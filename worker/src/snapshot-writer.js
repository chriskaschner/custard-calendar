/**
 * Snapshot writer — append-only historical flavor observations in KV.
 *
 * Writes three keys per observation (triple-write):
 *   snap:{slug}:{date}        → { flavor, description, fetchedAt }
 *   snap:date:{date}          → [ {slug, flavor} ... ]
 *   snap:flavor:{normalized}  → [ {slug, date, original} ... ]
 *
 * Called on cache miss only — piggybacks on existing upstream fetches.
 * No TTL on snapshot keys — permanent historical record.
 */

import { normalize } from './flavor-matcher.js';

/**
 * Record a single flavor observation as three snapshot keys.
 * @param {Object} kv - KV namespace binding
 * @param {string} slug - Store slug
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} flavor - Flavor name as returned by upstream
 * @param {string} [description] - Flavor description
 */
export async function recordSnapshot(kv, slug, date, flavor, description) {
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
}

/**
 * Record snapshots for all flavors in a store response.
 * @param {Object} kv - KV namespace binding
 * @param {string} slug - Store slug
 * @param {Object} data - Store data with { flavors: [{ date, title, description }] }
 */
export async function recordSnapshots(kv, slug, data) {
  if (!kv || !data || !data.flavors) return;

  for (const flavor of data.flavors) {
    await recordSnapshot(kv, slug, flavor.date, flavor.title, flavor.description);
  }
}
