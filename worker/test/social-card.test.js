import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSocialCard } from '../src/social-card.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// Minimal valid 1x1 transparent PNG for mocking fetch responses
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
function tinyPngBuffer() {
  const binary = atob(TINY_PNG_B64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function createMockD1({ snapshot = null, appearances = 0, storeCount = 0, failSnapshot = false } = {}) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT flavor FROM snapshots')) {
            if (failSnapshot) throw new Error('snapshot query failed');
            return snapshot;
          }
          if (sql.includes('COUNT(*) as n')) return { n: appearances };
          if (sql.includes('COUNT(DISTINCT slug) as n')) return { n: storeCount };
          return null;
        }),
      })),
    })),
  };
}

// Default fetch mock: return a tiny PNG for any cone PNG request
function mockFetchSuccess() {
  return vi.fn(async (url) => {
    if (typeof url === 'string' && url.includes('/assets/cones/')) {
      return { ok: true, arrayBuffer: async () => tinyPngBuffer() };
    }
    // Pass through for non-cone URLs (shouldn't happen in tests)
    return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  });
}

// Fetch mock that fails for cone PNGs (404)
function mockFetch404() {
  return vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
}

// Fetch mock that throws for cone PNGs (network error)
function mockFetchError() {
  return vi.fn(async () => { throw new Error('Network error'); });
}

describe('handleSocialCard', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Default: all PNG fetches succeed
    globalThis.fetch = mockFetchSuccess();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns null for non-matching paths', async () => {
    const res = await handleSocialCard('/api/flavors', {}, CORS);
    expect(res).toBeNull();
  });

  it('returns null for malformed date in path', async () => {
    const res = await handleSocialCard('/og/mt-horeb/not-a-date.svg', {}, CORS);
    expect(res).toBeNull();
  });

  it('returns SVG with snapshot data from D1', async () => {
    const env = {
      DB: createMockD1({
        snapshot: {
          flavor: 'Mint Explosion',
          description: 'Cool mint custard',
        },
      }),
    };

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
    const env = { DB: createMockD1({ snapshot: null }) };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('No flavor data');
  });

  it('includes metrics when snapshot exists and D1 metrics are available', async () => {
    const env = {
      DB: createMockD1({
        snapshot: { flavor: 'Turtle', description: '' },
        appearances: 42,
        storeCount: 8,
      }),
    };

    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

    const body = await res.text();
    expect(body).toContain('Seen 42 times');
    expect(body).toContain('at 8 stores');
  });

  it('works without D1 by returning fallback card', async () => {
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('No flavor data');
  });

  it('handles snapshot query errors gracefully', async () => {
    const env = { DB: createMockD1({ failSnapshot: true }) };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('No flavor data');
  });

  it('sets long cache TTL', async () => {
    const env = { DB: createMockD1() };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('embeds L5 PNG cone as base64 <image> element', async () => {
    const env = {
      DB: createMockD1({
        snapshot: { flavor: 'Mint Explosion', description: '' },
      }),
    };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    const body = await res.text();
    expect(body).toContain('<image');
    expect(body).toContain('data:image/png;base64,');
    expect(body).not.toContain('\uD83C\uDF66'); // no ice cream emoji
  });

  it('page route: embeds L5 PNG cone as base64 <image> element', async () => {
    const res = await handleSocialCard('/og/page/forecast.svg', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<image');
    expect(body).toContain('data:image/png;base64,');
  });

  it('trivia route: embeds L5 PNG cone as base64 <image> element', async () => {
    const res = await handleSocialCard('/og/trivia/top-flavor.svg', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<image');
    expect(body).toContain('data:image/png;base64,');
  });

  it('falls back to L0 SVG cone when PNG fetch fails (network error)', async () => {
    globalThis.fetch = mockFetchError();
    const env = {
      DB: createMockD1({
        snapshot: { flavor: 'Mint Explosion', description: '' },
      }),
    };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    const body = await res.text();
    // Fallback should use L0 mini SVG cone with <rect> elements
    expect(body).toContain('<rect');
    expect(body).not.toContain('data:image/png;base64,');
  });

  it('falls back to L0 SVG cone when PNG fetch returns 404', async () => {
    globalThis.fetch = mockFetch404();
    const env = {
      DB: createMockD1({
        snapshot: { flavor: 'Mint Explosion', description: '' },
      }),
    };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    const body = await res.text();
    expect(body).toContain('<rect');
    expect(body).not.toContain('data:image/png;base64,');
  });

  it('trivia route: returns 404 for unknown trivia slug', async () => {
    const res = await handleSocialCard('/og/trivia/not-real.svg', {}, CORS);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('trivia route: top-flavor card returns SVG with "Did you know?" header', async () => {
    const res = await handleSocialCard('/og/trivia/top-flavor.svg', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain('Did you know?');
  });

  it('trivia route: top-flavor card mentions the top flavor name', async () => {
    const res = await handleSocialCard('/og/trivia/top-flavor.svg', {}, CORS);
    const body = await res.text();
    // Seed has Turtle as topFlavors[0]
    expect(body).toContain('Turtle');
  });

  it('trivia route: rarest-flavor card returns SVG', async () => {
    const res = await handleSocialCard('/og/trivia/rarest-flavor.svg', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain('Did you know?');
  });

  it('trivia route: hnbc-season card returns SVG with month reference', async () => {
    const res = await handleSocialCard('/og/trivia/hnbc-season.svg', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain('Did you know?');
  });

  it('trivia route: top-store card returns SVG', async () => {
    const res = await handleSocialCard('/og/trivia/top-store.svg', {}, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain('Did you know?');
  });

  it('trivia route: sets 24h cache TTL', async () => {
    const res = await handleSocialCard('/og/trivia/top-flavor.svg', {}, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('trivia route: does not match non-trivia og paths', async () => {
    // Normal store/date path should still work fine
    const env = { DB: createMockD1({ snapshot: { flavor: 'Vanilla' } }) };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('Vanilla');
    expect(body).not.toContain('Did you know?');
  });

  it('page route: returns 404 for unknown page slug', async () => {
    const res = await handleSocialCard('/og/page/does-not-exist.svg', {}, CORS);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('page route: forecast card returns SVG with headline and cone', async () => {
    const res = await handleSocialCard('/og/page/forecast.svg', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain("Today's Flavor Forecast");
  });

  it('page route: all eleven page slugs return 200 SVG', async () => {
    const slugs = ['forecast', 'calendar', 'alerts', 'map', 'quiz', 'radar', 'siri', 'widget', 'fronts', 'scoop', 'group'];
    for (const slug of slugs) {
      const res = await handleSocialCard(`/og/page/${slug}.svg`, {}, CORS);
      expect(res.status, `slug "${slug}" should return 200`).toBe(200);
      const body = await res.text();
      expect(body).toContain('<svg');
    }
  });

  it('page route: sets 24h cache TTL', async () => {
    const res = await handleSocialCard('/og/page/map.svg', {}, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('page route: does not interfere with store/date or trivia routes', async () => {
    const env = { DB: createMockD1({ snapshot: { flavor: 'Vanilla' } }) };
    const storeRes = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(storeRes.status).toBe(200);
    const triviaRes = await handleSocialCard('/og/trivia/top-flavor.svg', {}, CORS);
    expect(triviaRes.status).toBe(200);
  });

  it('produces different accent colors for different flavors', async () => {
    const peachEnv = {
      DB: createMockD1({
        snapshot: { flavor: 'Georgia Peach', description: '' },
      }),
    };
    const chocEnv = {
      DB: createMockD1({
        snapshot: { flavor: 'Dark Chocolate Decadence', description: '' },
      }),
    };
    const peachRes = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', peachEnv, CORS);
    const chocRes = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', chocEnv, CORS);
    const peachBody = await peachRes.text();
    const chocBody = await chocRes.text();
    // Peach base color = #FFE5B4, dark chocolate = #3B1F0B
    expect(peachBody).toContain('#FFE5B4');
    expect(chocBody).toContain('#3B1F0B');
    // They should not share base fills
    expect(peachBody).not.toContain('#3B1F0B');
  });
});
