/**
 * Cloudflare Worker entry point for Culver's FOTD calendar service.
 *
 * Serves subscribable .ics calendar files based on URL query parameters:
 *   GET /calendar.ics?primary=mt-horeb&secondary=madison-todd-drive,middleton
 *
 * Flavor data is cached in KV with 24h TTL. The .ics response includes
 * cache headers so Cloudflare's edge cache absorbs repeated requests.
 */

import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { BRAND_COLORS, SIMILARITY_GROUPS, FLAVOR_FAMILIES } from './flavor-matcher.js';
import { handleAlertRoute } from './alert-routes.js';
import { handleFlavorCatalog } from './flavor-catalog.js';
import { handleMetricsRoute, handleGeoEDA } from './metrics.js';
import { handleFlavorStats } from './flavor-stats.js';
import { handleForecast } from './forecast.js';
import { handleQuizRoute } from './quiz-routes.js';
import { handleEventsRoute } from './events.js';
import { handleTriviaRoute } from './trivia.js';
import { handleLeaderboardRoute } from './leaderboard.js';
import { handleSocialCard } from './social-card.js';
import { BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS, CONE_COLORS, FLAVOR_PROFILES, getFlavorProfile, renderConeSVG } from './flavor-colors.js';
import { checkAlerts, checkWeeklyDigests } from './alert-checker.js';
import { sendWeeklyAnalyticsReport } from './report-sender.js';
import { resolveSnapshotTargets, getCronCursor, setCronCursor } from './snapshot-targets.js';
import { handleReliabilityRoute, getReliabilityBatch, refreshReliabilityBatch } from './reliability.js';
import { handlePlan } from './planner.js';
import { handleSignals } from './signals.js';
import { isValidSlug } from './slug-validation.js';
import { getFetcherForSlug, getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';
import { handleCalendar } from './route-calendar.js';
import { handleApiToday } from './route-today.js';
import { handleApiNearbyFlavors } from './route-nearby.js';
import { applyIpRateLimit } from './rate-limit.js';

const CACHE_MAX_AGE = 3600; // 1 hour (browser + edge cache)
const API_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const PUBLIC_WRITE_DEFAULT_ORIGINS = [
  'https://custard.chriskaschner.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const ADMIN_EXACT_ROUTES = new Set([
  '/api/events/summary',
  '/api/quiz/personality-index',
  '/api/analytics/geo-eda',
  '/api/metrics/accuracy',
]);

/**
 * Parse comma-separated origin lists from env.
 */
function parseOriginList(raw, fallback = []) {
  if (!raw || typeof raw !== 'string') return fallback;
  const parsed = raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function originAllowed(origin, allowlist) {
  return allowlist.some(allowed => origin.startsWith(allowed));
}

function isAdminRoute(canonical) {
  if (ADMIN_EXACT_ROUTES.has(canonical)) return true;
  return /^\/api\/metrics\/accuracy\/[^/]+$/.test(canonical);
}

function isPublicWriteRoute(canonical, method) {
  return method === 'POST' && (
    canonical === '/api/events'
    || canonical === '/api/quiz/events'
  );
}

function getPublicWriteLimitConfig(canonical) {
  if (canonical === '/api/events') {
    return {
      prefix: 'rl:events:write',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 event writes per hour.',
    };
  }
  if (canonical === '/api/quiz/events') {
    return {
      prefix: 'rl:quiz:write',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 quiz event writes per hour.',
    };
  }
  return null;
}

function getExpensiveReadLimitConfig(canonical, method) {
  if (method !== 'GET') return null;
  if (canonical.startsWith('/og/')) {
    return {
      prefix: 'rl:og',
      limit: 60,
      error: 'Rate limit exceeded. Max 60 /og/ requests per hour.',
    };
  }
  if (canonical.startsWith('/api/metrics/')) {
    return {
      prefix: 'rl:metrics:read',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 metrics requests per hour.',
    };
  }
  if (/^\/api\/forecast\/[a-z0-9][a-z0-9_-]+$/.test(canonical)) {
    return {
      prefix: 'rl:forecast:read',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 forecast requests per hour.',
    };
  }
  if (/^\/api\/flavor-stats\/[^/]+$/.test(canonical)) {
    return {
      prefix: 'rl:flavor-stats:read',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 flavor-stats requests per hour.',
    };
  }
  if (canonical.startsWith('/api/signals/')) {
    return {
      prefix: 'rl:signals:read',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 signals requests per hour.',
    };
  }
  if (canonical === '/api/plan') {
    return {
      prefix: 'rl:plan:read',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 plan requests per hour.',
    };
  }
  return null;
}

/**
 * Check admin access token.
 * Uses ADMIN_ACCESS_TOKEN (preferred) with ACCESS_TOKEN as fallback.
 */
function checkAdminAccess(request, env) {
  const required = env.ADMIN_ACCESS_TOKEN || env.ACCESS_TOKEN;
  if (!required) {
    return {
      ok: false,
      status: 503,
      error: 'Admin endpoint unavailable: ADMIN_ACCESS_TOKEN not configured.',
    };
  }
  const authHeader = request.headers.get('Authorization');
  const match = authHeader ? authHeader.match(/^Bearer\s+(\S+)$/i) : null;
  if (match && match[1] === required) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 403,
    error: 'Invalid or missing admin access token.',
  };
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

async function withRequestIdInServerErrorBody(response, requestId) {
  if (!response || response.status < 500) return response;
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) return response;
  try {
    const payload = await response.clone().json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return response;
    if (payload.request_id) return response;
    const headers = new Headers(response.headers);
    return new Response(
      JSON.stringify({ ...payload, request_id: requestId }),
      { status: response.status, statusText: response.statusText, headers },
    );
  } catch {
    return response;
  }
}

export { isValidSlug } from './slug-validation.js';
export { getFetcherForSlug, getBrandForSlug } from './brand-registry.js';
export { getFlavorsCached } from './kv-cache.js';

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
  const requestId = request.headers.get('CF-Ray') || crypto.randomUUID();
  env._requestId = requestId;
  const requestOrigin = request.headers.get('Origin') || '';
  const configuredOrigin = env.ALLOWED_ORIGIN || 'https://custard.chriskaschner.com';
  // Allow configured origin + localhost for development
  let allowedOrigin = configuredOrigin;
  if (configuredOrigin !== '*' && /^https?:\/\/localhost(:\d+)?$/.test(requestOrigin)) {
    allowedOrigin = requestOrigin;
  }
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'X-Request-ID',
    'X-Request-ID': requestId,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': API_CSP,
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Normalize versioned paths: /api/v1/X → /api/X, /v1/X → /X
  const { canonical, isVersioned } = normalizePath(url.pathname);

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

    // O2/O3/O4 + X1 sanitizer anomaly count (non-fatal; default 0)
    const today = new Date().toISOString().slice(0, 10);
    let parseFailuresToday = 0;
    let snapshotErrorsToday = 0;
    let emailErrorsToday = 0;
    let payloadAnomaliesToday = 0;
    if (env.FLAVOR_CACHE) {
      try {
        const pfRaw = await env.FLAVOR_CACHE.get(`meta:parse-fail-count:${today}`);
        parseFailuresToday = pfRaw ? parseInt(pfRaw, 10) : 0;
        const seRaw = await env.FLAVOR_CACHE.get(`meta:snapshot-errors:${today}`);
        snapshotErrorsToday = seRaw ? parseInt(seRaw, 10) : 0;
        const eeRaw = await env.FLAVOR_CACHE.get(`meta:email-errors:${today}`);
        emailErrorsToday = eeRaw ? parseInt(eeRaw, 10) : 0;
        const paRaw = await env.FLAVOR_CACHE.get(`meta:payload-anomaly-count:${today}`);
        payloadAnomaliesToday = paRaw ? parseInt(paRaw, 10) : 0;
      } catch { /* counter reads are best-effort */ }
    }

    return Response.json(
      {
        status: degraded ? 'degraded' : 'ok',
        timestamp: new Date().toISOString(),
        checks,
        parse_failures_today: parseFailuresToday,
        snapshot_errors_today: snapshotErrorsToday,
        email_errors_today: emailErrorsToday,
        payload_anomalies_today: payloadAnomaliesToday,
      },
      { headers: corsHeaders }
    );
  }

  // Public write routes stay open, but browser origins are restricted and
  // all writes are per-IP rate limited.
  if (isPublicWriteRoute(canonical, request.method)) {
    const allowlist = parseOriginList(env.PUBLIC_WRITE_ALLOWED_ORIGINS, PUBLIC_WRITE_DEFAULT_ORIGINS);
    if (requestOrigin && !originAllowed(requestOrigin, allowlist)) {
      return Response.json(
        { error: 'Forbidden', request_id: requestId },
        { status: 403, headers: corsHeaders },
      );
    }

    const writeLimit = getPublicWriteLimitConfig(canonical);
    if (writeLimit) {
      const writeLimited = await applyIpRateLimit({
        request,
        kv: env.FLAVOR_CACHE,
        corsHeaders,
        prefix: writeLimit.prefix,
        limit: writeLimit.limit,
        error: writeLimit.error,
      });
      if (writeLimited) return writeLimited;
    }
  }

  // Admin-only analytics routes require ADMIN_ACCESS_TOKEN bearer auth.
  if (isAdminRoute(canonical)) {
    const admin = checkAdminAccess(request, env);
    if (!admin.ok) {
      return Response.json(
        { error: admin.error, request_id: requestId },
        { status: admin.status, headers: corsHeaders },
      );
    }
  }

  // Per-IP rate limits for expensive public read routes.
  const readLimit = getExpensiveReadLimitConfig(canonical, request.method);
  if (readLimit) {
    const readLimited = await applyIpRateLimit({
      request,
      kv: env.FLAVOR_CACHE,
      corsHeaders,
      prefix: readLimit.prefix,
      limit: readLimit.limit,
      error: readLimit.error,
    });
    if (readLimited) return readLimited;
  }

  if (request.method === 'GET' && canonical.startsWith('/api/alerts/')) {
    // Alert links are token-gated per-subscriber and should not be brute-forced.
    const alertsLimited = await applyIpRateLimit({
      request,
      kv: env.FLAVOR_CACHE,
      corsHeaders,
      prefix: 'rl:alerts:read',
      limit: 120,
      error: 'Rate limit exceeded. Max 120 alert token requests per hour.',
    });
    if (alertsLimited) return alertsLimited;
  }

  // Route on canonical path, then tag with API-Version if versioned
  let response;

  if (canonical === '/calendar.ics') {
    response = await handleCalendar(url, env, corsHeaders, fetchFlavorsFn);
  } else if (canonical === '/api/flavors/catalog') {
    // Must match before /api/flavors to avoid prefix collision
    response = await handleFlavorCatalog(env, corsHeaders);
  } else if (canonical === '/api/flavor-config') {
    response = handleFlavorConfig(corsHeaders);
  } else if (canonical === '/api/flavor-colors') {
    response = handleFlavorColors(corsHeaders);
  } else if (canonical === '/api/schema') {
    response = handleApiSchema(corsHeaders);
  } else if (canonical === '/api/today') {
    response = await handleApiToday(url, env, corsHeaders, fetchFlavorsFn);
  } else if (canonical === '/api/flavors') {
    response = await handleApiFlavors(url, env, corsHeaders, fetchFlavorsFn);
  } else if (canonical === '/api/stores') {
    response = await handleApiStores(url, env, corsHeaders);
  } else if (canonical === '/api/geolocate') {
    response = await handleApiGeolocate(request, corsHeaders);
  } else if (canonical === '/api/nearby-flavors') {
    response = await handleApiNearbyFlavors(request, url, env, corsHeaders);
  } else if (canonical.startsWith('/api/events')) {
    const eventsResponse = await handleEventsRoute(canonical, url, request, env, corsHeaders);
    if (eventsResponse) {
      response = eventsResponse;
    }
  } else if (canonical.startsWith('/api/trivia')) {
    const triviaResponse = await handleTriviaRoute(canonical, url, request, env, corsHeaders);
    if (triviaResponse) {
      response = triviaResponse;
    }
  } else if (canonical.startsWith('/api/quiz/')) {
    const quizResponse = await handleQuizRoute(canonical, url, request, env, corsHeaders);
    if (quizResponse) {
      response = quizResponse;
    }
  } else if (canonical.match(/^\/api\/forecast\/[a-z0-9][a-z0-9_-]+$/)) {
    const forecastSlug = canonical.replace('/api/forecast/', '');
    response = await handleForecast(forecastSlug, env, corsHeaders);
  } else if (canonical.match(/^\/api\/flavor-stats\/([^/]+)$/)) {
    const statsSlug = canonical.match(/^\/api\/flavor-stats\/([^/]+)$/)[1];
    response = await handleFlavorStats(request, env, decodeURIComponent(statsSlug));
  } else if (canonical.startsWith('/api/metrics/')) {
    const metricsResponse = await handleMetricsRoute(canonical, env, corsHeaders, url);
    if (metricsResponse) {
      response = metricsResponse;
    }
  } else if (canonical === '/api/analytics/geo-eda') {
    response = await handleGeoEDA(url, env, corsHeaders);
  } else if (canonical.startsWith('/api/leaderboard/')) {
    const leaderboardResponse = await handleLeaderboardRoute(canonical, url, request, env, corsHeaders);
    if (leaderboardResponse) {
      response = leaderboardResponse;
    }
  } else if (canonical === '/api/plan') {
    response = await handlePlan(url, env, corsHeaders);
  } else if (canonical.startsWith('/api/signals/')) {
    response = await handleSignals(url, env, corsHeaders);
  } else if (canonical.startsWith('/api/reliability')) {
    const reliabilityResponse = await handleReliabilityRoute(canonical, env, corsHeaders);
    if (reliabilityResponse) {
      response = reliabilityResponse;
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
    const enriched = await withRequestIdInServerErrorBody(response, requestId);
    return addVersionHeaders(enriched, isVersioned);
  }

  return Response.json(
    {
      error: 'Not found. Use /api/v1/today, /api/v1/flavors, /api/v1/stores, /api/v1/geolocate, /api/v1/nearby-flavors, /api/v1/flavors/catalog, /api/v1/flavor-config, /api/v1/flavor-colors, /api/v1/flavor-stats/{slug}, /api/v1/forecast/{slug}, /api/v1/reliability, /api/v1/reliability/{slug}, /api/v1/plan, /api/v1/signals/{slug}, /api/v1/events, /api/v1/events/summary, /api/v1/trivia, /api/v1/metrics/intelligence, /api/v1/metrics/context/flavor/{name}, /api/v1/metrics/context/store/{slug}, /api/v1/metrics/flavor/{name}, /api/v1/metrics/store/{slug}, /api/v1/metrics/trending, /api/v1/metrics/accuracy, /api/v1/metrics/accuracy/{slug}, /api/v1/metrics/coverage, /api/v1/metrics/flavor-hierarchy, /api/v1/metrics/health/{slug}, /api/v1/analytics/geo-eda, /api/v1/quiz/events, /api/v1/quiz/personality-index, /api/v1/alerts/*, /v1/calendar.ics, /v1/og/{slug}/{date}.svg, or /health',
      request_id: requestId,
    },
    { status: 404, headers: corsHeaders }
  );
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
      { status: 502, headers: corsHeaders }
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

/**
 * Handle GET /api/flavor-config requests.
 * Returns shared config constants to keep browser/server flavor logic in sync.
 */
function handleFlavorConfig(corsHeaders) {
  return Response.json({
    brand_colors: BRAND_COLORS,
    similarity_groups: SIMILARITY_GROUPS,
    flavor_families: FLAVOR_FAMILIES,
  }, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=86400', // 24h
    },
  });
}

/**
 * Handle GET /api/flavor-colors requests.
 * Returns the canonical flavor color system for custard visualization.
 */
function handleFlavorColors(corsHeaders) {
  return Response.json({
    profiles: FLAVOR_PROFILES,
    base_colors: BASE_COLORS,
    ribbon_colors: RIBBON_COLORS,
    topping_colors: TOPPING_COLORS,
    cone_colors: CONE_COLORS,
  }, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=86400', // 24h
    },
  });
}

/**
 * Handle GET /api/schema requests.
 * Returns the machine-readable API contract for v1 endpoints.
 * Consumers (custard-tidbyt, custard-scriptable) can use schema_version
 * to detect breaking changes before they manifest as runtime errors.
 */
function handleApiSchema(corsHeaders) {
  const schema = {
    schema_version: 1,
    description: 'Custard Calendar Worker API v1 contract. Bump schema_version on any breaking change to a required field.',
    endpoints: {
      '/api/v1/flavors': {
        method: 'GET',
        params: { slug: 'store slug (required)' },
        required_response_fields: ['name', 'flavors'],
        flavors_item_required: ['title', 'date'],
      },
      '/api/v1/today': {
        method: 'GET',
        params: { slug: 'store slug (required)' },
        required_response_fields: ['store', 'slug', 'brand', 'date', 'flavor'],
      },
      '/api/v1/stores': {
        method: 'GET',
        params: { q: 'search query, min 2 chars (required)' },
        required_response_fields: ['stores'],
        stores_item_required: ['slug', 'name'],
      },
    },
  };
  return Response.json(schema, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=86400', // 24h
    },
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
    const fetchFn = async (slug, kv) => getFlavorsCached(slug, kv, defaultFetchFlavors, false, env);
    const start = Date.now();

    // Monday 2 PM UTC cron → weekly analytics report email
    const isAnalyticsReport = event.cron === '0 14 * * 1';
    // Sunday 2 PM UTC cron → weekly digest for weekly subscribers
    const isWeekly = event.cron === '0 14 * * 7';
    const handler = isAnalyticsReport ? 'analytics_report' : isWeekly ? 'weekly_digest' : 'daily_alerts';

    const run = async () => {
      const result = isAnalyticsReport
        ? await sendWeeklyAnalyticsReport(env)
        : isWeekly
          ? await checkWeeklyDigests(env, fetchFn)
          : await checkAlerts(env, fetchFn);

      // Phase 2 + 3: Snapshot harvest and reliability refresh (skip on analytics report cron)
      if (isAnalyticsReport) return result;

      // Phase 2: Snapshot harvest (independent of email config)
      try {
        const targets = await resolveSnapshotTargets(env.DB, env.FLAVOR_CACHE);
        const alreadyFetched = result?.fetchedSlugs || new Set();
        const toHarvest = targets.filter(s => !alreadyFetched.has(s));

        const BATCH_SIZE = 50;
        const cursor = await getCronCursor(env.DB, 'snapshot_harvest');
        const batch = toHarvest.slice(cursor, cursor + BATCH_SIZE);

        for (const slug of batch) {
          try {
            await getFlavorsCached(slug, env.FLAVOR_CACHE, defaultFetchFlavors, false, env, { recordOnHit: true });
          } catch (err) {
            console.error(`Snapshot harvest failed for ${slug}: ${err.message}`);
          }
        }

        const next = cursor + batch.length >= toHarvest.length ? 0 : cursor + batch.length;
        await setCronCursor(env.DB, 'snapshot_harvest', next);
      } catch (err) {
        console.error(`Snapshot harvest phase failed: ${err.message}`);
      }

      // Phase 3: Reliability index refresh (25 stores per tick)
      try {
        const relCursor = await getCronCursor(env.DB, 'reliability_refresh');
        const { slugs: relBatch, nextCursor: relNext } = await getReliabilityBatch(env.DB, 25, relCursor);
        if (relBatch.length > 0) {
          await refreshReliabilityBatch(env.DB, relBatch);
        }
        await setCronCursor(env.DB, 'reliability_refresh', relNext);
      } catch (err) {
        console.error(`Reliability refresh phase failed: ${err.message}`);
      }

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
