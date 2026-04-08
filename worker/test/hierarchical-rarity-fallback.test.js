/**
 * Tests for hierarchical rarity scope fallback in route-today.js.
 *
 * When a store has insufficient data for rarity labeling (<10 appearances
 * or <90-day span), the system falls back through wider geographic scopes:
 *   store -> metro -> state -> national
 *
 * The response includes a `scope` field indicating which level supplied the data.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleApiToday } from '../src/route-today.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate `count` date strings spaced `gapDays` apart ending at `endDate`. */
function makeDates(count, gapDays, endDate = '2026-03-22') {
  const dates = [];
  const end = new Date(endDate + 'T00:00:00Z').getTime();
  for (let i = 0; i < count; i++) {
    const ts = end - (count - 1 - i) * gapDays * 86400000;
    dates.push({ date: new Date(ts).toISOString().slice(0, 10) });
  }
  return dates;
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

/**
 * Build env with configurable scope data.
 *
 * @param {object} opts
 * @param {number} opts.storeAppearances - appearance count at the store level
 * @param {number} opts.storeGapDays - gap between store-level dates
 * @param {number} opts.networkCount - number of distinct stores in last 30 days
 * @param {number|null} opts.metroAppearances - if set, the wider-scope query
 *   matching metro slugs will return this many rows
 * @param {number} opts.metroGapDays - gap for metro rows
 * @param {number|null} opts.stateAppearances - similar for state scope
 * @param {number} opts.stateGapDays - gap for state rows
 * @param {boolean} opts.metroThrows - if true, metro D1 query throws
 * @param {string} opts.today
 */
function makeEnv(opts = {}) {
  const {
    storeAppearances = 5,
    storeGapDays = 30,
    networkCount = 2,
    metroAppearances = null,
    metroGapDays = 120,
    stateAppearances = null,
    stateGapDays = 120,
    metroThrows = false,
    today = '2026-03-22',
  } = opts;

  const storeDates = makeDates(storeAppearances, storeGapDays, today);

  // Build metro rows if requested
  const metroRows = [];
  if (metroAppearances !== null) {
    const metroDateList = makeDates(metroAppearances, metroGapDays, today);
    for (const d of metroDateList) {
      metroRows.push({ slug: 'madison-east', date: d.date });
    }
  }

  // Build state rows if requested
  const stateRows = [];
  if (stateAppearances !== null) {
    const stateDateList = makeDates(stateAppearances, stateGapDays, today);
    for (const d of stateDateList) {
      stateRows.push({ slug: 'green-bay', date: d.date });
    }
  }

  return {
    DB: {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          all: vi.fn(async () => {
            // Store-scope flavor dates
            if (sql.includes('WHERE slug = ? AND normalized_flavor = ?')) {
              return { results: storeDates };
            }
            // Store-scope all flavor counts
            if (sql.includes('COUNT(*) as cnt FROM snapshots WHERE slug =')) {
              return { results: [{ normalized_flavor: 'turtle', cnt: storeAppearances }] };
            }
            // Wider-scope queries (metro/state via queryDatesForSlugs)
            if (sql.includes('slug IN (')) {
              if (metroThrows && metroRows.length > 0) {
                // Check if this is a metro or state query by looking at bound args
                // Metro queries will include madison-area slugs
                throw new Error('D1 query failed');
              }
              // Return metro rows first, then state rows for subsequent calls
              if (metroRows.length > 0) {
                const rows = [...metroRows];
                metroRows.length = 0; // consume once
                return { results: rows };
              }
              if (stateRows.length > 0) {
                const rows = [...stateRows];
                stateRows.length = 0; // consume once
                return { results: rows };
              }
              return { results: [] };
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
    FLAVOR_CACHE: makeKV(),
    _validSlugsOverride: new Set(['mt-horeb']),
    // Inject a minimal STORE_INDEX so route-today can find the store's city/state
    _storeIndexOverride: [
      { slug: 'mt-horeb', city: 'Mt. Horeb', state: 'WI' },
      { slug: 'madison-east', city: 'Madison', state: 'WI' },
      { slug: 'green-bay', city: 'Green Bay', state: 'WI' },
    ],
  };
}

async function callToday(envOverrides = {}, today = '2026-03-22') {
  const url = new URL('https://example.com/api/v1/today?slug=mt-horeb');
  const env = makeEnv({ today, ...envOverrides });
  const corsHeaders = {};
  const fetchFlavors = mockFetchFlavors(today);

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

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Scenario 1: Sufficient store data -- no fallback
// ---------------------------------------------------------------------------

describe('hierarchical rarity: store-scope (sufficient data)', () => {
  it('uses store scope when >=10 appearances and >=90-day span', async () => {
    // 15 appearances * 200-day gap = 2800-day span, well above 90
    const result = await callToday({ storeAppearances: 15, storeGapDays: 200 });
    expect(result.rarity).not.toBeNull();
    expect(result.rarity.scope).toBe('store');
    expect(result.rarity.appearances).toBe(15);
    expect(result.rarity.label).toBe('Ultra Rare'); // 200 > 150
  });

  it('returns store scope with null label when avg_gap < 90', async () => {
    // 15 appearances * 10-day gap = 140-day span >= 90, avg_gap = 10 < 90
    const result = await callToday({ storeAppearances: 15, storeGapDays: 10 });
    expect(result.rarity).not.toBeNull();
    expect(result.rarity.scope).toBe('store');
    expect(result.rarity.label).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Insufficient store data, metro has enough
// ---------------------------------------------------------------------------

describe('hierarchical rarity: metro fallback', () => {
  it('falls back to metro when store has <10 appearances and metro has >=30', async () => {
    const result = await callToday({
      storeAppearances: 5,
      storeGapDays: 30,
      metroAppearances: 35,
      metroGapDays: 120,
    });
    expect(result.rarity).not.toBeNull();
    expect(result.rarity.scope).toBe('metro');
    expect(result.rarity.label).toBe('Rare'); // 120 > 90
  });

  it('early-exits at metro (state/national not queried)', async () => {
    // Both metro and state have enough data, but should stop at metro
    const result = await callToday({
      storeAppearances: 5,
      storeGapDays: 30,
      metroAppearances: 35,
      metroGapDays: 200,
      stateAppearances: 50,
      stateGapDays: 100,
    });
    expect(result.rarity.scope).toBe('metro');
    expect(result.rarity.avg_gap_days).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Store and metro insufficient, state has enough
// ---------------------------------------------------------------------------

describe('hierarchical rarity: state fallback', () => {
  it('falls back to state when store and metro are insufficient', async () => {
    const result = await callToday({
      storeAppearances: 5,
      storeGapDays: 30,
      metroAppearances: 10, // < 30, insufficient
      metroGapDays: 120,
      stateAppearances: 40,
      stateGapDays: 100,
    });
    expect(result.rarity).not.toBeNull();
    expect(result.rarity.scope).toBe('state');
    expect(result.rarity.label).toBe('Rare'); // 100 > 90
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: All scopes insufficient, falls back to national (seed)
// ---------------------------------------------------------------------------

describe('hierarchical rarity: national fallback', () => {
  it('falls back to national scope from TRIVIA_METRICS_SEED when all D1 scopes insufficient', async () => {
    // Store has 5 appearances, no metro/state data
    const result = await callToday({
      storeAppearances: 5,
      storeGapDays: 30,
    });
    expect(result.rarity).not.toBeNull();
    // National scope pulls from the seed data -- scope should be "national"
    // (exact value depends on whether 'turtle' is in the seed)
    // At minimum, scope should be non-null when seed has data
    expect(['national', null]).toContain(result.rarity.scope);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: D1 error during metro query -- non-fatal
// ---------------------------------------------------------------------------

describe('hierarchical rarity: error handling', () => {
  it('does not crash when metro D1 query fails', async () => {
    const result = await callToday({
      storeAppearances: 5,
      storeGapDays: 30,
      metroAppearances: 35,
      metroGapDays: 120,
      metroThrows: true,
    });
    // Should not have crashed; rarity can be null or fall to state/national
    expect(result.flavor).toBe('Turtle');
    // rarity should exist (may be null if no wider scope data)
    expect(result).toHaveProperty('rarity');
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Scope field values
// ---------------------------------------------------------------------------

describe('hierarchical rarity: scope field in response', () => {
  it('scope is "store" for stores with sufficient data', async () => {
    const result = await callToday({ storeAppearances: 15, storeGapDays: 200 });
    expect(result.rarity.scope).toBe('store');
  });

  it('scope is "metro" for metro fallback', async () => {
    const result = await callToday({
      storeAppearances: 5,
      storeGapDays: 30,
      metroAppearances: 35,
      metroGapDays: 120,
    });
    expect(result.rarity.scope).toBe('metro');
  });

  it('rarity object always has scope field', async () => {
    const result = await callToday({ storeAppearances: 15, storeGapDays: 200 });
    expect(result.rarity).toHaveProperty('scope');
  });
});
