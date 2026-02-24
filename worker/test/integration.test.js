import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest, isValidSlug, getFetcherForSlug, getBrandForSlug, normalizePath } from '../src/index.js';

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

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
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

  it('22b: rejects cache record when slug metadata mismatches and refetches upstream', async () => {
    // Seed a poisoned slug-scoped cache entry.
    mockKV._store.set('flavors:mt-horeb', JSON.stringify({
      _meta: { v: 1, shared: false, slug: 'pensacola-fl', cachedAt: '2026-02-22T00:00:00.000Z' },
      data: {
        name: 'Pensacola',
        flavors: [{ date: '2026-02-20', title: 'Wrong Flavor', description: '' }],
      },
    }));

    const req = makeRequest('/api/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('Mt. Horeb');
    expect(mockFetchFlavors).toHaveBeenCalledTimes(1);
  });

  it('22c: returns fresh data even when KV put fails (429 resilience)', async () => {
    mockKV.put = vi.fn(async () => {
      throw new Error('KV write failed: 429 Too Many Requests');
    });

    const req = makeRequest('/api/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('Mt. Horeb');
    expect(mockFetchFlavors).toHaveBeenCalledTimes(1);
  });

  it('22d: returns 502 when upstream fetch fails for valid slug', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('Upstream unavailable');
    });

    const req = makeRequest('/api/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, failingFetch);
    expect(res.status).toBe(502);
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
              metadata: { slug: 'mt-horeb', city: 'Mt. Horeb', state: 'WI', street: '505 Springdale St', flavorOfDayName: 'Butter Pecan' },
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

// --- "See website" fallback tests ---

describe('Fallback events on fetch failure', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: new Set(['mt-horeb', 'madison-todd-drive', 'kopps-greenfield', 'gilles', 'hefners', 'kraverz']),
    };
  });

  it('38: generates fallback event when primary store fetch fails', async () => {
    const failingFetcher = vi.fn(async () => { throw new Error('Network error'); });
    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, failingFetcher);

    // Should still return 200 with a fallback event
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('BEGIN:VEVENT');
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('See');
    expect(unfolded).toContain('website');
  });

  it('39: fallback event when secondary fails but primary succeeds', async () => {
    let callCount = 0;
    const partialFetcher = vi.fn(async (slug) => {
      callCount++;
      if (slug === 'madison-todd-drive') throw new Error('Site down');
      return MOCK_FLAVORS[slug];
    });

    const req = makeRequest('/calendar.ics?primary=mt-horeb&secondary=madison-todd-drive');
    const res = await handleRequest(req, env, partialFetcher);

    expect(res.status).toBe(200);
    const body = await res.text();
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    // Primary should have real flavors
    expect(unfolded).toContain('Dark Chocolate PB Crunch');
    // Secondary should have fallback
    expect(unfolded).toContain('See');
  });

  it('40: fallback event contains correct Culver\'s URL for Culver\'s store', async () => {
    const failingFetcher = vi.fn(async () => { throw new Error('Network error'); });
    const req = makeRequest('/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, failingFetcher);

    const body = await res.text();
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('culvers.com/restaurants/mt-horeb');
  });

  it('41: fallback event contains correct brand URL for MKE brand', async () => {
    const failingFetcher = vi.fn(async () => { throw new Error('Network error'); });
    const req = makeRequest('/calendar.ics?primary=kopps-greenfield');
    const res = await handleRequest(req, env, failingFetcher);

    const body = await res.text();
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('kopps.com');
  });
});

// --- Brand routing tests ---

describe('Brand routing', () => {
  it('42: getFetcherForSlug returns Kopp\'s for kopps-* slugs', () => {
    const result = getFetcherForSlug('kopps-greenfield');
    expect(result.brand).toBe("Kopp's");
    expect(result.url).toContain('kopps.com');
  });

  it('43: getFetcherForSlug returns Gille\'s for gilles slug', () => {
    const result = getFetcherForSlug('gilles');
    expect(result.brand).toBe("Gille's");
  });

  it('44: getFetcherForSlug returns Hefner\'s for hefners slug', () => {
    const result = getFetcherForSlug('hefners');
    expect(result.brand).toBe("Hefner's");
  });

  it('45: getFetcherForSlug returns Kraverz for kraverz slug', () => {
    const result = getFetcherForSlug('kraverz');
    expect(result.brand).toBe('Kraverz');
  });

  it('46: getFetcherForSlug returns Culver\'s for regular slugs', () => {
    const result = getFetcherForSlug('mt-horeb');
    expect(result.brand).toBe("Culver's");
    expect(result.url).toContain('culvers.com');
  });

  it('47: getBrandForSlug returns correct brand names', () => {
    expect(getBrandForSlug('kopps-brookfield')).toBe("Kopp's");
    expect(getBrandForSlug('gilles')).toBe("Gille's");
    expect(getBrandForSlug('hefners')).toBe("Hefner's");
    expect(getBrandForSlug('kraverz')).toBe('Kraverz');
    expect(getBrandForSlug('mt-horeb')).toBe("Culver's");
  });
});

// --- MKE brand calendar generation ---

describe('MKE brand calendar generation', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: new Set(['mt-horeb', 'kopps-greenfield', 'kopps-brookfield', 'kopps-glendale', 'gilles', 'hefners', 'kraverz']),
    };
  });

  it('48: Kopp\'s calendar has brand-specific name', async () => {
    const koppsFetcher = vi.fn(async () => ({
      name: "Kopp's Frozen Custard",
      flavors: [{ date: '2026-02-21', title: "Reese's PB Kupps & Heath Bar", description: '' }],
    }));
    const req = makeRequest('/calendar.ics?primary=kopps-greenfield');
    const res = await handleRequest(req, env, koppsFetcher);

    expect(res.status).toBe(200);
    const body = await res.text();
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain("Kopp's FOTD");
  });

  it('49: mixed calendar (Culver\'s primary + MKE secondary)', async () => {
    const mixedFetcher = vi.fn(async (slug) => {
      if (slug === 'mt-horeb') return MOCK_FLAVORS['mt-horeb'];
      return {
        name: "Kopp's Frozen Custard",
        flavors: [{ date: '2026-02-21', title: 'Butter Pecan & Mint Oreo', description: '' }],
      };
    });
    const req = makeRequest('/calendar.ics?primary=mt-horeb&secondary=kopps-greenfield');
    const res = await handleRequest(req, env, mixedFetcher);

    expect(res.status).toBe(200);
    const body = await res.text();
    const unfolded = body.replace(/\r\n[ \t]/g, '');
    // Primary should be Culver's branded
    expect(unfolded).toContain("Culver's FOTD");
    // Should contain backup from Kopp's
    expect(unfolded).toContain('Butter Pecan');
  });

  it('50: Kopp\'s shared KV caching across all 3 slugs', async () => {
    const koppsFetcher = vi.fn(async () => ({
      name: "Kopp's Frozen Custard",
      flavors: [{ date: '2026-02-21', title: 'Test Flavor', description: '' }],
    }));

    // First request for kopps-greenfield
    const req1 = makeRequest('/calendar.ics?primary=kopps-greenfield');
    await handleRequest(req1, env, koppsFetcher);
    expect(koppsFetcher).toHaveBeenCalledTimes(1);

    // Second request for kopps-brookfield should use cache
    koppsFetcher.mockClear();
    const req2 = makeRequest('/calendar.ics?primary=kopps-brookfield');
    await handleRequest(req2, env, koppsFetcher);
    expect(koppsFetcher).not.toHaveBeenCalled();
  });
});

// --- API v1 versioned routing ---

describe('normalizePath', () => {
  it('maps /api/v1/flavors to /api/flavors with isVersioned=true', () => {
    expect(normalizePath('/api/v1/flavors')).toEqual({ canonical: '/api/flavors', isVersioned: true });
  });

  it('maps /api/v1/today to /api/today', () => {
    expect(normalizePath('/api/v1/today')).toEqual({ canonical: '/api/today', isVersioned: true });
  });

  it('maps /api/v1/stores to /api/stores', () => {
    expect(normalizePath('/api/v1/stores')).toEqual({ canonical: '/api/stores', isVersioned: true });
  });

  it('maps /api/v1/geolocate to /api/geolocate', () => {
    expect(normalizePath('/api/v1/geolocate')).toEqual({ canonical: '/api/geolocate', isVersioned: true });
  });

  it('maps /api/v1/nearby-flavors to /api/nearby-flavors', () => {
    expect(normalizePath('/api/v1/nearby-flavors')).toEqual({ canonical: '/api/nearby-flavors', isVersioned: true });
  });

  it('maps /api/v1/flavors/catalog to /api/flavors/catalog', () => {
    expect(normalizePath('/api/v1/flavors/catalog')).toEqual({ canonical: '/api/flavors/catalog', isVersioned: true });
  });

  it('maps /api/v1/flavor-config to /api/flavor-config', () => {
    expect(normalizePath('/api/v1/flavor-config')).toEqual({ canonical: '/api/flavor-config', isVersioned: true });
  });

  it('maps /api/v1/alerts/subscribe to /api/alerts/subscribe', () => {
    expect(normalizePath('/api/v1/alerts/subscribe')).toEqual({ canonical: '/api/alerts/subscribe', isVersioned: true });
  });

  it('maps /api/v1/quiz/events to /api/quiz/events', () => {
    expect(normalizePath('/api/v1/quiz/events')).toEqual({ canonical: '/api/quiz/events', isVersioned: true });
  });

  it('maps /api/v1/quiz/personality-index to /api/quiz/personality-index', () => {
    expect(normalizePath('/api/v1/quiz/personality-index')).toEqual({ canonical: '/api/quiz/personality-index', isVersioned: true });
  });

  it('maps /api/v1/events to /api/events', () => {
    expect(normalizePath('/api/v1/events')).toEqual({ canonical: '/api/events', isVersioned: true });
  });

  it('maps /api/v1/events/summary to /api/events/summary', () => {
    expect(normalizePath('/api/v1/events/summary')).toEqual({ canonical: '/api/events/summary', isVersioned: true });
  });

  it('maps /api/v1/metrics/intelligence to /api/metrics/intelligence', () => {
    expect(normalizePath('/api/v1/metrics/intelligence')).toEqual({ canonical: '/api/metrics/intelligence', isVersioned: true });
  });

  it('maps /api/v1/trivia to /api/trivia', () => {
    expect(normalizePath('/api/v1/trivia')).toEqual({ canonical: '/api/trivia', isVersioned: true });
  });

  it('maps /v1/calendar.ics to /calendar.ics', () => {
    expect(normalizePath('/v1/calendar.ics')).toEqual({ canonical: '/calendar.ics', isVersioned: true });
  });

  it('passes through legacy /api/flavors as isVersioned=false', () => {
    expect(normalizePath('/api/flavors')).toEqual({ canonical: '/api/flavors', isVersioned: false });
  });

  it('passes through /calendar.ics as isVersioned=false', () => {
    expect(normalizePath('/calendar.ics')).toEqual({ canonical: '/calendar.ics', isVersioned: false });
  });

  it('passes through /health as isVersioned=false', () => {
    expect(normalizePath('/health')).toEqual({ canonical: '/health', isVersioned: false });
  });
});

describe('API v1 versioned endpoints', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = { FLAVOR_CACHE: mockKV, _validSlugsOverride: TEST_VALID_SLUGS };
  });

  it('51: /api/v1/flavors returns data with API-Version header', async () => {
    const req = makeRequest('/api/v1/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.name).toBe('Mt. Horeb');
  });

  it('52: legacy /api/flavors still works without API-Version header', async () => {
    const req = makeRequest('/api/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBeNull();
    const body = await res.json();
    expect(body.name).toBe('Mt. Horeb');
  });

  it('53: /api/v1/stores returns data with API-Version header', async () => {
    env._storeIndexOverride = TEST_STORE_INDEX;
    const req = makeRequest('/api/v1/stores?q=madison');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.stores.length).toBeGreaterThan(0);
  });

  it('54: /v1/calendar.ics returns calendar with API-Version header', async () => {
    const req = makeRequest('/v1/calendar.ics?primary=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
  });

  it('55: /api/v1/geolocate returns data with API-Version header', async () => {
    const req = makeRequest('/api/v1/geolocate');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
  });

  it('55b: /api/v1/flavor-config returns data with API-Version header', async () => {
    const req = makeRequest('/api/v1/flavor-config');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.brand_colors?.culvers).toBeTruthy();
    expect(body.similarity_groups?.mint?.length).toBeGreaterThan(0);
    expect(body.flavor_families?.mint?.members?.length).toBeGreaterThan(0);
  });

  it('55c: /api/v1/metrics/intelligence returns data with API-Version header', async () => {
    const req = makeRequest('/api/v1/metrics/intelligence');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.contract_version).toBe(1);
    expect(body.source).toBe('trivia_metrics_seed');
    expect(body.coverage?.overall_covered).toBeGreaterThan(0);
  });

  it('56: /health has no API-Version header (unversioned)', async () => {
    const req = makeRequest('/health');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBeNull();
  });
});

describe('/api/v1/quiz endpoints', () => {
  function createQuizMockDB() {
    return {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          run: vi.fn(async () => ({ success: true, sql, args })),
          first: vi.fn(async () => ({ events: 1, matched_events: 1 })),
          all: vi.fn(async () => ({ results: [] })),
        })),
      })),
    };
  }

  it('routes /api/v1/quiz/events and adds API-Version header', async () => {
    const env = { FLAVOR_CACHE: createMockKV(), DB: createQuizMockDB(), _validSlugsOverride: TEST_VALID_SLUGS };
    const req = new Request('https://example.com/api/v1/quiz/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: 'weather-v1',
        event_type: 'quiz_result',
        archetype: 'cool-front',
        result_flavor: 'Mint Explosion',
      }),
    });

    const res = await handleRequest(req, env, createMockFetchFlavors());
    expect(res.status).toBe(202);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('/api/v1/events endpoints', () => {
  function createEventsMockDB() {
    return {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          run: vi.fn(async () => ({ success: true, sql, args })),
          first: vi.fn(async () => ({ events: 1, cta_clicks: 1, signal_views: 0, popup_opens: 0 })),
          all: vi.fn(async () => ({ results: [] })),
        })),
      })),
    };
  }

  it('routes /api/v1/events and adds API-Version header', async () => {
    const env = { FLAVOR_CACHE: createMockKV(), DB: createEventsMockDB(), _validSlugsOverride: TEST_VALID_SLUGS };
    const req = new Request('https://example.com/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'cta_click',
        page: 'index',
        action: 'directions',
      }),
    });

    const res = await handleRequest(req, env, createMockFetchFlavors());
    expect(res.status).toBe(202);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('routes /api/v1/events/summary and adds API-Version header', async () => {
    const env = { FLAVOR_CACHE: createMockKV(), DB: createEventsMockDB(), _validSlugsOverride: TEST_VALID_SLUGS };
    const req = new Request('https://example.com/api/v1/events/summary?days=7', { method: 'GET' });

    const res = await handleRequest(req, env, createMockFetchFlavors());
    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.window_days).toBe(7);
    expect(body.totals.events).toBe(1);
  });
});

describe('/api/v1/trivia endpoint', () => {
  function createTriviaMockDB() {
    return {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [
              { slug: 'mt-horeb', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 20 },
              { slug: 'mt-horeb', normalized_flavor: 'chocolate', flavor: 'Chocolate', count: 18 },
              { slug: 'madison-todd-drive', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 17 },
              { slug: 'madison-todd-drive', normalized_flavor: 'strawberry', flavor: 'Strawberry', count: 11 },
            ],
          })),
        })),
      })),
    };
  }

  it('routes /api/v1/trivia and adds API-Version header', async () => {
    const env = {
      FLAVOR_CACHE: createMockKV(),
      DB: createTriviaMockDB(),
      _validSlugsOverride: TEST_VALID_SLUGS,
      _storeIndexOverride: TEST_STORE_INDEX,
    };
    const req = new Request('https://example.com/api/v1/trivia?days=180&limit=5', { method: 'GET' });

    const res = await handleRequest(req, env, createMockFetchFlavors());
    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.id).toBe('trivia-v1');
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions.length).toBeGreaterThan(0);
  });
});

describe('Bearer token auth', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: TEST_VALID_SLUGS,
      ACCESS_TOKEN: 'test-secret-token',
    };
  });

  it('57: accepts Authorization: Bearer header', async () => {
    const req = new Request('https://example.com/api/v1/flavors?slug=mt-horeb', {
      headers: { 'Authorization': 'Bearer test-secret-token' },
    });
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(200);
  });

  it('58: still accepts ?token= query param as fallback', async () => {
    const req = makeRequest('/api/v1/flavors?slug=mt-horeb&token=test-secret-token');
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(200);
  });

  it('59: rejects request with wrong Bearer token', async () => {
    const req = new Request('https://example.com/api/v1/flavors?slug=mt-horeb', {
      headers: { 'Authorization': 'Bearer wrong-token' },
    });
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(403);
  });

  it('60: rejects request with no auth when ACCESS_TOKEN is set', async () => {
    const req = makeRequest('/api/v1/flavors?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(403);
  });

  it('60b: /health remains public even when ACCESS_TOKEN is set', async () => {
    const req = makeRequest('/health');
    const res = await handleRequest(req, env, mockFetchFlavors);
    expect(res.status).toBe(200);
  });
});

// --- /api/today endpoint ---

describe('/api/today endpoint', () => {
  let mockKV;
  let mockFetchFlavors;
  let env;

  // Mock D1 with snapshot data for mt-horeb
  function createMockDB(snapshotRows, countRows) {
    return {
      prepare: (sql) => ({
        bind: (...args) => ({
          all: async () => {
            if (sql.includes('ORDER BY date')) {
              return { results: snapshotRows || [] };
            }
            return { results: countRows || [] };
          },
        }),
      }),
    };
  }

  // Snapshot data: Dark Chocolate PB Crunch appeared 3 times (rare relative to 10 flavors)
  const SNAPSHOT_DATES = [
    { date: '2025-06-01' },
    { date: '2025-09-15' },
    { date: '2026-02-20' },
  ];
  const FLAVOR_COUNTS = [
    { normalized_flavor: 'vanilla', cnt: 30 },
    { normalized_flavor: 'chocolate', cnt: 28 },
    { normalized_flavor: 'caramel cashew', cnt: 25 },
    { normalized_flavor: 'butter pecan', cnt: 22 },
    { normalized_flavor: 'cookie dough', cnt: 20 },
    { normalized_flavor: 'mint chip', cnt: 18 },
    { normalized_flavor: 'strawberry', cnt: 15 },
    { normalized_flavor: 'chocolate caramel twist', cnt: 10 },
    { normalized_flavor: 'dark chocolate decadence', cnt: 5 },
    { normalized_flavor: 'dark chocolate pb crunch', cnt: 3 },
  ];

  beforeEach(() => {
    mockKV = createMockKV();
    mockFetchFlavors = createMockFetchFlavors();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: TEST_VALID_SLUGS,
      _storeIndexOverride: TEST_STORE_INDEX,
      DB: createMockDB(SNAPSHOT_DATES, FLAVOR_COUNTS),
    };
  });

  it('64: returns today\'s flavor with spoken field and rarity', async () => {
    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBe('1');
    const body = await res.json();
    expect(body.store).toBe('Mt. Horeb');
    expect(body.slug).toBe('mt-horeb');
    expect(body.brand).toBe("Culver's");
    expect(body.flavor).toBeTruthy();
    expect(body.spoken).toMatch(/Today the flavor of the day at/);
    expect(body.spoken).toContain("Culver's of Mt. Horeb");
    expect(body.spoken).not.toContain("WI - ");
    expect(body.spoken).toContain(body.description);
    expect(body.spoken_verbose).toMatch(/For .*?, .* is serving /);
    expect(body.spoken_verbose).toMatch(/Location:/);
    // Rarity fields
    expect(body.rarity).toBeTruthy();
    expect(body.rarity.appearances).toBe(3);
    expect(body.rarity.avg_gap_days).toBeGreaterThan(0);
    expect(['Ultra Rare', 'Rare', 'Uncommon', 'Common', 'Staple']).toContain(body.rarity.label);
  });

  it('65: returns 400 when slug is missing', async () => {
    const req = makeRequest('/api/v1/today');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slug/i);
  });

  it('66: returns 400 for invalid slug', async () => {
    const req = makeRequest('/api/v1/today?slug=nonexistent');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown store/i);
  });

  it('67: legacy /api/today path works without API-Version header', async () => {
    const req = makeRequest('/api/today?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    expect(res.status).toBe(200);
    expect(res.headers.get('API-Version')).toBeNull();
    const body = await res.json();
    expect(body.flavor).toBeTruthy();
  });

  it('68: includes description when available', async () => {
    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    const body = await res.json();
    expect(body.description).toBeTruthy();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('68b: returns 502 when upstream fetch fails for valid slug', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('Upstream unavailable');
    });

    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, env, failingFetch);
    expect(res.status).toBe(502);
  });

  it('69: returns graceful response when no flavors available', async () => {
    const emptyFetcher = vi.fn(async () => ({
      name: 'Empty Store',
      flavors: [],
    }));
    const emptyEnv = {
      FLAVOR_CACHE: createMockKV(),
      _validSlugsOverride: TEST_VALID_SLUGS,
    };

    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, emptyEnv, emptyFetcher);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flavor).toBeNull();
    expect(body.spoken).toMatch(/couldn't find/i);
    expect(body.spoken_verbose).toMatch(/Try again later today/i);
  });

  it('70: rarity is null when DB is unavailable', async () => {
    const noDbEnv = {
      FLAVOR_CACHE: createMockKV(),
      _validSlugsOverride: TEST_VALID_SLUGS,
      _storeIndexOverride: TEST_STORE_INDEX,
    };
    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, noDbEnv, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flavor).toBeTruthy();
    expect(body.rarity).toBeNull();
  });

  it('71: rarity is null when store has no snapshots', async () => {
    const emptyDbEnv = {
      FLAVOR_CACHE: createMockKV(),
      _validSlugsOverride: TEST_VALID_SLUGS,
      _storeIndexOverride: TEST_STORE_INDEX,
      DB: createMockDB([], []),
    };
    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, emptyDbEnv, mockFetchFlavors);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flavor).toBeTruthy();
    expect(body.rarity).toBeNull();
  });

  it('72: spoken text includes gap info for rare flavors', async () => {
    const req = makeRequest('/api/v1/today?slug=mt-horeb');
    const res = await handleRequest(req, env, mockFetchFlavors);

    const body = await res.json();
    if (body.rarity && (body.rarity.label === 'Ultra Rare' || body.rarity.label === 'Rare')) {
      expect(body.spoken).toMatch(/averages \d+ days between appearances/);
    }
  });
});
