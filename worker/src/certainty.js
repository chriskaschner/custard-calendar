/**
 * Certainty tier determination for the custard planner.
 *
 * Four explicit tiers:
 *   Confirmed -- schedule data from the store, good reliability
 *   Watch     -- schedule data present but store has reliability issues
 *   Estimated -- probabilistic fill when forecast meets quality thresholds
 *   None      -- no data, or forecast too weak/stale to surface
 *
 * Trigger rules for Estimated (all must be true):
 *   1. No confirmed schedule data
 *   2. Forecast data exists
 *   3. Top probability > 2% (~3x random for 150 flavors)
 *   4. History depth >= 14 days (minimum for pattern detection)
 *   5. Forecast age < 168 hours (7 days) if provided
 *
 * If any threshold fails, tier is NONE ("No data") rather than
 * showing a misleading Estimated prediction.
 */

export const TIERS = {
  CONFIRMED: 'confirmed',
  WATCH: 'watch',
  ESTIMATED: 'estimated',
  NONE: 'none',
};

/** Minimum probability to qualify for Estimated tier (~3x random). */
export const MIN_PROBABILITY = 0.02;

/** Minimum historical observations to qualify for Estimated tier. */
export const MIN_HISTORY_DEPTH = 14;

/** Maximum forecast age in hours before it goes stale. */
export const MAX_FORECAST_AGE_HOURS = 168; // 7 days

/**
 * Determine certainty tier from available data signals.
 *
 * @param {Object} opts
 * @param {boolean} opts.hasConfirmed - Whether confirmed schedule data exists
 * @param {boolean} opts.hasForecast - Whether forecast data exists
 * @param {number}  opts.probability - Forecast probability (0-1)
 * @param {number}  opts.historyDepth - Number of historical observations
 * @param {number}  [opts.forecastAgeHours] - Hours since forecast was generated
 * @param {string}  opts.reliabilityTier - Store reliability tier ('confirmed', 'watch', 'unreliable')
 * @returns {string} One of TIERS values
 */
export function determineCertaintyTier(opts = {}) {
  const {
    hasConfirmed = false,
    hasForecast = false,
    probability = 0,
    historyDepth = 0,
    forecastAgeHours,
    reliabilityTier,
  } = opts;

  // Confirmed schedule data always wins
  if (hasConfirmed) {
    if (reliabilityTier === 'watch' || reliabilityTier === 'unreliable') {
      return TIERS.WATCH;
    }
    return TIERS.CONFIRMED;
  }

  // Forecast must exist and meet all quality thresholds
  if (hasForecast) {
    const stale = typeof forecastAgeHours === 'number' && forecastAgeHours > MAX_FORECAST_AGE_HOURS;
    if (!stale && probability >= MIN_PROBABILITY && historyDepth >= MIN_HISTORY_DEPTH) {
      return TIERS.ESTIMATED;
    }
  }

  return TIERS.NONE;
}

/**
 * Cap the effective certainty score based on tier.
 * Used in the planner scoring formula to ensure Confirmed always outscores Estimated.
 *
 * @param {string} tier - Certainty tier
 * @param {number} probability - Raw probability (0-1), relevant for Estimated tier
 * @returns {number} Capped certainty score (0-1)
 */
export function certaintyCap(tier, probability = 0) {
  switch (tier) {
    case TIERS.CONFIRMED:
      return 1.0;
    case TIERS.WATCH:
      return 0.7;
    case TIERS.ESTIMATED:
      // Scale by probability but cap at 0.5 so Estimated never beats Watch
      return Math.min(0.5, probability * 5);
    case TIERS.NONE:
    default:
      return 0;
  }
}

/**
 * Human-readable label for a certainty tier.
 * @param {string} tier
 * @returns {string}
 */
export function tierLabel(tier) {
  switch (tier) {
    case TIERS.CONFIRMED: return 'Confirmed';
    case TIERS.WATCH: return 'Watch';
    case TIERS.ESTIMATED: return 'Estimated';
    default: return '';
  }
}
