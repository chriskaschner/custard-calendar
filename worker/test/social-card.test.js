import { describe, it, expect, vi } from 'vitest';
import { handleSocialCard } from '../src/social-card.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function createMockKV(snapshots = {}) {
  return {
    get: vi.fn(async (key) => snapshots[key] || null),
  };
}

function createMockD1(appearances = 0, storeCount = 0) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => ({ n: appearances || storeCount })),
      })),
    })),
  };
}

describe('handleSocialCard', () => {
  it('returns null for non-matching paths', async () => {
    const res = await handleSocialCard('/api/flavors', {}, CORS);
    expect(res).toBeNull();
  });

  it('returns null for malformed date in path', async () => {
    const res = await handleSocialCard('/og/mt-horeb/not-a-date.svg', {}, CORS);
    expect(res).toBeNull();
  });

  it('returns SVG for valid slug/date with snapshot data', async () => {
    const kv = createMockKV({
      'snap:mt-horeb:2026-02-22': JSON.stringify({
        flavor: 'Mint Explosion',
        description: 'Cool mint custard',
        fetchedAt: '2026-02-22T12:00:00Z',
      }),
    });
    const env = { FLAVOR_CACHE: kv };

    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain('Mint Explosion');
    expect(body).toContain('Mt Horeb');
    expect(body).toContain('Sunday, Feb 22');
  });

  it('returns fallback card when no snapshot exists', async () => {
    const kv = createMockKV({});
    const env = { FLAVOR_CACHE: kv };

    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('No flavor data');
  });

  it('includes metrics when D1 is available', async () => {
    const kv = createMockKV({
      'snap:mt-horeb:2026-02-22': JSON.stringify({
        flavor: 'Turtle',
        description: '',
        fetchedAt: '2026-02-22T12:00:00Z',
      }),
    });
    const mockFirst = vi.fn()
      .mockResolvedValueOnce({ n: 42 })   // appearances
      .mockResolvedValueOnce({ n: 8 });    // store count
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({ first: mockFirst })),
      })),
    };
    const env = { FLAVOR_CACHE: kv, DB: db };

    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

    const body = await res.text();
    expect(body).toContain('Seen 42 times');
    expect(body).toContain('at 8 stores');
  });

  it('works without KV (no FLAVOR_CACHE)', async () => {
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', {}, CORS);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('No flavor data');
  });

  it('sets long cache TTL', async () => {
    const env = { FLAVOR_CACHE: createMockKV({}) };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});
