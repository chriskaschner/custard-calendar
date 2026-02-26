import { describe, it, expect, vi } from 'vitest';
import { handleGeoEDA } from '../src/metrics.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// ---------------------------------------------------------------------------
// Mock store index with a small set of stores across WI and one other state
// ---------------------------------------------------------------------------
const MOCK_STORE_INDEX = [
  { slug: 'mt-horeb', name: 'Mt. Horeb', city: 'Mt. Horeb', state: 'WI' },
  { slug: 'verona', name: 'Verona', city: 'Verona', state: 'WI' },
  { slug: 'madison-todd-drive', name: 'Madison Todd Dr', city: 'Madison', state: 'WI' },
  { slug: 'middleton', name: 'Middleton', city: 'Middleton', state: 'WI' },
  { slug: 'chicago-main', name: 'Chicago Main', city: 'Chicago', state: 'IL' },
];

// ---------------------------------------------------------------------------
// Mock D1 factory
//
// Supports the three query shapes used by geo-eda:
//   1. exclusive_flavors query: GROUP BY normalized_flavor, slug
//   2. cadence_variance query: GROUP BY normalized_flavor, date
//   3. outlier_stores query:   SELECT slug, yearmonth, normalized_flavor
// ---------------------------------------------------------------------------
function createMockD1(snapshotRows = []) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...slugArgs) => ({
        all: vi.fn(async () => {
          // Exclusive flavors query: GROUP BY normalized_flavor, slug
          if (sql.includes('GROUP BY normalized_flavor, slug')) {
            const slugSet = new Set(slugArgs);
            const filtered = snapshotRows.filter((r) => slugSet.has(r.slug));
            // Group by normalized_flavor + slug
            const grouped = new Map();
            for (const row of filtered) {
              const key = `${row.normalized_flavor}::${row.slug}`;
              if (!grouped.has(key)) {
                grouped.set(key, {
                  normalized_flavor: row.normalized_flavor,
                  flavor: row.flavor,
                  slug: row.slug,
                  cnt: 0,
                });
              }
              grouped.get(key).cnt++;
            }
            return { results: [...grouped.values()] };
          }

          // Cadence variance query: GROUP BY normalized_flavor, date
          if (sql.includes('GROUP BY normalized_flavor, date')) {
            const slugSet = new Set(slugArgs);
            const filtered = snapshotRows.filter((r) => slugSet.has(r.slug));
            const grouped = new Map();
            for (const row of filtered) {
              const key = `${row.normalized_flavor}::${row.date}`;
              if (!grouped.has(key)) {
                grouped.set(key, {
                  normalized_flavor: row.normalized_flavor,
                  flavor: row.flavor,
                  date: row.date,
                });
              }
            }
            return { results: [...grouped.values()] };
          }

          // Outlier stores query: SELECT slug, yearmonth, normalized_flavor
          if (sql.includes('yearmonth') || sql.includes("strftime('%Y-%m'")) {
            const slugSet = new Set(slugArgs);
            const filtered = snapshotRows.filter((r) => slugSet.has(r.slug));
            return {
              results: filtered.map((r) => ({
                slug: r.slug,
                yearmonth: r.date.slice(0, 7),
                normalized_flavor: r.normalized_flavor,
              })),
            };
          }

          return { results: [] };
        }),
        first: vi.fn(async () => null),
      })),
      all: vi.fn(async () => ({ results: [] })),
      first: vi.fn(async () => null),
    })),
  };
}

function makeUrl(params = {}) {
  const base = 'https://example.com/api/v1/analytics/geo-eda';
  const qs = new URLSearchParams(params).toString();
  return new URL(qs ? `${base}?${qs}` : base);
}

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/geo-eda -- validation', () => {
  it('returns 400 for invalid scope', async () => {
    const url = makeUrl({ scope: 'continent' });
    const env = { DB: createMockD1([]), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid scope/i);
  });

  it('returns 400 when state scope has no matching region', async () => {
    const url = makeUrl({ scope: 'state', region: 'XX' });
    const env = { DB: createMockD1([]), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 400 when metro scope has no matching region', async () => {
    const url = makeUrl({ scope: 'metro', region: 'atlantis' });
    const env = { DB: createMockD1([]), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 503 when D1 is not configured', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/database not configured/i);
  });
});

// ---------------------------------------------------------------------------
// National scope tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/geo-eda -- national scope', () => {
  // Build snapshot rows: turtle appears at all 5 stores; vanilla only at 1
  const SNAPSHOT_ROWS = [
    // Turtle at all 5 stores, many appearances
    ...Array.from({ length: 10 }, (_, i) => ({
      slug: 'mt-horeb', date: `2025-0${(i % 9) + 1}-01`, flavor: 'Turtle', normalized_flavor: 'turtle',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      slug: 'verona', date: `2025-0${(i % 9) + 1}-02`, flavor: 'Turtle', normalized_flavor: 'turtle',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      slug: 'madison-todd-drive', date: `2025-0${(i % 9) + 1}-03`, flavor: 'Turtle', normalized_flavor: 'turtle',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      slug: 'middleton', date: `2025-0${(i % 9) + 1}-04`, flavor: 'Turtle', normalized_flavor: 'turtle',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      slug: 'chicago-main', date: `2025-0${(i % 9) + 1}-05`, flavor: 'Turtle', normalized_flavor: 'turtle',
    })),
    // Vanilla at only mt-horeb (1/5 stores = 20%)
    { slug: 'mt-horeb', date: '2025-01-15', flavor: 'Vanilla', normalized_flavor: 'vanilla' },
    { slug: 'mt-horeb', date: '2025-02-15', flavor: 'Vanilla', normalized_flavor: 'vanilla' },
  ];

  it('returns 200 with valid shape for national scope', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe('national');
    expect(body.region).toBeNull();
    expect(typeof body.generated_at).toBe('string');
    expect(body.store_count).toBe(5);
    expect(Array.isArray(body.exclusive_flavors)).toBe(true);
    expect(Array.isArray(body.cadence_variance)).toBe(true);
    expect(Array.isArray(body.outlier_stores)).toBe(true);
  });

  it('sets 24h Cache-Control header', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('exclusive_flavors is sorted by appearances desc', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    const ef = body.exclusive_flavors;
    for (let i = 1; i < ef.length; i++) {
      expect(ef[i - 1].appearances).toBeGreaterThanOrEqual(ef[i].appearances);
    }
  });

  it('exclusive_flavors entries have required fields', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    for (const entry of body.exclusive_flavors) {
      expect(typeof entry.flavor).toBe('string');
      expect(typeof entry.appearances).toBe('number');
      expect(typeof entry.pct_of_scope_stores).toBe('number');
      expect(entry.pct_of_scope_stores).toBeGreaterThan(0);
      expect(entry.pct_of_scope_stores).toBeLessThanOrEqual(1);
    }
  });

  it('turtle appears in exclusive_flavors (at all 5 stores = 100%)', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    const turtleEntry = body.exclusive_flavors.find((e) => e.flavor === 'Turtle');
    expect(turtleEntry).toBeDefined();
    expect(turtleEntry.pct_of_scope_stores).toBe(1);
  });

  it('vanilla does NOT appear in exclusive_flavors (only 1/5 stores = 20% < 50%)', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    const vanillaEntry = body.exclusive_flavors.find((e) => e.flavor === 'Vanilla');
    expect(vanillaEntry).toBeUndefined();
  });

  it('outlier_stores is an array', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1(SNAPSHOT_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    expect(Array.isArray(body.outlier_stores)).toBe(true);
  });

  it('returns valid shape with empty D1', async () => {
    const url = makeUrl({ scope: 'national' });
    const env = { DB: createMockD1([]), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exclusive_flavors).toEqual([]);
    expect(body.cadence_variance).toEqual([]);
    expect(body.outlier_stores).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// State scope tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/geo-eda -- state scope', () => {
  const WI_ROWS = [
    { slug: 'mt-horeb', date: '2025-01-01', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2025-02-01', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'verona', date: '2025-01-01', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'verona', date: '2025-02-01', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'madison-todd-drive', date: '2025-01-01', flavor: 'Mint Explosion', normalized_flavor: 'mint explosion' },
  ];

  it('returns 200 with scope=state for WI', async () => {
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(WI_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe('state');
    expect(body.region).toBe('WI');
    expect(body.store_count).toBe(4); // 4 WI stores in MOCK_STORE_INDEX
  });

  it('state scope only considers stores in that state', async () => {
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(WI_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    // Only WI stores in mock index: mt-horeb, verona, madison-todd-drive, middleton
    expect(body.store_count).toBe(4);
  });

  it('state scope is case-insensitive for region param', async () => {
    const url = makeUrl({ scope: 'state', region: 'wi' });
    const env = { DB: createMockD1(WI_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.region).toBe('WI');
  });
});

// ---------------------------------------------------------------------------
// Metro scope tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/geo-eda -- metro scope', () => {
  // mt-horeb city is "Mt. Horeb" which maps to 'madison' metro via WI_METRO_MAP
  const METRO_ROWS = [
    { slug: 'mt-horeb', date: '2025-01-01', flavor: 'Caramel Cashew', normalized_flavor: 'caramel cashew' },
    { slug: 'verona', date: '2025-01-01', flavor: 'Caramel Cashew', normalized_flavor: 'caramel cashew' },
  ];

  it('returns 200 for madison metro', async () => {
    const url = makeUrl({ scope: 'metro', region: 'madison' });
    const env = { DB: createMockD1(METRO_ROWS), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe('metro');
    expect(body.region).toBe('madison');
    // madison metro stores from MOCK_STORE_INDEX:
    //   mt-horeb (city=Mt. Horeb), verona (city=Verona), madison-todd-drive (city=Madison), middleton (city=Middleton)
    expect(body.store_count).toBeGreaterThan(0);
  });

  it('returns 400 for unknown metro region', async () => {
    const url = makeUrl({ scope: 'metro', region: 'springfield' });
    const env = { DB: createMockD1([]), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Outlier stores tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/geo-eda -- outlier_stores', () => {
  // Build data where one store has very high monthly unique-flavor count (outlier)
  // and others are consistent. Need >= 3 stores with >= 2 months each for z-score.
  function buildRows() {
    const rows = [];
    const flavors = ['turtle', 'vanilla', 'mint explosion', 'caramel cashew', 'butter pecan',
      'chocolate', 'strawberry', 'peach', 'lemon', 'raspberry'];

    // mt-horeb: 10 unique flavors per month for 3 months (high outlier)
    for (const month of ['2025-01', '2025-02', '2025-03']) {
      for (const f of flavors) {
        rows.push({ slug: 'mt-horeb', date: `${month}-05`, flavor: f, normalized_flavor: f });
      }
    }
    // verona: 3 unique flavors per month for 3 months (normal)
    for (const month of ['2025-01', '2025-02', '2025-03']) {
      for (const f of ['turtle', 'vanilla', 'mint explosion']) {
        rows.push({ slug: 'verona', date: `${month}-05`, flavor: f, normalized_flavor: f });
      }
    }
    // madison-todd-drive: 3 unique flavors per month for 3 months (normal)
    for (const month of ['2025-01', '2025-02', '2025-03']) {
      for (const f of ['turtle', 'caramel cashew', 'butter pecan']) {
        rows.push({ slug: 'madison-todd-drive', date: `${month}-05`, flavor: f, normalized_flavor: f });
      }
    }
    // middleton: 3 unique flavors per month for 3 months (normal)
    for (const month of ['2025-01', '2025-02', '2025-03']) {
      for (const f of ['turtle', 'chocolate', 'strawberry']) {
        rows.push({ slug: 'middleton', date: `${month}-05`, flavor: f, normalized_flavor: f });
      }
    }
    return rows;
  }

  it('outlier_stores contains stores with |z_score| >= 1.5', async () => {
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(buildRows()), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const store of body.outlier_stores) {
      expect(Math.abs(store.z_score)).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('outlier_stores entries have required fields', async () => {
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(buildRows()), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    for (const store of body.outlier_stores) {
      expect(typeof store.slug).toBe('string');
      expect(typeof store.name).toBe('string');
      expect(typeof store.avg_unique_flavors_per_month).toBe('number');
      expect(typeof store.scope_median).toBe('number');
      expect(typeof store.z_score).toBe('number');
      expect(typeof store.months_observed).toBe('number');
    }
  });

  it('outlier_stores is sorted by |z_score| descending', async () => {
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(buildRows()), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    const stores = body.outlier_stores;
    for (let i = 1; i < stores.length; i++) {
      expect(Math.abs(stores[i - 1].z_score)).toBeGreaterThanOrEqual(Math.abs(stores[i].z_score));
    }
  });

  it('mt-horeb (high outlier) appears in outlier_stores', async () => {
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(buildRows()), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    const body = await res.json();
    const horeb = body.outlier_stores.find((s) => s.slug === 'mt-horeb');
    expect(horeb).toBeDefined();
    expect(horeb.z_score).toBeGreaterThan(1.5);
    expect(horeb.avg_unique_flavors_per_month).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Cadence variance tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/geo-eda -- cadence_variance', () => {
  it('cadence_variance entries have required fields', async () => {
    // Build enough appearances (>= 5) so the flavor qualifies
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date('2024-01-01');
      d.setDate(d.getDate() + i * 30);
      rows.push({
        slug: 'mt-horeb',
        date: d.toISOString().slice(0, 10),
        flavor: 'Caramel Cashew',
        normalized_flavor: 'caramel cashew',
      });
    }
    const url = makeUrl({ scope: 'state', region: 'WI' });
    const env = { DB: createMockD1(rows), _storeIndexOverride: MOCK_STORE_INDEX };
    const res = await handleGeoEDA(url, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const entry of body.cadence_variance) {
      expect(typeof entry.flavor).toBe('string');
      expect(typeof entry.avg_gap_days).toBe('number');
      expect(typeof entry.national_avg_gap_days).toBe('number');
      expect(typeof entry.variance_ratio).toBe('number');
    }
  });
});
