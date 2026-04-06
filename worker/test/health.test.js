import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';
import { _resetRateLimitState } from '../src/rate-limit.js';

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    delete: vi.fn(async (key) => store.delete(key)),
    _store: store,
  };
}

const ADMIN_TOKEN = 'test-admin-token';

function authedHealthRequest() {
  return new Request('https://example.com/health', {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
  });
}

describe('/health endpoint', () => {
  beforeEach(() => {
    _resetRateLimitState();
  });

  it('returns minimal {"status":"ok"} without admin auth', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.checks).toBeUndefined();
    expect(body.parse_failures_today).toBeUndefined();
  });

  it('returns full diagnostics with admin auth', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.status).toBe('string');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.checks).toBe('object');
  });

  it('includes parse_failures_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(Number.isInteger(body.parse_failures_today)).toBe(true);
    expect(body.parse_failures_today).toBe(0);
    expect(body.parse_failures_by_brand_today).toEqual({
      culvers: 0,
      kopps: 0,
      oscars: 0,
      gilles: 0,
      hefners: 0,
      kraverz: 0,
    });
  });

  it('reflects non-zero parse_failures_today from KV counter', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockKV = createMockKV({ [`meta:parse-fail-count:${today}`]: '3' });
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(body.parse_failures_today).toBe(3);
  });

  it('includes parse_failures_by_brand_today from KV counters', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockKV = createMockKV({
      [`meta:parse-fail-count:${today}`]: '3',
      [`meta:parse-fail-count:brand:culvers:${today}`]: '2',
      [`meta:parse-fail-count:brand:kopps:${today}`]: '1',
    });
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(body.parse_failures_today).toBe(3);
    expect(body.parse_failures_by_brand_today.culvers).toBe(2);
    expect(body.parse_failures_by_brand_today.kopps).toBe(1);
    expect(body.parse_failures_by_brand_today.oscars).toBe(0);
  });

  it('includes email_errors_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(Number.isInteger(body.email_errors_today)).toBe(true);
    expect(body.email_errors_today).toBe(0);
  });

  it('reflects non-zero email_errors_today from KV counter', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockKV = createMockKV({ [`meta:email-errors:${today}`]: '5' });
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(body.email_errors_today).toBe(5);
  });

  it('includes snapshot_errors_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(Number.isInteger(body.snapshot_errors_today)).toBe(true);
    expect(body.snapshot_errors_today).toBe(0);
  });

  it('includes payload_anomalies_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(Number.isInteger(body.payload_anomalies_today)).toBe(true);
    expect(body.payload_anomalies_today).toBe(0);
  });

  it('reports payload anomalies alongside existing observability counters', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockKV = createMockKV({
      [`meta:parse-fail-count:${today}`]: '2',
      [`meta:snapshot-errors:${today}`]: '4',
      [`meta:email-errors:${today}`]: '3',
      [`meta:payload-anomaly-count:${today}`]: '7',
    });
    const env = { FLAVOR_CACHE: mockKV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN };

    const res = await handleRequest(authedHealthRequest(), env);
    const body = await res.json();

    expect(body.parse_failures_today).toBe(2);
    expect(body.snapshot_errors_today).toBe(4);
    expect(body.email_errors_today).toBe(3);
    expect(body.payload_anomalies_today).toBe(7);
  });
});
