import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';

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
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _fetchOverride: createMockFetch(EMPTY_LOCATOR),
    };
  });

  it('returns 429 after 20 requests from same IP', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    mockKV._store.set(`rl:nearby:1.2.3.4:${hour}`, '20');

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
    mockKV._store.set(`rl:nearby:1.2.3.4:${hour}`, '20');

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
    mockKV = createMockKV();
    env = {
      FLAVOR_CACHE: mockKV,
      _fetchOverride: createMockFetch(EMPTY_LOCATOR),
    };
  });

  it('limits public-write /api/events POST traffic per IP', async () => {
    const hour = new Date().toISOString().slice(0, 13);
    mockKV._store.set(`rl:events:write:1.2.3.4:${hour}`, '120');

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
    mockKV._store.set(`rl:forecast:read:1.2.3.4:${hour}`, '120');

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
      mockKV._store.set(`rl:forecast:read:1.2.3.4:${hourA}`, '120');

      const limitedReq = new Request('https://example.com/api/forecast/mt-horeb', {
        headers: { 'CF-Connecting-IP': '1.2.3.4' },
      });
      const limitedRes = await handleRequest(limitedReq, env);
      expect(limitedRes.status).toBe(429);

      // New hour bucket should not be blocked by the previous counter.
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
});

describe('subscribe Origin check', () => {
  let mockKV;
  let env;

  beforeEach(() => {
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
