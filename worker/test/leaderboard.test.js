import { describe, it, expect, vi } from 'vitest';
import { handleLeaderboardRoute } from '../src/leaderboard.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function makeRequest(path, method = 'GET') {
  return new Request(`https://example.com${path}`, { method });
}

function createMockD1(rows = []) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => ({ results: rows })),
      })),
    })),
  };
}

const MOCK_ROWS = [
  { slug: 'mt-horeb', normalized_flavor: 'turtle', flavor: 'Turtle', count: 30 },
  { slug: 'mt-horeb', normalized_flavor: 'caramel-cashew', flavor: 'Caramel Cashew', count: 20 },
  { slug: 'mt-horeb', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 10 },
  { slug: 'madison-todd-drive', normalized_flavor: 'turtle', flavor: 'Turtle', count: 25 },
  { slug: 'madison-todd-drive', normalized_flavor: 'mint', flavor: 'Mint Explosion', count: 8 },
  { slug: 'chicago-il-main-st', normalized_flavor: 'turtle', flavor: 'Turtle', count: 18 },
  { slug: 'chicago-il-main-st', normalized_flavor: 'chocolate', flavor: 'Chocolate', count: 14 },
];

const MOCK_STORE_INDEX = [
  { slug: 'mt-horeb', name: 'Mt. Horeb', state: 'WI' },
  { slug: 'madison-todd-drive', name: 'Madison Todd Dr', state: 'WI' },
  { slug: 'chicago-il-main-st', name: 'Chicago Main', state: 'IL' },
];

describe('handleLeaderboardRoute', () => {
  it('returns null for non-matching paths', async () => {
    const req = makeRequest('/api/v1/leaderboard/flavor');
    const url = new URL(req.url);
    const res = await handleLeaderboardRoute('/api/leaderboard/flavor', url, req, {}, CORS);
    expect(res).toBeNull();
  });

  it('returns 405 for non-GET requests', async () => {
    const req = makeRequest('/api/v1/leaderboard/state', 'POST');
    const url = new URL(req.url);
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, {}, CORS);
    expect(res.status).toBe(405);
  });

  it('returns metrics seed fallback when DB not configured', async () => {
    const req = makeRequest('/api/v1/leaderboard/state');
    const url = new URL(req.url);
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('metrics_seed');
    expect(body.state_leaders.national).toBeDefined();
    expect(body.state_leaders.national.length).toBeGreaterThan(0);
    expect(body.state_leaders.national[0].rank).toBe(1);
    expect(typeof body.state_leaders.national[0].flavor).toBe('string');
  });

  it('returns per-state rankings from D1 rows', async () => {
    const req = makeRequest('/api/v1/leaderboard/state?days=90&limit=5');
    const url = new URL(req.url);
    const env = {
      DB: createMockD1(MOCK_ROWS),
      _storeIndexOverride: MOCK_STORE_INDEX,
    };
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, env, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('d1_snapshots');
    expect(body.window_days).toBe(90);
    expect(body.state_leaders.WI).toBeDefined();
    expect(body.state_leaders.IL).toBeDefined();
    // WI: Turtle should be #1 (30+25=55 total)
    expect(body.state_leaders.WI[0].flavor).toBe('Turtle');
    expect(body.state_leaders.WI[0].rank).toBe(1);
    expect(body.state_leaders.WI[0].count).toBe(55);
  });

  it('respects the states filter', async () => {
    const req = makeRequest('/api/v1/leaderboard/state?states=WI');
    const url = new URL(req.url);
    const env = {
      DB: createMockD1(MOCK_ROWS),
      _storeIndexOverride: MOCK_STORE_INDEX,
    };
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, env, CORS);
    const body = await res.json();
    expect(body.state_leaders.WI).toBeDefined();
    expect(body.state_leaders.IL).toBeUndefined();
  });

  it('respects the limit param', async () => {
    const req = makeRequest('/api/v1/leaderboard/state?limit=2');
    const url = new URL(req.url);
    const env = {
      DB: createMockD1(MOCK_ROWS),
      _storeIndexOverride: MOCK_STORE_INDEX,
    };
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, env, CORS);
    const body = await res.json();
    for (const flavors of Object.values(body.state_leaders)) {
      expect(flavors.length).toBeLessThanOrEqual(2);
    }
  });

  it('ranks flavors in descending count order within each state', async () => {
    const req = makeRequest('/api/v1/leaderboard/state?states=WI&limit=3');
    const url = new URL(req.url);
    const env = {
      DB: createMockD1(MOCK_ROWS),
      _storeIndexOverride: MOCK_STORE_INDEX,
    };
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, env, CORS);
    const body = await res.json();
    const wi = body.state_leaders.WI;
    for (let i = 1; i < wi.length; i++) {
      expect(wi[i - 1].count).toBeGreaterThanOrEqual(wi[i].count);
      expect(wi[i].rank).toBe(i + 1);
    }
  });

  it('sets a 15-minute cache TTL', async () => {
    const req = makeRequest('/api/v1/leaderboard/state');
    const url = new URL(req.url);
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, {}, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=900');
  });

  it('returns states_returned count', async () => {
    const req = makeRequest('/api/v1/leaderboard/state');
    const url = new URL(req.url);
    const env = {
      DB: createMockD1(MOCK_ROWS),
      _storeIndexOverride: MOCK_STORE_INDEX,
    };
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, env, CORS);
    const body = await res.json();
    expect(body.states_returned).toBe(Object.keys(body.state_leaders).length);
  });

  it('gracefully falls back to seed when D1 query fails', async () => {
    const failingDB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => { throw new Error('D1 unavailable'); }),
        })),
      })),
    };
    const req = makeRequest('/api/v1/leaderboard/state');
    const url = new URL(req.url);
    const res = await handleLeaderboardRoute('/api/leaderboard/state', url, req, { DB: failingDB }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('metrics_seed');
    expect(body.state_leaders.national).toBeDefined();
  });
});
