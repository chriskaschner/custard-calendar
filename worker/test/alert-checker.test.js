import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAlerts } from '../src/alert-checker.js';

// Mock email sender
vi.mock('../src/email-sender.js', () => ({
  sendConfirmationEmail: vi.fn(async () => ({ ok: true })),
  sendAlertEmail: vi.fn(async () => ({ ok: true })),
}));

import { sendAlertEmail } from '../src/email-sender.js';

function createMockKV(initialData = {}) {
  const store = new Map(Object.entries(initialData));
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

// Fixed "today" for deterministic tests
const TODAY = '2026-02-21';
const TOMORROW = '2026-02-22';
const DAY_AFTER = '2026-02-23';

function makeSubscription(overrides = {}) {
  return JSON.stringify({
    email: 'user@test.com',
    slug: 'mt-horeb',
    favorites: ['Turtle'],
    unsubToken: 'unsub-token-123',
    createdAt: '2026-02-20T00:00:00Z',
    ...overrides,
  });
}

function makeMockGetFlavorsCached(data) {
  return vi.fn(async (slug, kv) => {
    if (data[slug]) return data[slug];
    throw new Error(`No data for ${slug}`);
  });
}

describe('Alert checker (cron handler)', () => {
  let env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date to return fixed today
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1: does nothing when no API key configured', async () => {
    const mockKV = createMockKV();
    env = { FLAVOR_CACHE: mockKV };

    const result = await checkAlerts(env, vi.fn());
    expect(result.sent).toBe(0);
    expect(result.checked).toBe(0);
  });

  it('2: does nothing when no subscriptions exist', async () => {
    const mockKV = createMockKV();
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key' };

    const result = await checkAlerts(env, vi.fn());
    expect(result.sent).toBe(0);
    expect(result.checked).toBe(0);
    expect(sendAlertEmail).not.toHaveBeenCalled();

    // Should write run metadata
    expect(mockKV._store.has('meta:last-alert-run')).toBe(true);
  });

  it('3: sends alert when favorite matches upcoming flavor', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Turtle'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        address: '505 Springdale St',
        flavors: [
          { date: TODAY, title: 'Dark Chocolate PB Crunch', description: 'Dark chocolate.' },
          { date: TOMORROW, title: 'Turtle', description: 'Pecan, caramel, fudge.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(1);
    expect(result.checked).toBe(1);
    expect(sendAlertEmail).toHaveBeenCalledOnce();

    // Verify email params
    const call = sendAlertEmail.mock.calls[0][0];
    expect(call.email).toBe('user@test.com');
    expect(call.storeName).toBe('Mt. Horeb');
    expect(call.matches.length).toBe(1);
    expect(call.matches[0].title).toBe('Turtle');
  });

  it('4: does not send alert when no favorites match', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Blackberry Cobbler'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TODAY, title: 'Dark Chocolate PB Crunch', description: 'Dark chocolate.' },
          { date: TOMORROW, title: 'Turtle', description: 'Pecan, caramel, fudge.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(0);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('5: deduplicates — does not re-send for same flavor+date', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Turtle'] }),
      // Pre-existing dedup key
      [`alert:sent:abc123:${TOMORROW}:turtle`]: '1',
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Turtle', description: 'Pecan, caramel, fudge.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(0);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('6: writes dedup key after sending', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Turtle'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Turtle', description: 'Pecan, caramel, fudge.' },
        ],
      },
    });

    await checkAlerts(env, getFlavorsCached);

    // Check dedup key was written
    const dedupKey = `alert:sent:abc123:${TOMORROW}:turtle`;
    expect(mockKV._store.has(dedupKey)).toBe(true);
  });

  it('7: consolidates multiple matches into one email', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Turtle', 'Mint Explosion'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TODAY, title: 'Turtle', description: 'Pecan, caramel, fudge.' },
          { date: TOMORROW, title: 'Mint Explosion', description: 'Mint with OREO.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(1); // One email
    expect(sendAlertEmail).toHaveBeenCalledOnce();

    const call = sendAlertEmail.mock.calls[0][0];
    expect(call.matches.length).toBe(2); // Two matches in one email
  });

  it('8: groups fetches by slug — fetches once per unique store', async () => {
    const sub1 = makeSubscription({ email: 'user1@test.com', favorites: ['Turtle'] });
    const sub2 = makeSubscription({ email: 'user2@test.com', favorites: ['Turtle'] });

    const mockKV = createMockKV({
      'alert:sub:abc123': sub1,
      'alert:sub:def456': sub2,
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Turtle', description: 'Pecan, caramel, fudge.' },
        ],
      },
    });

    await checkAlerts(env, getFlavorsCached);

    // Should only fetch mt-horeb once, not twice
    expect(getFlavorsCached).toHaveBeenCalledTimes(1);
    // But should send 2 emails
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
  });

  it('9: handles fetch failure gracefully — skips stores without data', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ slug: 'mt-horeb', favorites: ['Turtle'] }),
      'alert:sub:def456': makeSubscription({ slug: 'failing-store', favorites: ['Turtle'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Turtle', description: 'Pecan.' },
        ],
      },
      // 'failing-store' is not in the mock data — will throw
    });

    const result = await checkAlerts(env, getFlavorsCached);
    // Should still send for mt-horeb subscriber
    expect(result.sent).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  it('10: handles email send failure — records error', async () => {
    sendAlertEmail.mockResolvedValueOnce({ ok: false, error: 'Rate limited' });

    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Turtle'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Turtle', description: 'Pecan.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Rate limited');
  });

  it('11: matches via description (ingredient search)', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['oreo'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Mint Explosion', description: 'Mint Fresh Frozen Custard with OREO cookie pieces and fudge.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(1);
    expect(sendAlertEmail).toHaveBeenCalledOnce();
  });

  it('12: writes run metadata after check', async () => {
    const mockKV = createMockKV();
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key' };

    await checkAlerts(env, vi.fn());

    const metadata = JSON.parse(mockKV._store.get('meta:last-alert-run'));
    expect(metadata.timestamp).toBeDefined();
    expect(metadata.checked).toBe(0);
    expect(metadata.sent).toBe(0);
  });

  it('13: only considers next 3 days of flavors', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ favorites: ['Turtle'] }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          // 4 days from today — should be excluded from look-ahead
          { date: '2026-02-25', title: 'Turtle', description: 'Pecan.' },
        ],
      },
    });

    const result = await checkAlerts(env, getFlavorsCached);
    expect(result.sent).toBe(0);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('14: includes unsubscribe URL in email', async () => {
    const mockKV = createMockKV({
      'alert:sub:abc123': makeSubscription({ unsubToken: 'my-unsub-token' }),
    });
    env = { FLAVOR_CACHE: mockKV, RESEND_API_KEY: 'test-key', WORKER_BASE_URL: 'https://example.com' };

    const getFlavorsCached = makeMockGetFlavorsCached({
      'mt-horeb': {
        name: 'Mt. Horeb',
        flavors: [
          { date: TOMORROW, title: 'Turtle', description: 'Pecan.' },
        ],
      },
    });

    await checkAlerts(env, getFlavorsCached);

    const call = sendAlertEmail.mock.calls[0][0];
    expect(call.unsubscribeUrl).toContain('my-unsub-token');
    expect(call.statusUrl).toContain('my-unsub-token');
  });
});
