/**
 * Flavor catalog — serves known Culver's flavors for the alerts subscription UI.
 *
 * Seeded statically from SIMILARITY_GROUPS + KNOWN_FLAVORS + fixture data.
 * Accumulates new flavors over time as the cron handler encounters them.
 */

/**
 * Static seed catalog. Merged from:
 * - SIMILARITY_GROUPS in flavor-matcher.js (~30 flavors)
 * - KNOWN_FLAVORS in map.html (~32 flavors)
 * - Common fixture data
 *
 * Each entry has a title (display name) and optional description.
 */
const SEED_CATALOG = [
  { title: 'Andes Mint Avalanche', description: 'Mint Fresh Frozen Custard with Andes Mint pieces and chocolate.' },
  { title: 'Blackberry Cobbler', description: 'Blackberry Fresh Frozen Custard with pie crust pieces.' },
  { title: 'Brownie Thunder', description: 'Chocolate Fresh Frozen Custard with brownie pieces and marshmallow.' },
  { title: 'Butter Pecan', description: 'Butter Pecan Fresh Frozen Custard.' },
  { title: 'Caramel Cashew', description: 'Vanilla Fresh Frozen Custard with caramel and cashew pieces.' },
  { title: 'Caramel Chocolate Pecan', description: 'Chocolate Fresh Frozen Custard with caramel and pecan pieces.' },
  { title: 'Caramel Fudge Cookie Dough', description: 'Vanilla Fresh Frozen Custard with caramel, fudge, and cookie dough.' },
  { title: 'Caramel Peanut Buttercup', description: 'Vanilla Fresh Frozen Custard with peanut butter ribbon and chocolate pieces.' },
  { title: 'Caramel Pecan', description: 'Caramel Fresh Frozen Custard with pecan pieces.' },
  { title: 'Caramel Turtle', description: 'Caramel Fresh Frozen Custard with pecan pieces and fudge.' },
  { title: 'Chocolate Caramel Twist', description: 'Chocolate and Vanilla Fresh Frozen Custard with caramel.' },
  { title: 'Chocolate Covered Strawberry', description: 'Vanilla Fresh Frozen Custard with strawberry and chocolate pieces.' },
  { title: 'Chocolate Heath Crunch', description: 'Chocolate Fresh Frozen Custard with Heath bar pieces.' },
  { title: 'Chocolate Oreo Volcano', description: 'Chocolate Fresh Frozen Custard with OREO cookie pieces and marshmallow.', historical: true },
  { title: 'Chocolate Volcano', description: 'Chocolate Fresh Frozen Custard with fudge and marshmallow.' },
  { title: 'Crazy for Cookie Dough', description: 'Vanilla Fresh Frozen Custard with cookie dough pieces and fudge.' },
  { title: 'Dark Chocolate Decadence', description: 'Dark Chocolate Fresh Frozen Custard with fudge and chocolate chips.' },
  { title: 'Dark Chocolate PB Crunch', description: 'Dark Chocolate Fresh Frozen Custard with peanut butter and chocolate crunch.' },
  { title: "Devil's Food Cake", description: "Dark Chocolate Fresh Frozen Custard with devil's food cake pieces." },
  { title: 'Double Butter Pecan', description: 'Vanilla Fresh Frozen Custard loaded with butter pecan pieces.' },
  { title: 'Double Strawberry', description: 'Strawberry Fresh Frozen Custard with extra strawberry pieces.' },
  { title: 'Georgia Peach', description: 'Peach Fresh Frozen Custard with peach pieces.' },
  { title: 'Lemon Berry Layer Cake', description: 'Lemon Fresh Frozen Custard with blueberries and cake pieces.' },
  { title: 'Lemon Dash Cookie', description: 'Lemon Fresh Frozen Custard with cookie pieces.' },
  { title: 'Mint Cookie', description: 'Mint Fresh Frozen Custard with cookie pieces.' },
  { title: 'Mint Explosion', description: 'Mint Fresh Frozen Custard with OREO cookie pieces and fudge.' },
  { title: 'OREO Cheesecake', description: 'Cheesecake Fresh Frozen Custard with OREO cookie pieces.' },
  { title: 'OREO Cookie Cheesecake', description: 'Cheesecake Fresh Frozen Custard with OREO cookie pieces.' },
  { title: 'OREO Cookie Overload', description: 'Chocolate Fresh Frozen Custard loaded with OREO cookie pieces and chocolate fudge.' },
  { title: 'Peanut Butter Cup', description: 'Chocolate Fresh Frozen Custard with peanut butter cup pieces. Culver\'s name through 2021; now called Really Reese\'s.', historical: true },
  { title: 'Raspberry Cheesecake', description: 'Cheesecake Fresh Frozen Custard with raspberry sauce.' },
  { title: "Really Reese's", description: "Chocolate Fresh Frozen Custard with Reese's peanut butter cup pieces." },
  { title: 'Salted Caramel Pecan Pie', description: 'Salted Caramel Fresh Frozen Custard with pecan pie pieces.', historical: true },
  { title: 'Salted Double Caramel Pecan', description: 'Vanilla Fresh Frozen Custard with caramel, extra pecan pieces, and a touch of salt.' },
  { title: 'Snickers Swirl', description: 'Chocolate Fresh Frozen Custard with Snickers bar pieces and caramel.' },
  { title: 'Strawberry Cheesecake', description: 'Cheesecake Fresh Frozen Custard with strawberry sauce.' },
  { title: 'Turtle', description: 'Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge.' },
  { title: 'Turtle Cheesecake', description: 'Cheesecake Fresh Frozen Custard with pecan pieces, caramel, and fudge.' },
  { title: 'Turtle Dove', description: 'Chocolate and Vanilla Fresh Frozen Custard with pecan pieces, caramel, and fudge.' },
  { title: 'Vanilla', description: 'Vanilla Fresh Frozen Custard.' },
];

/**
 * Get the flavor catalog, merging static seed with any accumulated flavors from KV.
 * @param {Object} kv - KV namespace binding
 * @returns {Promise<{flavors: Array<{title: string, description: string}>, updatedAt: string}>}
 */
export async function getFlavorCatalog(kv) {
  const cached = kv ? await kv.get('meta:flavor-catalog') : null;
  if (cached) {
    try {
      const data = JSON.parse(cached);
      // Merge seed with accumulated — seed provides baseline, KV may have extras
      return mergeCatalogs(SEED_CATALOG, data.flavors || []);
    } catch {
      // Corrupted KV data — fall back to seed
    }
  }
  return { flavors: SEED_CATALOG, updatedAt: new Date().toISOString() };
}

/**
 * Merge two flavor arrays, deduplicating by normalized title.
 * Seed entries take priority for descriptions (they're hand-written).
 */
function mergeCatalogs(seed, accumulated) {
  const seen = new Map();
  for (const f of seed) {
    seen.set(f.title.toLowerCase(), f);
  }
  for (const f of accumulated) {
    const key = f.title.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, f);
    }
  }
  const flavors = [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
  return { flavors, updatedAt: new Date().toISOString() };
}

/**
 * Accumulate newly discovered flavors into the KV catalog.
 * Called by the cron handler after fetching store flavors.
 * @param {Object} kv - KV namespace binding
 * @param {Array<{title: string, description: string}>} newFlavors
 */
export async function accumulateFlavors(kv, newFlavors) {
  if (!kv || !newFlavors || newFlavors.length === 0) return;

  const existing = await kv.get('meta:flavor-catalog');
  let accumulated = [];
  if (existing) {
    try {
      accumulated = JSON.parse(existing).flavors || [];
    } catch {
      // Start fresh
    }
  }

  const seen = new Set(accumulated.map(f => f.title.toLowerCase()));
  // Also check against seed
  for (const f of SEED_CATALOG) {
    seen.add(f.title.toLowerCase());
  }

  let added = false;
  for (const f of newFlavors) {
    // Placeholders and hand-pinned entries are ours, not upstream observations.
    // Letting them in would surface "New flavor premiere" in flavor autocomplete.
    if (f.source === 'premiere' || f.source === 'override') continue;
    const key = f.title.toLowerCase();
    if (!seen.has(key)) {
      accumulated.push({ title: f.title, description: f.description || '' });
      seen.add(key);
      added = true;
    }
  }

  if (added) {
    try {
      await kv.put('meta:flavor-catalog', JSON.stringify({
        flavors: accumulated,
        updatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error(`Flavor catalog write failed: ${err.message}`);
    }
  }
}

/**
 * Handle GET /api/flavors/catalog requests.
 * Returns the full flavor catalog for the subscription UI.
 */
export async function handleFlavorCatalog(env, corsHeaders) {
  const catalog = await getFlavorCatalog(env.FLAVOR_CACHE);
  return Response.json(catalog, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=86400', // 24h
    },
  });
}
