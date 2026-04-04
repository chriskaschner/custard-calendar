/**
 * Integration test: every brand's fixture data must survive sanitization.
 *
 * Regression guard for the class of bug where SAFE_TEXT_RE (now UNSAFE_TEXT_RE)
 * rejects characters that upstream brands legitimately use in flavor text.
 * Parses each brand's HTML/JSON fixture, then runs the result through
 * sanitizeFlavorPayload and asserts zero dropped entries.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sanitizeFlavorPayload } from '../src/kv-cache.js';
import { parseNextData } from '../src/flavor-fetcher.js';
import { parseKoppsHtml } from '../src/kopp-fetcher.js';
import { parseGillesHtml } from '../src/gilles-fetcher.js';
import { parseHefnersHtml } from '../src/hefners-fetcher.js';
import { parseKraverzHtml } from '../src/kraverz-fetcher.js';
import { parseOscarsHtml } from '../src/oscars-fetcher.js';

const fix = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

// Culver's fixtures are raw JSON; wrap in HTML like the real page serves it
function wrapInHtml(jsonObj) {
  var fullData = JSON.stringify(jsonObj);
  return '<!DOCTYPE html><html><head><script id="__NEXT_DATA__" type="application/json">' + fullData + '</script></head><body></body></html>';
}

describe('sanitizeFlavorPayload integration: fixture data survives sanitization', () => {
  it("Culver's (mt-horeb) -- parseNextData through sanitize", () => {
    const nextData = JSON.parse(fix('mt-horeb-nextdata.json'));
    const payload = parseNextData(wrapInHtml(nextData));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });

  it("Culver's (madison-todd-drive) -- parseNextData through sanitize", () => {
    const nextData = JSON.parse(fix('madison-todd-drive-nextdata.json'));
    const payload = parseNextData(wrapInHtml(nextData));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });

  it("Kopp's -- parseKoppsHtml through sanitize", () => {
    const payload = parseKoppsHtml(fix('kopps-flavor-preview.html'));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });

  it("Gille's -- parseGillesHtml through sanitize", () => {
    const payload = parseGillesHtml(fix('gilles-fotd.html'));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });

  it("Hefner's -- parseHefnersHtml through sanitize", () => {
    const payload = parseHefnersHtml(fix('hefners.html'));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });

  it('Kraverz -- parseKraverzHtml through sanitize', () => {
    const payload = parseKraverzHtml(fix('kraverz.html'));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });

  it("Oscar's -- parseOscarsHtml through sanitize", () => {
    const payload = parseOscarsHtml(fix('oscars-flavors.html'));
    const result = sanitizeFlavorPayload(payload);
    expect(result.data.flavors.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(0);
  });
});
