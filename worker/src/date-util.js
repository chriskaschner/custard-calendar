/**
 * Central-time date helpers.
 *
 * Every brand this platform tracks operates in America/Chicago, so "today" must
 * mean today in Central, not today in UTC. Deriving it from UTC files evening
 * flavors under the next day: between 7pm Central and midnight (5h/day CDT, 6h
 * CST) the UTC date has already rolled over. That mis-stamped date reaches both
 * the API response and the append-only D1 snapshot record, so it corrupts
 * history as well as the display.
 */

const CENTRAL_TZ = 'America/Chicago';

const CENTRAL_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Current date in America/Chicago as YYYY-MM-DD.
 *
 * Assembled from formatToParts rather than a formatted locale string so the
 * output shape cannot shift with ICU locale formatting.
 *
 * @param {Date} [now] - Instant to convert; defaults to now.
 * @returns {string} ISO date (YYYY-MM-DD) in Central time
 */
export function centralDateString(now = new Date()) {
  const parts = CENTRAL_DATE_FORMAT.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Central date for a timestamp that may be missing or malformed.
 *
 * Intl throws on an Invalid Date, so anything unparseable has to be caught here
 * rather than at each call site.
 *
 * @param {string|Date|null|undefined} value
 * @returns {string|null} ISO date in Central, or null if unusable
 */
export function centralDateStringOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return centralDateString(date);
}
