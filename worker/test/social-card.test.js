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

// ---------------------------------------------------------------------------
// Quiz OG card endpoint: /og/quiz/{archetype}/{flavor}.png
// ---------------------------------------------------------------------------

describe('handleSocialCard - quiz PNG card', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchSuccess();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns null for non-matching path (no flavor slug)', async () => {
    const res = await handleSocialCard('/og/quiz/cool-front', {}, CORS);
    expect(res).toBeNull();
  });

  it('returns 404 for unknown archetype slug', async () => {
    const res = await handleSocialCard('/og/quiz/not-real/Mint%20Explosion.png', {}, CORS);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns a PNG response for a valid archetype and flavor', async () => {
    const res = await handleSocialCard('/og/quiz/cool-front/Andes%20Mint%20Avalanche.png', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('sets 24h cache TTL', async () => {
    const res = await handleSocialCard('/og/quiz/bold-storm/Dark%20Chocolate%20Decadence.png', {}, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('includes CORS headers in response', async () => {
    const cors = { 'Access-Control-Allow-Origin': 'https://custard.chriskaschner.com' };
    const res = await handleSocialCard('/og/quiz/steady-classic/Vanilla.png', {}, cors);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://custard.chriskaschner.com');
  });

  it('returns PNG for all 8 valid archetypes', async () => {
    const archetypes = [
      'cool-front', 'bold-storm', 'steady-classic', 'candy-burst',
      'berry-sunrise', 'caramel-architect', 'cheesecake-signal', 'explorer-jetstream',
    ];
    for (const arch of archetypes) {
      const res = await handleSocialCard(`/og/quiz/${arch}/Turtle.png`, {}, CORS);
      expect(res.status, `archetype "${arch}" should return 200`).toBe(200);
    }
  });

  it('handles flavor names with spaces encoded as %20', async () => {
    const res = await handleSocialCard('/og/quiz/candy-burst/Really%20Reese%27s.png', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('falls back gracefully when cone PNG fetch fails (404)', async () => {
    globalThis.fetch = mockFetch404();
    const res = await handleSocialCard('/og/quiz/cool-front/Mint%20Explosion.png', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('does not interfere with existing SVG store/date routes', async () => {
    const env = {
      DB: createMockD1({ snapshot: { flavor: 'Vanilla' } }),
    };
    const svgRes = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers.get('Content-Type')).toBe('image/svg+xml');
  });
});

// ---------------------------------------------------------------------------
// Flavor rarity OG card endpoint: /og/flavor/{flavor-name}.png
// ---------------------------------------------------------------------------

describe('handleSocialCard - flavor rarity PNG card', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchSuccess();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createFlavorD1({ appearances = 0, avgGap = 0, failQuery = false } = {}) {
    return {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => {
            if (failQuery) throw new Error('D1 query failed');
            if (sql.includes('COUNT(*) as n')) return { n: appearances };
            if (sql.includes('AVG(gap_days)')) return { avg_gap: avgGap };
            return null;
          }),
        })),
      })),
    };
  }

  it('returns null for non-matching path (no flavor)', async () => {
    const res = await handleSocialCard('/og/flavor/', {}, CORS);
    expect(res).toBeNull();
  });

  it('returns a PNG for a valid flavor name', async () => {
    const env = { DB: createFlavorD1({ appearances: 25, avgGap: 14 }) };
    const res = await handleSocialCard('/og/flavor/Mint%20Explosion.png', env, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('sets 24h cache TTL', async () => {
    const env = { DB: createFlavorD1() };
    const res = await handleSocialCard('/og/flavor/Turtle.png', env, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('includes CORS headers in response', async () => {
    const cors = { 'Access-Control-Allow-Origin': 'https://custard.chriskaschner.com' };
    const env = { DB: createFlavorD1() };
    const res = await handleSocialCard('/og/flavor/Vanilla.png', env, cors);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://custard.chriskaschner.com');
  });

  it('renders PNG without D1 bindings', async () => {
    const res = await handleSocialCard('/og/flavor/Turtle.png', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('renders PNG when D1 query throws', async () => {
    const env = { DB: createFlavorD1({ failQuery: true }) };
    const res = await handleSocialCard('/og/flavor/Vanilla.png', env, CORS);
    expect(res.status).toBe(200);
  });

  it('handles flavor names with special characters', async () => {
    const envRare = { DB: createFlavorD1({ appearances: 2, avgGap: 150 }) };
    const res = await handleSocialCard('/og/flavor/Really%20Reese%27s.png', envRare, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('falls back gracefully when cone PNG fetch fails', async () => {
    globalThis.fetch = mockFetch404();
    const env = { DB: createFlavorD1({ appearances: 10 }) };
    const res = await handleSocialCard('/og/flavor/Mint%20Explosion.png', env, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('does not interfere with page or trivia SVG routes', async () => {
    const pageRes = await handleSocialCard('/og/page/quiz.svg', {}, CORS);
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers.get('Content-Type')).toBe('image/svg+xml');

    const triviaRes = await handleSocialCard('/og/trivia/top-flavor.svg', {}, CORS);
    expect(triviaRes.status).toBe(200);
    expect(triviaRes.headers.get('Content-Type')).toBe('image/svg+xml');
  });
});

// ---------------------------------------------------------------------------
// Page PNG OG card endpoint: /og/page/{page-slug}.png
// ---------------------------------------------------------------------------

describe('handleSocialCard - page PNG card', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchSuccess();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns a PNG response for a valid page slug', async () => {
    const res = await handleSocialCard('/og/page/forecast.png', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('returns 404 for unknown page slug', async () => {
    const res = await handleSocialCard('/og/page/nonexistent.png', {}, CORS);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('sets 24h cache TTL', async () => {
    const res = await handleSocialCard('/og/page/calendar.png', {}, CORS);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('includes CORS headers in response', async () => {
    const cors = { 'Access-Control-Allow-Origin': 'https://custard.chriskaschner.com' };
    const res = await handleSocialCard('/og/page/map.png', {}, cors);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://custard.chriskaschner.com');
  });

  it('returns PNG for all 13 defined page slugs', async () => {
    const slugs = [
      'forecast', 'calendar', 'alerts', 'map', 'quiz', 'radar',
      'siri', 'widget', 'fronts', 'scoop', 'group', 'compare', 'fun',
    ];
    for (const slug of slugs) {
      const res = await handleSocialCard(`/og/page/${slug}.png`, {}, CORS);
      expect(res.status, `slug "${slug}" should return 200`).toBe(200);
      expect(res.headers.get('Content-Type'), `slug "${slug}" should return PNG`).toMatch(/image\/png/);
    }
  });

  it('falls back gracefully when cone PNG fetch fails', async () => {
    globalThis.fetch = mockFetch404();
    const res = await handleSocialCard('/og/page/radar.png', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/png/);
  });

  it('does not interfere with existing SVG page route', async () => {
    const res = await handleSocialCard('/og/page/forecast.svg', {}, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const body = await res.text();
    expect(body).toContain('<svg');
  });

  it('does not interfere with existing SVG store/date routes', async () => {
    const env = { DB: createMockD1({ snapshot: { flavor: 'Vanilla' } }) };
    const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  describe('cone PNG lookup', () => {
    /** URLs the card generator asked the CDN for. */
    function coneUrlsFrom(fetchMock) {
      return fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes('/assets/cones/'));
    }

    it('resolves an aliased flavor to its canonical cone filename', async () => {
      // Cone PNGs are named after canonical FLAVOR_PROFILES keys. Without alias
      // resolution this requested reeses-peanut-butter-cup.png, 404'd, and
      // silently degraded to the SVG cone.
      const env = {
        DB: createMockD1({ snapshot: { flavor: "Reese's Peanut Butter Cup", description: '' } }),
      };
      await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

      const urls = coneUrlsFrom(globalThis.fetch);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toContain('really-reese-s.png');
      expect(urls[0]).not.toContain('reese-s-peanut-butter-cup');
    });

    it('leaves an unaliased flavor slug alone', async () => {
      const env = { DB: createMockD1({ snapshot: { flavor: 'Mint Explosion', description: '' } }) };
      await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

      expect(coneUrlsFrom(globalThis.fetch)[0]).toContain('mint-explosion.png');
    });

    it('never requests artwork for a premiere placeholder', async () => {
      // There is no cone for a day upstream has not posted; the request would be
      // a guaranteed 404 on the way to the SVG fallback.
      const env = {
        DB: createMockD1({ snapshot: { flavor: 'Not yet announced', description: '' } }),
      };
      const res = await handleSocialCard('/og/mt-horeb/2026-02-22.svg', env, CORS);

      expect(res.status).toBe(200);
      expect(coneUrlsFrom(globalThis.fetch)).toEqual([]);
    });
  });
});
