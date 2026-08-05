import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGillesHtml } from '../src/gilles-fetcher.js';

// Captured 2026-08-05 from the Wix site, scripts and styles stripped. The page
// read "July 31 / Vanilla Chocolate / Flake" at capture time -- four days
// stale, which is exactly the condition these tests need to pin down.
const fixture = readFileSync(join(__dirname, 'fixtures/gilles-fotd.html'), 'utf-8');

const CAPTURE_DAY = '2026-07-31';

describe("Gille's fetcher", () => {
  it('parses the single day the Wix page publishes', () => {
    const result = parseGillesHtml(fixture, CAPTURE_DAY);
    expect(result.flavors).toHaveLength(1);
  });

  it('joins a flavor split across paragraphs', () => {
    // Upstream types "Vanilla Chocolate" and "Flake" as separate <p> tags.
    const result = parseGillesHtml(fixture, CAPTURE_DAY);
    expect(result.flavors[0].title).toBe('Vanilla Chocolate Flake');
  });

  it('reads the date off the page', () => {
    const result = parseGillesHtml(fixture, CAPTURE_DAY);
    expect(result.flavors[0].date).toBe('2026-07-31');
  });

  // The regression behind the outage report: a stale page must not be reported
  // as today's flavor. Callers decide what to show, and they can only do that
  // if the date they get back is the date that was actually published.
  it('reports the published date, not today, when the page is stale', () => {
    const result = parseGillesHtml(fixture, '2026-08-04');
    expect(result.flavors).toHaveLength(1);
    expect(result.flavors[0].date).toBe('2026-07-31');
  });

  it('yields no entry dated today when the page is stale', () => {
    const today = '2026-08-04';
    const result = parseGillesHtml(fixture, today);
    expect(result.flavors.filter(f => f.date === today)).toHaveLength(0);
  });

  it('returns brand name and address', () => {
    const result = parseGillesHtml(fixture, CAPTURE_DAY);
    expect(result.name).toBe("Gille's Frozen Custard");
    expect(result.address).toContain('Milwaukee');
  });
});

describe("Gille's year inference", () => {
  const page = (dateText, flavor) => `
    <div class="wixui-rich-text" data-testid="richTextElement"><p>${dateText}</p></div>
    <div class="wixui-rich-text" data-testid="richTextElement"><p>${flavor}</p></div>`;

  it('resolves backwards across the new year', () => {
    // Upstream never prints a year. On Jan 1, "December 31" is yesterday.
    const result = parseGillesHtml(page('December 31', 'Peppermint'), '2027-01-01');
    expect(result.flavors[0].date).toBe('2026-12-31');
  });

  it('resolves forwards across the new year', () => {
    const result = parseGillesHtml(page('January 1', 'Vanilla'), '2026-12-31');
    expect(result.flavors[0].date).toBe('2027-01-01');
  });

  it('accepts abbreviated months', () => {
    const result = parseGillesHtml(page('Aug 4', 'Turtle'), '2026-08-04');
    expect(result.flavors[0].date).toBe('2026-08-04');
  });

  it('handles leap day in the year that has one', () => {
    const result = parseGillesHtml(page('February 29', 'Vanilla'), '2028-03-01');
    expect(result.flavors[0].date).toBe('2028-02-29');
  });

  it('rejects a day that cannot exist', () => {
    const result = parseGillesHtml(page('February 30', 'Vanilla'), '2026-03-01');
    expect(result.flavors).toEqual([]);
  });
});

describe("Gille's parser guards", () => {
  const block = (...lines) =>
    `<div class="wixui-rich-text" data-testid="richTextElement">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;

  it('returns nothing for markup with no rich-text blocks', () => {
    const result = parseGillesHtml('<html><body><p>Nothing here</p></body></html>', '2026-08-04');
    expect(result.flavors).toEqual([]);
  });

  it('returns nothing when the page is empty', () => {
    expect(parseGillesHtml('', '2026-08-04').flavors).toEqual([]);
  });

  it('ignores prose that merely mentions a month', () => {
    const html = block('Open every day in July 31 flavors strong') + block('Vanilla');
    expect(parseGillesHtml(html, '2026-08-04').flavors).toEqual([]);
  });

  it('ignores a date block with no flavor after it', () => {
    expect(parseGillesHtml(block('July 31'), '2026-08-04').flavors).toEqual([]);
  });

  it('skips closed days', () => {
    const html = block('July 31') + block('Closed for the holiday');
    expect(parseGillesHtml(html, '2026-08-04').flavors).toEqual([]);
  });

  it('rejects an implausibly long title', () => {
    const html = block('July 31') + block('x'.repeat(120));
    expect(parseGillesHtml(html, '2026-08-04').flavors).toEqual([]);
  });

  it('does not mistake the footer address block for a flavor', () => {
    const result = parseGillesHtml(fixture, CAPTURE_DAY);
    expect(result.flavors[0].title).not.toContain('Milwaukee');
    expect(result.flavors[0].title).not.toContain('414');
  });
});
