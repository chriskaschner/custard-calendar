import { describe, expect, it, vi } from 'vitest';
import { handleTriviaRoute, buildRankingQuestion, buildFillInQuestion } from '../src/trivia.js';

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

  it('includes ranking and fill_in questions when seed provides sufficient data', async () => {
    const req = makeRequest('/api/v1/trivia?days=90&limit=10');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia', url, req, {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();
    const rankingQ = body.questions.find((q) => q.type === 'ranking');
    const fillInQ = body.questions.find((q) => q.type === 'fill_in');
    // These should appear when limit is large enough and seed data is present
    expect(rankingQ || fillInQ).toBeTruthy();
  });

  it('geo-aware: Q1 uses user state instead of top state when user state is known', async () => {
    const rows = [
      { slug: 'mt-horeb', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 50 },
      { slug: 'mt-horeb', normalized_flavor: 'chocolate', flavor: 'Chocolate', count: 30 },
      { slug: 'chicago-il-main-st', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 80 },
      { slug: 'chicago-il-main-st', normalized_flavor: 'mint', flavor: 'Mint', count: 70 },
    ];
    // IL has higher volume (150 vs 80) but user is in WI — Q1 should be about WI.
    // Use _userStateOverride since request.cf is a Cloudflare-only property not available in Vitest.
    const env = {
      DB: createMockD1(rows),
      _storeIndexOverride: [
        { slug: 'mt-horeb', name: 'Mt. Horeb', state: 'WI' },
        { slug: 'chicago-il-main-st', name: 'Chicago Main', state: 'IL' },
      ],
      _userStateOverride: 'WI',
    };
    const req = makeRequest('/api/v1/trivia?days=120&limit=5');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia', url, req, env, CORS);
    const body = await res.json();
    const stateQ = body.questions.find((q) => q.id && q.id.startsWith('trivia-state-top-'));
    expect(stateQ).toBeDefined();
    expect(stateQ.id).toBe('trivia-state-top-wi');
    expect(stateQ.prompt).toMatch(/Wisconsin/i);
  });

  it('geo-aware: state volume ranking question omitted when user state is known', async () => {
    const rows = [
      { slug: 'mt-horeb', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 10 },
      { slug: 'chicago-il-main-st', normalized_flavor: 'vanilla', flavor: 'Vanilla', count: 8 },
      { slug: 'detroit-mi', normalized_flavor: 'chocolate', flavor: 'Chocolate', count: 7 },
      { slug: 'minneapolis-mn', normalized_flavor: 'mint', flavor: 'Mint', count: 6 },
    ];
    const env = {
      DB: createMockD1(rows),
      _storeIndexOverride: [
        { slug: 'mt-horeb', name: 'Mt. Horeb', state: 'WI' },
        { slug: 'chicago-il-main-st', name: 'Chicago Main', state: 'IL' },
        { slug: 'detroit-mi', name: 'Detroit', state: 'MI' },
        { slug: 'minneapolis-mn', name: 'Minneapolis', state: 'MN' },
      ],
      _userStateOverride: 'WI',
    };
    const req = makeRequest('/api/v1/trivia?days=120&limit=10');
    const url = new URL(req.url);
    const res = await handleTriviaRoute('/api/trivia', url, req, env, CORS);
    const body = await res.json();
    const stateVolumeQ = body.questions.find((q) => q.id === 'trivia-top-state-volume');
    expect(stateVolumeQ).toBeUndefined();
  });
});

const MINIMAL_SEED = {
  top_flavors: [
    { title: 'Turtle', appearances: 14254, store_count: 965 },
    { title: 'Caramel Cashew', appearances: 12478, store_count: 981 },
    { title: 'Butter Pecan', appearances: 10275, store_count: 969 },
    { title: 'Snickers Swirl', appearances: 9982, store_count: 984 },
  ],
  seasonal_spotlights: [
    { title: 'Mooey Gooey Twist', appearances: 252, store_count: 252, peak_month: 5 },
    { title: 'Egg Nog Brickle', appearances: 288, store_count: 117, peak_month: 12 },
  ],
};

describe('buildRankingQuestion', () => {
  it('returns null when seed is missing or empty', () => {
    expect(buildRankingQuestion(null)).toBeNull();
    expect(buildRankingQuestion({})).toBeNull();
    expect(buildRankingQuestion({ top_flavors: [] })).toBeNull();
    expect(buildRankingQuestion({ top_flavors: [{ title: 'Only One' }] })).toBeNull();
  });

  it('returns a well-formed ranking question from valid seed', () => {
    const q = buildRankingQuestion(MINIMAL_SEED);
    expect(q).not.toBeNull();
    expect(q.type).toBe('ranking');
    expect(typeof q.id).toBe('string');
    expect(typeof q.prompt).toBe('string');
    expect(Array.isArray(q.options)).toBe(true);
    expect(q.options).toHaveLength(3);
    expect(Array.isArray(q.correct_order)).toBe(true);
    expect(q.correct_order).toHaveLength(3);
  });

  it('correct_order references valid option ids', () => {
    const q = buildRankingQuestion(MINIMAL_SEED);
    const optionIds = new Set(q.options.map((o) => o.id));
    for (const id of q.correct_order) {
      expect(optionIds.has(id)).toBe(true);
    }
  });

  it('all three options have distinct titles', () => {
    const q = buildRankingQuestion(MINIMAL_SEED);
    const labels = q.options.map((o) => o.label);
    expect(new Set(labels).size).toBe(3);
  });

  it('uses seasonal spotlight as the rarest option when available', () => {
    const q = buildRankingQuestion(MINIMAL_SEED);
    // Mooey Gooey Twist has lowest appearances (252) — should be the rare option
    const rareId = q.correct_order[0];
    const rareOption = q.options.find((o) => o.id === rareId);
    expect(rareOption.label).toBe('Mooey Gooey Twist');
  });

  it('still produces a question without seasonal_spotlights when top_flavors has 3+ entries', () => {
    const seed = { top_flavors: MINIMAL_SEED.top_flavors };
    const q = buildRankingQuestion(seed);
    expect(q).not.toBeNull();
    expect(q.options).toHaveLength(3);
  });
});

describe('buildFillInQuestion', () => {
  it('returns null when seed is missing or top_flavors is empty', () => {
    expect(buildFillInQuestion(null)).toBeNull();
    expect(buildFillInQuestion({})).toBeNull();
    expect(buildFillInQuestion({ top_flavors: [] })).toBeNull();
  });

  it('returns a well-formed fill_in question', () => {
    const q = buildFillInQuestion(MINIMAL_SEED);
    expect(q).not.toBeNull();
    expect(q.type).toBe('fill_in');
    expect(typeof q.id).toBe('string');
    expect(typeof q.prompt).toBe('string');
    expect(typeof q.correct_answer).toBe('string');
    expect(q.correct_answer).toBe(q.correct_answer.toLowerCase());
  });

  it('answer is the top flavor (most appearances) in lowercase', () => {
    const q = buildFillInQuestion(MINIMAL_SEED);
    // Turtle is topFlavors[0]
    expect(q.correct_answer).toBe('turtle');
  });

  it('includes a placeholder string', () => {
    const q = buildFillInQuestion(MINIMAL_SEED);
    expect(typeof q.placeholder).toBe('string');
    expect(q.placeholder.length).toBeGreaterThan(0);
  });

  it('options array is empty (fill_in has no options)', () => {
    const q = buildFillInQuestion(MINIMAL_SEED);
    expect(Array.isArray(q.options)).toBe(true);
    expect(q.options).toHaveLength(0);
  });
});
