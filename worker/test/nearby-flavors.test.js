import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalize, matchesFlavor, findSimilarFlavors } from '../src/flavor-matcher.js';
import { handleRequest } from '../src/index.js';

// --- flavor-matcher unit tests ---

describe('normalize()', () => {
  it('lowercases and trims', () => {
    expect(normalize('  Mint Explosion  ')).toBe('mint explosion');
  });

  it('strips trademark symbols', () => {
    expect(normalize('OREO\u00ae Cookie Cheesecake\u2122')).toBe('oreo cookie cheesecake');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('Caramel   Fudge   Cookie')).toBe('caramel fudge cookie');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize('')).toBe('');
  });
});

describe('matchesFlavor()', () => {
  it('matches same flavor case-insensitively', () => {
    expect(matchesFlavor('Mint Explosion', 'mint explosion')).toBe(true);
  });

  it('matches with trademark symbols stripped', () => {
    expect(matchesFlavor('OREO\u00ae Cheesecake', 'oreo cheesecake')).toBe(true);
  });

  it('does not match different flavors', () => {
    expect(matchesFlavor('Mint Explosion', 'Butter Pecan')).toBe(false);
  });

  it('handles extra whitespace', () => {
    expect(matchesFlavor('  Mint  Explosion ', 'Mint Explosion')).toBe(true);
  });
});

describe('findSimilarFlavors()', () => {
  it('finds similar mint flavors', () => {
    const available = ['Andes Mint Avalanche', 'Butter Pecan', 'Mint Cookie'];
    const similar = findSimilarFlavors('Mint Explosion', available);
    expect(similar).toContain('andes mint avalanche');
    expect(similar).toContain('mint cookie');
    expect(similar).not.toContain('butter pecan');
  });

  it('returns empty array for unknown flavor', () => {
    const similar = findSimilarFlavors('Unknown Flavor XYZ', ['Butter Pecan']);
    expect(similar).toEqual([]);
  });

  it('excludes the target flavor itself', () => {
    const available = ['Mint Explosion', 'Mint Cookie'];
    const similar = findSimilarFlavors('Mint Explosion', available);
    expect(similar).not.toContain('mint explosion');
  });

  it('only returns flavors that are actually available', () => {
    const available = ['Butter Pecan']; // no mint flavors available
    const similar = findSimilarFlavors('Mint Explosion', available);
    expect(similar).toEqual([]);
  });

  it('finds flavors across multiple groups', () => {
    // Chocolate Caramel Twist is in both chocolate and caramel groups
    const available = ['Dark Chocolate Decadence', 'Caramel Cashew', 'Butter Pecan'];
    const similar = findSimilarFlavors('Chocolate Caramel Twist', available);
    expect(similar).toContain('dark chocolate decadence');
    expect(similar).toContain('caramel cashew');
  });
});

// --- /api/nearby-flavors endpoint tests ---

// Mock locator API response matching Culver's format
const MOCK_LOCATOR_RESPONSE = {
  data: {
    geofences: [
      {
        metadata: {
          slug: 'mt-horeb',
          city: 'Mt. Horeb',
          state: 'WI',
          streetAddress: '505 Springdale St',
          flavorOfTheDay: 'Mint Explosion',
        },
        geometryCenter: { coordinates: [-89.718, 43.011] },
      },
      {
        metadata: {
          slug: 'dodgeville',
          city: 'Dodgeville',
          state: 'WI',
          streetAddress: '731 N Johns St',
          flavorOfTheDay: 'Butter Pecan',
        },
        geometryCenter: { coordinates: [-90.127, 42.972] },
      },
      {
        metadata: {
          slug: 'madison-todd-drive',
          city: 'Madison',
          state: 'WI',
          streetAddress: '6418 Odana Rd',
          flavorOfTheDay: 'Andes Mint Avalanche',
        },
        geometryCenter: { coordinates: [-89.478, 43.056] },
      },
    ],
  },
};

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    _store: store,
  };
}

function createMockFetch(response) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
  }));
}

function makeRequest(path) {
  return new Request(`https://example.com${path}`);
}

describe('/api/nearby-flavors endpoint', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: new Set(['mt-horeb', 'madison-todd-drive']),
      _fetchOverride: createMockFetch(MOCK_LOCATOR_RESPONSE),
    };
  });

  it('returns stores with flavor and coordinates for valid location', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nearby).toHaveLength(3);
    expect(body.nearby[0].slug).toBe('mt-horeb');
    expect(body.nearby[0].lat).toBe(43.011);
    expect(body.nearby[0].lon).toBe(-89.718);
    expect(body.nearby[0].flavor).toBe('Mint Explosion');
    expect(body.nearby[0].rank).toBe(1);
  });

  it('returns 400 when location is missing', async () => {
    const req = makeRequest('/api/nearby-flavors');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/location/i);
  });

  it('returns 400 when location is empty', async () => {
    const req = makeRequest('/api/nearby-flavors?location=');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(400);
  });

  it('splits matches vs nearby when flavor specified', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572&flavor=Mint+Explosion');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].slug).toBe('mt-horeb');
    expect(body.nearby).toHaveLength(2);
    expect(body.nearby.find(s => s.slug === 'mt-horeb')).toBeUndefined();
  });

  it('returns similarity suggestions', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572&flavor=Mint+Explosion');
    const res = await handleRequest(req, env);

    const body = await res.json();
    expect(body.suggestions.length).toBeGreaterThan(0);
    const mintSuggestion = body.suggestions.find(s =>
      s.flavor.toLowerCase().includes('mint')
    );
    expect(mintSuggestion).toBeDefined();
    expect(mintSuggestion.count).toBe(1);
  });

  it('returns all_flavors_today list', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    const body = await res.json();
    expect(body.all_flavors_today).toContain('Butter Pecan');
    expect(body.all_flavors_today).toContain('Mint Explosion');
    expect(body.all_flavors_today).toContain('Andes Mint Avalanche');
  });

  it('caches locator response in KV', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    await handleRequest(req, env);

    expect(mockKV.put).toHaveBeenCalledWith(
      'locator:53572:50',
      expect.any(String),
      { expirationTtl: 3600 }
    );
  });

  it('uses KV cache on second request', async () => {
    const req1 = makeRequest('/api/nearby-flavors?location=53572');
    await handleRequest(req1, env);
    expect(env._fetchOverride).toHaveBeenCalledTimes(1);

    env._fetchOverride.mockClear();
    const req2 = makeRequest('/api/nearby-flavors?location=53572');
    await handleRequest(req2, env);
    expect(env._fetchOverride).not.toHaveBeenCalled();
  });

  it('respects limit parameter', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572&limit=2');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    // The limit is passed to the locator API; our mock returns 3 regardless
    // but verify it was used in the cache key
    expect(mockKV.put).toHaveBeenCalledWith(
      'locator:53572:2',
      expect.any(String),
      expect.any(Object)
    );
  });

  it('caps limit at 100', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572&limit=999');
    await handleRequest(req, env);

    expect(mockKV.put).toHaveBeenCalledWith(
      'locator:53572:100',
      expect.any(String),
      expect.any(Object)
    );
  });

  it('includes CORS headers', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });

  it('includes 1h Cache-Control header', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('returns 502 when locator API fails', async () => {
    env._fetchOverride = vi.fn(async () => ({
      ok: false,
      status: 503,
    }));

    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/locator/i);
  });

  it('returns 502 when locator API throws', async () => {
    env._fetchOverride = vi.fn(async () => {
      throw new Error('DNS resolution failed');
    });

    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/DNS/i);
  });

  it('handles locator response with empty geofences', async () => {
    env._fetchOverride = createMockFetch({ data: { geofences: [] } });

    const req = makeRequest('/api/nearby-flavors?location=99999');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nearby).toHaveLength(0);
    expect(body.all_flavors_today).toHaveLength(0);
  });

  it('flavor matching is case-insensitive', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572&flavor=mint+EXPLOSION');
    const res = await handleRequest(req, env);

    const body = await res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].flavor).toBe('Mint Explosion');
  });

  it('returns query echo in response', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572&flavor=mint+explosion');
    const res = await handleRequest(req, env);

    const body = await res.json();
    expect(body.query.location).toBe('53572');
    expect(body.query.flavor).toBe('mint explosion');
  });

  it('query.flavor is null when no flavor specified', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    const body = await res.json();
    expect(body.query.flavor).toBeNull();
  });
});
