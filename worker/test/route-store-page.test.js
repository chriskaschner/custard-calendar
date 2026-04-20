import { describe, it, expect, vi } from 'vitest';
import { handleStorePage, LAUNCH_SLUGS } from '../src/route-store-page.js';

// --- Test helpers ---

function makeKV() {
  const store = new Map();
  return {
    get: vi.fn(async (k) => store.get(k) || null),
    put: vi.fn(async (k, v) => store.set(k, v)),
  };
}

function mockFetchFlavors(today) {
  const nextDay = nextIsoDate(today);
  const dayAfter = nextIsoDate(nextDay);
  const dayAfter2 = nextIsoDate(dayAfter);
  return vi.fn(async (_slug) => ({
    name: 'Mt. Horeb',
    flavors: [
      { date: today, title: 'Turtle', description: 'Caramel pecan custard.' },
      { date: nextDay, title: 'Chocolate Eclair', description: 'Rich chocolate custard.' },
      { date: dayAfter, title: 'Butter Pecan', description: 'Buttery pecan custard.' },
      { date: dayAfter2, title: 'Mint Chip', description: 'Cool mint with chocolate chips.' },
    ],
  }));
}

function nextIsoDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function makeEnv() {
  return {
    FLAVOR_CACHE: makeKV(),
    _validSlugsOverride: new Set(['mt-horeb']),
    _storeIndexOverride: [
      { slug: 'mt-horeb', name: 'Mt. Horeb, WI', city: 'Mt. Horeb', state: 'WI' },
    ],
    _storeCoordsOverride: new Map([
      ['mt-horeb', { lat: 43.0069, lng: -89.739, name: 'Mt. Horeb, WI', address: '150 Springdale St' }],
    ]),
  };
}

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
const today = new Date().toISOString().slice(0, 10);

describe('handleStorePage', () => {
  it('Test 1: returns 404 for slug not in LAUNCH_SLUGS set', async () => {
    const env = makeEnv();
    // Use a slug that is in VALID_SLUGS but not in LAUNCH_SLUGS
    env._validSlugsOverride = new Set(['some-other-store']);
    env._storeIndexOverride = [
      { slug: 'some-other-store', name: 'Other Store', city: 'Chicago', state: 'IL' },
    ];
    const url = new URL('https://custard.chriskaschner.com/store/il/chicago/some-other-store/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    expect(res.status).toBe(404);
  });

  it('Test 2: returns 404 when URL path does not match /store/{state}/{city}/{slug}/ pattern', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    expect(res.status).toBe(404);
  });

  it('Test 3: returns 200 with Content-Type text/html for valid store slug', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
  });

  it('Test 4: response HTML contains today\'s flavor name in the page body', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    expect(html).toContain('Turtle');
  });

  it('Test 5: response HTML contains the store address from STORE_COORDS', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    expect(html).toContain('150 Springdale St');
  });

  it('Test 6: response HTML contains a script type="application/ld+json" block with valid JSON', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();
    expect(() => JSON.parse(jsonLdMatch[1])).not.toThrow();
  });

  it('Test 7: JSON-LD block has @type "FastFoodRestaurant" with name, address, geo.latitude, geo.longitude', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    expect(jsonLd['@type']).toBe('FastFoodRestaurant');
    expect(jsonLd.name).toContain('Mt. Horeb');
    expect(jsonLd.address).toBeDefined();
    expect(jsonLd.address.streetAddress).toBe('150 Springdale St');
    expect(jsonLd.address.addressLocality).toBe('Mt. Horeb');
    expect(jsonLd.address.addressRegion).toBe('WI');
    expect(jsonLd.geo).toBeDefined();
    expect(jsonLd.geo.latitude).toBe(43.0069);
    expect(jsonLd.geo.longitude).toBe(-89.739);
  });

  it('Test 8: JSON-LD block has hasMenu.hasMenuSection.hasMenuItem with today\'s flavor name', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    expect(jsonLd.hasMenu).toBeDefined();
    expect(jsonLd.hasMenu.hasMenuSection).toBeDefined();
    expect(jsonLd.hasMenu.hasMenuSection.hasMenuItem).toBeDefined();
    expect(jsonLd.hasMenu.hasMenuSection.hasMenuItem.name).toBe('Turtle');
  });

  it('Test 9: response HTML contains week-ahead flavors (future dates from the fetcher response)', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    expect(html).toContain('Chocolate Eclair');
    expect(html).toContain('Butter Pecan');
    expect(html).toContain('Mint Chip');
  });

  it('Test 10: response HTML starts with DOCTYPE html and has viewport meta tag', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('name="viewport"');
  });

  it('Test 11: response has Cache-Control public max-age=3600', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('Test 12: response HTML contains og:title and og:description meta tags', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    expect(html).toContain('og:title');
    expect(html).toContain('og:description');
  });

  it('Test 13: handleStorePage returns 502 error page when fetchFlavors throws', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = vi.fn(async () => { throw new Error('upstream failure'); });
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    // Should not contain stack traces
    expect(html).not.toContain('upstream failure');
  });

  it('Test 14: HTML contains canonical link matching the request URL', async () => {
    const env = makeEnv();
    const url = new URL('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    const html = await res.text();
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('https://custard.chriskaschner.com/store/wi/mt-horeb/mt-horeb/');
  });

  it('Test 15: city in URL is validated against store\'s actual city (case-insensitive, slugified)', async () => {
    const env = makeEnv();
    // Use wrong city in URL
    const url = new URL('https://custard.chriskaschner.com/store/wi/madison/mt-horeb/');
    const fetchFn = mockFetchFlavors(today);
    const res = await handleStorePage(url, env, corsHeaders, fetchFn);
    expect(res.status).toBe(404);
  });

  describe('LAUNCH_SLUGS', () => {
    it('is a Set containing madison-metro store slugs', () => {
      expect(LAUNCH_SLUGS).toBeInstanceOf(Set);
      expect(LAUNCH_SLUGS.has('mt-horeb')).toBe(true);
      expect(LAUNCH_SLUGS.has('madison-todd-drive')).toBe(true);
      expect(LAUNCH_SLUGS.has('verona')).toBe(true);
      expect(LAUNCH_SLUGS.has('waunakee')).toBe(true);
    });
  });
});
