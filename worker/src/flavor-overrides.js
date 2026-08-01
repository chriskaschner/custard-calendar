/**
 * Serving-layer flavor overrides and premiere-day placeholders.
 *
 * Culver's withholds new-flavor premiere days from `restaurantCalendar.flavors`
 * chain-wide: 2026-08-05 and 2026-09-02 are absent at every store in every state
 * while neighbouring dates are fully populated, and nothing upstream reveals the
 * name in advance. Without this module those days render as a silent hole -- no
 * card on the web, no VEVENT in the .ics feed.
 *
 * Everything here applies at the SERVING boundary only. Nothing produced by this
 * module may reach KV or D1: getFlavorsCached() persists the raw upstream payload
 * first, then applies these overrides to a copy on the way out, so `snapshots`
 * (and therefore rarity stats and the ML corpus) hold only real observations.
 * Every function is pure with respect to its inputs -- callers rely on the input
 * payload never being mutated.
 *
 * Precedence: real upstream data > manual override > premiere placeholder.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Premiere placeholders only make sense for the brand that withholds them. */
export const PREMIERE_BRAND = "Culver's";

export const PREMIERE_TITLE = 'New flavor premiere';
export const PREMIERE_DESCRIPTION =
  "Culver's hasn't announced this one yet - the name lands the day it premieres.";

/**
 * Seed list of known premiere dates. Detection (see detectBlackoutDates) keeps
 * this current automatically, but the seed guarantees correct behavior even if
 * the cron is disabled or KV is unreachable.
 */
export const KNOWN_PREMIERE_DATES = Object.freeze(['2026-08-05', '2026-09-02']);

/**
 * Hand-pinned flavors, for when a name is known before upstream publishes it.
 *   { date, scope, title, description, mode }
 * `scope` is 'all' or an array of slugs. `mode` is 'fill-gap' (default -- yields
 * to upstream so the pin self-heals once real data lands) or 'replace'.
 */
export const MANUAL_OVERRIDES = Object.freeze([
  // { date: '2026-08-05', scope: 'all', title: 'Peanut Butter Fudge Brownie' },
]);

export const PREMIERE_DATES_KV_KEY = 'meta:premiere-dates';

function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

function appliesToSlug(entry, slug) {
  const scope = entry.scope;
  if (!scope || scope === 'all') return true;
  return Array.isArray(scope) && scope.includes(slug);
}

/** Earliest and latest date the store's payload actually covers. */
function coveredHorizon(flavors) {
  let start = null;
  let end = null;
  for (const f of flavors) {
    if (!isIsoDate(f?.date)) continue;
    if (start === null || f.date < start) start = f.date;
    if (end === null || f.date > end) end = f.date;
  }
  return start === null ? null : { start, end };
}

/**
 * Fill gaps in a store's flavor payload with manual overrides and premiere
 * placeholders. Returns the input untouched when nothing applies.
 *
 * @param {{name: string, flavors: Array}} data - Payload from cache or upstream
 * @param {string} slug
 * @param {Object} [options]
 * @param {string[]} [options.premiereDates] - Dates to placeholder when missing
 * @param {string} [options.brand] - Brand for `slug`; placeholders are Culver's-only
 * @param {Array} [options.overrides] - Defaults to MANUAL_OVERRIDES
 * @returns {{name: string, flavors: Array}} New object when modified
 */
export function applyFlavorOverrides(data, slug, options = {}) {
  if (!data || !Array.isArray(data.flavors)) return data;

  const {
    premiereDates = [],
    brand = PREMIERE_BRAND,
    overrides = MANUAL_OVERRIDES,
  } = options;

  const covered = new Set(data.flavors.map(f => f?.date).filter(isIsoDate));
  const additions = [];
  const replacements = new Map();

  for (const entry of overrides) {
    if (!isIsoDate(entry?.date) || !entry.title) continue;
    if (!appliesToSlug(entry, slug)) continue;

    if (covered.has(entry.date)) {
      // 'fill-gap' (the default) yields to upstream -- that is what lets a pin
      // self-heal the moment the real flavor is published.
      if (entry.mode === 'replace') replacements.set(entry.date, entry);
      continue;
    }
    additions.push({
      date: entry.date,
      title: entry.title,
      description: entry.description || '',
      source: 'override',
    });
    covered.add(entry.date);
  }

  if (brand === PREMIERE_BRAND) {
    // Only placeholder inside the horizon this store actually reports. A store
    // whose calendar stops on the 3rd should not sprout a card for the 5th.
    const horizon = coveredHorizon(data.flavors);
    if (horizon) {
      for (const date of premiereDates) {
        if (!isIsoDate(date) || covered.has(date)) continue;
        if (date < horizon.start || date > horizon.end) continue;
        additions.push({
          date,
          title: PREMIERE_TITLE,
          description: PREMIERE_DESCRIPTION,
          source: 'premiere',
        });
        covered.add(date);
      }
    }
  }

  if (additions.length === 0 && replacements.size === 0) return data;

  const flavors = data.flavors
    .map(f => {
      const hit = replacements.get(f?.date);
      if (!hit) return f;
      return { ...f, title: hit.title, description: hit.description || '', source: 'override' };
    })
    .concat(additions)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { ...data, flavors };
}

/**
 * Shift an ISO date string by whole days in UTC.
 * @param {string} iso - 'YYYY-MM-DD'
 * @param {number} days - May be negative
 * @returns {string}
 */
export function isoPlusDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Find dates that upstream blacked out chain-wide.
 *
 * A blacked-out date produces no `snapshots` rows at all, so it is absent from
 * the GROUP BY result rather than present with a low count -- hence the walk
 * over the date range instead of over the rows. Neighbours that are themselves
 * absent are excluded from the baseline rather than counted as zero, so two
 * adjacent premiere days do not mask each other.
 *
 * @param {Array<{date: string, stores: number}>} dateCounts - Should cover
 *   `neighborRadius` days beyond [start, end] on both sides for clean baselines.
 * @param {Object} options
 * @param {string} options.start - First date to test (inclusive)
 * @param {string} options.end - Last date to test (inclusive)
 * @returns {string[]} Sorted blackout dates; empty when the signal is unreliable
 */
export function detectBlackoutDates(dateCounts, options = {}) {
  const {
    start,
    end,
    neighborRadius = 3,
    // Coverage falls off a cliff at each month boundary -- most stores publish
    // only through the end of the current month, so early-September dates sit
    // at ~18 stores while late-August sits at ~75. Premieres land on the first
    // Wednesday, i.e. always inside that thin zone, so a baseline floor of 20
    // would systematically hide the very dates this exists to find. 12 stores
    // all missing the same day is still a decisive signal.
    minBase = 12,
    maxRatio = 0.15,
    maxBlackouts = 6,
  } = options;

  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return [];

  const counts = new Map();
  for (const row of dateCounts || []) {
    if (isIsoDate(row?.date)) counts.set(row.date, Number(row.stores) || 0);
  }
  if (counts.size === 0) return [];

  const blackouts = [];
  for (let date = start; date <= end; date = isoPlusDays(date, 1)) {
    const observed = counts.get(date) || 0;

    const neighbors = [];
    for (let offset = -neighborRadius; offset <= neighborRadius; offset++) {
      if (offset === 0) continue;
      const value = counts.get(isoPlusDays(date, offset));
      if (value !== undefined) neighbors.push(value);
    }
    if (neighbors.length < 2) continue;

    const base = median(neighbors);
    if (base >= minBase && observed <= maxRatio * base) blackouts.push(date);
  }

  // Upstream withholds premiere days one at a time. Consecutive missing days are
  // a harvest outage or an upstream failure, so drop whole runs rather than
  // inventing placeholders over a hole in our own data. (A multi-day outage only
  // ever surfaces as candidates at its edges -- its interior days have no covered
  // neighbours to form a baseline -- so filtering runs is what catches it.)
  const candidates = new Set(blackouts);
  const isolated = blackouts.filter(date =>
    !candidates.has(isoPlusDays(date, -1)) && !candidates.has(isoPlusDays(date, 1))
  );
  if (isolated.length < blackouts.length) {
    console.warn(
      `Blackout detection discarded ${blackouts.length - isolated.length} consecutive ` +
      `dates in ${start}..${end}; consecutive gaps indicate a coverage failure`
    );
  }

  // A handful of premieres a quarter is the real schedule. Dozens is not.
  if (isolated.length > maxBlackouts) {
    console.warn(
      `Blackout detection found ${isolated.length} dates in ${start}..${end}; ` +
      'treating as a coverage failure rather than premieres'
    );
    return [];
  }
  return isolated;
}

// Cached per UTC day so the serving path costs no extra KV read per request.
let premiereDateCache = { day: null, dates: null };

/** Test hook — clears the per-isolate premiere date cache. */
export function resetPremiereDateCache() {
  premiereDateCache = { day: null, dates: null };
}

/**
 * Union of the seed list and whatever the cron most recently detected.
 * Never throws: a KV failure degrades to the seed list.
 * @param {Object} kv - KV namespace binding
 * @returns {Promise<string[]>}
 */
export async function getPremiereDates(kv) {
  const day = new Date().toISOString().slice(0, 10);
  if (premiereDateCache.day === day && premiereDateCache.dates) {
    return premiereDateCache.dates;
  }

  let detected = [];
  if (kv) {
    try {
      const raw = await kv.get(PREMIERE_DATES_KV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.dates)) detected = parsed.dates.filter(isIsoDate);
      }
    } catch (err) {
      console.error(`Premiere date read failed: ${err.message}`);
    }
  }

  const dates = Array.from(new Set([...KNOWN_PREMIERE_DATES, ...detected])).sort();
  premiereDateCache = { day, dates };
  return dates;
}

/**
 * Persist detected blackout dates for the serving path to pick up.
 * Best-effort: a write failure is logged, never thrown.
 * @param {Object} kv - KV namespace binding
 * @param {string[]} dates
 */
export async function writePremiereDates(kv, dates) {
  if (!kv) return;
  try {
    await kv.put(
      PREMIERE_DATES_KV_KEY,
      JSON.stringify({ dates, updatedAt: new Date().toISOString() }),
      { expirationTtl: 8 * 86400 }
    );
    premiereDateCache = { day: null, dates: null };
  } catch (err) {
    console.error(`Premiere date write failed: ${err.message}`);
  }
}
