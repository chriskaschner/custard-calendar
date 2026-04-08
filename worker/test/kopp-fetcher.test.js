import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKoppsHtml } from '../src/kopp-fetcher.js';

const fixture = readFileSync(join(__dirname, 'fixtures/kopps-flavor-preview.html'), 'utf-8');

describe('Kopp\'s fetcher', () => {
  it('parses multiple flavors from fixture HTML', () => {
    const result = parseKoppsHtml(fixture);
    // 2 flavors per day, at least 3 days = at least 6 entries
    expect(result.flavors.length).toBeGreaterThanOrEqual(6);
  });

  it('extracts correct dates', () => {
    const result = parseKoppsHtml(fixture);
    const dates = result.flavors.map(f => f.date);
    // Fixture has 2/21, 2/22, 2/23
    expect(dates).toContain('2026-02-21');
    expect(dates).toContain('2026-02-22');
    expect(dates).toContain('2026-02-23');
  });

  it('returns separate entries for each flavor per day', () => {
    const result = parseKoppsHtml(fixture);
    const feb21 = result.flavors.filter(f => f.date === '2026-02-21');
    expect(feb21.length).toBe(2);
    expect(feb21[0].title).toContain("Reese's Peanut Butter Kupps");
    expect(feb21[1].title).toContain('Heath Bar');
  });

  it('cleans HTML entities from flavor names', () => {
    const result = parseKoppsHtml(fixture);
    const feb21 = result.flavors.find(f => f.date === '2026-02-21');
    // Should have apostrophe, not &rsquo;
    expect(feb21.title).toContain("Reese's");
    // Should not have (R) trademark
    expect(feb21.title).not.toContain('(R)');
  });

  it('returns brand name', () => {
    const result = parseKoppsHtml(fixture);
    expect(result.name).toBe("Kopp's Frozen Custard");
  });

  it('returns empty flavors for empty HTML', () => {
    const result = parseKoppsHtml('<html><body></body></html>');
    expect(result.flavors).toEqual([]);
  });
});
