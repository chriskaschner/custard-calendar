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
  { title: 'Caramel Fudge Cookie Dough', description: 'Vanilla Fresh Frozen Custard with caramel, fudge, and cookie dough.' },
  { title: 'Caramel Pecan', description: 'Caramel Fresh Frozen Custard with pecan pieces.' },
  { title: 'Caramel Turtle', description: 'Caramel Fresh Frozen Custard with pecan pieces and fudge.' },
  { title: 'Chocolate Caramel Twist', description: 'Chocolate and Vanilla Fresh Frozen Custard with caramel.' },
  { title: 'Chocolate Heath Crunch', description: 'Chocolate Fresh Frozen Custard with Heath bar pieces.' },
  { title: 'Chocolate Oreo Volcano', description: 'Chocolate Fresh Frozen Custard with OREO cookie pieces and marshmallow.' },
  { title: 'Chocolate Volcano', description: 'Chocolate Fresh Frozen Custard with fudge and marshmallow.' },
  { title: 'Crazy for Cookie Dough', description: 'Vanilla Fresh Frozen Custard with cookie dough pieces and fudge.' },
  { title: 'Dark Chocolate Decadence', description: 'Dark Chocolate Fresh Frozen Custard with fudge and chocolate chips.' },
  { title: 'Dark Chocolate PB Crunch', description: 'Dark Chocolate Fresh Frozen Custard with peanut butter and chocolate crunch.' },
  { title: 'Georgia Peach Pecan', description: 'Peach Fresh Frozen Custard with pecan pieces.' },
  { title: 'Lemon Berry Layer Cake', description: 'Lemon Fresh Frozen Custard with blueberries and cake pieces.' },
  { title: 'Lemon Dash Cookie', description: 'Lemon Fresh Frozen Custard with cookie pieces.' },
  { title: 'Mint Cookie', description: 'Mint Fresh Frozen Custard with cookie pieces.' },
  { title: 'Mint Explosion', description: 'Mint Fresh Frozen Custard with OREO cookie pieces and fudge.' },
  { title: 'OREO Cheesecake', description: 'Cheesecake Fresh Frozen Custard with OREO cookie pieces.' },
  { title: 'OREO Cookie Cheesecake', description: 'Cheesecake Fresh Frozen Custard with OREO cookie pieces.' },
  { title: 'OREO Cookies and Cream', description: 'Vanilla Fresh Frozen Custard with OREO cookie pieces.' },
  { title: 'Peanut Butter Cup', description: 'Chocolate Fresh Frozen Custard with peanut butter cup pieces.' },
  { title: 'Raspberry Cheesecake', description: 'Cheesecake Fresh Frozen Custard with raspberry sauce.' },
  { title: "Really Reese's", description: "Chocolate Fresh Frozen Custard with Reese's peanut butter cup pieces." },
  { title: 'Salted Caramel Pecan Pie', description: 'Salted Caramel Fresh Frozen Custard with pecan pie pieces.' },
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
    const key = f.title.toLowerCase();
    if (!seen.has(key)) {
      accumulated.push({ title: f.title, description: f.description || '' });
      seen.add(key);
      added = true;
    }
  }

  if (added) {
    await kv.put('meta:flavor-catalog', JSON.stringify({
      flavors: accumulated,
      updatedAt: new Date().toISOString(),
    }));
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
