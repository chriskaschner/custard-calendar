import { beforeEach, describe, expect, it, vi } from 'vitest';

const emailMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../src/email-sender.js', () => ({
  sendEmail: emailMocks.sendEmail,
}));

const {
  findOverdueHeartbeats,
  heartbeatKey,
  parseExpectedJobs,
  maybeSendOperatorAlert,
} = await import('../src/operator-alerts.js');

/** Minimal KV stub: only get() is exercised here. */
function kvWith(entries = {}) {
  return {
    get: async (key) => (key in entries ? entries[key] : null),
  };
}

const NOW = new Date('2026-07-25T12:00:00Z');

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// parseExpectedJobs
// ---------------------------------------------------------------------------

describe('parseExpectedJobs', () => {
  it('falls back to the built-in job list when unset', () => {
    const jobs = parseExpectedJobs({});
    expect(jobs.map(j => j.job)).toEqual(['tidbyt_daily', 'data_quality']);
  });

  it('parses job:days pairs', () => {
    const jobs = parseExpectedJobs({ OPERATOR_EXPECTED_JOBS: 'a:1,b:14' });
    expect(jobs).toEqual([
      { job: 'a', maxAgeDays: 1 },
      { job: 'b', maxAgeDays: 14 },
    ]);
  });

  it('skips malformed entries instead of throwing', () => {
    // A bad env var must not take down the whole operator alert.
    const jobs = parseExpectedJobs({ OPERATOR_EXPECTED_JOBS: 'good:3,noDays,bad:xyz,neg:-1,:5' });
    expect(jobs).toEqual([{ job: 'good', maxAgeDays: 3 }]);
  });

  it('treats an explicitly empty list as "no jobs expected"', () => {
    expect(parseExpectedJobs({ OPERATOR_EXPECTED_JOBS: '   ' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findOverdueHeartbeats
// ---------------------------------------------------------------------------

describe('findOverdueHeartbeats', () => {
  const env = { OPERATOR_EXPECTED_JOBS: 'tidbyt_daily:2' };

  it('reports nothing when the job checked in recently', async () => {
    const kv = kvWith({ [heartbeatKey('tidbyt_daily')]: daysAgo(1) });
    expect(await findOverdueHeartbeats(kv, env, NOW)).toEqual([]);
  });

  it('reports a job whose heartbeat is older than its threshold', async () => {
    const kv = kvWith({ [heartbeatKey('tidbyt_daily')]: daysAgo(5) });
    const overdue = await findOverdueHeartbeats(kv, env, NOW);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ job: 'tidbyt_daily', ageDays: 5, maxAgeDays: 2 });
  });

  it('reports a job that has never checked in', async () => {
    // Silence is the failure mode being guarded against, so a missing key is
    // an alert, not a skip.
    const overdue = await findOverdueHeartbeats(kvWith({}), env, NOW);
    expect(overdue).toEqual([
      { job: 'tidbyt_daily', maxAgeDays: 2, lastSeen: null, ageDays: null },
    ]);
  });

  it('reports a heartbeat whose timestamp is unparseable', async () => {
    const kv = kvWith({ [heartbeatKey('tidbyt_daily')]: 'garbage' });
    const overdue = await findOverdueHeartbeats(kv, env, NOW);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ job: 'tidbyt_daily', lastSeen: 'garbage', ageDays: null });
  });

  it('does not fire exactly at the threshold boundary', async () => {
    const kv = kvWith({ [heartbeatKey('tidbyt_daily')]: daysAgo(2) });
    expect(await findOverdueHeartbeats(kv, env, NOW)).toEqual([]);
  });

  it('reproduces the Jun 2026 outage: both jobs silent for five weeks', async () => {
    const kv = kvWith({
      [heartbeatKey('tidbyt_daily')]: daysAgo(37),
      [heartbeatKey('data_quality')]: daysAgo(34),
    });
    const overdue = await findOverdueHeartbeats(kv, {}, NOW);
    expect(overdue.map(o => o.job).sort()).toEqual(['data_quality', 'tidbyt_daily']);
  });

  it('returns empty when KV is unavailable rather than throwing', async () => {
    expect(await findOverdueHeartbeats(null, env, NOW)).toEqual([]);
  });

  it('skips a job whose KV read throws', async () => {
    const kv = { get: async () => { throw new Error('kv down'); } };
    expect(await findOverdueHeartbeats(kv, env, NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: a silent job must actually reach the operator's inbox.
// ---------------------------------------------------------------------------

describe('operator alert includes overdue scheduled jobs', () => {
  beforeEach(() => emailMocks.sendEmail.mockClear());

  function healthyEnvWith(heartbeats) {
    const today = '2026-07-25';
    const store = new Map(Object.entries({
      [`meta:parse-fail-count:${today}`]: '0',
      [`meta:payload-anomaly-count:${today}`]: '0',
      [`meta:unknown-flavor-count:${today}`]: '0',
      [`meta:duplicate-day-count:${today}`]: '0',
      ...heartbeats,
    }));
    return {
      FLAVOR_CACHE: {
        get: vi.fn(async k => store.get(k) || null),
        put: vi.fn(async (k, v) => { store.set(k, v); }),
      },
      DB: {
        prepare: vi.fn(sql => ({
          bind: vi.fn(() => ({
            all: vi.fn(async () => {
              if (sql.includes('FROM cron_runs')) return { results: [{ errors_count: 0 }, { errors_count: 0 }] };
              if (sql.includes('FROM snapshots')) {
                return {
                  results: [
                    { slug: 'mt-horeb', max_date: today },
                    { slug: 'verona', max_date: today },
                    { slug: 'madison-todd-drive', max_date: today },
                  ],
                };
              }
              return { results: [] };
            }),
          })),
        })),
      },
      RESEND_API_KEY: 'test-key',
      OPERATOR_EMAIL: 'ops@example.com',
    };
  }

  it('emails when an otherwise-healthy system has a silent job', async () => {
    // Everything else is green -- the overdue heartbeat is the only trigger.
    const env = healthyEnvWith({
      [heartbeatKey('tidbyt_daily')]: daysAgo(37),
      [heartbeatKey('data_quality')]: daysAgo(1),
    });

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: NOW,
    });

    expect(res.sent).toBe(true);
    const html = emailMocks.sendEmail.mock.calls[0][0].html;
    expect(html).toContain('tidbyt_daily');
    expect(html).not.toContain('Scheduled job silent: data_quality');
  });

  it('stays quiet when every job has checked in recently', async () => {
    const env = healthyEnvWith({
      [heartbeatKey('tidbyt_daily')]: daysAgo(1),
      [heartbeatKey('data_quality')]: daysAgo(2),
    });

    const res = await maybeSendOperatorAlert({
      env,
      handler: 'daily_alerts',
      result: { checked: 1, sent: 0, errors: [] },
      now: NOW,
    });

    expect(res.sent).toBe(false);
    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });
});
