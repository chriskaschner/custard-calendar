/**
 * Cloudflare Worker entry point for Culver's FOTD calendar service.
 *
 * Serves subscribable .ics calendar files based on URL query parameters:
 *   GET /calendar.ics?primary=mt-horeb&secondary=madison-todd-drive,middleton
 *
 * Flavor data is cached in KV with 24h TTL. The .ics response includes
 * cache headers so Cloudflare's edge cache absorbs repeated requests.
 */

import { generateIcs } from './ics-generator.js';
import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { normalize, matchesFlavor, findSimilarFlavors } from './flavor-matcher.js';

const KV_TTL_SECONDS = 86400; // 24 hours
const CACHE_MAX_AGE = 43200;  // 12 hours
const MAX_SECONDARY = 3;
const MAX_DAILY_FETCHES = 50;

// Reject slugs with invalid characters before checking allowlist (defense-in-depth)
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,59}$/;

/**
 * Check access token if one is configured.
 * Set ACCESS_TOKEN in wrangler.toml [vars] or as a secret to enable.
 * When not set, all requests are allowed (open access).
 */
function checkAccess(url, env) {
  const requiredToken = env.ACCESS_TOKEN;
  if (!requiredToken) return true; // no token configured = open access
  return url.searchParams.get('token') === requiredToken;
}

/**
 * Validate a slug against the regex pattern and the allowlist.
 * @param {string} slug
 * @param {Set<string>} validSlugs
 * @returns {{ valid: boolean, reason?: string }}
 */
export function isValidSlug(slug, validSlugs) {
  if (!slug) {
    return { valid: false, reason: 'Slug is empty' };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { valid: false, reason: 'Slug contains invalid characters' };
  }
  if (!validSlugs.has(slug)) {
    return { valid: false, reason: 'Unknown store slug' };
  }
  return { valid: true };
}

/**
 * Increment and check the daily upstream fetch counter.
 * Uses KV key `meta:fetch-count` with 24h TTL.
 * @returns {Promise<boolean>} true if under budget, false if exhausted
 */
async function checkFetchBudget(kv) {
  const raw = await kv.get('meta:fetch-count');
  const count = raw ? parseInt(raw, 10) : 0;
  return count < MAX_DAILY_FETCHES;
}

async function incrementFetchCount(kv) {
  const raw = await kv.get('meta:fetch-count');
  const count = raw ? parseInt(raw, 10) : 0;
  await kv.put('meta:fetch-count', String(count + 1), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

/**
 * Get flavor data for a store, checking KV cache first.
 * @param {string} slug
 * @param {Object} kv - KV namespace binding
 * @param {Function} fetchFlavorsFn - flavor fetcher function
 * @returns {Promise<{name: string, flavors: Array}>}
 */
async function getFlavorsCached(slug, kv, fetchFlavorsFn) {
  // Check KV cache
  const cached = await kv.get(`flavors:${slug}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Check daily fetch budget before making upstream request
  const withinBudget = await checkFetchBudget(kv);
  if (!withinBudget) {
    throw new Error('Daily upstream fetch limit reached. Try again later.');
  }

  // Cache miss: fetch from Culver's
  const data = await fetchFlavorsFn(slug);

  // Store in KV with TTL
  await kv.put(`flavors:${slug}`, JSON.stringify(data), {
    expirationTtl: KV_TTL_SECONDS,
  });

  // Increment fetch counter after successful fetch
  await incrementFetchCount(kv);

  return data;
}

/**
 * Handle an incoming request.
 * Exported for testing — Cloudflare Worker default export calls this.
 *
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker env bindings (FLAVOR_CACHE KV)
 * @param {Function} [fetchFlavorsFn] - injectable for testing
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env, fetchFlavorsFn = defaultFetchFlavors) {
  const url = new URL(request.url);
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Access control
  if (!checkAccess(url, env)) {
    return Response.json(
      { error: 'Invalid or missing access token' },
      { status: 403, headers: corsHeaders }
    );
  }

  // Health check
  if (url.pathname === '/health') {
    return Response.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { headers: corsHeaders }
    );
  }

  // Calendar endpoint
  if (url.pathname === '/calendar.ics') {
    return handleCalendar(url, env, corsHeaders, fetchFlavorsFn);
  }

  // Flavor data JSON endpoint
  if (url.pathname === '/api/flavors') {
    return handleApiFlavors(url, env, corsHeaders, fetchFlavorsFn);
  }

  // Store search JSON endpoint
  if (url.pathname === '/api/stores') {
    return handleApiStores(url, env, corsHeaders);
  }

  // IP-based geolocation endpoint (uses Cloudflare's request.cf)
  if (url.pathname === '/api/geolocate') {
    return handleApiGeolocate(request, corsHeaders);
  }

  // Nearby flavors endpoint (proxies Culver's locator API)
  if (url.pathname === '/api/nearby-flavors') {
    return handleApiNearbyFlavors(url, env, corsHeaders);
  }

  return Response.json(
    { error: 'Not found. Use /calendar.ics, /api/flavors, /api/stores, /api/geolocate, /api/nearby-flavors, or /health' },
    { status: 404, headers: corsHeaders }
  );
}

/**
 * Handle /calendar.ics requests.
 */
async function handleCalendar(url, env, corsHeaders, fetchFlavorsFn) {
  // Resolve the valid slugs set (allow test override)
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;

  // Parse and validate query params
  const primarySlug = url.searchParams.get('primary');
  if (!primarySlug) {
    return Response.json(
      { error: 'Missing required "primary" parameter. Usage: /calendar.ics?primary=<store-slug>' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate primary slug
  const primaryCheck = isValidSlug(primarySlug, validSlugs);
  if (!primaryCheck.valid) {
    return Response.json(
      { error: `Invalid primary store: ${primaryCheck.reason}` },
      { status: 400, headers: corsHeaders }
    );
  }

  const secondarySlugs = url.searchParams.get('secondary')
    ? url.searchParams.get('secondary').split(',').filter(Boolean)
    : [];

  if (secondarySlugs.length > MAX_SECONDARY) {
    return Response.json(
      { error: `Too many secondary stores. Maximum ${MAX_SECONDARY} allowed.` },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate all secondary slugs
  for (const slug of secondarySlugs) {
    const check = isValidSlug(slug, validSlugs);
    if (!check.valid) {
      return Response.json(
        { error: `Invalid secondary store "${slug}": ${check.reason}` },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // Fetch flavor data for all stores
  const stores = [];
  const flavorsBySlug = {};

  try {
    // Fetch primary
    const primaryData = await getFlavorsCached(primarySlug, env.FLAVOR_CACHE, fetchFlavorsFn);
    stores.push({ slug: primarySlug, name: primaryData.name, address: primaryData.address || '', role: 'primary' });
    flavorsBySlug[primarySlug] = primaryData.flavors;

    // Fetch secondaries
    for (const slug of secondarySlugs) {
      const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn);
      stores.push({ slug, name: data.name, address: data.address || '', role: 'secondary' });
      flavorsBySlug[slug] = data.flavors;
    }
  } catch (err) {
    return Response.json(
      { error: `Failed to fetch flavor data: ${err.message}` },
      { status: 400, headers: corsHeaders }
    );
  }

  // Generate .ics
  const calendarName = `Culver's FOTD - ${stores[0].name}`;
  const ics = generateIcs({ calendarName, stores, flavorsBySlug });

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      'Content-Disposition': 'inline; filename="custard-calendar.ics"',
    },
  });
}

/**
 * Handle /api/flavors?slug=<slug> requests.
 * Returns JSON flavor data for a single store, reusing the same
 * KV-cached fetch pipeline as the calendar endpoint.
 */
async function handleApiFlavors(url, env, corsHeaders, fetchFlavorsFn) {
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;

  const slug = url.searchParams.get('slug');
  if (!slug) {
    return Response.json(
      { error: 'Missing required "slug" parameter. Usage: /api/flavors?slug=<store-slug>' },
      { status: 400, headers: corsHeaders }
    );
  }

  const check = isValidSlug(slug, validSlugs);
  if (!check.valid) {
    return Response.json(
      { error: `Invalid store: ${check.reason}` },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn);
    return Response.json(data, {
      headers: {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to fetch flavor data: ${err.message}` },
      { status: 400, headers: corsHeaders }
    );
  }
}

/**
 * Handle /api/stores?q=<query> requests.
 * Searches the in-memory store index. No KV reads, no upstream fetches.
 */
function handleApiStores(url, env, corsHeaders) {
  const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
  const query = (url.searchParams.get('q') || '').toLowerCase().trim();
  const MAX_RESULTS = 25;

  // Require at least 2 characters for search
  if (query.length < 2) {
    return Response.json(
      { stores: [] },
      { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=86400' } }
    );
  }

  const matches = [];
  for (const store of storeIndex) {
    const searchable = `${store.name} ${store.city} ${store.state} ${store.slug}`.toLowerCase();
    if (searchable.includes(query)) {
      matches.push(store);
      if (matches.length >= MAX_RESULTS) break;
    }
  }

  return Response.json(
    { stores: matches },
    { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=86400' } }
  );
}

/**
 * Handle /api/geolocate requests.
 * Returns the user's approximate location from Cloudflare's request.cf object.
 * Response is per-user (IP-based) so uses private, no-store cache control.
 */
function handleApiGeolocate(request, corsHeaders) {
  const cf = request.cf || {};
  return Response.json({
    state: cf.regionCode || null,   // ISO 3166-2 code, e.g. "WI"
    stateName: cf.region || null,   // Full name, e.g. "Wisconsin"
    city: cf.city || null,          // e.g. "Madison"
    country: cf.country || null,    // e.g. "US"
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' },
  });
}

const LOCATOR_CACHE_TTL = 3600; // 1 hour
const NEARBY_CACHE_MAX_AGE = 3600; // 1 hour

/**
 * Handle /api/nearby-flavors?location=<zip>&flavor=<name>&limit=<n> requests.
 * Proxies to Culver's locator API server-side (bypasses CORS), caches in KV,
 * and optionally filters/ranks by flavor match + similarity.
 */
async function handleApiNearbyFlavors(url, env, corsHeaders) {
  const location = url.searchParams.get('location');
  if (!location || !location.trim()) {
    return Response.json(
      { error: 'Missing required "location" parameter. Usage: /api/nearby-flavors?location=<zip|city|lat,lon>' },
      { status: 400, headers: corsHeaders }
    );
  }

  const flavorQuery = url.searchParams.get('flavor') || '';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 50, 1), 100);

  // Check KV cache for this location+limit combo
  const kv = env.FLAVOR_CACHE;
  const cacheKey = `locator:${location.trim().toLowerCase()}:${limit}`;
  let locatorData;

  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    locatorData = JSON.parse(cached);
  } else {
    // Fetch from Culver's locator API
    const locatorUrl = `https://www.culvers.com/api/locator/getLocations?location=${encodeURIComponent(location.trim())}&limit=${limit}`;
    let resp;
    const fetchFn = env._fetchOverride || globalThis.fetch;
    try {
      resp = await fetchFn(locatorUrl);
    } catch (err) {
      return Response.json(
        { error: `Failed to reach Culver's locator API: ${err.message}` },
        { status: 502, headers: corsHeaders }
      );
    }

    if (!resp.ok) {
      return Response.json(
        { error: `Culver's locator API returned ${resp.status}` },
        { status: 502, headers: corsHeaders }
      );
    }

    locatorData = await resp.json();

    // Cache in KV
    if (kv) {
      await kv.put(cacheKey, JSON.stringify(locatorData), {
        expirationTtl: LOCATOR_CACHE_TTL,
      });
    }
  }

  // Transform locator response into our format
  const stores = transformLocatorData(locatorData);

  // Build response
  const allFlavorsToday = [...new Set(stores.map(s => s.flavor).filter(Boolean))].sort();
  let matches = [];
  let nearby = [];
  let suggestions = [];

  if (flavorQuery.trim()) {
    for (const store of stores) {
      if (matchesFlavor(store.flavor, flavorQuery, store.description)) {
        matches.push(store);
      } else {
        nearby.push(store);
      }
    }

    // Build suggestions from similarity groups
    const similarNormalized = findSimilarFlavors(flavorQuery, allFlavorsToday);
    const suggestionMap = new Map();

    for (const normName of similarNormalized) {
      // Find the original-cased name from stores
      for (const store of nearby) {
        if (normalize(store.flavor) === normName) {
          if (!suggestionMap.has(normName)) {
            suggestionMap.set(normName, { flavor: store.flavor, count: 0, closest_rank: Infinity });
          }
          const entry = suggestionMap.get(normName);
          entry.count++;
          entry.closest_rank = Math.min(entry.closest_rank, store.rank);
          break; // only need one for the name
        }
      }
      // Count additional stores
      if (suggestionMap.has(normName)) {
        const entry = suggestionMap.get(normName);
        entry.count = nearby.filter(s => normalize(s.flavor) === normName).length;
        entry.closest_rank = Math.min(...nearby.filter(s => normalize(s.flavor) === normName).map(s => s.rank));
      }
    }

    suggestions = [...suggestionMap.values()].sort((a, b) => a.closest_rank - b.closest_rank);
  } else {
    // No flavor filter — all stores go in nearby
    nearby = stores;
  }

  return Response.json({
    query: { location: location.trim(), flavor: flavorQuery.trim() || null },
    matches,
    nearby,
    suggestions,
    all_flavors_today: allFlavorsToday,
  }, {
    headers: {
      ...corsHeaders,
      'Cache-Control': `public, max-age=${NEARBY_CACHE_MAX_AGE}`,
    },
  });
}

/**
 * Transform Culver's locator API response into our store format.
 * The locator API returns geofences with restaurant details.
 * @param {Object} data - Raw locator API response
 * @returns {Array<{slug: string, name: string, address: string, lat: number, lon: number, flavor: string, description: string, rank: number}>}
 */
function transformLocatorData(data) {
  const geofences = data?.data?.geofences || [];
  return geofences.map((g, i) => {
    const meta = g.metadata || {};
    const slug = meta.slug || '';
    const city = meta.city || '';
    const state = meta.state || '';
    const street = meta.street || '';
    return {
      slug,
      name: city && state ? `${city}, ${state}` : city || slug,
      address: street,
      lat: g.geometryCenter?.coordinates?.[1] || 0,
      lon: g.geometryCenter?.coordinates?.[0] || 0,
      flavor: meta.flavorOfDayName || '',
      description: meta.flavorOfTheDayDescription || '',
      rank: i + 1,
    };
  });
}

// Cloudflare Worker default export
export default {
  async fetch(request, env, ctx) {
    // Only cache GET requests to /calendar.ics
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/calendar.ics') {
      const cache = caches.default;
      const cacheKey = request;

      // Check edge cache first
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Cache miss — handle request normally
      const response = await handleRequest(request, env);

      // Only cache successful responses
      if (response.status === 200) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    }

    return handleRequest(request, env);
  },
};
