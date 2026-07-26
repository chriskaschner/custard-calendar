import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maybeSendOperatorAlert } from '../src/operator-alerts.js';

const emailMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../src/email-sender.js', () => ({
  sendEmail: emailMocks.sendEmail,
}));

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => {
      store.set(key, value);
    }),
    _store: store,
  };
}

function createMockDb({ cronErrors = [], coverageRows = [] } = {}) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...params) => ({
        all: vi.fn(async () => {
          if (sql.includes('FROM cron_runs')) {
            return { results: cronErrors.map(errors_count => ({ errors_count })) };
          }
          if (sql.includes('FROM snapshots')) {
            return { results: coverageRows };
          }
          return { results: [] };
        }),
      })),
    })),
  };
}

describe('maybeSendOperatorAlert', () => {
  beforeEach(() => {
    emailMocks.sendEmail.mockClear();
  });

  it('returns not_configured when operator email settings are missing', async () => {
    const env = {
      FLAVOR_CACHE: createMockKV(),
      DB: createMockDb(),
      RESEND_API_KEY: '',
      OPERATOR_EMAIL: '',
    };
    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-03-01T12:00:00Z'),
    });
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('not_configured');
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it('sends operator alert when parse failures exceed threshold', async () => {
    const today = '2026-03-01';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '4',
      }),
      DB: createMockDb({ cronErrors: [0, 0] }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
      ALERT_FROM_EMAIL: 'alerts@example.com',
      WORKER_BASE_URL: 'https://custard.chriskaschner.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 2, sent: 1, errors: [] },
      now: new Date('2026-03-01T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(env.FLAVOR_CACHE._store.get(`meta:operator-alert-sent:${today}`)).toBe('1');
  });

  it('sends operator alert for consecutive cron error days', async () => {
    const today = '2026-03-02';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
      }),
      DB: createMockDb({ cronErrors: [2, 1] }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 0, sent: 0, errors: ['x'] },
      now: new Date('2026-03-02T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('sends operator alert for month-end coverage gaps on priority stores', async () => {
    const today = '2026-02-27';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
      }),
      DB: createMockDb({
        cronErrors: [0, 0],
        coverageRows: [
          { slug: 'mt-horeb', max_date: '2026-03-05' },
          { slug: 'verona', max_date: '2026-02-25' },
        ],
      }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
      OPERATOR_PRIORITY_SLUGS: 'mt-horeb,verona',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 0, sent: 0, errors: [] },
      now: new Date('2026-02-27T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('skips when no thresholds are crossed', async () => {
    const today = '2026-03-03';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '0',
        [`meta:duplicate-day-count:${today}`]: '0',
      }),
      DB: createMockDb({
        cronErrors: [0, 0],
        coverageRows: [
          { slug: 'mt-horeb', max_date: '2026-03-03' },
          { slug: 'verona', max_date: '2026-03-03' },
          { slug: 'madison-todd-drive', max_date: '2026-03-03' },
        ],
      }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-03-03T12:00:00Z'),
    });

    expect(res.sent).toBe(false);
    expect(res.reason).toBe('no_threshold_crossed');
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Quality gate alert integration tests (D-04)
// ---------------------------------------------------------------------------

describe('quality gate alerts in operator email', () => {
  beforeEach(() => {
    emailMocks.sendEmail.mockClear();
  });

  it('sends alert when unknown flavor count exceeds threshold', async () => {
    const today = '2026-04-01';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '8',
        [`meta:duplicate-day-count:${today}`]: '0',
      }),
      DB: createMockDb({ cronErrors: [0, 0] }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-04-01T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Unknown flavors detected' }),
      ])
    );
  });

  it('does NOT alert when unknown flavor count is at or below threshold', async () => {
    const today = '2026-04-02';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '5',
        [`meta:duplicate-day-count:${today}`]: '0',
      }),
      DB: createMockDb({
        cronErrors: [0, 0],
        coverageRows: [
          { slug: 'mt-horeb', max_date: '2026-04-02' },
          { slug: 'verona', max_date: '2026-04-02' },
          { slug: 'madison-todd-drive', max_date: '2026-04-02' },
        ],
      }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-04-02T12:00:00Z'),
    });

    expect(res.sent).toBe(false);
    expect(res.reason).toBe('no_threshold_crossed');
  });

  it('sends alert when duplicate day count exceeds threshold', async () => {
    const today = '2026-04-03';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '0',
        [`meta:duplicate-day-count:${today}`]: '3',
      }),
      DB: createMockDb({ cronErrors: [0, 0] }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-04-03T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Duplicate same-day entries' }),
      ])
    );
  });

  it('sends alert for stale store with max_date 10 days ago', async () => {
    const today = '2026-04-06';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '0',
        [`meta:duplicate-day-count:${today}`]: '0',
      }),
      DB: createMockDb({
        cronErrors: [0, 0],
        coverageRows: [
          { slug: 'mt-horeb', max_date: '2026-03-27' },
          { slug: 'verona', max_date: '2026-04-05' },
          { slug: 'madison-todd-drive', max_date: '2026-04-05' },
        ],
      }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-04-06T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Stale stores detected' }),
      ])
    );
    const staleIssue = res.issues.find(i => i.title === 'Stale stores detected');
    expect(staleIssue.detail).toContain('mt-horeb');
    expect(staleIssue.detail).not.toContain('verona');
  });

  it('does NOT alert for stale store when max_date is 3 days ago (within threshold)', async () => {
    const today = '2026-04-06';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '0',
        [`meta:duplicate-day-count:${today}`]: '0',
      }),
      DB: createMockDb({
        cronErrors: [0, 0],
        coverageRows: [
          { slug: 'mt-horeb', max_date: '2026-04-03' },
          { slug: 'verona', max_date: '2026-04-04' },
          { slug: 'madison-todd-drive', max_date: '2026-04-05' },
        ],
      }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-04-06T12:00:00Z'),
    });

    expect(res.sent).toBe(false);
    expect(res.reason).toBe('no_threshold_crossed');
  });

  it('alerts for store with no snapshot rows (never seen)', async () => {
    const today = '2026-04-06';
    const env = {
      FLAVOR_CACHE: createMockKV({
        [`meta:parse-fail-count:${today}`]: '0',
        [`meta:payload-anomaly-count:${today}`]: '0',
        [`meta:unknown-flavor-count:${today}`]: '0',
        [`meta:duplicate-day-count:${today}`]: '0',
      }),
      DB: createMockDb({
        cronErrors: [0, 0],
        coverageRows: [],
      }),
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: new Date('2026-04-06T12:00:00Z'),
    });

    expect(res.sent).toBe(true);
    expect(res.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Stale stores detected' }),
      ])
    );
    const staleIssue = res.issues.find(i => i.title === 'Stale stores detected');
    expect(staleIssue.detail).toContain('never');
  });
});

