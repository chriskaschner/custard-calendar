import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleQuizRoute } from '../src/quiz-routes.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function makeRequest(path, method = 'GET', body = null) {
  const init = { method };
  if (body != null) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return new Request(`https://example.com${path}`, init);
}

function createMockD1(resolver = () => null) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...args) => ({
        run: vi.fn(async () => resolver({ sql, args, method: 'run' }) || { success: true }),
        first: vi.fn(async () => resolver({ sql, args, method: 'first' })),
        all: vi.fn(async () => resolver({ sql, args, method: 'all' }) || { results: [] }),
      })),
      first: vi.fn(async () => resolver({ sql, args: [], method: 'first' })),
      all: vi.fn(async () => resolver({ sql, args: [], method: 'all' }) || { results: [] }),
    })),
  };
}

describe('handleQuizRoute /api/quiz/events', () => {
  it('returns 503 when DB is not configured', async () => {
    const req = makeRequest('/api/v1/quiz/events', 'POST', { quiz_id: 'weather-v1' });
    const url = new URL(req.url);
    const res = await handleQuizRoute('/api/quiz/events', url, req, {}, CORS);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/unavailable/i);
  });

  it('returns 400 for invalid event type', async () => {
    const req = makeRequest('/api/v1/quiz/events', 'POST', {
      quiz_id: 'weather-v1',
      event_type: 'bad-event',
    });
    const url = new URL(req.url);
    const res = await handleQuizRoute('/api/quiz/events', url, req, { DB: createMockD1() }, CORS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/event_type/i);
  });

  it('stores sanitized event payload and returns 202', async () => {
    const inserts = [];
    const db = createMockD1((ctx) => {
      if (ctx.method === 'run') {
        inserts.push(ctx);
        return { success: true };
      }
      return null;
    });

    const req = makeRequest('/api/v1/quiz/events', 'POST', {
      quiz_id: 'weather-v1',
      event_type: 'quiz_result',
      archetype: 'cool-front',
      result_flavor: 'Andes Mint Avalanche',
      matched_flavor: 'Andes Mint Avalanche',
      matched_store_slug: 'mt-horeb',
      matched_distance_miles: 12.456,
      radius_miles: 20,
      has_radius_match: true,
      trait_scores: { calm: 4.2, adventurous: 1.1, weird: 'x' },
    });
    req.cf = { city: 'Madison', regionCode: 'WI', country: 'US' };
    const url = new URL(req.url);

    const res = await handleQuizRoute('/api/quiz/events', url, req, { DB: db }, CORS);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(inserts.length).toBe(1);

    const insertArgs = inserts[0].args;
    // quiz_id
    expect(insertArgs[1]).toBe('weather-v1');
    // has_radius_match flag stored as integer
    expect(insertArgs[8]).toBe(1);
    // trait_scores_json
    expect(typeof insertArgs[9]).toBe('string');
    expect(insertArgs[9]).toContain('"calm":4.2');
    // CF geo fields
    expect(insertArgs[10]).toBe('Madison');
    expect(insertArgs[11]).toBe('WI');
    expect(insertArgs[12]).toBe('US');
  });
});

describe('handleQuizRoute /api/quiz/personality-index', () => {
  let db;

  beforeEach(() => {
    db = createMockD1(({ sql, method }) => {
      if (method === 'first' && sql.includes('SUM(CASE WHEN has_radius_match')) {
        return { events: 30, matched_events: 11 };
      }
      if (method === 'all' && sql.includes('GROUP BY archetype')) {
        return { results: [{ archetype: 'cool-front', count: 10 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY result_flavor')) {
        return { results: [{ flavor: 'Mint Explosion', count: 8 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY matched_flavor')) {
        return { results: [{ flavor: 'Turtle', count: 4 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY region, country')) {
        return { results: [{ region: 'WI', country: 'US', events: 9 }] };
      }
      return null;
    });
  });

  it('returns a weekly personality index payload', async () => {
    const req = makeRequest('/api/v1/quiz/personality-index?days=7&quiz_id=weather-v1');
    const url = new URL(req.url);
    const res = await handleQuizRoute('/api/quiz/personality-index', url, req, { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.window_days).toBe(7);
    expect(body.quiz_id).toBe('weather-v1');
    expect(body.totals.events).toBe(30);
    expect(body.totals.matched_events).toBe(11);
    expect(body.top_archetypes[0].archetype).toBe('cool-front');
    expect(body.top_results[0].flavor).toBe('Mint Explosion');
    expect(body.top_matched_flavors[0].flavor).toBe('Turtle');
    expect(body.top_regions[0].region).toBe('WI');
  });

  it('returns 405 for non-GET requests', async () => {
    const req = makeRequest('/api/v1/quiz/personality-index', 'POST', {});
    const url = new URL(req.url);
    const res = await handleQuizRoute('/api/quiz/personality-index', url, req, { DB: db }, CORS);
    expect(res.status).toBe(405);
  });
});

describe('handleQuizRoute fallback', () => {
  it('returns null for unknown quiz route', async () => {
    const req = makeRequest('/api/v1/quiz/unknown');
    const url = new URL(req.url);
    const res = await handleQuizRoute('/api/quiz/unknown', url, req, { DB: createMockD1() }, CORS);
    expect(res).toBeNull();
  });
});
