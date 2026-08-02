/**
 * Forecast endpoint — serves pre-computed flavor predictions.
 *
 * Source priority:
 *   1. D1 forecasts table (primary durable store)
 *   2. KV `forecast:{slug}` (temporary backward-compat fallback)
 *
 * GET /api/v1/forecast/{slug}
 *   → { store_slug, date, predictions: [{flavor, probability}], prose }
 */

async function readForecastFromD1(db, slug) {
  if (!db) return { found: false, forecast: null, corrupted: false };
  try {
    const row = await db.prepare(
      'SELECT data FROM forecasts WHERE slug = ? LIMIT 1'
    ).bind(slug).first();
    if (!row || !row.data) {
      return { found: false, forecast: null, corrupted: false };
    }
    try {
      return { found: true, forecast: JSON.parse(row.data), corrupted: false };
    } catch (err) {
      console.error(`Corrupted forecast JSON in D1 for slug=${slug}: ${err.message}`);
      return { found: true, forecast: null, corrupted: true };
    }
  } catch (err) {
    // D1 read failures are non-fatal; caller can fall back to KV.
    console.error(`Forecast D1 read failed for slug=${slug}: ${err.message}`);
    return { found: false, forecast: null, corrupted: false };
  }
}

async function readForecastFromKv(kv, slug) {
  if (!kv) return { found: false, forecast: null, corrupted: false };
  try {
    const cached = await kv.get(`forecast:${slug}`);
    if (!cached) {
      return { found: false, forecast: null, corrupted: false };
    }
    try {
      return { found: true, forecast: JSON.parse(cached), corrupted: false };
    } catch (err) {
      console.error(`Corrupted forecast JSON in KV for slug=${slug}: ${err.message}`);
      return { found: true, forecast: null, corrupted: true };
    }
  } catch (err) {
    console.error(`Forecast KV read failed for slug=${slug}: ${err.message}`);
    return { found: false, forecast: null, corrupted: false };
  }
}

/**
 * Resolve forecast data for a store slug.
 * Returns D1-first with KV fallback.
 * @param {string} slug
 * @param {Object} env
 * @returns {Promise<{ forecast: Object|null, source: string|null, corrupted: boolean }>}
 */
export async function getForecastData(slug, env) {
  const d1Result = await readForecastFromD1(env.DB || null, slug);
  if (d1Result.found && d1Result.forecast) {
    return { forecast: d1Result.forecast, source: 'd1', corrupted: false };
  }

  const kvResult = await readForecastFromKv(env.FLAVOR_CACHE || null, slug);
  if (kvResult.found && kvResult.forecast) {
    return { forecast: kvResult.forecast, source: 'kv', corrupted: false };
  }

  return {
    forecast: null,
    source: null,
    corrupted: Boolean(d1Result.corrupted || kvResult.corrupted),
  };
}

/**
 * Age past which a forecast is flagged stale. Matches MAX_FORECAST_AGE_HOURS
 * in docs/planner-domain.js, where the client downgrades it out of "Estimated".
 */
export const FORECAST_STALE_HOURS = 168; // 7 days

/**
 * Age past which predictions are withheld entirely. A forecast this old was
 * trained on a corpus that no longer reflects the rotation, and presenting it
 * as an estimate is worse than showing nothing -- the caller falls back to
 * "no data", which is at least honest.
 */
export const FORECAST_HARD_LIMIT_HOURS = 720; // 30 days

/**
 * Annotate a forecast with its age and withhold predictions once it is beyond
 * saving. Pure so the thresholds are testable without D1 or KV.
 *
 * The batch pipeline stamps `generated_at`; a forecast without one is treated
 * as unknown-age rather than fresh.
 *
 * @param {Object} forecast - Raw forecast payload
 * @param {number} nowMs - Current time in epoch ms
 * @returns {Object} New object; input is not mutated
 */
export function annotateForecastAge(forecast, nowMs) {
  if (!forecast || typeof forecast !== 'object') return forecast;

  const generatedAt = forecast.generated_at;
  const parsed = generatedAt ? Date.parse(generatedAt) : NaN;
  if (Number.isNaN(parsed)) {
    return { ...forecast, age_hours: null, stale: true, stale_reason: 'unknown_generated_at' };
  }

  const ageHours = Math.max(0, Math.round((nowMs - parsed) / 36e5));
  const annotated = {
    ...forecast,
    age_hours: ageHours,
    stale: ageHours > FORECAST_STALE_HOURS,
  };

  if (ageHours > FORECAST_HARD_LIMIT_HOURS) {
    annotated.stale_reason = 'expired';
    // Strip predictions rather than the days themselves so consumers can still
    // see the shape and the reason instead of a bare 404.
    annotated.days = (forecast.days || []).map(day => ({ ...day, predictions: [] }));
    if (forecast.predictions) annotated.predictions = [];
  }

  return annotated;
}

/**
 * Handle forecast route.
 * @param {string} slug - Store slug from URL path
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handleForecast(slug, env, corsHeaders) {
  const hasDb = Boolean(env.DB);
  const hasKv = Boolean(env.FLAVOR_CACHE);
  if (!hasDb && !hasKv) {
    return Response.json(
      { error: 'Forecast data not available — neither D1 nor KV is configured' },
      { status: 503, headers: corsHeaders },
    );
  }

  const { forecast, corrupted } = await getForecastData(slug, env);
  if (!forecast && corrupted) {
    return Response.json(
      { error: 'Forecast data corrupted' },
      { status: 500, headers: corsHeaders },
    );
  }

  if (!forecast) {
    return Response.json(
      { error: `No forecast available for "${slug}". Forecasts are generated daily by the batch pipeline.` },
      { status: 404, headers: corsHeaders },
    );
  }

  return Response.json(annotateForecastAge(forecast, Date.now()), {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=3600', // 1 hour
    },
  });
}
