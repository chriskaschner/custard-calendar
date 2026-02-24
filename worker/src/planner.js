/**
 * Shared planner engine for the custard intelligence platform.
 *
 * Answers: "Where should I go, within my radius and time window,
 * for flavors I care about?" Used by Forecast, Map, Radar, Fronts, Quiz.
 *
 * Score components (explicit, consistent, testable):
 *   - certainty  (40%) -- Confirmed > Watch > Estimated > None
 *   - distance   (30%) -- closer is better
 *   - rarity     (20%) -- rarer flavors score higher
 *   - preference (10%) -- bonus for matching user's preferred flavors
 */

import { determineCertaintyTier, certaintyCap, TIERS, tierLabel } from './certainty.js';
import { getReliability } from './reliability.js';
import { getForecastData } from './forecast.js';
import { normalize, matchesFlavor } from './flavor-matcher.js';

// --- Geo utilities ---

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Haversine distance between two lat/lon points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in miles
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Scoring ---

/**
 * Score a single recommendation. Pure function, no I/O.
 *
 * @param {Object} opts
 * @param {number} opts.certaintyScore  - From certaintyCap() (0-1)
 * @param {number} opts.distanceMiles   - Distance from user
 * @param {number} opts.maxRadius       - Search radius (for normalization)
 * @param {number} opts.rarityPercentile - 0-1, higher = rarer
 * @param {boolean} opts.preferenceMatch - Whether flavor matches user prefs
 * @returns {number} Composite score (0-1)
 */
export function scoreRecommendation({
  certaintyScore = 0,
  distanceMiles = 0,
  maxRadius = 25,
  rarityPercentile = 0,
  preferenceMatch = false,
}) {
  const distanceNorm = Math.min(distanceMiles / Math.max(maxRadius, 1), 1.0);
  return (
    certaintyScore * 0.4 +
    (1 - distanceNorm) * 0.3 +
    rarityPercentile * 0.2 +
    (preferenceMatch ? 0.1 : 0)
  );
}

// --- Recommendation builder ---

/**
 * Build scored recommendations from assembled data.
 * Pure function -- all data pre-fetched and passed in.
 *
 * @param {Object} opts
 * @param {Array} opts.stores - [{slug, name, address, lat, lon, flavor, description, rank}]
 * @param {number} opts.userLat
 * @param {number} opts.userLon
 * @param {number} opts.maxRadius - Miles
 * @param {Map<string,Object>} opts.reliabilityMap - slug -> reliability record
 * @param {Map<string,Object>} opts.forecastMap - slug -> forecast data
 * @param {string[]} opts.preferredFlavors - User's flavor preferences (optional)
 * @returns {Object} { recommendations, alternatives }
 */
export function buildRecommendations({
  stores = [],
  userLat,
  userLon,
  maxRadius = 25,
  reliabilityMap = new Map(),
  forecastMap = new Map(),
  preferredFlavors = [],
}) {
  const prefNorms = preferredFlavors.map((f) => normalize(f));
  const recommendations = [];

  for (const store of stores) {
    const dist = haversine(userLat, userLon, store.lat, store.lon);
    if (dist > maxRadius) continue;

    const reliability = reliabilityMap.get(store.slug);
    const reliabilityTier = reliability?.reliability_tier || null;

    // Today's confirmed flavor
    if (store.flavor) {
      const tier = determineCertaintyTier({
        hasConfirmed: true,
        reliabilityTier,
      });
      const certaintyScore = certaintyCap(tier);
      const prefMatch =
        prefNorms.length > 0 &&
        prefNorms.some((p) => matchesFlavor(store.flavor, p, store.description));

      const score = scoreRecommendation({
        certaintyScore,
        distanceMiles: dist,
        maxRadius,
        rarityPercentile: 0, // enriched later if stats available
        preferenceMatch: prefMatch,
      });

      recommendations.push({
        slug: store.slug,
        name: store.name,
        address: store.address,
        flavor: store.flavor,
        description: store.description,
        date: todayStr(),
        distance_miles: Math.round(dist * 10) / 10,
        certainty_tier: tier,
        certainty_label: tierLabel(tier),
        certainty_score: certaintyScore,
        reliability_tier: reliabilityTier,
        preference_match: prefMatch,
        score: Math.round(score * 1000) / 1000,
        source: 'confirmed',
        actions: ['directions', 'alert', 'calendar'],
      });
    }

    // Forecast predictions (future days)
    const forecast = forecastMap.get(store.slug);
    if (forecast?.predictions) {
      const forecastAgeHours = forecastAgeInHours(forecast.generated_at);
      for (const pred of forecast.predictions.slice(0, 5)) {
        const tier = determineCertaintyTier({
          hasConfirmed: false,
          hasForecast: true,
          probability: pred.probability || 0,
          historyDepth: forecast.history_depth || 0,
          forecastAgeHours,
          reliabilityTier,
        });
        if (tier === TIERS.NONE) continue;

        const certaintyScore = certaintyCap(tier, pred.probability);
        const prefMatch =
          prefNorms.length > 0 &&
          prefNorms.some((p) => matchesFlavor(pred.flavor, p));

        const score = scoreRecommendation({
          certaintyScore,
          distanceMiles: dist,
          maxRadius,
          rarityPercentile: 0,
          preferenceMatch: prefMatch,
        });

        recommendations.push({
          slug: store.slug,
          name: store.name,
          address: store.address,
          flavor: pred.flavor,
          description: '',
          date: forecast.date || null,
          distance_miles: Math.round(dist * 10) / 10,
          certainty_tier: tier,
          certainty_label: tierLabel(tier),
          certainty_score: certaintyScore,
          reliability_tier: reliabilityTier,
          preference_match: prefMatch,
          probability: pred.probability,
          score: Math.round(score * 1000) / 1000,
          source: 'forecast',
          actions: ['alert', 'calendar'],
        });
      }
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Top results + alternatives
  const top = recommendations.slice(0, 10);
  const alts = recommendations.slice(10, 20);

  return { recommendations: top, alternatives: alts };
}

// --- Enrichment helpers ---

/**
 * Batch-fetch reliability data for a set of slugs.
 * @param {Object} db - D1 binding
 * @param {string[]} slugs
 * @returns {Promise<Map<string,Object>>}
 */
export async function fetchReliabilityMap(db, slugs) {
  const map = new Map();
  if (!db) return map;

  // Fetch in parallel, swallow individual errors
  const results = await Promise.allSettled(
    slugs.map((slug) => getReliability(db, slug).then((r) => [slug, r]))
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value[1]) {
      map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

/**
 * Batch-fetch forecast data for a set of slugs.
 * @param {Object} env - Worker env bindings
 * @param {string[]} slugs
 * @returns {Promise<Map<string,Object>>}
 */
export async function fetchForecastMap(env, slugs) {
  const map = new Map();
  const results = await Promise.allSettled(
    slugs.map((slug) =>
      getForecastData(slug, env).then((r) => [slug, r?.forecast])
    )
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value[1]) {
      map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

// --- API handler ---

/**
 * Handle GET /api/plan requests.
 *
 * Required params:
 *   location - zip, city, or "lat,lon"
 *
 * Optional params:
 *   radius   - miles (default 25, max 100)
 *   flavors  - comma-separated preferred flavors
 *   limit    - max stores from locator (default 25, max 50)
 *
 * @param {URL} url
 * @param {Object} env
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handlePlan(url, env, corsHeaders) {
  const location = url.searchParams.get('location');
  if (!location || !location.trim()) {
    return Response.json(
      { error: 'Missing required "location" parameter. Usage: /api/v1/plan?location=<zip|city|lat,lon>' },
      { status: 400, headers: corsHeaders }
    );
  }

  const radius = Math.min(Math.max(parseFloat(url.searchParams.get('radius')) || 25, 1), 100);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 25, 1), 50);
  const flavorsParam = url.searchParams.get('flavors') || '';
  const preferredFlavors = flavorsParam
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  // Step 1: Get nearby stores from locator API (with today's confirmed flavor)
  const kv = env.FLAVOR_CACHE;
  const cacheKey = `locator:${location.trim().toLowerCase()}:${limit}`;
  let locatorData;

  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    locatorData = JSON.parse(cached);
  } else {
    const locatorUrl = `https://www.culvers.com/api/locator/getLocations?location=${encodeURIComponent(location.trim())}&limit=${limit}`;
    const fetchFn = env._fetchOverride || globalThis.fetch;
    let resp;
    try {
      resp = await fetchFn(locatorUrl);
    } catch {
      return Response.json(
        { error: 'Failed to reach upstream locator API' },
        { status: 502, headers: corsHeaders }
      );
    }
    if (!resp.ok) {
      return Response.json(
        { error: `Upstream locator returned ${resp.status}` },
        { status: 502, headers: corsHeaders }
      );
    }
    locatorData = await resp.json();

    if (kv) {
      try {
        await kv.put(cacheKey, JSON.stringify(locatorData), { expirationTtl: 3600 });
      } catch { /* best-effort */ }
    }
  }

  // Transform into our store format
  const stores = transformLocatorStores(locatorData);
  if (stores.length === 0) {
    return Response.json(
      { query: { location: location.trim(), radius, flavors: preferredFlavors }, recommendations: [], alternatives: [] },
      { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' } }
    );
  }

  // Resolve user lat/lon from first store (locator returns by proximity)
  const userLat = parseFloat(url.searchParams.get('lat')) || stores[0].lat;
  const userLon = parseFloat(url.searchParams.get('lon')) || stores[0].lon;

  // Step 2: Enrich with reliability + forecast
  const slugs = stores.map((s) => s.slug);
  const [reliabilityMap, forecastMap] = await Promise.all([
    fetchReliabilityMap(env.DB, slugs),
    fetchForecastMap(env, slugs),
  ]);

  // Step 3: Score and rank
  const result = buildRecommendations({
    stores,
    userLat,
    userLon,
    maxRadius: radius,
    reliabilityMap,
    forecastMap,
    preferredFlavors,
  });

  return Response.json(
    {
      query: { location: location.trim(), radius, flavors: preferredFlavors, lat: userLat, lon: userLon },
      ...result,
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}

// --- Internal helpers ---

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculate hours since a forecast was generated.
 * @param {string|undefined} generatedAt - ISO timestamp
 * @returns {number|undefined} Hours elapsed, or undefined if no timestamp
 */
function forecastAgeInHours(generatedAt) {
  if (!generatedAt) return undefined;
  const ms = Date.now() - new Date(generatedAt).getTime();
  return ms / (1000 * 60 * 60);
}

/**
 * Transform locator API response into planner store format.
 * Same shape as index.js transformLocatorData but kept local to avoid coupling.
 */
function transformLocatorStores(data) {
  const geofences = data?.data?.geofences || [];
  return geofences.map((g, i) => {
    const meta = g.metadata || {};
    const city = meta.city || '';
    const state = meta.state || '';
    return {
      slug: meta.slug || '',
      name: city && state ? `${city}, ${state}` : city || meta.slug || '',
      address: meta.street || '',
      lat: g.geometryCenter?.coordinates?.[1] || 0,
      lon: g.geometryCenter?.coordinates?.[0] || 0,
      flavor: meta.flavorOfDayName || '',
      description: meta.flavorOfTheDayDescription || '',
      rank: i + 1,
    };
  });
}
