import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseHefnersHtml } from '../src/hefners-fetcher.js';
import { centralDateString } from '../src/date-util.js';

const fixture = readFileSync(join(__dirname, 'fixtures/hefners.html'), 'utf-8');

describe('Hefner\'s fetcher', () => {
  it('extracts today\'s flavor name', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.flavors).toHaveLength(1);
    expect(result.flavors[0].title).toBe('Tiramisu');
  });

  it('extracts flavor description', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.flavors[0].description).toContain('tiramisu');
  });

  it('stamps the date it is given', () => {
    const result = parseHefnersHtml(fixture, '2026-08-04');
    expect(result.flavors[0].date).toBe('2026-08-04');
  });

  it('uses the Central date, not the UTC date, during the evening', () => {
    // 01:30 UTC on Aug 5 is 20:30 Central on Aug 4. Hefner's page shows the
    // flavor being served right now, so it belongs to Aug 4. Stamping the UTC
    // date filed every evening's flavor under tomorrow -- in the D1 snapshot
    // record as well as the API response.
    const evening = new Date('2026-08-05T01:30:00Z');
    expect(centralDateString(evening)).toBe('2026-08-04');

    const result = parseHefnersHtml(fixture, centralDateString(evening));
    expect(result.flavors[0].date).toBe('2026-08-04');
  });

  it('defaults to the current Central date', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.flavors[0].date).toBe(centralDateString());
  });

  it('returns brand name and address', () => {
    const result = parseHefnersHtml(fixture);
    expect(result.name).toBe("Hefner's Frozen Custard");
    expect(result.address).toContain('West Allis');
  });

  it('returns empty flavors when no flavor-content section', () => {
    const result = parseHefnersHtml('<html><body><div>No flavors here</div></body></html>');
    expect(result.flavors).toEqual([]);
  });

  it('does not extract sundae-of-month as FOTD', () => {
    const result = parseHefnersHtml(fixture);
    const titles = result.flavors.map(f => f.title);
    expect(titles).not.toContain('Puppy Love');
  });
});
