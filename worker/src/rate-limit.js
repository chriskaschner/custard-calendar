import { safeKvPut } from './kv-cache.js';

/**
 * Get client IP from Cloudflare header with safe fallback.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Apply a simple per-IP fixed-window rate limit backed by KV.
 *
 * @param {Object} options
 * @param {Request} options.request
 * @param {Object|null} options.kv
 * @param {Object} options.corsHeaders
 * @param {string} options.prefix - key prefix, e.g. "rl:events"
 * @param {number} options.limit - max requests in the window
 * @param {number} [options.windowSeconds=3600] - window/TTL in seconds
 * @param {string} options.error - user-facing error message
 * @returns {Promise<Response|null>} 429 response when limited, otherwise null
 */
export async function applyIpRateLimit({
  request,
  kv,
  corsHeaders,
  prefix,
  limit,
  windowSeconds = 3600,
  error,
}) {
  const ip = getClientIp(request);
  // Hourly buckets keep key cardinality predictable for current limits.
  const bucket = new Date().toISOString().slice(0, 13);
  const key = `${prefix}:${ip}:${bucket}`;

  const raw = kv ? await kv.get(key) : null;
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= limit) {
    return Response.json(
      { error },
      { status: 429, headers: corsHeaders },
    );
  }

  await safeKvPut(kv, key, String(count + 1), { expirationTtl: windowSeconds });
  return null;
}
