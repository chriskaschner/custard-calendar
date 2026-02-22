/**
 * Snapshot writer — append-only historical flavor observations.
 *
 * Dual-write strategy:
 *   1. KV (existing) — triple-write for backward compat with existing cron reads
 *   2. D1 (new) — single INSERT for queryable historical analysis
 *
 * KV keys (no TTL — permanent):
 *   snap:{slug}:{date}        → { flavor, description, fetchedAt }
 *   snap:date:{date}          → [ {slug, flavor} ... ]
 *   snap:flavor:{normalized}  → [ {slug, date, original} ... ]
 *
 * D1 table: snapshots (slug, date, flavor, normalized_flavor, description, fetched_at)
 *
 * Called on cache miss only — piggybacks on existing upstream fetches.
 */

import { normalize } from './flavor-matcher.js';

/**
 * Record a single flavor observation to KV (triple-write) and D1.
 * @param {Object} kv - KV namespace binding
 * @param {string} slug - Store slug
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} flavor - Flavor name as returned by upstream
 * @param {string} [description] - Flavor description
 * @param {Object} [options] - Additional options
 * @param {Object} [options.db] - D1 database binding
 * @param {string} [options.brand] - Brand name (for D1)
 */
export async function recordSnapshot(kv, slug, date, flavor, description, options = {}) {
  if (!kv || !slug || !date || !flavor) return;

  const fetchedAt = new Date().toISOString();

  // 1. Per-store-per-date key (write-once, skip if exists)
  const storeKey = `snap:${slug}:${date}`;
  const existing = await kv.get(storeKey);
  if (existing) return; // Already recorded this store+date

  await kv.put(storeKey, JSON.stringify({ flavor, description: description || '', fetchedAt }));

  // 2. Append to date index
  const dateKey = `snap:date:${date}`;
  const dateRaw = await kv.get(dateKey);
  const dateList = dateRaw ? JSON.parse(dateRaw) : [];
  dateList.push({ slug, flavor });
  await kv.put(dateKey, JSON.stringify(dateList));

  // 3. Append to flavor index
  const normalized = normalize(flavor);
  const flavorKey = `snap:flavor:${normalized}`;
  const flavorRaw = await kv.get(flavorKey);
  const flavorList = flavorRaw ? JSON.parse(flavorRaw) : [];
  flavorList.push({ slug, date, original: flavor });
  await kv.put(flavorKey, JSON.stringify(flavorList));

  // 4. D1 write (if binding available)
  const db = options.db;
  if (db) {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO snapshots (brand, slug, date, flavor, normalized_flavor, description, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        options.brand || 'unknown',
        slug,
        date,
        flavor,
        normalized,
        description || '',
        fetchedAt,
      ).run();
    } catch (err) {
      // D1 write failures are non-fatal — KV is the primary store
      console.error(`D1 snapshot write failed for ${slug}/${date}: ${err.message}`);
    }
  }
}

/**
 * Record snapshots for all flavors in a store response.
 * @param {Object} kv - KV namespace binding
 * @param {string} slug - Store slug
 * @param {Object} data - Store data with { flavors: [{ date, title, description }] }
 * @param {Object} [options] - Additional options (db, brand)
 */
export async function recordSnapshots(kv, slug, data, options = {}) {
  if (!kv || !data || !data.flavors) return;

  for (const flavor of data.flavors) {
    await recordSnapshot(kv, slug, flavor.date, flavor.title, flavor.description, options);
  }
}
