import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest, isValidSlug } from '../src/index.js';

// Mock flavor data returned by fetchFlavors
const MOCK_FLAVORS = {
  'mt-horeb': {
    name: 'Mt. Horeb',
    flavors: [
      { date: '2026-02-20', title: 'Dark Chocolate PB Crunch', description: 'Dark Chocolate custard.' },
      { date: '2026-02-21', title: 'Chocolate Caramel Twist', description: 'Chocolate and Vanilla.' },
    ],
  },
  'madison-todd-drive': {
    name: 'Madison Todd Dr',
    flavors: [
      { date: '2026-02-20', title: 'Chocolate Volcano', description: 'Chocolate with fudge.' },
      { date: '2026-02-21', title: 'Butter Pecan', description: 'Butter Pecan custard.' },
    ],
  },
};

// Small test allowlist — only valid slugs for our mock data
const TEST_VALID_SLUGS = new Set(['mt-horeb', 'madison-todd-drive']);

// Mock KV namespace
function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    _store: store,
  };
}

// Mock fetchFlavors that returns data from MOCK_FLAVORS
function createMockFetchFlavors() {
  return vi.fn(async (slug) => {
    const data = MOCK_FLAVORS[slug];
    if (!data) {
      throw new Error(`Unknown restaurant slug: ${slug}`);
    }
    return data;
  });
}

function makeRequest(path) {
  return new Request(`https://example.com${path}`);
}

describe('Worker request handling', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = { FLAVOR_CACHE: mockKV, _validSlugsOverride: TEST_VALID_SLUGS };
  });

  it('1: returns valid .ics for single primary store', async () => {
    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');

    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('🍦 Dark Chocolate PB Crunch');
  });

  it('2: includes backup options when secondary stores provided', async () => {
    const req = makeRequest('/calendar.ics?primary=mt-horeb&secondary=madison-todd-drive');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.text();
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('Backup Option');
    expect(unfolded).toContain('🍨: Chocolate Volcano - Madison Todd Dr');
  });

  it('3: returns 400 when primary param is missing', async () => {
    const req = makeRequest('/calendar.ics');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('4: returns 400 when more than 3 secondary stores', async () => {
    const req = makeRequest('/calendar.ics?primary=mt-horeb&secondary=a,b,c,d');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/secondary/i);
  });

  it('5: caches flavor data in KV after first fetch', async () => {
    const req1 = makeRequest('/calendar.ics?primary=mt-horeb');
    await handleRequest(req1, env, mockFetchFlavors);

    // First request should have fetched and stored
    expect(mockKV.put).toHaveBeenCalled();
    expect(mockFetchFlavors).toHaveBeenCalledTimes(1);

    // Second request should use cache
    mockFetchFlavors.mockClear();
    const req2 = makeRequest('/calendar.ics?primary=mt-horeb');
    await handleRequest(req2, env, mockFetchFlavors);

    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('6: /health returns 200 with status ok', async () => {
    const req = makeRequest('/health');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('7: includes CORS headers', async () => {
    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });

  it('8: returns 400 for invalid/unknown slug', async () => {
    const req = makeRequest('/calendar.ics?primary=nonexistent-store-xyz');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('Slug validation', () => {
  const slugs = new Set(['mt-horeb', 'madison-todd-drive']);

  it('accepts valid slug in allowlist', () => {
    expect(isValidSlug('mt-horeb', slugs)).toEqual({ valid: true });
  });

  it('rejects empty slug', () => {
    const result = isValidSlug('', slugs);
    expect(result.valid).toBe(false);
  });

  it('rejects slug with invalid characters', () => {
    const result = isValidSlug('../etc/passwd', slugs);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid characters/i);
  });

  it('rejects slug not in allowlist', () => {
    const result = isValidSlug('valid-format-but-unknown', slugs);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unknown/i);
  });
});

describe('Security hardening', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = { FLAVOR_CACHE: mockKV, _validSlugsOverride: TEST_VALID_SLUGS };
  });

  it('9: rejects slug not in allowlist without calling fetchFlavors', async () => {
    const req = makeRequest('/calendar.ics?primary=fake-store-xyz');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown store/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('10: rejects path traversal in slug without calling fetchFlavors', async () => {
    const req = makeRequest('/calendar.ics?primary=../etc/passwd');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid characters/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('11: returns 400 when daily fetch budget is exhausted', async () => {
    // Pre-fill the fetch counter to the limit
    mockKV._store.set('meta:fetch-count', '50');

    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fetch limit/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('12: rejects slug with special characters', async () => {
    const req = makeRequest('/calendar.ics?primary=store%3Cscript%3E');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid characters/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('13: rejects empty primary slug value', async () => {
    const req = makeRequest('/calendar.ics?primary=');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
  });

  it('14: rejects invalid secondary slug without fetching anything', async () => {
    const req = makeRequest('/calendar.ics?primary=mt-horeb&secondary=fake-store');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/secondary.*unknown/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('15: uses ALLOWED_ORIGIN for CORS when configured', async () => {
    env.ALLOWED_ORIGIN = 'https://mysite.github.io';
    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://mysite.github.io');
  });

  it('16: defaults CORS to wildcard when ALLOWED_ORIGIN not set', async () => {
    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

// --- /api/flavors endpoint ---

describe('/api/flavors endpoint', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = { FLAVOR_CACHE: mockKV, _validSlugsOverride: TEST_VALID_SLUGS };
  });

  it('17: returns JSON flavor data for valid slug', async () => {
    const req = makeRequest('/api/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);

    const body = await res.json();
    expect(body.name).toBe('Mt. Horeb');
    expect(body.flavors).toHaveLength(2);
    expect(body.flavors[0].date).toBe('2026-02-20');
    expect(body.flavors[0].title).toBe('Dark Chocolate PB Crunch');
  });

  it('18: returns 400 when slug param is missing', async () => {
    const req = makeRequest('/api/flavors');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slug/i);
  });

  it('19: returns 400 for invalid slug', async () => {
    const req = makeRequest('/api/flavors?slug=../etc/passwd');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('20: returns 400 for unknown slug', async () => {
    const req = makeRequest('/api/flavors?slug=nonexistent-store');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown/i);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });

  it('21: includes 12h Cache-Control header', async () => {
    const req = makeRequest('/api/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=43200');
  });

  it('22: uses KV cache on second request', async () => {
    const req1 = makeRequest('/api/flavors?slug=mt-horeb');
    await handleRequest(req1, env, mockFetchFlavors);
    expect(mockFetchFlavors).toHaveBeenCalledTimes(1);

    mockFetchFlavors.mockClear();
    const req2 = makeRequest('/api/flavors?slug=mt-horeb');
    await handleRequest(req2, env, mockFetchFlavors);
    expect(mockFetchFlavors).not.toHaveBeenCalled();
  });
});

// --- /api/stores endpoint ---

const TEST_STORE_INDEX = [
  { slug: 'mt-horeb', name: 'Mt. Horeb, WI', city: 'Mt. Horeb', state: 'WI' },
  { slug: 'madison-todd-drive', name: 'Madison, WI', city: 'Madison', state: 'WI' },
  { slug: 'madison-east-wash', name: 'Madison, WI', city: 'Madison', state: 'WI' },
  { slug: 'chicago-il-main-st', name: 'Chicago, IL', city: 'Chicago', state: 'IL' },
];

describe('/api/stores endpoint', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: TEST_VALID_SLUGS,
      _storeIndexOverride: TEST_STORE_INDEX,
    };
  });

  it('23: returns matching stores for valid query', async () => {
    const req = makeRequest('/api/stores?q=madison');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stores).toHaveLength(2);
    expect(body.stores[0].slug).toBe('madison-todd-drive');
  });

  it('24: returns empty array for query shorter than 2 chars', async () => {
    const req = makeRequest('/api/stores?q=m');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stores).toHaveLength(0);
  });

  it('25: returns empty array when no query provided', async () => {
    const req = makeRequest('/api/stores');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stores).toHaveLength(0);
  });

  it('26: search is case-insensitive', async () => {
    const req = makeRequest('/api/stores?q=CHICAGO');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stores).toHaveLength(1);
    expect(body.stores[0].slug).toBe('chicago-il-main-st');
  });

  it('27: caps results at 25', async () => {
    // Create a large store index with 30 matching entries
    const bigIndex = Array.from({ length: 30 }, (_, i) => ({
      slug: `test-store-${i}`,
      name: `Test City ${i}, WI`,
      city: `Test City ${i}`,
      state: 'WI',
    }));
    env._storeIndexOverride = bigIndex;

    const req = makeRequest('/api/stores?q=test');
    const res = await handleRequest(req, env, mockFetchFlavors);

    const body = await res.json();
    expect(body.stores).toHaveLength(25);
  });

  it('28: includes 24h Cache-Control header', async () => {
    const req = makeRequest('/api/stores?q=madison');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('29: searches by slug too', async () => {
    const req = makeRequest('/api/stores?q=todd');
    const res = await handleRequest(req, env, mockFetchFlavors);

    const body = await res.json();
    expect(body.stores).toHaveLength(1);
    expect(body.stores[0].slug).toBe('madison-todd-drive');
  });
});

// --- /api/geolocate endpoint ---

describe('/api/geolocate endpoint', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = { FLAVOR_CACHE: mockKV, _validSlugsOverride: TEST_VALID_SLUGS };
  });

  it('30: returns geolocation JSON shape', async () => {
    const req = makeRequest('/api/geolocate');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('state');
    expect(body).toHaveProperty('stateName');
    expect(body).toHaveProperty('city');
    expect(body).toHaveProperty('country');
  });

  it('31: returns private no-store cache header', async () => {
    const req = makeRequest('/api/geolocate');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('32: returns null fields when request.cf is absent', async () => {
    const req = makeRequest('/api/geolocate');
    const res = await handleRequest(req, env, mockFetchFlavors);

    const body = await res.json();
    expect(body.state).toBeNull();
    expect(body.stateName).toBeNull();
    expect(body.city).toBeNull();
    expect(body.country).toBeNull();
  });

  it('33: includes CORS headers', async () => {
    const req = makeRequest('/api/geolocate');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });
});

// --- /api/nearby-flavors route-level tests ---

describe('/api/nearby-flavors route integration', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: TEST_VALID_SLUGS,
      _fetchOverride: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            geofences: [{
              metadata: { slug: 'mt-horeb', city: 'Mt. Horeb', state: 'WI', streetAddress: '505 Springdale St', flavorOfTheDay: 'Butter Pecan' },
              geometryCenter: { coordinates: [-89.718, 43.011] },
            }],
          },
        }),
      })),
    };
  });

  it('34: routes /api/nearby-flavors correctly', async () => {
    const req = makeRequest('/api/nearby-flavors?location=53572');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('nearby');
    expect(body).toHaveProperty('matches');
    expect(body).toHaveProperty('suggestions');
    expect(body).toHaveProperty('all_flavors_today');
  });

  it('35: nearby-flavors returns 400 without location', async () => {
    const req = makeRequest('/api/nearby-flavors');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(400);
  });

  it('36: 404 mentions nearby-flavors in available routes', async () => {
    const req = makeRequest('/nonexistent');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('nearby-flavors');
  });

  it('37: OPTIONS returns 204 for CORS preflight', async () => {
    const req = new Request('https://example.com/api/nearby-flavors?location=53572', { method: 'OPTIONS' });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(204);
  });
});
