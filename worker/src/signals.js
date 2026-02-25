/**
 * Flavor signal detection for the custard intelligence platform.
 *
 * Signals are statistically gated insights about flavor patterns at a store.
 * Each signal has a plain-language explanation with evidence, a type, and a
 * recommended action (alert, calendar, directions).
 *
 * Signal types:
 *   overdue       -- Flavor hasn't appeared in > 1.5x its average interval
 *   dow_pattern   -- Flavor shows significant day-of-week scheduling bias
 *   seasonal      -- Flavor concentrated in a 3-month window (>=50%)
 *   active_streak -- Flavor on a multi-day consecutive streak right now
 *   rare_find     -- Flavor available today at very few stores (<= 3)
 *
 * Gating: each signal type has minimum evidence thresholds to prevent noise.
 */

// --- Signal type constants ---

export const SIGNAL_TYPES = {
  OVERDUE: 'overdue',
  DOW_PATTERN: 'dow_pattern',
  SEASONAL: 'seasonal',
  ACTIVE_STREAK: 'active_streak',
  RARE_FIND: 'rare_find',
};

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Threshold constants ---

/** Minimum appearances for a flavor to qualify for any signal. */
export const MIN_APPEARANCES = 3;

/** Overdue ratio threshold (days_since / avg_gap). */
export const OVERDUE_RATIO = 1.5;

/** Minimum appearances for DOW chi-squared to be meaningful. */
export const MIN_DOW_APPEARANCES = 12;

/** Minimum distinct weekdays in flavor history for DOW pattern detection. */
export const MIN_DOW_DISTINCT_DAYS = 2;

/** Minimum % on peak day before we surface a DOW pattern. */
export const MIN_DOW_PEAK_PCT = 45;

/** Suppress suspiciously single-day flavor patterns (often cadence artifacts). */
export const MAX_DOW_PEAK_PCT = 90;

/** Required lift vs store baseline peak weekday %. */
export const MIN_DOW_PEAK_LIFT_PCT = 20;

/** Suppress DOW signals when store baseline is already dominated by one weekday. */
export const MAX_BASELINE_PEAK_PCT = 65;

/** Chi-squared critical value for DOW bias (df=6, p<0.05). */
export const CHI_SQUARED_CRITICAL = 12.592;
export const CHI_SQUARED_CRITICAL_BY_DF = {
  1: 3.841,
  2: 5.991,
  3: 7.815,
  4: 9.488,
  5: 11.07,
  6: 12.592,
};

/** Minimum concentration for seasonal detection. */
export const SEASONAL_CONCENTRATION = 0.5;

/** Minimum consecutive days for active streak signal. */
export const MIN_STREAK_DAYS = 2;

/** Maximum stores serving a flavor for it to count as "rare." */
export const MAX_RARE_STORES = 3;

function normalizeFlavorKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122\u00a9]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// --- Signal computation ---

/**
 * Detect overdue flavors at a store.
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @param {string} today - YYYY-MM-DD
 * @returns {Array} Overdue signals
 */
export function detectOverdue(flavorHistory, today) {
  const todayMs = new Date(today).getTime();
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_APPEARANCES) continue;

    const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24));
    }
    if (gaps.length === 0) continue;

    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const daysSince = (todayMs - sorted[sorted.length - 1]) / (1000 * 60 * 60 * 24);
    const ratio = daysSince / avgGap;

    if (ratio >= OVERDUE_RATIO && avgGap >= 2) {
      signals.push({
        type: SIGNAL_TYPES.OVERDUE,
        flavor,
        headline: `${flavor} is overdue`,
        explanation: `${flavor} usually appears every ${Math.round(avgGap)} days but hasn't been seen in ${Math.round(daysSince)} days.`,
        action: 'alert',
        evidence: { avg_gap_days: Math.round(avgGap), days_since: Math.round(daysSince), ratio: Math.round(ratio * 10) / 10, appearances: dates.length },
        score: ratio, // higher = more overdue = more newsworthy
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect day-of-week scheduling bias via chi-squared test.
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @param {Object} [opts]
 * @param {number[]} [opts.baselineDowCounts] - Optional store-level DOW counts
 * @param {number} [opts.baselineTotal] - Total observations in baselineDowCounts
 * @returns {Array} DOW pattern signals
 */
export function detectDowPatterns(flavorHistory, opts = {}) {
  const signals = [];
  const baselineCounts = Array.isArray(opts.baselineDowCounts) && opts.baselineDowCounts.length === 7
    ? opts.baselineDowCounts.map((n) => Number(n) || 0)
    : null;
  const baselineTotal = Math.max(Number(opts.baselineTotal) || 0, 0);

  const hasBaseline = !!baselineCounts && baselineTotal > 0;
  const expectedWeights = hasBaseline
    ? baselineCounts.map((n) => n / baselineTotal)
    : new Array(7).fill(1 / 7);
  const baselineActiveDays = hasBaseline
    ? baselineCounts.filter((n) => n > 0).length
    : 7;
  const baselinePeakPct = hasBaseline
    ? Math.round(Math.max(...expectedWeights) * 100)
    : Math.round((1 / 7) * 100);

  // If the store itself is almost single-day cadence, DOW "bias" signals
  // become mostly an artifact of scrape/update timing rather than flavor behavior.
  if (hasBaseline) {
    if (baselineActiveDays < MIN_DOW_DISTINCT_DAYS) return [];
    if (baselinePeakPct >= MAX_BASELINE_PEAK_PCT) return [];
  }

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_DOW_APPEARANCES) continue;

    // Count appearances per DOW
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dates) {
      const parsed = new Date(d);
      if (Number.isNaN(parsed.getTime())) continue;
      const dow = parsed.getUTCDay();
      dowCounts[dow]++;
    }
    const totalObserved = dowCounts.reduce((sum, n) => sum + n, 0);
    if (totalObserved < MIN_DOW_APPEARANCES) continue;
    const flavorActiveDays = dowCounts.filter((n) => n > 0).length;
    if (flavorActiveDays < MIN_DOW_DISTINCT_DAYS) continue;

    // Chi-squared test against either uniform weekday probability
    // or store-level baseline weekday availability.
    let chiSquared = 0;
    let activeBuckets = 0;
    for (let i = 0; i < dowCounts.length; i++) {
      const count = dowCounts[i];
      const expected = expectedWeights[i] * totalObserved;
      if (expected <= 0) continue;
      activeBuckets++;
      chiSquared += ((count - expected) ** 2) / expected;
    }

    const degreesOfFreedom = activeBuckets - 1;
    if (degreesOfFreedom < 1) continue;
    const critical = CHI_SQUARED_CRITICAL_BY_DF[degreesOfFreedom] || CHI_SQUARED_CRITICAL;

    if (chiSquared >= critical) {
      const peakDow = dowCounts.indexOf(Math.max(...dowCounts));
      const peakPct = Math.round((dowCounts[peakDow] / totalObserved) * 100);
      const expectedPeakPct = Math.round((expectedWeights[peakDow] || 0) * 100);
      const liftPct = peakPct - expectedPeakPct;
      if (peakPct < MIN_DOW_PEAK_PCT) continue;
      if (peakPct > MAX_DOW_PEAK_PCT) continue;
      if (liftPct < MIN_DOW_PEAK_LIFT_PCT) continue;
      const peakWeekdayTotal = hasBaseline ? baselineCounts[peakDow] : totalObserved;
      const peakWeekdayRatePct = peakWeekdayTotal > 0
        ? Math.round((dowCounts[peakDow] / peakWeekdayTotal) * 100)
        : null;
      signals.push({
        type: SIGNAL_TYPES.DOW_PATTERN,
        flavor,
        headline: `${flavor} peaks on ${DOW_NAMES[peakDow]}s`,
        explanation: `${flavor} appears on ${DOW_NAMES[peakDow]}s in ${dowCounts[peakDow]} of ${peakWeekdayTotal} observed ${DOW_NAMES[peakDow]}s${peakWeekdayRatePct !== null ? ` (${peakWeekdayRatePct}%)` : ''}, and ${peakPct}% of this flavor's appearances land on that day (baseline ${expectedPeakPct}%).`,
        action: 'calendar',
        evidence: {
          peak_dow: peakDow,
          peak_name: DOW_NAMES[peakDow],
          peak_pct: peakPct,
          peak_weekday_total: peakWeekdayTotal,
          peak_weekday_rate_pct: peakWeekdayRatePct,
          expected_peak_pct: expectedPeakPct,
          lift_pct: liftPct,
          flavor_active_days: flavorActiveDays,
          baseline_peak_pct: hasBaseline ? baselinePeakPct : null,
          chi_squared: Math.round(chiSquared * 10) / 10,
          total: totalObserved,
        },
        score: chiSquared,
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect seasonal concentration (>=50% of appearances in a 3-month window).
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @returns {Array} Seasonal signals
 */
export function detectSeasonal(flavorHistory) {
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_APPEARANCES) continue;

    // Count by month
    const monthCounts = new Array(12).fill(0);
    for (const d of dates) {
      const month = new Date(d).getUTCMonth();
      monthCounts[month]++;
    }

    // Sliding 3-month window to find peak concentration
    let bestStart = 0;
    let bestSum = 0;
    for (let start = 0; start < 12; start++) {
      const sum = monthCounts[start] + monthCounts[(start + 1) % 12] + monthCounts[(start + 2) % 12];
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = start;
      }
    }

    const concentration = bestSum / dates.length;
    if (concentration >= SEASONAL_CONCENTRATION && dates.length >= 6) {
      const peakMonths = [
        MONTH_NAMES[bestStart],
        MONTH_NAMES[(bestStart + 1) % 12],
        MONTH_NAMES[(bestStart + 2) % 12],
      ];
      signals.push({
        type: SIGNAL_TYPES.SEASONAL,
        flavor,
        headline: `${flavor} peaks ${peakMonths[0]}-${peakMonths[2]}`,
        explanation: `${Math.round(concentration * 100)}% of ${flavor} appearances fall in ${peakMonths.join('-')} (${bestSum} of ${dates.length}).`,
        action: 'alert',
        evidence: { peak_months: peakMonths, concentration: Math.round(concentration * 100) / 100, peak_count: bestSum, total: dates.length },
        score: concentration,
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect active consecutive-day streaks.
 *
 * @param {Array} flavorHistory - [{flavor, dates: [string]}]
 * @param {string} today - YYYY-MM-DD
 * @returns {Array} Active streak signals
 */
export function detectStreaks(flavorHistory, today) {
  const todayMs = new Date(today).getTime();
  const oneDayMs = 1000 * 60 * 60 * 24;
  const signals = [];

  for (const { flavor, dates } of flavorHistory) {
    if (dates.length < MIN_STREAK_DAYS) continue;

    const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => b - a); // most recent first
    // Check if the most recent date is today or yesterday
    const daysDiff = (todayMs - sorted[0]) / oneDayMs;
    if (daysDiff > 1.5) continue; // streak not active

    // Count consecutive days backwards from most recent
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i - 1] - sorted[i]) / oneDayMs;
      if (gap > 1.5) break;
      streak++;
    }

    if (streak >= MIN_STREAK_DAYS) {
      signals.push({
        type: SIGNAL_TYPES.ACTIVE_STREAK,
        flavor,
        headline: `${flavor}: ${streak}-day streak`,
        explanation: `${flavor} has been the flavor of the day for ${streak} consecutive days.`,
        action: 'directions',
        evidence: { streak_days: streak },
        score: streak,
      });
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

/**
 * Detect rare finds -- flavors available today at very few stores.
 *
 * @param {string} todayFlavor - The confirmed flavor at this store today
 * @param {number} storeCount - Number of stores serving this flavor today
 * @returns {Object|null} Rare find signal or null
 */
export function detectRareFind(todayFlavor, storeCount) {
  if (!todayFlavor || typeof storeCount !== 'number') return null;
  if (storeCount > MAX_RARE_STORES || storeCount < 1) return null;

  return {
    type: SIGNAL_TYPES.RARE_FIND,
    flavor: todayFlavor,
    headline: `Rare: ${todayFlavor}`,
    explanation: storeCount === 1
      ? `${todayFlavor} is only available at 1 store today.`
      : `${todayFlavor} is only available at ${storeCount} stores today.`,
    action: 'directions',
    evidence: { store_count: storeCount },
    score: 1 / storeCount, // rarer = higher score
  };
}

// --- Aggregation ---

/**
 * Build flavor history from D1 snapshot rows.
 * Groups dates by normalized flavor name.
 *
 * @param {Array} rows - [{flavor, date}]
 * @returns {Array} [{flavor, dates: [string]}]
 */
export function buildFlavorHistory(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.flavor || !row.date) continue;
    const key = normalizeFlavorKey(row.normalized_flavor || row.flavor);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { flavor: row.flavor, dates: [] });
    }
    const entry = map.get(key);
    entry.dates.push(row.date);
    if (typeof row.flavor === 'string' && row.flavor.length > String(entry.flavor || '').length) {
      entry.flavor = row.flavor;
    }
  }
  return Array.from(map.values());
}

/**
 * Compute all signals for a store.
 *
 * @param {Object} opts
 * @param {Array} opts.snapshotRows - [{flavor, date}] from D1
 * @param {string} opts.today - YYYY-MM-DD
 * @param {string} [opts.todayFlavor] - Confirmed flavor today
 * @param {number} [opts.todayFlavorStoreCount] - How many stores serve today's flavor
 * @param {number} [opts.limit=5] - Max signals to return
 * @returns {Array} Top signals sorted by score
 */
export function computeSignals(opts = {}) {
  const {
    snapshotRows = [],
    today,
    todayFlavor,
    todayFlavorStoreCount,
    limit = 5,
  } = opts;

  const history = buildFlavorHistory(snapshotRows);
  const baselineDowCounts = [0, 0, 0, 0, 0, 0, 0];
  let baselineTotal = 0;
  for (const row of snapshotRows) {
    const parsed = new Date(row?.date);
    if (Number.isNaN(parsed.getTime())) continue;
    baselineDowCounts[parsed.getUTCDay()]++;
    baselineTotal++;
  }

  const signals = [
    ...detectOverdue(history, today),
    ...detectDowPatterns(history, { baselineDowCounts, baselineTotal }),
    ...detectSeasonal(history),
    ...detectStreaks(history, today),
  ];

  const rare = detectRareFind(todayFlavor, todayFlavorStoreCount);
  if (rare) signals.push(rare);

  // Deduplicate: keep highest-scoring signal per flavor
  const best = new Map();
  for (const signal of signals) {
    const key = `${signal.flavor}:${signal.type}`;
    if (!best.has(key) || signal.score > best.get(key).score) {
      best.set(key, signal);
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// --- API handler ---

/**
 * Handle GET /api/v1/signals/{slug}
 *
 * @param {URL} url
 * @param {Object} env
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handleSignals(url, env, corsHeaders) {
  const parts = url.pathname.replace(/^\/api\/v1\//, '').split('/');
  const slug = parts[1] || '';

  if (!slug) {
    return Response.json(
      { error: 'Missing store slug. Usage: /api/v1/signals/{slug}' },
      { status: 400, headers: corsHeaders }
    );
  }

  const db = env.DB;
  if (!db) {
    return Response.json(
      { error: 'Database unavailable' },
      { status: 503, headers: corsHeaders }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch snapshot history for this store (last 365 days for pattern detection)
  let rows;
  try {
    const result = await db.prepare(
      `SELECT flavor, normalized_flavor, date
       FROM snapshots
       WHERE slug = ?
         AND date >= date('now', '-365 days')
       ORDER BY date`
    ).bind(slug).all();
    rows = result.results || [];
  } catch {
    return Response.json(
      { error: 'Failed to query snapshot history' },
      { status: 500, headers: corsHeaders }
    );
  }

  if (rows.length === 0) {
    return Response.json(
      { slug, signals: [], message: 'No history for this store' },
      { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } }
    );
  }

  // Get today's flavor and cross-store count
  let todayFlavor = null;
  let todayFlavorStoreCount = null;
  const todayRow = rows.find((r) => r.date === today);
  if (todayRow) {
    todayFlavor = todayRow.flavor;
    try {
      const countResult = await db.prepare(
        `SELECT COUNT(DISTINCT slug) as cnt FROM snapshots WHERE normalized_flavor = ? AND date = ?`
      ).bind(todayRow.flavor.toLowerCase().replace(/[^\w\s]/g, '').trim(), today).first();
      todayFlavorStoreCount = countResult?.cnt || null;
    } catch {
      // best-effort
    }
  }

  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 5, 1), 20);

  const signals = computeSignals({
    snapshotRows: rows,
    today,
    todayFlavor,
    todayFlavorStoreCount,
    limit,
  });

  return Response.json(
    { slug, today, signals },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=1800',
      },
    }
  );
}
