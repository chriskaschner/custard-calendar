/**
 * Tests for three-gate rarity system in route-today.js (S06-T01).
 *
 * Gate 1: Data quality  -- ≥10 appearances AND ≥90-day span
 * Gate 2: Network-wide  -- ≤100 stores serving flavor in last 30 days
 * Gate 3: Thresholds    -- Ultra Rare >150 days, Rare 90-150 days
 */
import { describe, it, expect, vi } from 'vitest';
import { handleApiToday } from '../src/route-today.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDates(count, gapDays, endDate) {
  const dates = [];
  const end = new Date((endDate || '2026-03-22') + 'T00:00:00Z').getTime();
  for (let i = 0; i < count; i++) {
    const ts = end - (count - 1 - i) * gapDays * 86400000;
    dates.push({ date: new Date(ts).toISOString().slice(0, 10) });
  }
  return dates;
}

function makeEnv(overrides = {}) {
  const {
    appearances = 15,
    gapDays = 200,       // Default: ultra-rare gap
    networkCount = 2,    // Default: very few stores
    today = '2026-03-22',
  } = overrides;

  const flavorDates = makeDates(appearances, gapDays, today);

  return {
    DB: {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          all: vi.fn(async () => {
            // Route-today sends 3 queries:
            // 1. snapshot dates for this flavor at this store
            // 2. all flavor counts for this store
            // 3. network-wide distinct stores in last 30 days
            if (sql.includes('WHERE slug = ? AND normalized_flavor = ?')) {
              return { results: flavorDates };
            }
            if (sql.includes('COUNT(*) as cnt FROM snapshots WHERE slug =')) {
              return { results: [{ normalized_flavor: 'turtle', cnt: appearances }] };
            }
            return { results: [] };
          }),
          first: vi.fn(async () => {
            // Network count query
            return { cnt: networkCount };
          }),
        })),
      })),
    },
    FLAVOR_CACHE: null,
    _validSlugsOverride: new Set(['mt-horeb']),
  };
}

function makeKV() {
  const store = new Map();
  return {
    get: vi.fn(async (k) => store.get(k) || null),
    put: vi.fn(async (k, v) => store.set(k, v)),
  };
}

function mockFetchFlavors(today) {
  return vi.fn(async (_slug) => ({
    name: 'Mt. Horeb',
    flavors: [{ date: today, title: 'Turtle', description: 'Caramel pecan custard.' }],
  }));
}

async function callToday(envOverrides = {}, today = '2026-03-22') {
  const url = new URL('https://example.com/api/v1/today?slug=mt-horeb');
  const env = {
    ...makeEnv({ today, ...envOverrides }),
    FLAVOR_CACHE: makeKV(),
  };
  const corsHeaders = {};
  const fetchFlavors = mockFetchFlavors(today);
  // Inject today as reference date via mocking Date
  const origDate = Date;
  vi.spyOn(global, 'Date').mockImplementation(function (...args) {
    if (args.length === 0) return new origDate(today + 'T12:00:00Z');
    return new origDate(...args);
  });
  global.Date.prototype = origDate.prototype;
  global.Date.now = () => new origDate(today + 'T12:00:00Z').getTime();

  let res;
  try {
    res = await handleApiToday(url, env, corsHeaders, fetchFlavors);
  } finally {
    vi.restoreAllMocks();
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Gate 1: data quality
// ---------------------------------------------------------------------------

describe('route-today rarity gate 1: data quality', () => {
  it('suppresses rarity when fewer than 10 appearances', async () => {
    // 5 appearances, large gap days -- should NOT get rarity label
    const result = await callToday({ appearances: 5, gapDays: 200 });
    expect(result.rarity).not.toBeNull();
    expect(result.rarity.appearances).toBe(5);
    expect(result.rarity.label).toBeNull();
  });

  it('suppresses rarity when span < 90 days (many closely-spaced appearances)', async () => {
    // 15 appearances each 3 days apart = 42-day span < 90 days
    const result = await callToday({ appearances: 15, gapDays: 3 });
    expect(result.rarity).not.toBeNull();
    expect(result.rarity.label).toBeNull();
  });

  it('allows rarity when ≥10 appearances and ≥90-day span', async () => {
    // 12 appearances, 15-day gap = 165-day span; avg gap 15d -- below thresholds though
    // Use 200-day gap for ultra-rare result
    const result = await callToday({ appearances: 12, gapDays: 160 });
    // span = 11 * 160 = 1760 days >= 90, appearances = 12 >= 10
    // avg_gap = 160 > 150 => Ultra Rare
    expect(result.rarity?.label).toBe('Ultra Rare');
  });
});

// ---------------------------------------------------------------------------
// Gate 2: network-wide suppression
// ---------------------------------------------------------------------------

describe('route-today rarity gate 2: network-wide', () => {
  it('suppresses rarity when >100 stores served flavor in last 30 days', async () => {
    const result = await callToday({ appearances: 15, gapDays: 200, networkCount: 150 });
    expect(result.rarity?.label).toBeNull();
  });

  it('allows rarity when ≤100 stores served flavor in last 30 days', async () => {
    const result = await callToday({ appearances: 15, gapDays: 200, networkCount: 50 });
    expect(result.rarity?.label).toBe('Ultra Rare');
  });

  it('allows rarity at boundary (exactly 100 stores)', async () => {
    const result = await callToday({ appearances: 15, gapDays: 200, networkCount: 100 });
    expect(result.rarity?.label).toBe('Ultra Rare');
  });
});

// ---------------------------------------------------------------------------
// Gate 3: tightened thresholds
// ---------------------------------------------------------------------------

describe('route-today rarity gate 3: thresholds', () => {
  it('Ultra Rare requires >150 day avg gap', async () => {
    const result = await callToday({ appearances: 15, gapDays: 160 });
    expect(result.rarity?.label).toBe('Ultra Rare');
  });

  it('does NOT label as Ultra Rare at 120 days (old threshold)', async () => {
    // 14 appearances * 130-day gap -- avg_gap=130, old code would be 'Rare'
    const result = await callToday({ appearances: 15, gapDays: 130 });
    expect(result.rarity?.label).not.toBe('Ultra Rare');
    expect(result.rarity?.label).toBe('Rare'); // 130 > 90
  });

  it('Rare requires avg gap 90-150 days', async () => {
    const result = await callToday({ appearances: 15, gapDays: 100 });
    expect(result.rarity?.label).toBe('Rare');
  });

  it('does NOT label as Rare at 61 days (old Rare threshold)', async () => {
    const result = await callToday({ appearances: 15, gapDays: 70 });
    expect(result.rarity?.label).toBeNull();
  });

  it('null label when avg_gap <= 90 days', async () => {
    const result = await callToday({ appearances: 15, gapDays: 85 });
    expect(result.rarity?.label).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

describe('route-today rarity response shape', () => {
  it('always returns appearances and avg_gap_days when D1 data exists', async () => {
    const result = await callToday({ appearances: 15, gapDays: 50 });
    expect(result.rarity).not.toBeNull();
    expect(typeof result.rarity.appearances).toBe('number');
    expect(typeof result.rarity.avg_gap_days).toBe('number');
  });
});
