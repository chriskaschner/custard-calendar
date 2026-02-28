import { recordSnapshots } from './snapshot-writer.js';
import { getFetcherForSlug } from './brand-registry.js';

const KV_TTL_SECONDS = 86400; // 24 hours
const FLAVOR_CACHE_RECORD_VERSION = 1;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_TEXT_RE = /^[\p{L}\p{N}\s.,'’"&()!:+\-/%®™]*$/u;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_STORE_NAME_LENGTH = 120;

/**
 * KV writes should be best-effort only. Caller correctness cannot depend on put success.
 * @param {Object|null} kv - KV namespace binding
 * @param {string} key - KV key
 * @param {string} value - serialized payload
 * @param {Object} [options] - KV put options (expirationTtl, etc)
 * @returns {Promise<boolean>} true when write succeeded, false otherwise
 */
export async function safeKvPut(kv, key, value, options = {}) {
  if (!kv) return false;
  try {
    await kv.put(key, value, options);
    return true;
  } catch (err) {
    console.error(`KV write failed for ${key}: ${err.message}`);
    return false;
  }
}

function isValidIsoDate(raw) {
  if (typeof raw !== 'string' || !ISO_DATE_RE.test(raw)) return false;
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === raw;
}

function sanitizeText(raw, maxLen) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, maxLen);
  if (!trimmed) return null;
  if (!SAFE_TEXT_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Sanitize upstream flavor payload to reduce content-injection risk.
 * Drops invalid entries and preserves only trusted fields.
 * @param {Object} payload
 * @returns {{ data: Object, dropped: number, rawCount: number }}
 */
export function sanitizeFlavorPayload(payload) {
  const rawFlavors = Array.isArray(payload?.flavors) ? payload.flavors : [];
  const flavors = [];
  let dropped = 0;

  for (const row of rawFlavors) {
    const date = row?.date;
    const title = sanitizeText(row?.title, MAX_TITLE_LENGTH);
    const descriptionRaw = row?.description ?? '';
    const description = descriptionRaw
      ? sanitizeText(String(descriptionRaw), MAX_DESCRIPTION_LENGTH)
      : '';

    if (!isValidIsoDate(date) || !title || (descriptionRaw && description == null)) {
      dropped++;
      continue;
    }
    flavors.push({ date, title, description: description || '' });
  }

  const storeName = sanitizeText(payload?.name || 'Unknown', MAX_STORE_NAME_LENGTH) || 'Unknown';
  return {
    data: { name: storeName, flavors },
    dropped,
    rawCount: rawFlavors.length,
  };
}

async function incrementDailyCounter(kv, keyPrefix, dateStr) {
  const key = `${keyPrefix}:${dateStr}`;
  const raw = kv ? await kv.get(key) : null;
  const count = raw ? parseInt(raw, 10) : 0;
  await safeKvPut(kv, key, String(count + 1), { expirationTtl: 86400 });
}

/**
 * Serialize a flavor-cache record with metadata for integrity checking.
 * Shared cache keys (e.g., Kopp's) do not embed a slug because one key serves many slugs.
 * @param {Object} data - Flavor payload
 * @param {string} slug - Requested slug
 * @param {boolean} isShared - true when a shared KV cache key is used
 */
export function makeFlavorCacheRecord(data, slug, isShared) {
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
export function parseFlavorCacheRecord(raw, { slug, cacheKey, isShared }) {
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
export async function getFlavorsCached(slug, kv, fetchFlavorsFn, isOverride = false, env = {}, { recordOnHit = false } = {}) {
  const brandInfo = getFetcherForSlug(slug, fetchFlavorsFn);
  const cacheKey = brandInfo.kvPrefix || `flavors:${slug}`;
  const isShared = Boolean(brandInfo.kvPrefix);
  // When isOverride is true, use the provided fetcher for all brands (testing)
  const fetcher = isOverride ? fetchFlavorsFn : brandInfo.fetcher;

  // Check KV cache
  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    const parsed = parseFlavorCacheRecord(cached, { slug, cacheKey, isShared });
    if (parsed) {
      if (recordOnHit && env.DB) {
        await recordSnapshots(null, slug, parsed, { db: env.DB, brand: brandInfo.brand });
      }
      return parsed;
    }
  }

  // Cache miss: fetch from upstream
  const upstreamData = await fetcher(slug);
  const sanitized = sanitizeFlavorPayload(upstreamData);
  const data = sanitized.data;

  const today = new Date().toISOString().slice(0, 10);
  if (sanitized.dropped > 0) {
    await incrementDailyCounter(kv, 'meta:payload-anomaly-count', today);
  }

  // O2: Track parse failures — empty flavors array after a fresh fetch indicates
  // upstream HTML parsing returned nothing (structure change or network blip).
  if (data.flavors && data.flavors.length === 0) {
    await incrementDailyCounter(kv, 'meta:parse-fail-count', today);
    // If upstream had data but all entries were rejected, do not cache/persist.
    if (sanitized.rawCount > 0) {
      throw new Error(`No valid flavor entries after sanitization for ${slug}`);
    }
  }

  // Store in KV with TTL (best-effort)
  const cacheRecord = makeFlavorCacheRecord(data, slug, isShared);
  await safeKvPut(kv, cacheKey, cacheRecord, {
    expirationTtl: KV_TTL_SECONDS,
  });

  // Persist flavor observations to D1 (durable historical source of truth)
  await recordSnapshots(null, slug, data, { db: env.DB || null, brand: brandInfo.brand, kv });

  return data;
}
