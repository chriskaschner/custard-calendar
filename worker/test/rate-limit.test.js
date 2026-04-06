import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';
import { _resetRateLimitState, _seedRateLimitCounter } from '../src/rate-limit.js';
import { _resetDailyProxyCounter } from '../src/route-nearby.js';

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    delete: vi.fn(async (key) => store.delete(key)),
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

const EMPTY_LOCATOR = { data: { geofences: [] } };

describe('nearby-flavors rate limiting', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    _resetRateLimitState();
    _resetDailyProxyCounter();
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _fetchOverride: createMockFetch(EMPTY_LOCATOR),
    };
  });

  it('returns 429 after 20 requests from same IP', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    _seedRateLimitCounter(`rl:nearby:1.2.3.4:${hour}`, 20);

    const req = new Request('https://example.com/api/nearby-flavors?location=53572', {
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
  });

  it('allows requests from a different IP when first IP is at limit', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    _seedRateLimitCounter(`rl:nearby:1.2.3.4:${hour}`, 20);

    const req = new Request('https://example.com/api/nearby-flavors?location=53572', {
      headers: { 'CF-Connecting-IP': '5.6.7.8' },
    });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
  });
});

describe('route-class rate limits', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    _resetRateLimitState();
    _resetDailyProxyCounter();
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _fetchOverride: createMockFetch(EMPTY_LOCATOR),
    };
  });

  it('limits public-write /api/events POST traffic per IP', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    _seedRateLimitCounter(`rl:events:write:1.2.3.4:${hour}`, 120);

    const req = new Request('https://example.com/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '1.2.3.4',
      },
      body: JSON.stringify({
        event_type: 'page_view',
        page: 'index',
      }),
    });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(429);
  });

  it('limits expensive /api/forecast/* reads per IP', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    _seedRateLimitCounter(`rl:forecast:read:1.2.3.4:${hour}`, 120);

    const req = new Request('https://example.com/api/forecast/mt-horeb', {
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(429);
  });

  it('resets per-hour read limit once the window rolls over', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-02-28T10:15:00Z'));
      const hourA = new Date().toISOString().slice(0, 13);
      _seedRateLimitCounter(`rl:forecast:read:1.2.3.4:${hourA}`, 120);

      const limitedReq = new Request('https://example.com/api/forecast/mt-horeb', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      });
      const limitedRes = await handleRequest(limitedReq, env);
      expect(limitedRes.status).toBe(429);

      // New hour bucket should not be blocked by the previous counter.
      _resetRateLimitState();
      vi.setSystemTime(new Date('2026-02-28T11:00:01Z'));
      const nextReq = new Request('https://example.com/api/forecast/mt-horeb', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      });
      const nextRes = await handleRequest(nextReq, env);
      expect(nextRes.status).not.toBe(429);
    } finally {
      vi.useRealTimers();
    }
  });

  it('global rate limit returns 429 after 300 requests (seeded)', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    _seedRateLimitCounter(`rl:global:1.2.3.4:${hour}`, 300);

    const req = new Request('https://example.com/api/stores?q=madison', {
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/300 requests/);
  });
});

describe('rate limits fire through real request flow (no seeding)', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    _resetRateLimitState();
    _resetDailyProxyCounter();
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _fetchOverride: createMockFetch(EMPTY_LOCATOR),
    };
  });

  it('nearby-flavors returns 429 after exactly 20 real requests', async () => {
    // Make 20 requests -- all should succeed
    for (let i = 0; i < 20; i++) {
      const req = new Request('https://example.com/api/nearby-flavors?location=53572', {
        headers: { 'CF-Connecting-IP': '9.9.9.9' },
      });
      const res = await handleRequest(req, env);
      expect(res.status).toBe(200);
    }

    // 21st request should be rate limited
    const req = new Request('https://example.com/api/nearby-flavors?location=53572', {
      headers: { 'CF-Connecting-IP': '9.9.9.9' },
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/20 nearby/i);
  });

  it('/api/stores requests increment the global counter toward 300', async () => {
    // Make 5 real requests and verify they all succeed (cheap endpoint, no per-route limit)
    for (let i = 0; i < 5; i++) {
      const req = new Request('https://example.com/api/stores?q=madison', {
        headers: { 'CF-Connecting-IP': '8.8.8.8' },
      });
      const res = await handleRequest(req, env);
      expect(res.status).toBe(200);
    }

    // Now seed the global counter near the limit and verify the next request is blocked
    const hour = new Date().toISOString().slice(0, 13);
    _seedRateLimitCounter(`rl:global:8.8.8.8:${hour}`, 300);

    const req = new Request('https://example.com/api/stores?q=madison', {
      headers: { 'CF-Connecting-IP': '8.8.8.8' },
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(429);
  });

  it('different IPs have independent rate limit counters', async () => {
    // Exhaust IP A's nearby limit
    for (let i = 0; i < 20; i++) {
      const req = new Request('https://example.com/api/nearby-flavors?location=53572', {
        headers: { 'CF-Connecting-IP': '10.0.0.1' },
      });
      await handleRequest(req, env);
    }

    // IP A is blocked
    const blockedReq = new Request('https://example.com/api/nearby-flavors?location=53572', {
      headers: { 'CF-Connecting-IP': '10.0.0.1' },
    });
    const blockedRes = await handleRequest(blockedReq, env);
    expect(blockedRes.status).toBe(429);

    // IP B still works
    const okReq = new Request('https://example.com/api/nearby-flavors?location=53572', {
      headers: { 'CF-Connecting-IP': '10.0.0.2' },
    });
    const okRes = await handleRequest(okReq, env);
    expect(okRes.status).toBe(200);
  });
});

describe('KV quota: rate limiter must not read or write KV', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    _resetRateLimitState();
    _resetDailyProxyCounter();
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _fetchOverride: createMockFetch(EMPTY_LOCATOR),
    };
  });

  it('rate-limited requests produce zero KV reads and zero KV writes for rate limit keys', async () => {
    // Make 25 requests to a rate-limited endpoint (nearby: limit 20)
    for (let i = 0; i < 25; i++) {
      const req = new Request('https://example.com/api/nearby-flavors?location=53572', {
        headers: { 'CF-Connecting-IP': '7.7.7.7' },
      });
      await handleRequest(req, env);
    }

    // Inspect all KV get/put calls -- none should be for rate limit keys (rl:*)
    const kvGetCalls = mockKV.get.mock.calls.map(c => c[0]);
    const kvPutCalls = mockKV.put.mock.calls.map(c => c[0]);

    const rlGets = kvGetCalls.filter(k => k.startsWith('rl:'));
    const rlPuts = kvPutCalls.filter(k => k.startsWith('rl:'));

    expect(rlGets).toEqual([]);
    expect(rlPuts).toEqual([]);
  });

  it('global rate limit on unprotected endpoints uses zero KV operations', async () => {
    // /api/stores has no per-route rate limit -- only the global limit applies
    for (let i = 0; i < 10; i++) {
      const req = new Request('https://example.com/api/stores?q=madison', {
        headers: { 'CF-Connecting-IP': '6.6.6.6' },
      });
      await handleRequest(req, env);
    }

    const kvGetCalls = mockKV.get.mock.calls.map(c => c[0]);
    const kvPutCalls = mockKV.put.mock.calls.map(c => c[0]);

    const rlGets = kvGetCalls.filter(k => k.startsWith('rl:'));
    const rlPuts = kvPutCalls.filter(k => k.startsWith('rl:'));

    expect(rlGets).toEqual([]);
    expect(rlPuts).toEqual([]);
  });
});

describe('subscribe Origin check', () => {
  let mockKV;
  let env;

  beforeEach(() => {
    _resetRateLimitState();
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _validSlugsOverride: new Set(['mt-horeb']),
    };
  });

  it('returns 403 for an unknown Origin header', async () => {
    const req = new Request('https://example.com/api/alerts/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-site.example.com',
      },
      body: JSON.stringify({
        email: 'victim@example.com',
        slug: 'mt-horeb',
        favorites: ['Butter Pecan'],
      }),
    });
    const res = await handleRequest(req, env);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('allows subscribe with no Origin header (server-side / curl)', async () => {
    // No RESEND_API_KEY means 503 — that is past the Origin gate
    const req = new Request('https://example.com/api/alerts/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        slug: 'mt-horeb',
        favorites: ['Butter Pecan'],
      }),
    });
    const res = await handleRequest(req, env);

    // 503 = passed the Origin check, blocked at email service gate
    expect(res.status).toBe(503);
  });

  it('accepts canonical origin from env-driven default allowlist', async () => {
    const req = new Request('https://example.com/api/alerts/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://custard.chriskaschner.com',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        slug: 'mt-horeb',
        favorites: ['Butter Pecan'],
      }),
    });
    const res = await handleRequest(req, env);

    // 503 = passed the Origin check and reached email service gate
    expect(res.status).toBe(503);
  });
});
