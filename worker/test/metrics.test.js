import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectStreaks, handleMetricsRoute } from '../src/metrics.js';

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
    expect(body.dataset_summary.rows).toBeGreaterThan(300000);
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
  });

  it('decodes URL-encoded flavor names', async () => {
    const db = createMockD1(SNAPSHOT_ROWS);
    const res = await handleMetricsRoute('/api/metrics/flavor/mint%20explosion', { DB: db }, CORS);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.normalized_flavor).toBe('mint explosion');
    expect(body.total_appearances).toBe(1);
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
