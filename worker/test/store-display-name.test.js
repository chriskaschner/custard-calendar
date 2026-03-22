/**
 * Unit tests for getDisplayName() store disambiguation logic (S06-T01).
 *
 * Tests the slug-to-street-name extraction and single-store city short-name
 * preservation, using the same algorithm as docs/planner-domain.js.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extract the pure functions from planner-domain.js for unit testing.
// We re-implement the same logic here rather than importing the IIFE.
// ---------------------------------------------------------------------------

function _streetFromSlug(slug, city, state) {
  if (!slug) return '';
  const cityNorm = (city || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stateNorm = (state || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const withState = cityNorm + '-' + stateNorm + '-';
  const withoutState = cityNorm + '-';

  let remainder = '';
  if (slug.indexOf(withState) === 0) {
    remainder = slug.slice(withState.length);
  } else if (slug.indexOf(withoutState) === 0) {
    const after = slug.slice(withoutState.length);
    if (stateNorm && after.indexOf(stateNorm + '-') === 0) {
      remainder = after.slice(stateNorm.length + 1);
    } else if (after && after !== stateNorm) {
      remainder = after;
    }
  }

  if (!remainder) return '';
  return remainder.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function _streetFromAddress(address) {
  if (!address) return '';
  let clean = address.trim().replace(/^\d+\s+/, '');
  clean = clean.replace(/\bRoad\b/gi, 'Rd').replace(/\bStreet\b/gi, 'St').replace(/\bAvenue\b/gi, 'Ave')
    .replace(/\bBoulevard\b/gi, 'Blvd').replace(/\bDrive\b/gi, 'Dr').replace(/\bHighway\b/gi, 'Hwy')
    .replace(/\bLane\b/gi, 'Ln').replace(/\bCourt\b/gi, 'Ct').replace(/\bParkway\b/gi, 'Pkwy');
  if (clean.length > 28) {
    let truncated = clean.slice(0, 25);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 8) truncated = truncated.slice(0, lastSpace);
    return truncated;
  }
  return clean;
}

function getDisplayName(store, allStores) {
  if (!store) return '';
  const city = store.city || '';
  const state = store.state || '';
  if (!city) return store.slug || '';

  let sameCity = 0;
  if (allStores && allStores.length > 0) {
    for (const s of allStores) {
      if (s.city === city && s.state === state) sameCity++;
    }
  }

  if (sameCity <= 1) return city;

  const slug = store.slug || '';
  const street = _streetFromSlug(slug, city, state);
  if (street) return street + ' \u2014 ' + city;

  if (store.address) {
    const addrStreet = _streetFromAddress(store.address);
    if (addrStreet) return addrStreet + ' \u2014 ' + city;
  }

  return city + ', ' + state;
}

// ---------------------------------------------------------------------------
// Test fixture: real Madison WI stores from stores.json
// ---------------------------------------------------------------------------

const MADISON_STORES = [
  { slug: 'madison-cottage-grove', name: 'Madison, WI', city: 'Madison', state: 'WI', address: '4401 Cottage Grove Road' },
  { slug: 'madison-east-towne', name: 'Madison, WI', city: 'Madison', state: 'WI', address: '4301 East Towne Blvd.' },
  { slug: 'madison-northport', name: 'Madison, WI', city: 'Madison', state: 'WI', address: '1325 Northport Drive' },
  { slug: 'madison-todd-drive', name: 'Madison, WI', city: 'Madison', state: 'WI', address: '2102 West Beltline Hwy.' },
  { slug: 'madison-wi-mineral-point-rd', name: 'Madison, WI', city: 'Madison', state: 'WI', address: '7206 Mineral Point Road' },
];

const VERONA_STORE = { slug: 'verona', name: 'Verona, WI', city: 'Verona', state: 'WI', address: '430 E. Verona Avenue' };
const ALL_STORES = [...MADISON_STORES, VERONA_STORE];

// ---------------------------------------------------------------------------
// Tests: single-store cities keep short name
// ---------------------------------------------------------------------------

describe('getDisplayName: single-store cities', () => {
  it('returns city name for single-store Verona', () => {
    const result = getDisplayName(VERONA_STORE, ALL_STORES);
    expect(result).toBe('Verona');
  });

  it('returns city name when allStores is empty', () => {
    const result = getDisplayName(VERONA_STORE, []);
    expect(result).toBe('Verona');
  });

  it('returns city name when allStores is null', () => {
    const result = getDisplayName(VERONA_STORE, null);
    expect(result).toBe('Verona');
  });
});

// ---------------------------------------------------------------------------
// Tests: multi-store cities use street disambiguation
// ---------------------------------------------------------------------------

describe('getDisplayName: multiple Madison stores', () => {
  it('disambiguates madison-wi-mineral-point-rd', () => {
    const store = MADISON_STORES.find(s => s.slug === 'madison-wi-mineral-point-rd');
    const result = getDisplayName(store, ALL_STORES);
    expect(result).toContain('Madison');
    expect(result).toContain('\u2014');
    expect(result).toMatch(/Mineral Point Rd/i);
  });

  it('disambiguates madison-cottage-grove', () => {
    const store = MADISON_STORES.find(s => s.slug === 'madison-cottage-grove');
    const result = getDisplayName(store, ALL_STORES);
    expect(result).toContain('Madison');
    expect(result).toContain('\u2014');
  });

  it('disambiguates madison-east-towne', () => {
    const store = MADISON_STORES.find(s => s.slug === 'madison-east-towne');
    const result = getDisplayName(store, ALL_STORES);
    expect(result).toContain('Madison');
    expect(result).toContain('\u2014');
  });

  it('disambiguates madison-northport', () => {
    const store = MADISON_STORES.find(s => s.slug === 'madison-northport');
    const result = getDisplayName(store, ALL_STORES);
    expect(result).toContain('Madison');
    expect(result).toContain('\u2014');
  });

  it('disambiguates madison-todd-drive', () => {
    const store = MADISON_STORES.find(s => s.slug === 'madison-todd-drive');
    const result = getDisplayName(store, ALL_STORES);
    expect(result).toContain('Madison');
    expect(result).toContain('\u2014');
  });

  it('each Madison store produces a unique display name', () => {
    const names = MADISON_STORES.map(s => getDisplayName(s, ALL_STORES));
    const unique = new Set(names);
    expect(unique.size).toBe(MADISON_STORES.length);
  });
});

// ---------------------------------------------------------------------------
// Tests: slug parsing edge cases
// ---------------------------------------------------------------------------

describe('_streetFromSlug', () => {
  it('parses city-state-street format', () => {
    const result = _streetFromSlug('madison-wi-mineral-point-rd', 'Madison', 'WI');
    expect(result).toBe('Mineral Point Rd');
  });

  it('parses city-street format (no state in slug)', () => {
    const result = _streetFromSlug('madison-cottage-grove', 'Madison', 'WI');
    expect(result).toBe('Cottage Grove');
  });

  it('returns empty string for legacy city-only slug', () => {
    const result = _streetFromSlug('verona', 'Verona', 'WI');
    expect(result).toBe('');
  });

  it('returns empty string for null slug', () => {
    const result = _streetFromSlug(null, 'Madison', 'WI');
    expect(result).toBe('');
  });

  it('title-cases the street segment', () => {
    const result = _streetFromSlug('aurora-co-buckley-rd', 'Aurora', 'CO');
    expect(result).toBe('Buckley Rd');
  });

  it('parses multi-word street names', () => {
    const result = _streetFromSlug('blaine-mn-108th-ave-ne', 'Blaine', 'MN');
    expect(result).toBe('108th Ave Ne');
  });
});

// ---------------------------------------------------------------------------
// Tests: address fallback
// ---------------------------------------------------------------------------

describe('_streetFromAddress', () => {
  it('strips house number', () => {
    const result = _streetFromAddress('7206 Mineral Point Road');
    expect(result).toBe('Mineral Point Rd');
  });

  it('abbreviates Road to Rd', () => {
    expect(_streetFromAddress('123 Main Road')).toBe('Main Rd');
  });

  it('abbreviates Street to St', () => {
    expect(_streetFromAddress('456 Oak Street')).toBe('Oak St');
  });

  it('handles empty address', () => {
    expect(_streetFromAddress('')).toBe('');
    expect(_streetFromAddress(null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: edge cases
// ---------------------------------------------------------------------------

describe('getDisplayName: edge cases', () => {
  it('returns empty string for null store', () => {
    expect(getDisplayName(null, ALL_STORES)).toBe('');
  });

  it('returns slug for store with no city', () => {
    const store = { slug: 'mystery-store', city: '', state: 'WI' };
    expect(getDisplayName(store, ALL_STORES)).toBe('mystery-store');
  });

  it('different states with same city name do not conflict', () => {
    // Madison AL and Madison WI should each see their respective duplicates
    const madisonAL_1 = { slug: 'madison-al-wall-triana-hwy', city: 'Madison', state: 'AL', address: '4567 Wall Triana Hwy' };
    const madisonAL_2 = { slug: 'madison-us-hwy-72-w', city: 'Madison', state: 'AL', address: '8382 US Hwy 72 W' };
    const allWithAL = [...MADISON_STORES, VERONA_STORE, madisonAL_1, madisonAL_2];
    // AL stores see each other as duplicates
    const alResult = getDisplayName(madisonAL_1, allWithAL);
    expect(alResult).toContain('Madison');
    expect(alResult).toContain('\u2014'); // disambiguated
    // WI stores still see each other
    const wiResult = getDisplayName(MADISON_STORES[0], allWithAL);
    expect(wiResult).toContain('\u2014');
  });
});
