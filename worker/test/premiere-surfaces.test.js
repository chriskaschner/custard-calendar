/**
 * Downstream surfaces on a premiere day.
 *
 * The placeholder title is not a flavor name, so any surface that slots it into
 * a "the flavor is X" construction reads wrong. These tests freeze the clock to
 * a seeded premiere date (2026-08-05) and assert the spoken output says what
 * actually happened instead.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleRequest } from '../src/index.js';
import { resetPremiereDateCache, PREMIERE_TITLE } from '../src/flavor-overrides.js';

const PREMIERE_DATE = '2026-08-05';
const TEST_VALID_SLUGS = new Set(['mt-horeb']);
const TEST_STORE_INDEX = [
  { slug: 'mt-horeb', name: 'Mt. Horeb, WI', city: 'Mt. Horeb', state: 'WI' },
];

// Spans the premiere date the way upstream actually does: 08-05 simply absent.
const UPSTREAM = {
  name: 'Mt. Horeb',
  flavors: [
    { date: '2026-08-04', title: 'Caramel Turtle', description: 'Pecans and chocolate.' },
    { date: '2026-08-06', title: 'Butter Pecan', description: 'Classic butter pecan.' },
  ],
};

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    _store: store,
  };
}

async function todayBody({ systemDate, flavors = UPSTREAM }) {
  vi.setSystemTime(new Date(`${systemDate}T12:00:00Z`));
  resetPremiereDateCache();
  const env = {
    FLAVOR_CACHE: createMockKV(),
    _validSlugsOverride: TEST_VALID_SLUGS,
    _storeIndexOverride: TEST_STORE_INDEX,
  };
  const res = await handleRequest(
    new Request('https://example.com/api/v1/today?slug=mt-horeb'),
    env,
    vi.fn(async () => flavors)
  );
  expect(res.status).toBe(200);
  return res.json();
}

describe('spoken output on a premiere day', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    resetPremiereDateCache();
  });

  it('says the flavor is unannounced rather than naming the placeholder', async () => {
    const body = await todayBody({ systemDate: PREMIERE_DATE });

    expect(body.flavor).toBe(PREMIERE_TITLE);
    expect(body.spoken).toBe("Culver's of Mt. Horeb hasn't announced today's flavor yet.");
    // The bug this replaces: "...the flavor of the day at X is Not yet announced"
    expect(body.spoken).not.toMatch(/flavor of the day .* is /);
    expect(body.spoken).not.toContain(`is ${PREMIERE_TITLE}`);
  });

  it('keeps spoken_verbose free of "is serving <placeholder>"', async () => {
    const body = await todayBody({ systemDate: PREMIERE_DATE });

    expect(body.spoken_verbose).toContain("hasn't announced a flavor yet");
    expect(body.spoken_verbose).not.toContain('is serving');
    expect(body.spoken_verbose).toContain('Location: Mt. Horeb, WI.');
  });

  it('does not offer the placeholder as the next listed flavor', async () => {
    // On 08-04 the next dated entry is the 08-05 placeholder. Naming it would
    // say "Next listed flavor is Not yet announced on Wednesday, August fifth."
    const body = await todayBody({ systemDate: '2026-08-04' });

    expect(body.flavor).toBe('Caramel Turtle');
    expect(body.spoken_verbose).not.toContain(PREMIERE_TITLE);
    expect(body.spoken_verbose).toContain('Next listed flavor is Butter Pecan');
  });

  it('leaves an ordinary day untouched', async () => {
    const body = await todayBody({ systemDate: '2026-08-06' });

    expect(body.flavor).toBe('Butter Pecan');
    expect(body.spoken).toMatch(/Today the flavor of the day at .* is Butter Pecan/);
    expect(body.spoken_verbose).toContain('is serving Butter Pecan');
  });
});
