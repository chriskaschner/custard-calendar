/**
 * In-memory per-isolate rate limiter.
 *
 * Replaces the previous KV-backed approach to avoid burning KV read/write
 * quota on rate limit bookkeeping. Counters reset on Worker cold start,
 * which is acceptable — isolates persist for minutes-to-hours, providing
 * sufficient burst protection.
 */

/** @type {Map<string, {count: number, expiresAt: number}>} */
const counters = new Map();

/**
 * Get client IP from Cloudflare header with safe fallback.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Probabilistic cleanup of expired entries to prevent unbounded Map growth.
 */
function maybeCleanup() {
  if (counters.size < 500 || Math.random() > 0.02) return;
  const now = Date.now();
  for (const [key, entry] of counters) {
    if (now >= entry.expiresAt) counters.delete(key);
  }
}

/**
 * Apply a per-IP fixed-window rate limit using in-memory counters.
 *
 * @param {Object} options
 * @param {Request} options.request
 * @param {Object} [options.kv] - Ignored (kept for backward compatibility)
 * @param {Object} options.corsHeaders
 * @param {string} options.prefix - key prefix, e.g. "rl:events"
 * @param {number} options.limit - max requests in the window
 * @param {number} [options.windowSeconds=3600] - window duration in seconds
 * @param {string} options.error - user-facing error message
 * @returns {Promise<Response|null>} 429 response when limited, otherwise null
 */
export async function applyIpRateLimit({
  request,
  kv,          // eslint-disable-line no-unused-vars -- backward compat
  corsHeaders,
  prefix,
  limit,
  windowSeconds = 3600,
  error,
}) {
  maybeCleanup();

  const ip = getClientIp(request);
  const bucket = new Date().toISOString().slice(0, 13);
  const key = `${prefix}:${ip}:${bucket}`;
  const now = Date.now();

  const entry = counters.get(key);

  if (!entry || now >= entry.expiresAt) {
    counters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return null;
  }

  if (entry.count >= limit) {
    return Response.json(
      { error },
      { status: 429, headers: corsHeaders },
    );
  }

  entry.count++;
  return null;
}

// ---------------------------------------------------------------------------
// Test helpers (underscore-prefixed — not part of the public API)
// ---------------------------------------------------------------------------

/** Reset all in-memory rate limit state. */
export function _resetRateLimitState() {
  counters.clear();
}

/** Pre-seed a rate limit counter for testing. */
export function _seedRateLimitCounter(key, count, windowSeconds = 3600) {
  counters.set(key, { count, expiresAt: Date.now() + windowSeconds * 1000 });
}
