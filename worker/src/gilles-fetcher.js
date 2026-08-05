/**
 * Fetches and parses Gille's Frozen Custard flavor data.
 *
 * Gille's migrated from Drupal 7 to Wix around 2026-07-18. The old parser
 * targeted the Drupal Calendar module's `td.single-day[data-date]` grid; the
 * Wix page contains none of that markup, so the fetch kept returning 200 while
 * the parse silently produced nothing for weeks.
 *
 * What upstream publishes now is much thinner: a single hand-typed day, as two
 * adjacent Wix rich-text blocks -- a bare "July 31" heading followed by the
 * flavor name, which may be split across several <p> tags ("Vanilla Chocolate"
 * + "Flake"). The month calendar is gone; it is now a flat PNG. So one day is
 * the ceiling here, and it is only as current as the owner's last Wix edit.
 *
 * Because of that, this parser reports the date it actually read rather than
 * assuming the page is current. A stale page must yield a stale-dated entry so
 * callers can say "no flavor posted today" instead of showing four-day-old
 * custard as though it were today's.
 */

import { centralDateString } from './date-util.js';

const STORE_NAME = "Gille's Frozen Custard";
const STORE_ADDRESS = '7515 W Bluemound Rd, Milwaukee, WI';

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// "July 31", "Dec 3". Anchored: the whole line must be the date, so prose that
// merely mentions a month cannot be mistaken for the heading.
const MONTH_DAY_RE = new RegExp(
  `^(${Object.keys(MONTHS).join('|')}|${Object.keys(MONTHS).map(m => m.slice(0, 3)).join('|')})\\.?\\s+(\\d{1,2})$`,
  'i',
);

const MAX_TITLE_LENGTH = 60;

function stripTags(fragment) {
  return fragment
    .replace(/<[^>]+>/g, '')
    .replace(/&#0*39;|&apos;|&#8217;|’/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|​/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text lines of each Wix rich-text block, in document order.
 * @param {string} html
 * @returns {string[][]}
 */
function extractRichTextBlocks(html) {
  const blockRe = /<div[^>]*class="[^"]*wixui-rich-text[^"]*"[^>]*data-testid="richTextElement"[^>]*>([\s\S]*?)<\/div>/gi;
  const blocks = [];
  let match;
  while ((match = blockRe.exec(html)) !== null) {
    const lines = [];
    const paraRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let para;
    while ((para = paraRe.exec(match[1])) !== null) {
      const text = stripTags(para[1]);
      if (text) lines.push(text);
    }
    blocks.push(lines);
  }
  return blocks;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Attach a year to a bare "Month Day", choosing whichever candidate year puts
 * the date closest to today. Upstream never prints a year, so on Jan 1 a
 * "December 31" heading has to resolve backwards, not forwards.
 *
 * @param {number} month - 1-12
 * @param {number} day
 * @param {string} today - ISO date in Central
 * @returns {string|null} ISO date, or null if the day does not exist
 */
function resolveYear(month, day, today) {
  const todayYear = parseInt(today.slice(0, 4), 10);
  const todayMs = Date.parse(`${today}T00:00:00Z`);

  let best = null;
  for (const year of [todayYear - 1, todayYear, todayYear + 1]) {
    if (day < 1 || day > daysInMonth(year, month)) continue;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const distance = Math.abs(Date.parse(`${iso}T00:00:00Z`) - todayMs);
    if (!best || distance < best.distance) best = { iso, distance };
  }
  return best ? best.iso : null;
}

/**
 * Parse Gille's Wix flavor-of-the-day page.
 *
 * @param {string} html - Raw HTML from gillesfrozencustard.com/flavor-of-the-day
 * @param {string} [today] - Central date (YYYY-MM-DD); injectable for tests
 * @returns {{ name: string, address: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseGillesHtml(html, today = centralDateString()) {
  const empty = { name: STORE_NAME, address: STORE_ADDRESS, flavors: [] };
  if (!html) return empty;

  const blocks = extractRichTextBlocks(html);

  for (let i = 0; i < blocks.length; i++) {
    // The date block is exactly one line, and that line is only the date.
    if (blocks[i].length !== 1) continue;
    const match = blocks[i][0].match(MONTH_DAY_RE);
    if (!match) continue;

    const monthKey = Object.keys(MONTHS).find(m => m.startsWith(match[1].toLowerCase().replace('.', '')));
    if (!monthKey) continue;

    const date = resolveYear(MONTHS[monthKey], parseInt(match[2], 10), today);
    if (!date) continue;

    // The flavor sits in the next rich-text block, sometimes split over
    // several <p> tags ("Vanilla Chocolate" / "Flake").
    const title = (blocks[i + 1] || []).join(' ').trim();
    if (!title || title.length > MAX_TITLE_LENGTH) continue;
    if (/^closed\b/i.test(title)) continue;

    return {
      name: STORE_NAME,
      address: STORE_ADDRESS,
      flavors: [{ date, title, description: '' }],
    };
  }

  return empty;
}

/**
 * Fetch flavor data for Gille's.
 *
 * The apex domain 301s to www; fetch follows redirects by default, so the
 * canonical host is used directly to save the hop.
 *
 * @param {string} slug - "gilles"
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, address: string, flavors: Array}>}
 */
export async function fetchGillesFlavors(slug, fetchFn = globalThis.fetch) {
  const url = 'https://www.gillesfrozencustard.com/flavor-of-the-day';
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Gille's flavor page: ${response.status}`);
  }

  const html = await response.text();
  return parseGillesHtml(html);
}
