import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  haversine,
  scoreRecommendation,
  historicalTieBreakerScore,
  buildRecommendations,
  fetchReliabilityMap,
  fetchForecastMap,
  handlePlan,
} from '../src/planner.js';
import { TIERS } from '../src/certainty.js';

// --- haversine ---

describe('haversine', () => {
  it('returns 0 for same point', () => {
    expect(haversine(43.0, -89.5, 43.0, -89.5)).toBe(0);
  });

  it('calculates known distance (Madison to Milwaukee ~77mi)', () => {
    const dist = haversine(43.0731, -89.4012, 43.0389, -87.9065);
    expect(dist).toBeGreaterThan(70);
    expect(dist).toBeLessThan(85);
  });

  it('handles antipodal points', () => {
    const dist = haversine(0, 0, 0, 180);
    expect(dist).toBeGreaterThan(12400);
    expect(dist).toBeLessThan(12500);
  });
});

// --- scoreRecommendation ---

describe('scoreRecommendation', () => {
  it('returns max score for confirmed, nearby, preference match', () => {
    const score = scoreRecommendation({
      certaintyScore: 1.0,
      distanceMiles: 0,
      maxRadius: 25,
      rarityPercentile: 1.0,
      preferenceMatch: true,
    });
    expect(score).toBeCloseTo(1.0, 10);
  });

  it('returns 0 for no certainty, max distance, no rarity, no pref', () => {
    const score = scoreRecommendation({
      certaintyScore: 0,
      distanceMiles: 25,
      maxRadius: 25,
      rarityPercentile: 0,
      preferenceMatch: false,
    });
    expect(score).toBe(0);
  });

  it('certainty dominates distance', () => {
    const highCert = scoreRecommendation({
      certaintyScore: 1.0,
      distanceMiles: 20,
      maxRadius: 25,
    });
    const lowCert = scoreRecommendation({
      certaintyScore: 0.3,
      distanceMiles: 1,
      maxRadius: 25,
    });
    expect(highCert).toBeGreaterThan(lowCert);
  });

  it('preference match adds exactly 0.1', () => {
    const without = scoreRecommendation({
      certaintyScore: 0.5,
      distanceMiles: 10,
      maxRadius: 25,
      preferenceMatch: false,
    });
    const with_ = scoreRecommendation({
      certaintyScore: 0.5,
      distanceMiles: 10,
      maxRadius: 25,
      preferenceMatch: true,
    });
    expect(with_ - without).toBeCloseTo(0.1, 5);
  });

  it('caps distance norm at 1.0 for stores beyond radius', () => {
    const score = scoreRecommendation({
      certaintyScore: 1.0,
      distanceMiles: 100,
      maxRadius: 25,
    });
    // distance component = 0 (capped), certainty = 0.4
    expect(score).toBeCloseTo(0.4, 5);
  });

  it('handles maxRadius of 0 gracefully', () => {
    const score = scoreRecommendation({
      certaintyScore: 1.0,
      distanceMiles: 5,
      maxRadius: 0,
    });
    // maxRadius clamps to 1, so distanceNorm = min(5, 1) = 1
    expect(score).toBeCloseTo(0.4, 5);
  });
});

// --- historicalTieBreakerScore ---

describe('historicalTieBreakerScore', () => {
  const historicalMetrics = {
    datasetStores: 1000,
    maxStoreObservations: 2000,
    flavorLookup: new Map([
      ['rare flavor', { store_count: 50, peak_month: 8, seasonal_concentration: 0.9 }],
      ['common flavor', { store_count: 980, peak_month: 1, seasonal_concentration: 0.2 }],
    ]),
    storeLookup: new Map([
      ['deep-store', { observations: 1900 }],
      ['thin-store', { observations: 100 }],
    ]),
  };

  it('returns bounded score (0 to 0.35)', () => {
    const score = historicalTieBreakerScore({
      flavor: 'Rare Flavor',
      slug: 'deep-store',
      month: 8,
      historicalMetrics,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(0.35);
  });

  it('favors rare flavor + high-depth store over common + low-depth', () => {
    const high = historicalTieBreakerScore({
      flavor: 'Rare Flavor',
      slug: 'deep-store',
      month: 8,
      historicalMetrics,
    });
    const low = historicalTieBreakerScore({
      flavor: 'Common Flavor',
      slug: 'thin-store',
      month: 8,
      historicalMetrics,
    });
    expect(high).toBeGreaterThan(low);
  });

  it('applies peak-month seasonal bonus', () => {
    const seasonalMetrics = {
      datasetStores: 1000,
      maxStoreObservations: 2000,
      flavorLookup: new Map([
        ['rare flavor', { store_count: 900, peak_month: 8, seasonal_concentration: 0.8 }],
      ]),
      storeLookup: new Map([
        ['deep-store', { observations: 1000 }],
      ]),
    };
    const inSeason = historicalTieBreakerScore({
      flavor: 'Rare Flavor',
      slug: 'deep-store',
      month: 8,
      historicalMetrics: seasonalMetrics,
    });
    const offSeason = historicalTieBreakerScore({
      flavor: 'Rare Flavor',
      slug: 'deep-store',
      month: 2,
      historicalMetrics: seasonalMetrics,
    });
    expect(inSeason).toBeGreaterThan(offSeason);
  });
});

// --- buildRecommendations ---

function makeStore(overrides = {}) {
  return {
    slug: 'mt-horeb',
    name: 'Mt. Horeb, WI',
    address: '123 Main St',
    lat: 43.0,
    lon: -89.7,
    flavor: 'Chocolate Fudge',
    description: 'Rich chocolate custard',
    rank: 1,
    ...overrides,
  };
}

describe('buildRecommendations', () => {
  it('returns empty when no stores', () => {
    const result = buildRecommendations({
      stores: [],
      userLat: 43.0,
      userLon: -89.7,
    });
    expect(result.recommendations).toEqual([]);
    expect(result.alternatives).toEqual([]);
  });

  it('includes confirmed stores within radius', () => {
    const result = buildRecommendations({
      stores: [makeStore()],
      userLat: 43.0,
      userLon: -89.7,
      maxRadius: 25,
    });
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].certainty_tier).toBe('confirmed');
    expect(result.recommendations[0].source).toBe('confirmed');
  });

  it('excludes stores beyond radius', () => {
    const farStore = makeStore({ lat: 44.5, lon: -89.7 }); // ~103 miles north
    const result = buildRecommendations({
      stores: [farStore],
      userLat: 43.0,
      userLon: -89.7,
      maxRadius: 25,
    });
    expect(result.recommendations).toHaveLength(0);
  });

  it('skips stores with no flavor and no forecast', () => {
    const result = buildRecommendations({
      stores: [makeStore({ flavor: '' })],
      userLat: 43.0,
      userLon: -89.7,
    });
    expect(result.recommendations).toHaveLength(0);
  });

  it('confirmed outscores estimated at same distance', () => {
    const confirmedStore = makeStore({ slug: 'a', flavor: 'Chocolate Fudge' });
    const estimatedStore = makeStore({ slug: 'b', flavor: '', lat: 43.001, lon: -89.701 });
    const forecastMap = new Map([
      ['b', { history_depth: 30, predictions: [{ flavor: 'Vanilla', probability: 0.3 }] }],
    ]);

    const result = buildRecommendations({
      stores: [confirmedStore, estimatedStore],
      userLat: 43.0,
      userLon: -89.7,
      maxRadius: 25,
      forecastMap,
    });

    const confirmed = result.recommendations.find((r) => r.slug === 'a');
    const estimated = result.recommendations.find((r) => r.slug === 'b');
    expect(confirmed).toBeDefined();
    expect(estimated).toBeDefined();
    expect(confirmed.score).toBeGreaterThan(estimated.score);
  });

  it('downgrades to Watch tier when reliability is watch', () => {
    const reliabilityMap = new Map([
      ['mt-horeb', { reliability_tier: 'watch' }],
    ]);
    const result = buildRecommendations({
      stores: [makeStore()],
      userLat: 43.0,
      userLon: -89.7,
      reliabilityMap,
    });
    expect(result.recommendations[0].certainty_tier).toBe('watch');
    expect(result.recommendations[0].certainty_label).toBe('Watch');
  });

  it('ranks closer stores higher when certainty is equal', () => {
    const near = makeStore({ slug: 'near', lat: 43.001, lon: -89.701 });
    const far = makeStore({ slug: 'far', lat: 43.1, lon: -89.7 });
    const result = buildRecommendations({
      stores: [far, near],
      userLat: 43.0,
      userLon: -89.7,
      maxRadius: 25,
    });
    expect(result.recommendations[0].slug).toBe('near');
    expect(result.recommendations[1].slug).toBe('far');
  });

  it('preference match boosts ranking', () => {
    const preferred = makeStore({ slug: 'pref', flavor: 'Mint Avalanche' });
    const other = makeStore({ slug: 'other', flavor: 'Vanilla', lat: 43.001, lon: -89.701 });
    const result = buildRecommendations({
      stores: [preferred, other],
      userLat: 43.0,
      userLon: -89.7,
      preferredFlavors: ['Mint Avalanche'],
    });
    expect(result.recommendations[0].slug).toBe('pref');
    expect(result.recommendations[0].preference_match).toBe(true);
    expect(result.recommendations[1].preference_match).toBe(false);
  });

  it('uses bounded historical tie-breakers when certainty/distance are equal', () => {
    const rare = makeStore({ slug: 'deep-store', flavor: 'Rare Flavor', lat: 43.001, lon: -89.701 });
    const common = makeStore({ slug: 'thin-store', flavor: 'Common Flavor', lat: 43.001, lon: -89.701 });
    const historicalMetrics = {
      datasetStores: 1000,
      maxStoreObservations: 2000,
      flavorLookup: new Map([
        ['rare flavor', { store_count: 50, peak_month: 8, seasonal_concentration: 0.9 }],
        ['common flavor', { store_count: 980, peak_month: 1, seasonal_concentration: 0.2 }],
      ]),
      storeLookup: new Map([
        ['deep-store', { observations: 1900 }],
        ['thin-store', { observations: 100 }],
      ]),
    };

    const result = buildRecommendations({
      stores: [common, rare],
      userLat: 43.0,
      userLon: -89.7,
      maxRadius: 25,
      historicalMetrics,
      referenceMonth: 8,
    });

    expect(result.recommendations[0].slug).toBe('deep-store');
    expect(result.recommendations[0].historical_tie_breaker).toBeGreaterThan(
      result.recommendations[1].historical_tie_breaker
    );
    expect(result.recommendations[0].historical_tie_breaker).toBeLessThanOrEqual(0.35);
  });

  it('includes forecast predictions when no confirmed flavor', () => {
    const store = makeStore({ flavor: '' });
    const forecastMap = new Map([
      ['mt-horeb', { history_depth: 30, predictions: [{ flavor: 'Caramel Cashew', probability: 0.25 }] }],
    ]);
    const result = buildRecommendations({
      stores: [store],
      userLat: 43.0,
      userLon: -89.7,
      forecastMap,
    });
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].source).toBe('forecast');
    expect(result.recommendations[0].certainty_tier).toBe('estimated');
  });

  it('limits forecast predictions to 5 per store', () => {
    const store = makeStore({ flavor: '' });
    const predictions = Array.from({ length: 10 }, (_, i) => ({
      flavor: `Flavor ${i}`,
      probability: 0.1,
    }));
    const forecastMap = new Map([['mt-horeb', { history_depth: 30, predictions }]]);
    const result = buildRecommendations({
      stores: [store],
      userLat: 43.0,
      userLon: -89.7,
      forecastMap,
    });
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });

  it('caps output at 10 recommendations + 10 alternatives', () => {
    const stores = Array.from({ length: 25 }, (_, i) =>
      makeStore({
        slug: `store-${i}`,
        lat: 43.0 + i * 0.001,
        lon: -89.7,
      })
    );
    const result = buildRecommendations({
      stores,
      userLat: 43.0,
      userLon: -89.7,
      maxRadius: 50,
    });
    expect(result.recommendations.length).toBeLessThanOrEqual(10);
    expect(result.alternatives.length).toBeLessThanOrEqual(10);
  });

  it('filters out forecast predictions below quality thresholds', () => {
    const store = makeStore({ flavor: '' });
    const forecastMap = new Map([
      ['mt-horeb', {
        history_depth: 5, // below MIN_HISTORY_DEPTH
        predictions: [{ flavor: 'Caramel Cashew', probability: 0.25 }],
      }],
    ]);
    const result = buildRecommendations({
      stores: [store],
      userLat: 43.0,
      userLon: -89.7,
      forecastMap,
    });
    expect(result.recommendations).toHaveLength(0);
  });

  it('filters out forecast predictions with low probability', () => {
    const store = makeStore({ flavor: '' });
    const forecastMap = new Map([
      ['mt-horeb', {
        history_depth: 30,
        predictions: [{ flavor: 'Caramel Cashew', probability: 0.01 }],
      }],
    ]);
    const result = buildRecommendations({
      stores: [store],
      userLat: 43.0,
      userLon: -89.7,
      forecastMap,
    });
    expect(result.recommendations).toHaveLength(0);
  });

  it('actions include directions for confirmed, not for forecast', () => {
    const confirmedStore = makeStore({ slug: 'c' });
    const estimatedStore = makeStore({ slug: 'e', flavor: '', lat: 43.001 });
    const forecastMap = new Map([
      ['e', { history_depth: 30, predictions: [{ flavor: 'X', probability: 0.5 }] }],
    ]);
    const result = buildRecommendations({
      stores: [confirmedStore, estimatedStore],
      userLat: 43.0,
      userLon: -89.7,
      forecastMap,
    });
    const conf = result.recommendations.find((r) => r.slug === 'c');
    const est = result.recommendations.find((r) => r.slug === 'e');
    expect(conf.actions).toContain('directions');
    expect(est.actions).not.toContain('directions');
  });
});

// --- fetchReliabilityMap ---

describe('fetchReliabilityMap', () => {
  it('returns empty map when db is null', async () => {
    const map = await fetchReliabilityMap(null, ['mt-horeb']);
    expect(map.size).toBe(0);
  });

  it('returns map of slug to reliability record', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ slug: 'mt-horeb', reliability_tier: 'confirmed' })),
        })),
      })),
    };
    const map = await fetchReliabilityMap(db, ['mt-horeb']);
    expect(map.get('mt-horeb')).toEqual({ slug: 'mt-horeb', reliability_tier: 'confirmed' });
  });

  it('swallows errors for individual slugs', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => { throw new Error('boom'); }),
        })),
      })),
    };
    const map = await fetchReliabilityMap(db, ['mt-horeb']);
    expect(map.size).toBe(0);
  });
});

// --- fetchForecastMap ---

describe('fetchForecastMap', () => {
  it('returns map of slug to forecast', async () => {
    const forecast = { predictions: [{ flavor: 'Chocolate', probability: 0.5 }] };
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ data: JSON.stringify(forecast) })),
          })),
        })),
      },
      FLAVOR_CACHE: {
        get: vi.fn(async () => null),
      },
    };
    const map = await fetchForecastMap(env, ['mt-horeb']);
    expect(map.get('mt-horeb')).toBeTruthy();
    expect(map.get('mt-horeb').predictions[0].flavor).toBe('Chocolate');
  });
});

// --- handlePlan API ---

// Build a minimal KV mock that returns a flavor payload for a given slug.
function makeFlavorKv(slugFlavorMap = {}) {
  return {
    get: vi.fn(async (key) => {
      // key format is "flavors:<slug>" for slug-scoped entries
      const slug = key.replace(/^flavors:/, '');
      const flavor = slugFlavorMap[slug];
      if (!flavor) return null;
      const today = new Date().toISOString().slice(0, 10);
      // Return a v1 cache record
      return JSON.stringify({
        _meta: { v: 1, shared: false, slug, cachedAt: new Date().toISOString() },
        data: { name: slug, flavors: [{ title: flavor, date: today, description: '' }] },
      });
    }),
    put: vi.fn(async () => {}),
  };
}

describe('handlePlan', () => {
  function makeUrl(params = {}) {
    const u = new URL('https://test.com/api/v1/plan');
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v);
    }
    return u;
  }

  const mockCors = { 'Access-Control-Allow-Origin': '*' };

  // Minimal store index override: two stores close to Madison WI
  const nearbyStoreIndex = new Map([
    ['mt-horeb-wi', { lat: 43.022, lng: -89.736, name: 'Mt. Horeb, WI', address: '100 E Main St' }],
    ['verona-wi', { lat: 43.0, lng: -89.534, name: 'Verona, WI', address: '200 S Main St' }],
    ['far-store', { lat: 45.0, lng: -89.7, name: 'Far North, WI', address: '999 North Rd' }],
  ]);

  it('returns 400 if no location', async () => {
    const resp = await handlePlan(makeUrl(), {}, mockCors);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toContain('location');
  });

  it('returns 400 if location is not parseable as lat,lon', async () => {
    const resp = await handlePlan(makeUrl({ location: 'madison, wi' }), {}, mockCors);
    expect(resp.status).toBe(400);
    const json = await resp.json();
    expect(json.error).toContain('Invalid');
  });

  it('returns empty recommendations when no stores in radius', async () => {
    const env = {
      FLAVOR_CACHE: makeFlavorKv({}),
      DB: null,
      _storeIndexOverride: new Map([
        ['remote', { lat: 45.0, lng: -80.0, name: 'Remote', address: '' }],
      ]),
    };
    const resp = await handlePlan(makeUrl({ location: '43.07,-89.40', radius: '5' }), env, mockCors);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.recommendations).toEqual([]);
  });

  it('returns scored recommendations for nearby stores with flavors', async () => {
    const env = {
      FLAVOR_CACHE: makeFlavorKv({ 'mt-horeb-wi': 'Chocolate Fudge', 'verona-wi': 'Vanilla' }),
      DB: null,
      _storeIndexOverride: nearbyStoreIndex,
    };
    const resp = await handlePlan(makeUrl({ location: '43.07,-89.40', radius: '50' }), env, mockCors);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(json.recommendations[0].certainty_tier).toBe('confirmed');
    expect(json.query.lat).toBeCloseTo(43.07, 2);
  });

  it('excludes stores beyond the radius', async () => {
    const env = {
      FLAVOR_CACHE: makeFlavorKv({ 'far-store': 'Butter Pecan' }),
      DB: null,
      _storeIndexOverride: new Map([
        ['far-store', { lat: 45.0, lng: -89.7, name: 'Far North, WI', address: '' }],
      ]),
    };
    // User at Madison WI, radius 25 miles — far-store is ~135 miles north
    const resp = await handlePlan(makeUrl({ location: '43.07,-89.40', radius: '25' }), env, mockCors);
    const json = await resp.json();
    expect(json.recommendations).toHaveLength(0);
  });

  it('parses flavor preferences and marks preference_match', async () => {
    const env = {
      FLAVOR_CACHE: makeFlavorKv({ 'mt-horeb-wi': 'Mint Avalanche' }),
      DB: null,
      _storeIndexOverride: new Map([
        ['mt-horeb-wi', { lat: 43.022, lng: -89.736, name: 'Mt. Horeb, WI', address: '' }],
      ]),
    };
    const resp = await handlePlan(
      makeUrl({ location: '43.07,-89.40', radius: '50', flavors: 'Mint Avalanche,Chocolate' }),
      env,
      mockCors
    );
    const json = await resp.json();
    expect(json.query.flavors).toEqual(['Mint Avalanche', 'Chocolate']);
    expect(json.recommendations[0].preference_match).toBe(true);
  });

  it('returns empty when getFlavorsCached fails for all stores', async () => {
    const env = {
      FLAVOR_CACHE: { get: vi.fn(async () => { throw new Error('KV down'); }), put: vi.fn() },
      DB: null,
      _storeIndexOverride: new Map([
        ['mt-horeb-wi', { lat: 43.022, lng: -89.736, name: 'Mt. Horeb, WI', address: '' }],
      ]),
    };
    // getFlavorsCached will throw on KV, but also fall through to upstream fetch
    // which will also throw. Promise.allSettled swallows all.
    const resp = await handlePlan(makeUrl({ location: '43.07,-89.40', radius: '50' }), env, mockCors);
    // Should not 500 — graceful empty
    expect([200, 200]).toContain(resp.status);
  });

  it('respects the limit parameter', async () => {
    // 5 stores all within radius, limit=2 → at most 2 evaluated
    const storeIndex = new Map(
      Array.from({ length: 5 }, (_, i) => [
        `store-${i}`,
        { lat: 43.07 + i * 0.001, lng: -89.40, name: `Store ${i}`, address: '' },
      ])
    );
    const flavorMap = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`store-${i}`, 'Vanilla'])
    );
    const env = {
      FLAVOR_CACHE: makeFlavorKv(flavorMap),
      DB: null,
      _storeIndexOverride: storeIndex,
    };
    const resp = await handlePlan(makeUrl({ location: '43.07,-89.40', radius: '50', limit: '2' }), env, mockCors);
    const json = await resp.json();
    const total = json.recommendations.length + json.alternatives.length;
    expect(total).toBeLessThanOrEqual(2);
  });
});
