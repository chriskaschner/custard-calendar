import { recordSnapshots } from './snapshot-writer.js';
import { getFetcherForSlug } from './brand-registry.js';
import { FLAVOR_PROFILES, FLAVOR_ALIASES, normalizeFlavorKey } from './flavor-colors.js';
import { applyFlavorOverrides, getPremiereDates } from './flavor-overrides.js';
import { centralDateString, centralDateStringOrNull } from './date-util.js';

const KV_TTL_SECONDS = 86400; // 24 hours
const FLAVOR_CACHE_RECORD_VERSION = 1;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Block characters that could enable HTML/script injection. Everything else
// is allowed so upstream brands can use whatever punctuation they want.
const UNSAFE_TEXT_RE = /[<>`{}]/;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_STORE_NAME_LENGTH = 120;

// Upstream brands sometimes use sentinel titles to indicate a store is closed.
// These are not real flavors and must be dropped before caching or serving.
export const CLOSED_TITLE_RE = /\bclosed\b|^z[_ ]*(store|restaurant)?closed/i;

/**
 * Check whether a flavor title is recognized in the canonical catalog.
 * Looks up both FLAVOR_PROFILES (direct entries) and FLAVOR_ALIASES (variant names).
 * Unknown flavors are counted but NOT dropped -- they still get served to users.
 * @param {string} title - Flavor name from upstream data
 * @returns {boolean}
 */
export function isKnownFlavor(title) {
  if (!title) return false;
  const key = normalizeFlavorKey(title);
  if (!key) return false;
  return Boolean(FLAVOR_PROFILES[key] || FLAVOR_ALIASES[key]);
}

/**
 * Detect duplicate same-day entries in an upstream flavor payload.
 * D1 UNIQUE(slug,date) prevents DB-level dupes; this catches them in the
 * upstream payload BEFORE the D1 write so they can be counted and alerted on.
 * @param {Array<{date: string}>} flavors
 * @returns {string[]} Sorted array of duplicate date strings
 */
export function detectDuplicateDays(flavors) {
  if (!Array.isArray(flavors) || flavors.length === 0) return [];
  const seen = new Set();
  const dupes = new Set();
  for (const row of flavors) {
    const d = row?.date;
    if (d && seen.has(d)) dupes.add(d);
    if (d) seen.add(d);
  }
  return [...dupes].sort();
}

/**
 * Check whether a store's last flavor date exceeds a staleness threshold.
 * A store with no data at all is considered stale.
 * @param {string|null} lastFlavorDate - ISO date string (YYYY-MM-DD) or null
 * @param {Date|string} now - Current date
 * @param {number} [thresholdDays=7] - Days after which data is considered stale
 * @returns {boolean}
 */
export function isStaleStore(lastFlavorDate, now, thresholdDays = 7) {
  if (!lastFlavorDate) return true;
  const last = new Date(lastFlavorDate + 'T00:00:00Z');
  const current = now instanceof Date ? now : new Date(now);
  if (isNaN(last.getTime()) || isNaN(current.getTime())) return true;
  const diffDays = (current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}

export function brandCounterKey(brand) {
  return String(brand || 'unknown')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

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
  if (UNSAFE_TEXT_RE.test(trimmed)) return null;
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

    // Drop closed-day sentinel values (e.g. "z_storeclosed", "Closed", "Closed for Remodel")
    if (CLOSED_TITLE_RE.test(title)) {
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

/** KV key holding today's unknown flavor sightings. */
export const UNKNOWN_FLAVOR_NAMES_KEY = 'meta:unknown-flavor-names';

/** Cap so one bad upstream day cannot grow an unbounded KV value. */
export const MAX_UNKNOWN_FLAVOR_NAMES = 25;

/**
 * Record which flavors were unrecognized, so the operator alert can name them.
 *
 * The daily counter alone says "3 unknown flavors today" without saying which,
 * where, or when -- leaving the operator to go hunting. Deduped by normalized
 * title so a chain-wide debut appears once rather than a thousand times.
 * Best-effort: never throws, never blocks serving.
 *
 * @param {Object} kv - KV namespace binding
 * @param {Array<{title: string, slug: string, date: string}>} sightings
 * @param {string} dateStr - Today, for the daily key suffix
 */
export async function recordUnknownFlavorNames(kv, sightings, dateStr) {
  if (!kv || !sightings || sightings.length === 0) return;
  const key = `${UNKNOWN_FLAVOR_NAMES_KEY}:${dateStr}`;

  let existing = [];
  try {
    const raw = await kv.get(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) existing = parsed;
    }
  } catch (err) {
    console.error(`Unknown-flavor name read failed: ${err.message}`);
  }

  const seen = new Set(existing.map(e => normalizeFlavorKey(e?.title)));
  let added = false;
  for (const sighting of sightings) {
    if (existing.length >= MAX_UNKNOWN_FLAVOR_NAMES) break;
    const normalized = normalizeFlavorKey(sighting.title);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    existing.push({ title: sighting.title, slug: sighting.slug, date: sighting.date });
    added = true;
  }

  if (added) {
    await safeKvPut(kv, key, JSON.stringify(existing), { expirationTtl: 86400 });
  }
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
 * @param {string} [options.today] - Central date; injectable for tests
 * @returns {Object|null}
 */
export function parseFlavorCacheRecord(raw, { slug, cacheKey, isShared, today = centralDateString() }) {
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

    // A flavor cache entry is only valid for the Central day it was fetched.
    //
    // The 24h TTL alone is not enough. Brands that publish a single day
    // (Hefner's, Gille's) hold exactly one dated entry, so a record written at
    // 8pm survives until 8pm the following day -- serving yesterday's date for
    // twenty hours, which every surface then correctly reports as "no flavor
    // posted for today". Expiring on the Central day boundary instead of 24h
    // after the write is what makes the entry mean what it says.
    const cachedDay = centralDateStringOrNull(meta.cachedAt);
    if (cachedDay !== today) {
      console.warn(`Cache record for ${cacheKey} is from Central day ${cachedDay || 'unknown'}, not ${today}; refreshing`);
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

/** Days of D1 history worth serving when upstream is unreachable. */
const FALLBACK_LOOKBACK_DAYS = 45;

/**
 * Last known good schedule for a slug, from the durable D1 record.
 *
 * Only used when upstream fetching fails. Returns null rather than throwing:
 * a failure here must not replace the upstream error the caller is handling.
 *
 * @param {Object|null} db - D1 binding
 * @param {string} slug
 * @param {string} name - Store name to report; snapshots do not store one
 * @returns {Promise<{name: string, flavors: Array, stale: boolean}|null>}
 */
async function readLastKnownGood(db, slug, name) {
  if (!db) return null;
  try {
    const result = await db.prepare(
      `SELECT date, flavor, description
       FROM snapshots
       WHERE slug = ? AND date >= date('now', ?)
       ORDER BY date ASC`
    ).bind(slug, `-${FALLBACK_LOOKBACK_DAYS} days`).all();

    const flavors = (result?.results || [])
      .filter(r => isValidIsoDate(r?.date) && r?.flavor)
      .map(r => ({
        date: r.date,
        title: r.flavor,
        description: r.description || '',
      }));
    if (flavors.length === 0) return null;

    return { name, flavors, stale: true };
  } catch (err) {
    console.error(`D1 fallback read failed for ${slug}: ${err.message}`);
    return null;
  }
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
  const brandKey = brandCounterKey(brandInfo.brand);
  // When isOverride is true, use the provided fetcher for all brands (testing)
  const fetcher = isOverride ? fetchFlavorsFn : brandInfo.fetcher;

  // Overrides and premiere placeholders are applied to a COPY on the way out,
  // after every KV/D1 write, so synthetic entries can never enter the historical
  // record. Callers below must return serve(...), never the raw payload.
  const serve = async (payload) => applyFlavorOverrides(payload, slug, {
    premiereDates: await getPremiereDates(kv),
    brand: brandInfo.brand,
  });

  // Check KV cache
  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    const parsed = parseFlavorCacheRecord(cached, { slug, cacheKey, isShared });
    if (parsed) {
      if (recordOnHit && env.DB) {
        await recordSnapshots(null, slug, parsed, { db: env.DB, brand: brandInfo.brand });
      }
      return serve(parsed);
    }
  }

  // Cache miss: fetch from upstream
  const today = new Date().toISOString().slice(0, 10);
  let upstreamData;
  try {
    upstreamData = await fetcher(slug);
  } catch (err) {
    await incrementDailyCounter(kv, 'meta:parse-fail-count', today);
    await incrementDailyCounter(kv, `meta:parse-fail-count:brand:${brandKey}`, today);

    // Upstream is unreachable, but D1 may still hold a usable schedule -- for
    // brands that publish weeks ahead it very often does. Serving that beats a
    // 502 that the map can only render as a blank pin. Callers can tell the
    // difference: the payload is flagged stale, and it is NOT written back to
    // KV, so the next request retries upstream rather than pinning a stale
    // answer in place for the full TTL.
    const fallback = await readLastKnownGood(env.DB, slug, brandInfo.brand);
    if (fallback) {
      console.warn(`Serving stale D1 data for ${slug} after upstream failure: ${err.message}`);
      return serve(fallback);
    }
    throw err;
  }
  const sanitized = sanitizeFlavorPayload(upstreamData);
  const data = sanitized.data;

  if (sanitized.dropped > 0) {
    await incrementDailyCounter(kv, 'meta:payload-anomaly-count', today);
  }

  // D-05a: Count unknown flavors (warning only -- do not drop from serving)
  let unknownCount = 0;
  const unknownSightings = [];
  for (const f of data.flavors) {
    if (!isKnownFlavor(f.title)) {
      unknownCount++;
      unknownSightings.push({ title: f.title, slug, date: f.date });
    }
  }
  if (unknownCount > 0) {
    await recordUnknownFlavorNames(kv, unknownSightings, today);
    await incrementDailyCounter(kv, 'meta:unknown-flavor-count', today);
  }

  // D-05b: Count duplicate same-day entries in upstream payload
  const dupeDays = detectDuplicateDays(data.flavors);
  if (dupeDays.length > 0) {
    await incrementDailyCounter(kv, 'meta:duplicate-day-count', today);
  }

  // O2: Track parse failures — empty flavors array after a fresh fetch indicates
  // upstream HTML parsing returned nothing (structure change or network blip).
  if (data.flavors && data.flavors.length === 0) {
    await incrementDailyCounter(kv, 'meta:parse-fail-count', today);
    await incrementDailyCounter(kv, `meta:parse-fail-count:brand:${brandKey}`, today);
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

  return serve(data);
}
