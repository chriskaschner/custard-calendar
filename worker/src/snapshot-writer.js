/**
 * Snapshot writer — append-only historical flavor observations.
 *
 * D1 table: snapshots (slug, date, flavor, normalized_flavor, description, fetched_at)
 *
 * Called on cache miss only — piggybacks on existing upstream fetches.
 */

import { normalize } from './flavor-matcher.js';

/**
 * Record a single flavor observation to D1.
 * @param {Object|null} kv - legacy arg (unused; preserved for call-site compatibility)
 * @param {string} slug - Store slug
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} flavor - Flavor name as returned by upstream
 * @param {string} [description] - Flavor description
 * @param {Object} [options] - Additional options
 * @param {Object} [options.db] - D1 database binding
 * @param {string} [options.brand] - Brand name (for D1)
 */
export async function recordSnapshot(kv, slug, date, flavor, description, options = {}) {
  if (!slug || !date || !flavor) return;

  const db = options.db;
  if (!db) return;
  const fetchedAt = new Date().toISOString();
  const normalized = normalize(flavor);

  try {
    await db.prepare(
      `INSERT INTO snapshots (brand, slug, date, flavor, normalized_flavor, description, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug, date) DO UPDATE SET
         flavor = excluded.flavor, normalized_flavor = excluded.normalized_flavor,
         description = excluded.description, fetched_at = excluded.fetched_at
       WHERE excluded.date >= date('now', '-7 days')`
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
    // D1 write failures are non-fatal; this path should never block serving flavor data.
    console.error(`D1 snapshot write failed for ${slug}/${date}: ${err.message}`);
    // O3: Count snapshot write failures for observability via /health endpoint.
    const kvBinding = options.kv;
    if (kvBinding) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const errKey = `meta:snapshot-errors:${today}`;
        const raw = await kvBinding.get(errKey);
        const cnt = raw ? parseInt(raw, 10) : 0;
        await kvBinding.put(errKey, String(cnt + 1), { expirationTtl: 86400 });
      } catch {
        // counter write is best-effort; do not throw
      }
    }
  }
}

/**
 * Record snapshots for all flavors in a store response.
 * @param {Object|null} kv - legacy arg (unused; preserved for call-site compatibility)
 * @param {string} slug - Store slug
 * @param {Object} data - Store data with { flavors: [{ date, title, description }] }
 * @param {Object} [options] - Additional options (db, brand)
 */
export async function recordSnapshots(kv, slug, data, options = {}) {
  if (!data || !Array.isArray(data.flavors)) return;

  for (const flavor of data.flavors) {
    await recordSnapshot(kv, slug, flavor.date, flavor.title, flavor.description, options);
  }
}
