import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOscarsHtml } from '../src/oscars-fetcher.js';

const fixture = readFileSync(join(__dirname, 'fixtures/oscars-flavors.html'), 'utf-8');

describe('Oscar\'s fetcher', () => {
  it('parses full month from February table', () => {
    const result = parseOscarsHtml(fixture);
    const febFlavors = result.flavors.filter(f => f.date.startsWith('2026-02'));
    expect(febFlavors.length).toBe(28);
  });

  it('parses March forecast table', () => {
    const result = parseOscarsHtml(fixture);
    const marFlavors = result.flavors.filter(f => f.date.startsWith('2026-03'));
    expect(marFlavors.length).toBe(7);
  });

  it('extracts correct dates', () => {
    const result = parseOscarsHtml(fixture);
    const dates = result.flavors.map(f => f.date);
    expect(dates).toContain('2026-02-01');
    expect(dates).toContain('2026-02-14');
    expect(dates).toContain('2026-02-28');
    expect(dates).toContain('2026-03-01');
  });

  it('title-cases ALL CAPS flavor names', () => {
    const result = parseOscarsHtml(fixture);
    const feb1 = result.flavors.find(f => f.date === '2026-02-01');
    expect(feb1.title).toBe('Badger Claw');
  });

  it('preserves -or- alternatives', () => {
    const result = parseOscarsHtml(fixture);
    const feb3 = result.flavors.find(f => f.date === '2026-02-03');
    expect(feb3.title).toContain('-or-');
    expect(feb3.title).toContain('Cherry Chip');
    expect(feb3.title).toContain('Butter Almond');
  });

  it('handles HTML entities (apostrophe)', () => {
    const result = parseOscarsHtml(fixture);
    const feb17 = result.flavors.find(f => f.date === '2026-02-17');
    expect(feb17.title).toContain("Oscar's");
  });

  it('handles ampersand entities', () => {
    const result = parseOscarsHtml(fixture);
    const feb20 = result.flavors.find(f => f.date === '2026-02-20');
    expect(feb20.title).toContain('M&M');
  });

  it('returns brand name and address', () => {
    const result = parseOscarsHtml(fixture);
    expect(result.name).toBe("Oscar's Frozen Custard");
    expect(result.address).toContain('New Berlin');
  });

  it('returns empty flavors for empty HTML', () => {
    const result = parseOscarsHtml('<html><body></body></html>');
    expect(result.flavors).toEqual([]);
  });

  it('handles March forecast entries (mixed case, no bold links)', () => {
    const result = parseOscarsHtml(fixture);
    const mar4 = result.flavors.find(f => f.date === '2026-03-04');
    expect(mar4).toBeDefined();
    expect(mar4.title).toContain('Strawberry Cheesecake');
  });

  it('parses March forecast table when current month is March', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
      const result = parseOscarsHtml(fixture);
      const marFlavors = result.flavors.filter(f => f.date.startsWith('2026-03'));
      expect(marFlavors.length).toBe(7);
      expect(marFlavors.map(f => f.date)).toContain('2026-03-01');
    } finally {
      vi.useRealTimers();
    }
  });
});
