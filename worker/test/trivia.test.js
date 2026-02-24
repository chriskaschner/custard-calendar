import { describe, expect, it, vi } from 'vitest';
import { handleTriviaRoute } from '../src/trivia.js';

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

describe('handleTriviaRoute', () => {
  it('returns 405 for non-GET requests', async () => {
    const req = makeRequest('/api/v1/trivia', 'POST');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia', url, req, { DB: createMockD1() }, CORS);
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toMatch(/method not allowed/i);
  });

  it('returns metrics-seeded trivia when DB is not configured', async () => {
    const req = makeRequest('/api/v1/trivia?days=90&limit=5');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia', url, req, {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toMatch(/metrics_seed|fallback/);
    expect(body.question_count).toBeGreaterThan(0);
    expect(Array.isArray(body.questions)).toBe(true);
  });

  it('returns generated trivia payload shape from grouped snapshot rows', async () => {
    const rows = [
      { slug: 'mt-horeb', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 20 },
      { slug: 'mt-horeb', normalized_flavor: 'chocolate', flavor: 'Chocolate', count: 16 },
      { slug: 'madison-todd-drive', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 14 },
      { slug: 'madison-todd-drive', normalized_flavor: 'strawberry', flavor: 'Strawberry', count: 11 },
      { slug: 'madison-east-wash', normalized_flavor: 'mint', flavor: 'Mint', count: 9 },
      { slug: 'chicago-il-main-st', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 8 },
    ];
    const env = {
      DB: createMockD1(rows),
      _storeIndexOverride: [
        { slug: 'mt-horeb', name: 'Mt. Horeb', state: 'WI' },
        { slug: 'madison-todd-drive', name: 'Madison Todd Dr', state: 'WI' },
        { slug: 'madison-east-wash', name: 'Madison East Wash', state: 'WI' },
        { slug: 'chicago-il-main-st', name: 'Chicago Main', state: 'IL' },
      ],
    };

    const req = makeRequest('/api/v1/trivia?days=120&limit=5');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia', url, req, env, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=900');

    const body = await res.json();
    expect(body.id).toBe('trivia-v1');
    expect(body.source).toMatch(/d1_snapshots/);
    expect(body.question_count).toBe(5);
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions).toHaveLength(5);

    for (const question of body.questions) {
      expect(typeof question.id).toBe('string');
      expect(Array.isArray(question.options)).toBe(true);
      expect(question.options.length).toBeGreaterThan(1);
      expect(typeof question.correct_option_id).toBe('string');
      expect(question.options.some((option) => option.id === question.correct_option_id)).toBe(true);
    }
  });

  it('returns null for unknown trivia routes', async () => {
    const req = makeRequest('/api/v1/trivia/unknown');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia/unknown', url, req, { DB: createMockD1() }, CORS);
    expect(res).toBeNull();
  });
});
