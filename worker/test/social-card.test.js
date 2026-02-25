import { describe, it, expect, vi } from 'vitest';
import { handleSocialCard } from '../src/social-card.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

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

describe('handleSocialCard', () => {
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

  it('contains pixel-art cone rect elements instead of emoji', async () => {
    const env = {
      DB: createMockD1({
        snapshot: { flavor: 'Mint Explosion', description: '' },
      }),
    };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    const body = await res.text();
    expect(body).toContain('<rect');
    expect(body).toContain('<g transform="translate(');
    expect(body).not.toContain('\uD83C\uDF66'); // no ice cream emoji
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

  it('produces different fill colors for different flavors', async () => {
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
