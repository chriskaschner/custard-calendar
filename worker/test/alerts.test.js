import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';

// Mock email sender
vi.mock('../src/email-sender.js', () => ({
  sendConfirmationEmail: vi.fn(async () => ({ ok: true })),
  sendAlertEmail: vi.fn(async () => ({ ok: true })),
}));

import { sendConfirmationEmail } from '../src/email-sender.js';

const TEST_VALID_SLUGS = new Set(['mt-horeb', 'madison-todd-drive']);
const TEST_STORE_INDEX = [
  { slug: 'mt-horeb', name: 'Mt. Horeb, WI', city: 'Mt. Horeb', state: 'WI' },
  { slug: 'madison-todd-drive', name: 'Madison Todd Dr, WI', city: 'Madison', state: 'WI' },
];

const MOCK_FLAVORS = {
  'mt-horeb': {
    name: 'Mt. Horeb',
    flavors: [
      { date: '2026-02-20', title: 'Dark Chocolate PB Crunch', description: 'Dark Chocolate custard.' },
      { date: '2026-02-21', title: 'Chocolate Caramel Twist', description: 'Chocolate and Vanilla.' },
    ],
  },
};

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    delete: vi.fn(async (key) => store.delete(key)),
    list: vi.fn(async (opts) => {
      const prefix = opts?.prefix || '';
      const keys = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          keys.push({ name: key });
        }
      }
      return { keys, list_complete: true };
    }),
    _store: store,
  };
}

function createMockFetchFlavors() {
  return vi.fn(async (slug) => {
    const data = MOCK_FLAVORS[slug];
    if (!data) throw new Error(`Unknown restaurant slug: ${slug}`);
    return data;
  });
}

function makeRequest(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const headers = body
    ? { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }
    : { 'CF-Connecting-IP': '1.2.3.4' };
  return new Request(`https://example.com${path}`, {
    method,
    body,
    headers,
  });
}

describe('Alert routes', () => {
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
      RESEND_API_KEY: 'test-api-key',
      ALERT_FROM_EMAIL: 'test@example.com',
      WORKER_BASE_URL: 'https://example.com',
    };
    vi.clearAllMocks();
  });

  describe('POST /api/alerts/subscribe', () => {
    it('1: creates pending subscription and returns success', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle', 'Mint Explosion'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.message).toContain('email');
      expect(sendConfirmationEmail).toHaveBeenCalledOnce();
    });

    it('2: rejects invalid email', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'not-an-email', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/email/i);
    });

    it('3: rejects invalid slug', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'nonexistent-store', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/store/i);
    });

    it('4: rejects empty favorites array', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: [] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/favorites/i);
    });

    it('5: rejects more than 10 favorites', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: {
          email: 'user@test.com',
          slug: 'mt-horeb',
          favorites: Array.from({ length: 11 }, (_, i) => `Flavor ${i}`),
        },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(400);
    });

    it('6: rejects invalid JSON body', async () => {
      const req = new Request('https://example.com/api/alerts/subscribe', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/json/i);
    });

    it('7: returns same 200 for duplicate subscription (no enumeration leak)', async () => {
      // Pre-populate an active subscription
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode('user@test.com:mt-horeb'));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const subId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

      mockKV._store.set(`alert:sub:${subId}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
        unsubToken: 'existing-token',
        createdAt: '2026-02-20T00:00:00Z',
      }));

      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      // Returns 200 with same message — attacker can't tell if subscription exists
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      // Should NOT have sent a confirmation email
      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('8: stores pending subscription in KV with correct structure', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'User@Test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      await handleRequest(req, env, mockFetchFlavors);

      // Find the pending key
      const pendingKey = [...mockKV._store.keys()].find(k => k.startsWith('alert:pending:'));
      expect(pendingKey).toBeDefined();

      const pending = JSON.parse(mockKV._store.get(pendingKey));
      expect(pending.email).toBe('user@test.com'); // lowercased
      expect(pending.slug).toBe('mt-horeb');
      expect(pending.favorites).toEqual(['Turtle']);
    });
  });

  describe('GET /api/alerts/confirm', () => {
    it('9: activates pending subscription', async () => {
      // Pre-populate a pending subscription
      const token = 'test-confirm-token';
      mockKV._store.set(`alert:pending:${token}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle', 'Mint Explosion'],
      }));

      const req = makeRequest(`/api/alerts/confirm?token=${token}`);
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');

      const body = await res.text();
      expect(body).toContain('all set');

      // Verify active subscription was created
      const subKey = [...mockKV._store.keys()].find(k => k.startsWith('alert:sub:'));
      expect(subKey).toBeDefined();

      const sub = JSON.parse(mockKV._store.get(subKey));
      expect(sub.email).toBe('user@test.com');
      expect(sub.favorites).toEqual(['Turtle', 'Mint Explosion']);
      expect(sub.unsubToken).toBeDefined();

      // Verify unsub token reverse lookup was created
      const unsubKey = [...mockKV._store.keys()].find(k => k.startsWith('alert:unsub:'));
      expect(unsubKey).toBeDefined();

      // Verify pending was deleted
      expect(mockKV._store.has(`alert:pending:${token}`)).toBe(false);
    });

    it('10: returns 404 for expired/invalid token', async () => {
      const req = makeRequest('/api/alerts/confirm?token=nonexistent');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(404);
    });

    it('11: returns 400 when token is missing', async () => {
      const req = makeRequest('/api/alerts/confirm');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(400);
    });

    it('12: is idempotent — second confirmation succeeds', async () => {
      const token = 'test-confirm-token';
      mockKV._store.set(`alert:pending:${token}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
      }));

      // First confirmation
      const req1 = makeRequest(`/api/alerts/confirm?token=${token}`);
      const res1 = await handleRequest(req1, env, mockFetchFlavors);
      expect(res1.status).toBe(200);

      // Put pending back to simulate a re-click (though normally it's deleted)
      mockKV._store.set(`alert:pending:${token}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
      }));

      // Second confirmation — should detect existing sub
      const req2 = makeRequest(`/api/alerts/confirm?token=${token}`);
      const res2 = await handleRequest(req2, env, mockFetchFlavors);
      expect(res2.status).toBe(200);
      const body = await res2.text();
      expect(body).toContain('already active');
    });
  });

  describe('GET /api/alerts/unsubscribe', () => {
    it('13: deletes subscription and returns confirmation', async () => {
      // Set up active subscription
      const subId = 'test-sub-id-123456789012345678';
      const unsubToken = 'test-unsub-token';

      mockKV._store.set(`alert:sub:${subId}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
        unsubToken,
        createdAt: '2026-02-20T00:00:00Z',
      }));
      mockKV._store.set(`alert:unsub:${unsubToken}`, subId);

      const req = makeRequest(`/api/alerts/unsubscribe?token=${unsubToken}`);
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('Unsubscribed');

      // Verify records deleted
      expect(mockKV._store.has(`alert:sub:${subId}`)).toBe(false);
      expect(mockKV._store.has(`alert:unsub:${unsubToken}`)).toBe(false);
    });

    it('14: returns 404 for invalid unsubscribe token', async () => {
      const req = makeRequest('/api/alerts/unsubscribe?token=invalid');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(404);
    });

    it('15: returns 400 when token is missing', async () => {
      const req = makeRequest('/api/alerts/unsubscribe');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/alerts/status', () => {
    it('16: returns subscription details for valid token', async () => {
      const subId = 'test-sub-id-123456789012345678';
      const unsubToken = 'test-status-token';

      mockKV._store.set(`alert:sub:${subId}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle', 'Mint Explosion'],
        unsubToken,
        createdAt: '2026-02-20T00:00:00Z',
      }));
      mockKV._store.set(`alert:unsub:${unsubToken}`, subId);

      const req = makeRequest(`/api/alerts/status?token=${unsubToken}`);
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.slug).toBe('mt-horeb');
      expect(data.storeName).toBe('Mt. Horeb, WI');
      expect(data.favorites).toEqual(['Turtle', 'Mint Explosion']);
      expect(data.createdAt).toBeDefined();
      // Should NOT expose email
      expect(data.email).toBeUndefined();
    });

    it('17: returns 404 for invalid status token', async () => {
      const req = makeRequest('/api/alerts/status?token=invalid');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(404);
    });

    it('18: returns 400 when token is missing', async () => {
      const req = makeRequest('/api/alerts/status');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/flavors/catalog', () => {
    it('19: returns flavor catalog with seed data', async () => {
      const req = makeRequest('/api/flavors/catalog');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.flavors).toBeDefined();
      expect(Array.isArray(data.flavors)).toBe(true);
      expect(data.flavors.length).toBeGreaterThan(20);
      expect(data.updatedAt).toBeDefined();

      // Check expected flavors are present
      const titles = data.flavors.map(f => f.title);
      expect(titles).toContain('Turtle');
      expect(titles).toContain('Mint Explosion');
      expect(titles).toContain('Dark Chocolate PB Crunch');
    });

    it('20: flavors are sorted alphabetically', async () => {
      const req = makeRequest('/api/flavors/catalog');
      const res = await handleRequest(req, env, mockFetchFlavors);

      const data = await res.json();
      const titles = data.flavors.map(f => f.title);
      const sorted = [...titles].sort((a, b) => a.localeCompare(b));
      expect(titles).toEqual(sorted);
    });

    it('21: includes descriptions for each flavor', async () => {
      const req = makeRequest('/api/flavors/catalog');
      const res = await handleRequest(req, env, mockFetchFlavors);

      const data = await res.json();
      for (const flavor of data.flavors) {
        expect(flavor.title).toBeDefined();
        expect(typeof flavor.title).toBe('string');
        expect(flavor.description).toBeDefined();
        expect(typeof flavor.description).toBe('string');
      }
    });

    it('22: has 24h cache header', async () => {
      const req = makeRequest('/api/flavors/catalog');
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.headers.get('Cache-Control')).toContain('86400');
    });
  });

  describe('CORS', () => {
    it('23: OPTIONS returns POST in allowed methods', async () => {
      const req = new Request('https://example.com/api/alerts/subscribe', { method: 'OPTIONS' });
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('24: OPTIONS returns Content-Type in allowed headers', async () => {
      const req = new Request('https://example.com/api/alerts/subscribe', { method: 'OPTIONS' });
      const res = await handleRequest(req, env, mockFetchFlavors);

      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });

  describe('Email sending failure', () => {
    it('25: returns 500 and cleans up pending on email failure', async () => {
      sendConfirmationEmail.mockResolvedValueOnce({ ok: false, error: 'API error' });

      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(500);

      // Pending should be cleaned up
      const pendingKeys = [...mockKV._store.keys()].filter(k => k.startsWith('alert:pending:'));
      expect(pendingKeys.length).toBe(0);
    });
  });

  describe('No API key configured', () => {
    it('26: subscribe works without sending email when no RESEND_API_KEY', async () => {
      delete env.RESEND_API_KEY;

      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(200);
      expect(sendConfirmationEmail).not.toHaveBeenCalled();

      // Pending should still be created
      const pendingKeys = [...mockKV._store.keys()].filter(k => k.startsWith('alert:pending:'));
      expect(pendingKeys.length).toBe(1);
    });
  });

  describe('Rate limiting', () => {
    it('27: blocks after too many subscribe attempts from same IP', async () => {
      // Pre-set IP rate limit counter to max
      mockKV._store.set('alert:ratelimit:ip:1.2.3.4', '10');

      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toMatch(/too many/i);
      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('28: silently drops after too many pending emails to same address', async () => {
      // Pre-set email rate limit counter to max
      mockKV._store.set('alert:ratelimit:email:user@test.com', '3');

      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      // Returns 200 — no indication that email was suppressed
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      // Should NOT have sent an email or created a pending record
      expect(sendConfirmationEmail).not.toHaveBeenCalled();
      const pendingKeys = [...mockKV._store.keys()].filter(k => k.startsWith('alert:pending:'));
      expect(pendingKeys.length).toBe(0);
    });

    it('29: increments rate limit counters on successful subscribe', async () => {
      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      await handleRequest(req, env, mockFetchFlavors);

      expect(mockKV._store.get('alert:ratelimit:ip:1.2.3.4')).toBe('1');
      expect(mockKV._store.get('alert:ratelimit:email:user@test.com')).toBe('1');
    });
  });

  describe('Email count tracking', () => {
    it('30: confirm increments email subscription count', async () => {
      const token = 'test-confirm-token';
      mockKV._store.set(`alert:pending:${token}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
      }));

      const req = makeRequest(`/api/alerts/confirm?token=${token}`);
      await handleRequest(req, env, mockFetchFlavors);

      // Email count should be incremented
      expect(mockKV._store.get('alert:email-count:user@test.com')).toBe('1');
    });

    it('31: unsubscribe decrements email subscription count', async () => {
      const subId = 'test-sub-id-123456789012345678';
      const unsubToken = 'test-unsub-token';

      mockKV._store.set(`alert:sub:${subId}`, JSON.stringify({
        email: 'user@test.com',
        slug: 'mt-horeb',
        favorites: ['Turtle'],
        unsubToken,
        createdAt: '2026-02-20T00:00:00Z',
      }));
      mockKV._store.set(`alert:unsub:${unsubToken}`, subId);
      mockKV._store.set('alert:email-count:user@test.com', '2');

      const req = makeRequest(`/api/alerts/unsubscribe?token=${unsubToken}`);
      await handleRequest(req, env, mockFetchFlavors);

      // Count should be decremented from 2 to 1
      expect(mockKV._store.get('alert:email-count:user@test.com')).toBe('1');
    });

    it('32: silently drops subscribe when at max active subscriptions', async () => {
      // Pre-set email count to max
      mockKV._store.set('alert:email-count:user@test.com', '5');

      const req = makeRequest('/api/alerts/subscribe', {
        method: 'POST',
        body: { email: 'user@test.com', slug: 'mt-horeb', favorites: ['Turtle'] },
      });

      const res = await handleRequest(req, env, mockFetchFlavors);
      // Returns 200 — no indication that limit was hit
      expect(res.status).toBe(200);
      expect(sendConfirmationEmail).not.toHaveBeenCalled();
    });
  });
});
