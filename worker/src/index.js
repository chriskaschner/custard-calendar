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
import { recordSnapshots } from './snapshot-writer.js';
import { handleAlertRoute } from './alert-routes.js';
import { handleFlavorCatalog } from './flavor-catalog.js';
import { handleMetricsRoute } from './metrics.js';
import { handleForecast } from './forecast.js';
import { handleSocialCard } from './social-card.js';
import { checkAlerts, checkWeeklyDigests } from './alert-checker.js';

import { fetchKoppsFlavors } from './kopp-fetcher.js';
import { fetchGillesFlavors } from './gilles-fetcher.js';
import { fetchHefnersFlavors } from './hefners-fetcher.js';
import { fetchKraverzFlavors } from './kraverz-fetcher.js';
import { fetchOscarsFlavors } from './oscars-fetcher.js';

const KV_TTL_SECONDS = 86400; // 24 hours
const CACHE_MAX_AGE = 3600;   // 1 hour (browser + edge cache)
const MAX_SECONDARY = 3;
const FLAVOR_CACHE_RECORD_VERSION = 1;

// Reject slugs with invalid characters before checking allowlist (defense-in-depth)
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,59}$/;

/**
 * Brand registry — maps slug patterns to fetcher functions + metadata.
 * MKE custard brands get explicit entries; Culver's is the default.
 */
const BRAND_REGISTRY = [
  { pattern: /^kopps-/, fetcher: fetchKoppsFlavors, url: 'https://www.kopps.com/flavor-forecast', brand: "Kopp's", kvPrefix: 'flavors:kopps-shared' },
  { pattern: /^gilles$/, fetcher: fetchGillesFlavors, url: 'https://gillesfrozencustard.com/flavor-of-the-day', brand: "Gille's" },
  { pattern: /^hefners$/, fetcher: fetchHefnersFlavors, url: 'https://www.hefnerscustard.com', brand: "Hefner's" },
  { pattern: /^kraverz$/, fetcher: fetchKraverzFlavors, url: 'https://kraverzcustard.com/FlavorSchedule', brand: 'Kraverz' },
  { pattern: /^oscars/, fetcher: fetchOscarsFlavors, url: 'https://www.oscarscustard.com/index.php/flavors/', brand: "Oscar's", kvPrefix: 'flavors:oscars-shared' },
];

/**
 * Get fetcher + brand metadata for a slug.
 * Returns default Culver's fetcher when no MKE brand matches.
 */
export function getFetcherForSlug(slug, fallbackFetcher = defaultFetchFlavors) {
  for (const entry of BRAND_REGISTRY) {
    if (entry.pattern.test(slug)) {
      return { fetcher: entry.fetcher, url: entry.url, brand: entry.brand, kvPrefix: entry.kvPrefix || null };
    }
  }
  return { fetcher: fallbackFetcher, url: `https://www.culvers.com/restaurants/${slug}`, brand: "Culver's", kvPrefix: null };
}

/**
 * Get the brand name for a slug.
 */
export function getBrandForSlug(slug) {
  return getFetcherForSlug(slug).brand;
}

/**
 * Generate fallback flavor events when scraping fails for a store.
 * @param {string} slug
 * @param {string[]} [dates] - dates to cover (defaults to today)
 */
function makeFallbackFlavors(slug, dates) {
  const { url, brand } = getFetcherForSlug(slug);
  if (!dates || dates.length === 0) {
    dates = [new Date().toISOString().slice(0, 10)];
  }
  return {
    name: slug,
    address: '',
    flavors: dates.map(date => ({
      date,
      title: `See ${brand} website for today's flavor`,
      description: `Visit ${url}`,
    })),
  };
}

/**
 * Check access token if one is configured.
 * Set ACCESS_TOKEN in wrangler.toml [vars] or as a secret to enable.
 * When not set, all requests are allowed (open access).
 *
 * Accepts:
 *   - Authorization: Bearer <token> header (preferred)
 *   - ?token=<token> query param (legacy fallback)
 */
function checkAccess(request, url, env) {
  const requiredToken = env.ACCESS_TOKEN;
  if (!requiredToken) return true; // no token configured = open access

  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);
    if (match && match[1] === requiredToken) return true;
  }

  // Fall back to query param
  return url.searchParams.get('token') === requiredToken;
}

/**
 * Normalize a request path, mapping versioned API paths to their canonical form.
 * Returns { canonical, isVersioned }.
 *
 * Versioned paths:
 *   /api/v1/flavors       → /api/flavors       (isVersioned: true)
 *   /v1/calendar.ics      → /calendar.ics       (isVersioned: true)
 * Legacy paths pass through unchanged:
 *   /api/flavors           → /api/flavors       (isVersioned: false)
 *   /calendar.ics          → /calendar.ics       (isVersioned: false)
 */
export function normalizePath(pathname) {
  if (pathname.startsWith('/api/v1/')) {
    return { canonical: '/api/' + pathname.slice('/api/v1/'.length), isVersioned: true };
  }
  if (pathname.startsWith('/v1/')) {
    return { canonical: '/' + pathname.slice('/v1/'.length), isVersioned: true };
  }
  return { canonical: pathname, isVersioned: false };
}

/**
 * Add standard versioned API headers to a response.
 */
function addVersionHeaders(response, isVersioned) {
  if (!isVersioned) return response;
  const headers = new Headers(response.headers);
  headers.set('API-Version', '1');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
 * KV writes should be best-effort only. Caller correctness cannot depend on put success.
 * @param {Object|null} kv - KV namespace binding
 * @param {string} key - KV key
 * @param {string} value - serialized payload
 * @param {Object} [options] - KV put options (expirationTtl, etc)
 * @returns {Promise<boolean>} true when write succeeded, false otherwise
 */
async function safeKvPut(kv, key, value, options = {}) {
  if (!kv) return false;
  try {
    await kv.put(key, value, options);
    return true;
  } catch (err) {
    console.error(`KV write failed for ${key}: ${err.message}`);
    return false;
  }
}

/**
 * Serialize a flavor-cache record with metadata for integrity checking.
 * Shared cache keys (e.g., Kopp's) do not embed a slug because one key serves many slugs.
 * @param {Object} data - Flavor payload
 * @param {string} slug - Requested slug
 * @param {boolean} isShared - true when a shared KV cache key is used
 */
function makeFlavorCacheRecord(data, slug, isShared) {
  return JSON.stringify({
    _meta: {
      v: FLAVOR_CACHE_RECORD_VERSION,
      shared: isShared,
      slug: isShared ? null : slug,
      cachedAt: new Date().toISOString(),
    },
    data,
  });
}

/**
 * Parse and validate flavor cache records. Returns null on corruption/mismatch.
 * For non-shared keys, legacy records are rejected so stale/bad entries self-heal.
 * @param {string} raw
 * @param {Object} options
 * @param {string} options.slug
 * @param {string} options.cacheKey
 * @param {boolean} options.isShared
 * @returns {Object|null}
 */
function parseFlavorCacheRecord(raw, { slug, cacheKey, isShared }) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON in cache key ${cacheKey}: ${err.message}`);
    return null;
  }

  const meta = parsed?._meta;
  if (meta && parsed.data && typeof meta === 'object') {
    if (meta.v !== FLAVOR_CACHE_RECORD_VERSION) {
      console.warn(`Ignoring unsupported cache record version for ${cacheKey}: ${meta.v}`);
      return null;
    }

    if (isShared) {
      if (!meta.shared) {
        console.error(`Cache metadata mismatch for ${cacheKey}: expected shared record`);
        return null;
      }
      return parsed.data;
    }

    if (meta.shared) {
      console.error(`Cache metadata mismatch for ${cacheKey}: expected slug-scoped record`);
      return null;
    }
    if (meta.slug !== slug) {
      console.error(`Cache mismatch for ${cacheKey}: expected slug=${slug}, got slug=${meta.slug}`);
      return null;
    }
    return parsed.data;
  }

  // Backward compatibility:
  // - Shared keys: accept legacy payloads temporarily to avoid cold misses.
  // - Slug-scoped keys: reject legacy payloads so old stale/corrupt values are refreshed.
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.flavors)) {
    if (isShared) return parsed;
    console.warn(`Rejecting legacy slug-scoped cache record for ${cacheKey}; refreshing from upstream`);
    return null;
  }

  return null;
}

/**
 * Get flavor data for a store, checking KV cache first.
 * Supports brand routing — MKE brands use their own fetchers and may share KV keys.
 * When fetchFlavorsFn is provided (tests), it overrides ALL brand fetchers.
 * @param {string} slug
 * @param {Object} kv - KV namespace binding
 * @param {Function} fetchFlavorsFn - override fetcher (when provided, overrides brand fetchers too)
 * @param {boolean} isOverride - true when fetchFlavorsFn should override brand routing
 * @param {Object} [env] - Full env for D1 access (optional)
 * @returns {Promise<{name: string, flavors: Array}>}
 */
export async function getFlavorsCached(slug, kv, fetchFlavorsFn, isOverride = false, env = {}) {
  const brandInfo = getFetcherForSlug(slug, fetchFlavorsFn);
  const cacheKey = brandInfo.kvPrefix || `flavors:${slug}`;
  const isShared = Boolean(brandInfo.kvPrefix);
  // When isOverride is true, use the provided fetcher for all brands (testing)
  const fetcher = isOverride ? fetchFlavorsFn : brandInfo.fetcher;

  // Check KV cache
  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    const parsed = parseFlavorCacheRecord(cached, { slug, cacheKey, isShared });
    if (parsed) return parsed;
  }

  // Cache miss: fetch from upstream
  const data = await fetcher(slug);

  // Store in KV with TTL (best-effort)
  const cacheRecord = makeFlavorCacheRecord(data, slug, isShared);
  await safeKvPut(kv, cacheKey, cacheRecord, {
    expirationTtl: KV_TTL_SECONDS,
  });

  // Persist flavor observations to D1 (durable historical source of truth)
  await recordSnapshots(null, slug, data, { db: env.DB || null, brand: brandInfo.brand });

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Normalize versioned paths: /api/v1/X → /api/X, /v1/X → /X
  const { canonical, isVersioned } = normalizePath(url.pathname);

  // Access control (supports both Bearer header and ?token= query param)
  if (!checkAccess(request, url, env)) {
    return Response.json(
      { error: 'Invalid or missing access token' },
      { status: 403, headers: corsHeaders }
    );
  }

  // Health check (unversioned — always public)
  if (canonical === '/health') {
    const checks = {};
    let degraded = false;

    // KV reachability
    try {
      if (env.FLAVOR_CACHE) {
        const ts = await env.FLAVOR_CACHE.get('meta:last-alert-run');
        checks.kv = { ok: true, last_alert_run: ts || null };
        if (ts) {
          const age = Date.now() - new Date(JSON.parse(ts).timestamp || ts).getTime();
          if (age > 25 * 60 * 60 * 1000) { checks.kv.stale = true; degraded = true; }
        }
      } else {
        checks.kv = { ok: false, error: 'not configured' }; degraded = true;
      }
    } catch { checks.kv = { ok: false }; degraded = true; }

    // D1 + latest cron run
    try {
      if (env.DB) {
        const row = await env.DB.prepare(
          'SELECT handler, ran_at, checked, sent, errors_count FROM cron_runs ORDER BY id DESC LIMIT 1'
        ).first();
        checks.d1 = { ok: true, last_cron: row || null };
        if (row && row.errors_count > 0) { checks.d1.has_errors = true; degraded = true; }
      } else {
        checks.d1 = { ok: false, error: 'not configured' };
      }
    } catch { checks.d1 = { ok: false }; degraded = true; }

    return Response.json(
      { status: degraded ? 'degraded' : 'ok', timestamp: new Date().toISOString(), checks },
      { headers: corsHeaders }
    );
  }

  // Route on canonical path, then tag with API-Version if versioned
  let response;

  if (canonical === '/calendar.ics') {
    response = await handleCalendar(url, env, corsHeaders, fetchFlavorsFn);
  } else if (canonical === '/api/flavors/catalog') {
    // Must match before /api/flavors to avoid prefix collision
    response = await handleFlavorCatalog(env, corsHeaders);
  } else if (canonical === '/api/today') {
    response = await handleApiToday(url, env, corsHeaders, fetchFlavorsFn);
  } else if (canonical === '/api/flavors') {
    response = await handleApiFlavors(url, env, corsHeaders, fetchFlavorsFn);
  } else if (canonical === '/api/stores') {
    response = await handleApiStores(url, env, corsHeaders);
  } else if (canonical === '/api/geolocate') {
    response = await handleApiGeolocate(request, corsHeaders);
  } else if (canonical === '/api/nearby-flavors') {
    response = await handleApiNearbyFlavors(url, env, corsHeaders);
  } else if (canonical.match(/^\/api\/forecast\/[a-z0-9][a-z0-9_-]+$/)) {
    const forecastSlug = canonical.replace('/api/forecast/', '');
    response = await handleForecast(forecastSlug, env, corsHeaders);
  } else if (canonical.startsWith('/api/metrics/')) {
    const metricsResponse = await handleMetricsRoute(canonical, env, corsHeaders);
    if (metricsResponse) {
      response = metricsResponse;
    }
  } else if (canonical.startsWith('/og/')) {
    const cardResponse = await handleSocialCard(canonical, env, corsHeaders);
    if (cardResponse) {
      response = cardResponse;
    }
  } else if (canonical.startsWith('/api/alerts/')) {
    // Rewrite url.pathname for alert-routes matching
    const alertUrl = isVersioned ? new URL(url) : url;
    if (isVersioned) alertUrl.pathname = canonical;
    const alertResponse = await handleAlertRoute(alertUrl, request, env, corsHeaders);
    if (alertResponse) {
      response = alertResponse;
    }
  }

  if (response) {
    return addVersionHeaders(response, isVersioned);
  }

  return Response.json(
    { error: 'Not found. Use /api/v1/today, /api/v1/flavors, /api/v1/stores, /api/v1/geolocate, /api/v1/nearby-flavors, /api/v1/flavors/catalog, /api/v1/forecast/{slug}, /api/v1/alerts/*, /v1/calendar.ics, /v1/og/{slug}/{date}.svg, or /health' },
    { status: 404, headers: corsHeaders }
  );
}

/**
 * Handle /calendar.ics requests.
 */
async function handleCalendar(url, env, corsHeaders, fetchFlavorsFn) {
  // When a custom fetcher is passed (testing), it overrides all brand routing
  const isOverride = fetchFlavorsFn !== defaultFetchFlavors;
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

  // Fetch flavor data for all stores (with per-store fallback)
  const stores = [];
  const flavorsBySlug = {};

  // Fetch primary — use fallback on failure
  try {
    const primaryData = await getFlavorsCached(primarySlug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
    const brandUrl = getFetcherForSlug(primarySlug, fetchFlavorsFn).url;
    stores.push({ slug: primarySlug, name: primaryData.name, address: primaryData.address || '', url: brandUrl, role: 'primary' });
    flavorsBySlug[primarySlug] = primaryData.flavors;
  } catch (err) {
    const fallback = makeFallbackFlavors(primarySlug);
    stores.push({ slug: primarySlug, name: fallback.name, address: '', url: getFetcherForSlug(primarySlug).url, role: 'primary' });
    flavorsBySlug[primarySlug] = fallback.flavors;
  }

  // Collect primary dates for secondary fallback coverage
  const primaryDates = (flavorsBySlug[primarySlug] || []).map(f => f.date);

  // Fetch secondaries — use fallback on failure
  for (const slug of secondarySlugs) {
    try {
      const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
      const brandUrl = getFetcherForSlug(slug, fetchFlavorsFn).url;
      stores.push({ slug, name: data.name, address: data.address || '', url: brandUrl, role: 'secondary' });
      flavorsBySlug[slug] = data.flavors;
    } catch (err) {
      const fallback = makeFallbackFlavors(slug, primaryDates);
      stores.push({ slug, name: fallback.name, address: '', url: getFetcherForSlug(slug).url, role: 'secondary' });
      flavorsBySlug[slug] = fallback.flavors;
    }
  }

  // Generate .ics with brand-aware calendar name
  const primaryBrand = getBrandForSlug(primarySlug);
  const calendarName = `${primaryBrand} FOTD - ${stores[0].name}`;
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
  const isOverride = fetchFlavorsFn !== defaultFetchFlavors;
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
    const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
    return Response.json(data, {
      headers: {
        ...corsHeaders,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch flavor data. Please try again later.' },
      { status: 400, headers: corsHeaders }
    );
  }
}

/**
 * Handle /api/today?slug=<slug> requests.
 * Returns today's single flavor for a store, with a pre-composed spoken sentence
 * for voice assistants (Siri Shortcuts, Alexa, etc.).
 */
async function handleApiToday(url, env, corsHeaders, fetchFlavorsFn) {
  const isOverride = fetchFlavorsFn !== defaultFetchFlavors;
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;

  const slug = url.searchParams.get('slug');
  if (!slug) {
    return Response.json(
      { error: 'Missing required "slug" parameter. Usage: /api/today?slug=<store-slug>' },
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
    const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
    const brand = getBrandForSlug(slug);
    const today = new Date().toISOString().slice(0, 10);

    // Find today's flavor (or fall back to the first available)
    const todayFlavor = data.flavors.find(f => f.date === today) || data.flavors[0] || null;

    if (!todayFlavor) {
      return Response.json({
        store: data.name,
        slug,
        brand,
        date: today,
        flavor: null,
        description: null,
        spoken: `I couldn't find today's flavor of the day at ${data.name}. Check back later.`,
      }, {
        headers: { ...corsHeaders, 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` },
      });
    }

    const flavorName = todayFlavor.title;
    const spoken = `Today's flavor of the day at ${data.name} ${brand} is ${flavorName}.`;

    return Response.json({
      store: data.name,
      slug,
      brand,
      date: todayFlavor.date,
      flavor: flavorName,
      description: todayFlavor.description || null,
      spoken,
    }, {
      headers: { ...corsHeaders, 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` },
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch flavor data. Please try again later.' },
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
        { error: 'Failed to reach upstream locator API. Please try again later.' },
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

    // Cache in KV (best-effort)
    await safeKvPut(kv, cacheKey, JSON.stringify(locatorData), {
      expirationTtl: LOCATOR_CACHE_TTL,
    });
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
    // Only cache GET requests to /calendar.ics (or /v1/calendar.ics)
    const url = new URL(request.url);
    const { canonical } = normalizePath(url.pathname);
    if (request.method === 'GET' && canonical === '/calendar.ics') {
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

  async scheduled(event, env, ctx) {
    const fetchFn = async (slug, kv) => getFlavorsCached(slug, kv, defaultFetchFlavors);
    const start = Date.now();

    // Sunday 2 PM UTC cron → weekly digest for weekly subscribers
    const isWeekly = event.cron === '0 14 * * 7';
    const handler = isWeekly ? 'weekly_digest' : 'daily_alerts';

    const run = async () => {
      const result = isWeekly
        ? await checkWeeklyDigests(env, fetchFn)
        : await checkAlerts(env, fetchFn);

      // Persist cron results to D1 for observability (O1)
      if (env.DB) {
        try {
          await env.DB.prepare(
            `INSERT INTO cron_runs (handler, ran_at, checked, sent, errors_count, errors_json, duration_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            handler,
            new Date().toISOString(),
            result.checked || 0,
            result.sent || 0,
            (result.errors || []).length,
            (result.errors || []).length > 0 ? JSON.stringify(result.errors) : null,
            Date.now() - start,
          ).run();
        } catch (err) {
          console.error(`Failed to persist cron result: ${err.message}`);
        }
      }

      return result;
    };

    ctx.waitUntil(run());
  },
};
