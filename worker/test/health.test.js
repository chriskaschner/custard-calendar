import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../src/index.js';

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    delete: vi.fn(async (key) => store.delete(key)),
    _store: store,
  };
}

describe('/health endpoint', () => {
  it('returns 200 with required top-level fields', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.status).toBe('string');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.checks).toBe('object');
  });

  it('includes parse_failures_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);
    const body = await res.json();

    expect(Number.isInteger(body.parse_failures_today)).toBe(true);
    expect(body.parse_failures_today).toBe(0);
  });

  it('reflects non-zero parse_failures_today from KV counter', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockKV = createMockKV({ [`meta:parse-fail-count:${today}`]: '3' });
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);
    const body = await res.json();

    expect(body.parse_failures_today).toBe(3);
  });

  it('includes email_errors_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);
    const body = await res.json();

    expect(Number.isInteger(body.email_errors_today)).toBe(true);
    expect(body.email_errors_today).toBe(0);
  });

  it('reflects non-zero email_errors_today from KV counter', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockKV = createMockKV({ [`meta:email-errors:${today}`]: '5' });
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);
    const body = await res.json();

    expect(body.email_errors_today).toBe(5);
  });

  it('includes snapshot_errors_today as an integer (defaults to 0)', async () => {
    const mockKV = createMockKV();
    const env = { FLAVOR_CACHE: mockKV };

    const req = new Request('https://example.com/health');
    const res = await handleRequest(req, env);
    const body = await res.json();

    expect(Number.isInteger(body.snapshot_errors_today)).toBe(true);
    expect(body.snapshot_errors_today).toBe(0);
  });
});
