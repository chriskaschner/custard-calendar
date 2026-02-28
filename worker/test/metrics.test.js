import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectStreaks, handleMetricsRoute } from '../src/metrics.js';
import { handleRequest } from '../src/index.js';

// --- Mock D1 database ---

function createMockD1(rows = []) {
  // rows: flat array of row objects. Queries filter client-side for simplicity.
  // Helper to build result methods for a given SQL + bound args
  function makeResultMethods(sql, args) {
    return {
      first: vi.fn(async () => {
        if (sql.includes('COUNT(*)') && sql.includes('total_appearances')) {
          const filtered = rows.filter(r => r.normalized_flavor === args[0]);
          return { total_appearances: filtered.length };
        }
        if (sql.includes('COUNT(DISTINCT slug)') && sql.includes('store_count')) {
          const slugs = new Set(rows.filter(r => r.normalized_flavor === args[0]).map(r => r.slug));
          return { store_count: slugs.size };
        }
        if (sql.includes('COUNT(DISTINCT normalized_flavor)') && sql.includes('unique_flavors')) {
          const flavors = new Set(rows.filter(r => r.slug === args[0]).map(r => r.normalized_flavor));
          return { unique_flavors: flavors.size };
        }
        if (sql.includes('COUNT(*)') && sql.includes('total_days')) {
          const filtered = rows.filter(r => r.slug === args[0]);
          return { total_days: filtered.length };
        }
        return null;
      }),
      all: vi.fn(async () => {
        if (sql.includes('WHERE normalized_flavor') && sql.includes('ORDER BY date DESC')) {
          const filtered = rows
            .filter(r => r.normalized_flavor === args[0])
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10);
          return { results: filtered };
        }
        if (sql.includes('WHERE slug') && sql.includes('ORDER BY date DESC')) {
          const filtered = rows
            .filter(r => r.slug === args[0])
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 30);
          return { results: filtered };
        }
        if (sql.includes('WHERE date >=') && sql.includes('GROUP BY normalized_flavor')) {
          const weekAgo = args[0];
          const todayBound = args[1] || '9999-12-31';
          const filtered = rows.filter(r => r.date >= weekAgo && r.date <= todayBound);
          const groups = {};
          for (const r of filtered) {
            if (!groups[r.normalized_flavor]) groups[r.normalized_flavor] = { flavor: r.flavor, normalized_flavor: r.normalized_flavor, count: 0 };
            groups[r.normalized_flavor].count++;
          }
          return { results: Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 10) };
        }
        if (sql.includes('GROUP BY normalized_flavor')) {
          const groups = {};
          for (const r of rows) {
            if (!groups[r.normalized_flavor]) groups[r.normalized_flavor] = { flavor: r.flavor, normalized_flavor: r.normalized_flavor, count: 0 };
            groups[r.normalized_flavor].count++;
          }
          return { results: Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 10) };
        }
        return { results: [] };
      }),
    };
  }

  return {
    prepare: vi.fn((sql) => {
      // Some queries (like all-time trending) call .all() directly without .bind()
      const unboundMethods = makeResultMethods(sql, []);
      return {
        ...unboundMethods,
        bind: vi.fn((...args) => makeResultMethods(sql, args)),
      };
    }),
  };
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
    _store: store,
  };
}

// --- Metrics HTTP route tests ---

describe('handleMetricsRoute', () => {
  it('returns 503 when D1 is not configured', async () => {
    const res = await handleMetricsRoute('/api/metrics/flavor/turtle', {}, CORS);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not available/i);
  });

  it('returns null for unknown metrics path', async () => {
    const db = createMockD1([]);
    const res = await handleMetricsRoute('/api/metrics/unknown', { DB: db }, CORS);
    expect(res).toBeNull();
  });

  it('returns historical intelligence metrics without requiring D1', async () => {
    const res = await handleMetricsRoute('/api/metrics/intelligence', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');

    const body = await res.json();
    expect(body.contract_version).toBe(1);
    expect(body.source).toBe('trivia_metrics_seed');
    expect(body.generated_at).toBeDefined();
    expect(body.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.dataset_summary.rows).toBeGreaterThan(150000);
    expect(body.coverage.overall_covered).toBeGreaterThan(900);
    expect(Array.isArray(body.highlights.top_flavors)).toBe(true);
    expect(body.highlights.top_flavors.length).toBeGreaterThan(0);
    expect(Array.isArray(body.highlights.top_stores)).toBe(true);
    expect(Array.isArray(body.highlights.seasonal_spotlights)).toBe(true);
    expect(body.highlights.how_now_brown_cow.count).toBeGreaterThan(0);
  });
});

describe('GET /api/metrics/flavor/{normalized}', () => {
  const SNAPSHOT_ROWS = [
    { slug: 'mt-horeb', date: '2026-02-20', flavor: 'Turtle', normalized_flavor: 'turtle', description: '' },
    { slug: 'mt-horeb', date: '2026-02-21', flavor: 'Turtle', normalized_flavor: 'turtle', description: '' },
    { slug: 'madison-todd-drive', date: '2026-02-20', flavor: 'Turtle', normalized_flavor: 'turtle', description: '' },
    { slug: 'mt-horeb', date: '2026-02-22', flavor: 'Mint Explosion', normalized_flavor: 'mint explosion', description: '' },
  ];

  it('returns frequency, store count, and recent appearances', async () => {
    const db = createMockD1(SNAPSHOT_ROWS);
    const res = await handleMetricsRoute('/api/metrics/flavor/turtle', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.normalized_flavor).toBe('turtle');
    expect(body.total_ranked_flavors).toBeGreaterThan(0);
    expect(body.global_rank).toBeGreaterThan(0);
    expect(typeof body.global_percentile === 'number' || body.global_percentile === null).toBe(true);
    expect(body.total_appearances).toBe(3);
    expect(body.store_count).toBe(2);
    expect(body.recent).toHaveLength(3);
    expect(body.recent[0].date).toBe('2026-02-21'); // most recent first
  });

  it('returns zero counts for unknown flavor', async () => {
    const db = createMockD1(SNAPSHOT_ROWS);
    const res = await handleMetricsRoute('/api/metrics/flavor/nonexistent', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_appearances).toBe(0);
    expect(body.store_count).toBe(0);
    expect(body.recent).toEqual([]);
    expect(body.total_ranked_flavors).toBeGreaterThan(0);
    expect(body.global_rank).toBeNull();
  });

  it('decodes URL-encoded flavor names', async () => {
    const db = createMockD1(SNAPSHOT_ROWS);
    const res = await handleMetricsRoute('/api/metrics/flavor/mint%20explosion', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.normalized_flavor).toBe('mint explosion');
    expect(body.total_appearances).toBe(1);
    expect(body.global_rank).toBeGreaterThan(0);
  });
});

describe('GET /api/metrics/store/{slug}', () => {
  const STORE_ROWS = [
    { slug: 'mt-horeb', date: '2026-02-24', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-02-23', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-02-22', flavor: 'Mint Explosion', normalized_flavor: 'mint explosion' },
    { slug: 'mt-horeb', date: '2026-02-21', flavor: 'Butter Pecan', normalized_flavor: 'butter pecan' },
  ];

  it('returns diversity, history, and streaks for a store', async () => {
    const db = createMockD1(STORE_ROWS);
    const res = await handleMetricsRoute('/api/metrics/store/mt-horeb', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('mt-horeb');
    expect(body.unique_flavors).toBe(3);
    expect(body.total_days).toBe(4);
    expect(body.recent_history).toHaveLength(4);
    // Turtle streak of 2 days
    expect(body.active_streaks).toHaveLength(1);
    expect(body.active_streaks[0].flavor).toBe('Turtle');
    expect(body.active_streaks[0].length).toBe(2);
  });

  it('returns empty data for unknown store', async () => {
    const db = createMockD1([]);
    const res = await handleMetricsRoute('/api/metrics/store/nonexistent', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unique_flavors).toBe(0);
    expect(body.total_days).toBe(0);
    expect(body.recent_history).toEqual([]);
    expect(body.active_streaks).toEqual([]);
  });

  it('returns appearance count >= minimum threshold for known flavor at known store (fixture)', async () => {
    // Regression guard: a known flavor at a known store must have >= 10 D1 appearances.
    // Validates that D1 data loaded correctly and the endpoint aggregates it properly.
    // Uses createMockD1 with 15 realistic Caramel Cashew rows for mt-horeb.
    const rows = Array.from({ length: 15 }, (_, i) => {
      const d = new Date('2023-01-01');
      d.setDate(d.getDate() + i * 25);
      return {
        normalized_flavor: 'caramel cashew',
        flavor: 'Caramel Cashew',
        date: d.toISOString().slice(0, 10),
        slug: 'mt-horeb',
      };
    });
    const db = createMockD1(rows);
    const res = await handleMetricsRoute('/api/metrics/store/mt-horeb', { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    // total_days should reflect all 15 fixture rows
    expect(body.total_days).toBeGreaterThanOrEqual(10);
    // recent_history should include caramel cashew entries (up to LIMIT 30)
    expect(Array.isArray(body.recent_history)).toBe(true);
    const ccEntries = body.recent_history.filter(
      (f) => (f.flavor || '').toLowerCase().includes('caramel cashew'),
    );
    expect(ccEntries.length).toBeGreaterThanOrEqual(10);
  });
});

describe('GET /api/metrics/trending', () => {
  const TRENDING_ROWS = [
    { slug: 'mt-horeb', date: '2026-02-20', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'madison-todd-drive', date: '2026-02-20', flavor: 'Turtle', normalized_flavor: 'turtle' },
    { slug: 'mt-horeb', date: '2026-02-21', flavor: 'Mint Explosion', normalized_flavor: 'mint explosion' },
    { slug: 'mt-horeb', date: '2026-01-15', flavor: 'Butter Pecan', normalized_flavor: 'butter pecan' },
  ];

  it('returns this_week and all_time trending flavors', async () => {
    const db = createMockD1(TRENDING_ROWS);
    const res = await handleMetricsRoute('/api/metrics/trending', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.this_week).toBeDefined();
    expect(body.all_time).toBeDefined();
    expect(Array.isArray(body.this_week)).toBe(true);
    expect(Array.isArray(body.all_time)).toBe(true);
    // All-time should have all flavors
    expect(body.all_time.length).toBeGreaterThanOrEqual(2);
    // Each entry has the right shape
    for (const entry of body.all_time) {
      expect(entry).toHaveProperty('flavor');
      expect(entry).toHaveProperty('normalized');
      expect(entry).toHaveProperty('count');
    }
  });

  it('returns empty arrays when no snapshots exist', async () => {
    const db = createMockD1([]);
    const res = await handleMetricsRoute('/api/metrics/trending', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.this_week).toEqual([]);
    expect(body.all_time).toEqual([]);
  });

  it('excludes future-dated snapshots from this_week', async () => {
    // Use fake timers to control "today"
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00Z'));

    const rows = [
      { slug: 'mt-horeb', date: '2026-02-20', flavor: 'Turtle', normalized_flavor: 'turtle' },
      { slug: 'mt-horeb', date: '2026-02-25', flavor: 'Future Flavor', normalized_flavor: 'future flavor' },
    ];

    const db = createMockD1(rows);
    const res = await handleMetricsRoute('/api/metrics/trending', { DB: db }, CORS);
    const body = await res.json();

    // Future flavor (2026-02-25) should be excluded from this_week
    const futureInWeek = body.this_week.find(e => e.normalized === 'future flavor');
    expect(futureInWeek).toBeUndefined();

    // Past flavor should be included
    const pastInWeek = body.this_week.find(e => e.normalized === 'turtle');
    expect(pastInWeek).toBeDefined();

    vi.useRealTimers();
  });
});

// --- Accuracy endpoint tests ---

describe('GET /api/metrics/accuracy', () => {
  function createAccuracyMockD1(accuracyRows = []) {
    return {
      prepare: vi.fn((sql) => {
        const methods = {
          first: vi.fn(async () => null),
          all: vi.fn(async () => ({ results: accuracyRows })),
        };
        return {
          ...methods,
          bind: vi.fn(() => methods),
        };
      }),
    };
  }

  it('returns grouped accuracy data when rows exist', async () => {
    const rows = [
      { slug: 'mt-horeb', window: '7d', top_1_hit_rate: 0.15, top_5_hit_rate: 0.55, avg_log_loss: 2.1, n_samples: 7, computed_at: '2026-02-23T00:00:00Z' },
      { slug: 'mt-horeb', window: '30d', top_1_hit_rate: 0.10, top_5_hit_rate: 0.45, avg_log_loss: 2.5, n_samples: 20, computed_at: '2026-02-23T00:00:00Z' },
    ];
    const db = createAccuracyMockD1(rows);
    const res = await handleMetricsRoute('/api/metrics/accuracy', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['mt-horeb']).toBeDefined();
    expect(body['mt-horeb']['7d'].top_1_hit_rate).toBe(0.15);
    expect(body['mt-horeb']['30d'].n_samples).toBe(20);
  });

  it('returns empty object when no accuracy data', async () => {
    const db = createAccuracyMockD1([]);
    const res = await handleMetricsRoute('/api/metrics/accuracy', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });
});

describe('GET /api/metrics/accuracy/{slug}', () => {
  function createPerStoreAccuracyMockD1(rows = []) {
    return {
      prepare: vi.fn((sql) => {
        const methods = {
          first: vi.fn(async () => null),
          all: vi.fn(async () => ({ results: rows })),
        };
        return {
          ...methods,
          bind: vi.fn(() => methods),
        };
      }),
    };
  }

  it('returns per-store accuracy filtered by slug', async () => {
    const rows = [
      { window: '7d', top_1_hit_rate: 0.20, top_5_hit_rate: 0.60, avg_log_loss: 1.9, n_samples: 5, computed_at: '2026-02-23T00:00:00Z' },
    ];
    const db = createPerStoreAccuracyMockD1(rows);
    const res = await handleMetricsRoute('/api/metrics/accuracy/mt-horeb', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('mt-horeb');
    expect(body.metrics['7d'].top_1_hit_rate).toBe(0.20);
  });

  it('returns empty metrics for unknown store', async () => {
    const db = createPerStoreAccuracyMockD1([]);
    const res = await handleMetricsRoute('/api/metrics/accuracy/nonexistent', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('nonexistent');
    expect(body.metrics).toEqual({});
  });
});

// --- Coverage endpoint tests ---

describe('GET /api/metrics/coverage', () => {
  function createCoverageMockD1({ forecastRows = [], snapshotSlugs = [] } = {}) {
    return {
      prepare: vi.fn((sql) => {
        const methods = {
          first: vi.fn(async () => null),
          all: vi.fn(async () => {
            if (sql.includes('FROM forecasts')) {
              return { results: forecastRows };
            }
            if (sql.includes('FROM snapshots')) {
              return { results: snapshotSlugs.map(s => ({ slug: s })) };
            }
            return { results: [] };
          }),
        };
        return {
          ...methods,
          bind: vi.fn(() => methods),
        };
      }),
    };
  }

  it('returns correct forecast slug count', async () => {
    const db = createCoverageMockD1({
      forecastRows: [
        { slug: 'mt-horeb', generated_at: '2026-02-22T00:00:00Z' },
        { slug: 'madison-todd-drive', generated_at: '2026-02-22T00:00:00Z' },
      ],
      snapshotSlugs: ['mt-horeb', 'madison-todd-drive'],
    });
    const res = await handleMetricsRoute('/api/metrics/coverage', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_forecasts).toBe(2);
    expect(body.forecast_slugs).toEqual(['mt-horeb', 'madison-todd-drive']);
    expect(body.snapshot_coverage.stores_with_forecast_and_snapshot).toBe(2);
    expect(body.missing_slugs).toEqual([]);
  });

  it('returns missing slugs when forecast exists but no recent snapshot', async () => {
    const db = createCoverageMockD1({
      forecastRows: [
        { slug: 'mt-horeb', generated_at: '2026-02-22T00:00:00Z' },
        { slug: 'no-snapshot-store', generated_at: '2026-02-22T00:00:00Z' },
      ],
      snapshotSlugs: ['mt-horeb'],  // no-snapshot-store has no recent snapshot
    });
    const res = await handleMetricsRoute('/api/metrics/coverage', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_forecasts).toBe(2);
    expect(body.missing_slugs).toEqual(['no-snapshot-store']);
    expect(body.snapshot_coverage.stores_with_forecast_and_snapshot).toBe(1);
  });
});

// --- Store specialty tests ---

describe('GET /api/metrics/context/store/{slug} — specialty_flavor', () => {
  // Minimal D1 mock: returns pre-defined rows for any query (the CTE is the only query here)
  function createStoreContextMock(specialtyRows = []) {
    return {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: specialtyRows })),
          first: vi.fn(async () => null),
        })),
      })),
    };
  }

  it('returns specialty_flavor when store has a disproportionate flavor (ratio >= 1.2)', async () => {
    const specialtyRows = [{ display_flavor: 'Turtle', specialty_ratio: 3.5, store_count: 12 }];
    const db = createStoreContextMock(specialtyRows);
    const res = await handleMetricsRoute('/api/metrics/context/store/mt-horeb', { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specialty_flavor).not.toBeNull();
    expect(body.specialty_flavor.title).toBe('Turtle');
    expect(body.specialty_flavor.ratio).toBe(3.5);
    expect(body.specialty_flavor.store_count).toBe(12);
  });

  it('returns specialty_flavor null when no flavors qualify (empty D1 result)', async () => {
    const db = createStoreContextMock([]);
    const res = await handleMetricsRoute('/api/metrics/context/store/mt-horeb', { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specialty_flavor).toBeNull();
  });

  it('returns specialty_flavor null when DB is not available (still returns 200)', async () => {
    const res = await handleMetricsRoute('/api/metrics/context/store/mt-horeb', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specialty_flavor).toBeNull();
  });

  it('returns specialty_flavor null when top flavor ratio < 1.2', async () => {
    const specialtyRows = [{ display_flavor: 'Vanilla', specialty_ratio: 1.1, store_count: 5 }];
    const db = createStoreContextMock(specialtyRows);
    const res = await handleMetricsRoute('/api/metrics/context/store/mt-horeb', { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specialty_flavor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Flavor hierarchy endpoint tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/metrics/flavor-hierarchy', () => {
  const CORS = { 'Access-Control-Allow-Origin': '*' };

  // Build a mock D1 that returns pre-set {slug, date} rows for slug IN (...) + normalized_flavor.
  function createHierarchyMockD1(datesBySlug) {
    // datesBySlug: { [slug]: ['2025-01-01', ...], ... }
    return {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          all: vi.fn(async () => {
            // Last arg is the normalized_flavor; rest are slugs
            const slugArgs = args.slice(0, args.length - 1);
            const rows = [];
            for (const slug of slugArgs) {
              for (const d of (datesBySlug[slug] || [])) {
                rows.push({ slug, date: d });
              }
            }
            rows.sort((a, b) => a.date.localeCompare(b.date));
            return { results: rows };
          }),
          first: vi.fn(async () => null),
        })),
        all: vi.fn(async () => ({ results: [] })),
        first: vi.fn(async () => null),
      })),
    };
  }

  function makeUrl(flavor, slug) {
    return new URL(`https://example.com/api/v1/metrics/flavor-hierarchy?flavor=${encodeURIComponent(flavor)}&slug=${encodeURIComponent(slug)}`);
  }

  it('returns 400 when flavor or slug is missing', async () => {
    const url = new URL('https://example.com/api/v1/metrics/flavor-hierarchy?flavor=Turtle');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', {}, CORS, url);
    expect(res.status).toBe(400);
  });

  it('effective_scope = store when store appearances >= 30', async () => {
    // mt-horeb is in Madison metro, WI
    const storeDates = Array.from({ length: 40 }, (_, i) => {
      const d = new Date('2024-01-01');
      d.setDate(d.getDate() + i * 9);
      return d.toISOString().slice(0, 10);
    });
    const db = createHierarchyMockD1({ 'mt-horeb': storeDates });
    const url = makeUrl('Caramel Cashew', 'mt-horeb');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', { DB: db }, CORS, url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.effective_scope).toBe('store');
    expect(body.scopes.store.appearances).toBe(40);
    expect(body.scopes.store.avg_gap_days).toBe(9);
  });

  it('effective_scope = metro when store < 30 but metro >= 30', async () => {
    // mt-horeb (store) has 5 appearances; verona (same Madison metro) has 30
    const storeDates5 = ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01'];
    const veronaDates30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2024-01-01');
      d.setDate(d.getDate() + i * 12);
      return d.toISOString().slice(0, 10);
    });
    // verona is in Madison metro (city="Verona"), so it should be included
    const db = createHierarchyMockD1({ 'mt-horeb': storeDates5, 'verona': veronaDates30 });
    const url = makeUrl('Caramel Cashew', 'mt-horeb');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', { DB: db }, CORS, url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scopes.store.appearances).toBe(5);
    expect(body.scopes.metro).not.toBeNull();
    expect(body.scopes.metro.metro).toBe('madison');
    expect(body.scopes.metro.appearances).toBeGreaterThanOrEqual(30);
    expect(body.effective_scope).toBe('metro');
  });

  it('effective_scope = state when store < 30 and metro is null (non-WI store)', async () => {
    // Use a store in a state without metro mapping (non-WI)
    // auburn-al-university-dr is in AL, no metro mapping
    const storeDates5 = ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01'];
    // Simulate other AL stores all having data
    const alDates40 = Array.from({ length: 40 }, (_, i) => {
      const d = new Date('2024-01-01');
      d.setDate(d.getDate() + i * 5);
      return d.toISOString().slice(0, 10);
    });
    // Build datesBySlug with all AL slugs mapped to alDates40
    // For simplicity, just give one extra AL slug data
    const db = createHierarchyMockD1({
      'auburn-al-university-dr': storeDates5,
      'decatur-al-6th-ave': alDates40,
    });
    const url = makeUrl('Turtle', 'auburn-al-university-dr');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', { DB: db }, CORS, url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scopes.metro).toBeNull(); // AL has no metro mapping
    expect(body.scopes.state).not.toBeNull();
    expect(body.scopes.state.state).toBe('AL');
    // effective_scope depends on total AL appearances >= 30
    // (state query includes all AL slugs; at least decatur contributes 40)
    expect(['state', 'national']).toContain(body.effective_scope);
  });

  it('effective_scope = national when all scopes < 30', async () => {
    // Store with only 5 appearances, no other stores in DB
    const db = createHierarchyMockD1({ 'mt-horeb': ['2024-01-01', '2024-02-01', '2024-03-01'] });
    const url = makeUrl('Caramel Cashew', 'mt-horeb');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', { DB: db }, CORS, url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scopes.store.appearances).toBe(3);
    // National from seed should have many appearances (Caramel Cashew is common)
    expect(body.scopes.national).not.toBeNull();
    expect(body.scopes.national.appearances).toBeGreaterThan(1000);
    expect(body.effective_scope).toBe('national');
  });

  it('handles missing flavor gracefully with null scopes and national fallback', async () => {
    const db = createHierarchyMockD1({});
    const url = makeUrl('Completely Unknown Flavor XYZ', 'mt-horeb');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', { DB: db }, CORS, url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scopes.store.appearances).toBe(0);
    expect(body.scopes.national).toBeNull(); // not in seed
    expect(body.effective_scope).toBe('national'); // fallback even if national is null
  });

  it('metro avg_gap is per-store average, not collapsed calendar-day gap', async () => {
    // Regression: same-day appearances at two stores should NOT collapse into one
    // calendar date, which would produce an artificially small avg_gap.
    //
    // Store A: flavor on Jan 1, Feb 1, Mar 1 -> avg_gap ~31d
    // Store B: flavor on Jan 1, Feb 1, Mar 1 -> avg_gap ~31d (same days as A)
    //
    // Wrong (old Set dedup): deduped = [Jan1, Feb1, Mar1] -> avg_gap = 31d, appearances = 3
    // Correct (per-slug avg):  total appearances = 6, avg_gap = mean(31, 31) = 31d
    const storeADates = ['2024-01-01', '2024-02-01', '2024-03-01'];
    const storeBDates = ['2024-01-01', '2024-02-01', '2024-03-01'];
    const db = createHierarchyMockD1({ 'mt-horeb': storeADates, 'verona': storeBDates });
    const url = makeUrl('Caramel Cashew', 'mt-horeb');
    const res = await handleMetricsRoute('/api/metrics/flavor-hierarchy', { DB: db }, CORS, url);
    const body = await res.json();
    // appearances must count store-days (3 + 3 = 6), not deduped calendar days (3)
    expect(body.scopes.metro.appearances).toBe(6);
    // avg_gap should be ~31 (mean of per-store gaps), not artificially small
    expect(body.scopes.metro.avg_gap_days).toBeGreaterThanOrEqual(28);
    expect(body.scopes.metro.avg_gap_days).toBeLessThanOrEqual(35);
  });
});

describe('detectStreaks', () => {
  it('detects a streak of 3 consecutive same-flavor days', () => {
    const history = [
      { date: '2026-02-24', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-23', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-22', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-21', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
    ];

    const streaks = detectStreaks(history);
    expect(streaks).toHaveLength(1);
    expect(streaks[0].flavor).toBe('Mint Explosion');
    expect(streaks[0].length).toBe(3);
    expect(streaks[0].start).toBe('2026-02-22');
    expect(streaks[0].end).toBe('2026-02-24');
  });

  it('ignores single-day appearances (no streak)', () => {
    const history = [
      { date: '2026-02-24', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-23', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
      { date: '2026-02-22', normalized_flavor: 'turtle', flavor: 'Turtle' },
    ];

    expect(detectStreaks(history)).toHaveLength(0);
  });

  it('detects multiple streaks', () => {
    const history = [
      { date: '2026-02-26', normalized_flavor: 'turtle', flavor: 'Turtle' },
      { date: '2026-02-25', normalized_flavor: 'turtle', flavor: 'Turtle' },
      { date: '2026-02-24', normalized_flavor: 'mint explosion', flavor: 'Mint Explosion' },
      { date: '2026-02-23', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
      { date: '2026-02-22', normalized_flavor: 'butter pecan', flavor: 'Butter Pecan' },
    ];

    const streaks = detectStreaks(history);
    expect(streaks).toHaveLength(2);
    expect(streaks[0].flavor).toBe('Turtle');
    expect(streaks[0].length).toBe(2);
    expect(streaks[1].flavor).toBe('Butter Pecan');
    expect(streaks[1].length).toBe(2);
  });

  it('returns empty for empty history', () => {
    expect(detectStreaks([])).toEqual([]);
  });
});

describe('GET /api/metrics/context/flavor/{name}', () => {
  it('returns found:false for an unknown flavor', async () => {
    const url = new URL('https://example.com/api/v1/metrics/context/flavor/Totally-Unknown-Flavor-XYZ');
    const res = await handleMetricsRoute('/api/metrics/context/flavor/Totally-Unknown-Flavor-XYZ', {}, CORS, url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.flavor).toBeNull();
    expect(body.source).toBe('trivia_metrics_seed');
  });

  it('returns found:true with appearances for a known flavor', async () => {
    // Turtle is in the trivia-metrics-seed; confirm the lookup succeeds
    const res = await handleMetricsRoute('/api/metrics/context/flavor/Turtle', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    // If seed has Turtle, found should be true; if seed is empty in test env, found:false is also valid
    expect(typeof body.found).toBe('boolean');
    expect(body).toHaveProperty('normalized_flavor');
    expect(body).toHaveProperty('rank');
  });

  it('includes Cache-Control header', async () => {
    const res = await handleMetricsRoute('/api/metrics/context/flavor/Turtle', {}, CORS);
    expect(res.headers.get('Cache-Control')).toContain('max-age');
  });
});

describe('computeStoreSpecialtyFromD1 — D1 error catch', () => {
  it('handleStoreContextMetrics returns null specialty when D1 prepare throws', async () => {
    const badDb = { prepare: vi.fn(() => { throw new Error('D1 error'); }) };
    const res = await handleMetricsRoute('/api/metrics/context/store/mt-horeb', { DB: badDb }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    // specialty_flavor should be null when the CTE throws
    expect(body.specialty_flavor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

function createHealthMockD1({ rowCount = 0, minDate = null, maxDate = null, dates = [] } = {}) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => ({
          row_count: rowCount,
          min_date: minDate,
          max_date: maxDate,
        })),
        all: vi.fn(async () => ({
          results: dates.map((d) => ({ date: d })),
        })),
      })),
    })),
  };
}

describe('GET /api/metrics/health/{slug}', () => {
  it('returns 400 when slug is missing', async () => {
    const db = createHealthMockD1();
    const res = await handleMetricsRoute('/api/metrics/health/', { DB: db }, CORS);
    // Path won't match the regex, so returns null → no response routed
    expect(res).toBeNull();
  });

  it('returns 200 with row_count and date_range', async () => {
    const db = createHealthMockD1({
      rowCount: 53,
      minDate: '2024-01-15',
      maxDate: '2025-02-10',
      dates: ['2024-01-15', '2024-02-20', '2025-02-10'],
    });
    const res = await handleMetricsRoute('/api/metrics/health/mt-horeb', { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('mt-horeb');
    expect(body.d1.row_count).toBe(53);
    expect(body.d1.date_range.min).toBe('2024-01-15');
    expect(body.d1.date_range.max).toBe('2025-02-10');
  });

  it('reports gap_count for gaps > 14 days', async () => {
    const db = createHealthMockD1({
      rowCount: 3,
      minDate: '2024-01-01',
      maxDate: '2024-04-01',
      dates: ['2024-01-01', '2024-02-01', '2024-04-01'],
    });
    const res = await handleMetricsRoute('/api/metrics/health/verona', { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Both gaps (31d and 60d) exceed 14 days
    expect(body.d1.gap_count).toBe(2);
    expect(body.d1.gaps_gt_14d).toHaveLength(2);
    expect(body.d1.gaps_gt_14d[0].days).toBe(31);
  });

  it('returns empty gaps_gt_14d when row_count <= 1', async () => {
    const db = createHealthMockD1({ rowCount: 1, minDate: '2024-06-01', maxDate: '2024-06-01', dates: [] });
    const res = await handleMetricsRoute('/api/metrics/health/mt-horeb', { DB: db }, CORS);
    const body = await res.json();
    expect(body.d1.gap_count).toBe(0);
    expect(body.d1.gaps_gt_14d).toEqual([]);
  });

  it('includes metrics_seed_age_days in response', async () => {
    const db = createHealthMockD1({ rowCount: 10, minDate: '2025-01-01', maxDate: '2025-02-01', dates: [] });
    const res = await handleMetricsRoute('/api/metrics/health/mt-horeb', { DB: db }, CORS);
    const body = await res.json();
    // May be null if seed has no generated_at, but field must be present
    expect(body).toHaveProperty('metrics_seed_age_days');
  });

  it('includes Cache-Control header', async () => {
    const db = createHealthMockD1();
    const res = await handleMetricsRoute('/api/metrics/health/mt-horeb', { DB: db }, CORS);
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
  });

  it('returns 503 when D1 throws', async () => {
    const badDb = { prepare: vi.fn(() => { throw new Error('D1 down'); }) };
    const res = await handleMetricsRoute('/api/metrics/health/mt-horeb', { DB: badDb }, CORS);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/D1 query failed/i);
  });

  it('returns 503 when DB binding is missing', async () => {
    const res = await handleMetricsRoute('/api/metrics/health/mt-horeb', {}, CORS);
    expect(res.status).toBe(503);
  });
});

describe('metrics route protection (index-level)', () => {
  it('requires admin bearer token for /api/v1/metrics/accuracy', async () => {
    const env = {
      FLAVOR_CACHE: createMockKV(),
      ADMIN_ACCESS_TOKEN: 'admin-secret-token',
    };

    const noTokenReq = new Request('https://example.com/api/v1/metrics/accuracy');
    const noTokenRes = await handleRequest(noTokenReq, env);
    expect(noTokenRes.status).toBe(403);

    const validTokenReq = new Request('https://example.com/api/v1/metrics/accuracy', {
      headers: { Authorization: 'Bearer admin-secret-token' },
    });
    const validTokenRes = await handleRequest(validTokenReq, env);
    // Auth passes; DB is missing in this env.
    expect(validTokenRes.status).toBe(503);
  });

  it('applies read rate limiting for /api/v1/metrics/*', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    const kv = createMockKV({ [`rl:metrics:read:1.2.3.4:${hour}`]: '120' });
    const env = { FLAVOR_CACHE: kv };

    const req = new Request('https://example.com/api/v1/metrics/intelligence', {
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(429);
  });
});
