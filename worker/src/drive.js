import { STORE_COORDS } from './store-coords.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';
import { getForecastData } from './forecast.js';
import { normalize } from './flavor-matcher.js';
import { haversine, handlePlan } from './planner.js';
import { buildDealbreakers, buildVibeTags, extractFlavorTags } from './flavor-tags.js';

const SORT_MODES = new Set(['match', 'detour', 'rarity', 'eta']);
const HARD_EXCLUDE_TAGS = new Set(['nuts', 'cheesecake']);
const BOOST_TAGS = new Set(['chocolate', 'fruit', 'caramel', 'mint', 'coffee', 'seasonal', 'kids']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseCsvList(raw, allowSet = null) {
  if (!raw || typeof raw !== 'string') return [];
  const seen = new Set();
  const values = [];
  for (const part of raw.split(',')) {
    const cleaned = String(part || '').trim().toLowerCase();
    if (!cleaned || seen.has(cleaned)) continue;
    if (allowSet && !allowSet.has(cleaned)) continue;
    seen.add(cleaned);
    values.push(cleaned);
  }
  return values;
}

function parseSlugs(raw, validSlugs) {
  if (!raw || typeof raw !== 'string') return [];
  const seen = new Set();
  const slugs = [];
  for (const part of raw.split(',')) {
    const slug = String(part || '').trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    if (!validSlugs.has(slug)) continue;
    // Phase 1 scope: Culver's only.
    if (getBrandForSlug(slug) !== "Culver's") continue;
    slugs.push(slug);
  }
  return slugs;
}

function parseLocation(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function fetchFlavorCadence(db, slug, flavorName) {
  if (!db || !flavorName) {
    return {
      appearances: 0,
      avg_gap_days: null,
      last_seen: null,
      days_since_last: null,
      novelty: false,
    };
  }

  try {
    const normalizedFlavor = normalize(flavorName);
    if (!normalizedFlavor) {
      return {
        appearances: 0,
        avg_gap_days: null,
        last_seen: null,
        days_since_last: null,
        novelty: false,
      };
    }

    const rows = await db.prepare(
      'SELECT date FROM snapshots WHERE slug = ? AND normalized_flavor = ? ORDER BY date DESC'
    ).bind(slug, normalizedFlavor).all();

    const dates = (rows?.results || []).map((row) => row.date).filter(Boolean);
    const appearances = dates.length;
    if (appearances === 0) {
      return {
        appearances: 0,
        avg_gap_days: null,
        last_seen: null,
        days_since_last: null,
        novelty: true,
      };
    }

    const lastSeen = dates[0];
    const daysSinceLast = Math.max(0, Math.round((Date.now() - new Date(`${lastSeen}T00:00:00Z`).getTime()) / 86400000));

    let avgGapDays = null;
    if (dates.length > 1) {
      let totalGap = 0;
      for (let i = 0; i < dates.length - 1; i++) {
        const newer = new Date(`${dates[i]}T00:00:00Z`);
        const older = new Date(`${dates[i + 1]}T00:00:00Z`);
        totalGap += Math.max(0, Math.round((newer - older) / 86400000));
      }
      avgGapDays = Math.round(totalGap / (dates.length - 1));
    }

    return {
      appearances,
      avg_gap_days: avgGapDays,
      last_seen: lastSeen,
      days_since_last: daysSinceLast,
      novelty: daysSinceLast >= 30,
    };
  } catch {
    return {
      appearances: 0,
      avg_gap_days: null,
      last_seen: null,
      days_since_last: null,
      novelty: false,
    };
  }
}

function scoreBucket(score) {
  if (score >= 70) return 'great';
  if (score >= 45) return 'ok';
  return 'pass';
}

function buildRecommendationLine({ flavorName, dealbreakers, matchedBoostTags, matchedAvoidTags, novelty, avgGapDays }) {
  const parts = [];
  if (flavorName) parts.push(flavorName);
  if (matchedBoostTags.length > 0) parts.push(`matches ${matchedBoostTags.join(', ')}`);
  if (matchedAvoidTags.length > 0) parts.push(`avoid signal: ${matchedAvoidTags.join(', ')}`);
  if (dealbreakers.length > 0) parts.push(dealbreakers.join(', '));
  if (novelty) parts.push('new to this store');
  if (Number.isFinite(avgGapDays) && avgGapDays > 0) parts.push(`rare cadence ~${avgGapDays}d`);
  return parts.join('; ');
}

function formatEtaMinutes(distanceMiles) {
  if (!Number.isFinite(distanceMiles)) return null;
  return Math.max(3, Math.round(distanceMiles * 2.2 + 2));
}

function sortCards(cards, sortMode) {
  const list = [...cards];
  if (sortMode === 'detour') {
    list.sort((a, b) => (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999));
    return list;
  }
  if (sortMode === 'rarity') {
    list.sort((a, b) => (b.rarity?.avg_gap_days ?? -1) - (a.rarity?.avg_gap_days ?? -1));
    return list;
  }
  if (sortMode === 'eta') {
    list.sort((a, b) => (a.eta_minutes ?? 9999) - (b.eta_minutes ?? 9999));
    return list;
  }
  list.sort((a, b) => b.score - a.score);
  return list;
}

async function fetchNearbyLeaderboard({ env, corsHeaders, location, radius, selectedSlugs }) {
  if (!location) return [];
  try {
    const planUrl = new URL('https://internal.local/api/v1/plan');
    planUrl.searchParams.set('location', `${location.lat},${location.lon}`);
    planUrl.searchParams.set('radius', String(radius));
    planUrl.searchParams.set('limit', '25');
    const planResponse = await handlePlan(planUrl, env, corsHeaders);
    if (!planResponse.ok) return [];
    const planJson = await planResponse.json();
    const candidates = [...(planJson.recommendations || []), ...(planJson.alternatives || [])];
    const confirmed = candidates.filter((row) => row.certainty_tier === 'confirmed');
    const primary = confirmed.length > 0 ? confirmed : candidates;
    return primary
      .filter((row) => !selectedSlugs.has(row.slug))
      .slice(0, 8)
      .map((row) => ({
        slug: row.slug,
        name: row.name,
        flavor: row.flavor,
        distance_miles: row.distance_miles,
        certainty_tier: row.certainty_tier,
        score: row.score,
        source: row.source,
      }));
  } catch {
    return [];
  }
}

async function buildCard({
  slug,
  env,
  location,
  excludeTags,
  boostTags,
  avoidTags,
  includeEstimated,
  allowEstimatedFallback,
  includeTomorrow,
}) {
  const coord = STORE_COORDS.get(slug);
  const distanceMiles = location && coord ? haversine(location.lat, location.lon, coord.lat, coord.lng) : null;
  const etaMinutes = formatEtaMinutes(distanceMiles);

  const flavorData = await getFlavorsCached(slug, env.FLAVOR_CACHE, undefined, false, env);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todayEntry = (flavorData.flavors || []).find((entry) => entry.date === today) || null;
  let tomorrowEntry = null;
  if (includeTomorrow) {
    tomorrowEntry = (flavorData.flavors || []).find((entry) => entry.date === tomorrow) || null;
  }

  let flavorName = todayEntry?.title || '';
  let description = todayEntry?.description || '';
  let source = 'confirmed';
  let certaintyTier = 'confirmed';
  let date = todayEntry?.date || today;

  if (!todayEntry && (includeEstimated || allowEstimatedFallback)) {
    const forecast = await getForecastData(slug, env);
    const pred = forecast?.forecast?.predictions?.[0];
    if (pred?.flavor) {
      flavorName = pred.flavor;
      description = '';
      source = 'estimated';
      certaintyTier = 'estimated';
      date = forecast?.forecast?.date || date;
    }
  }

  if (!flavorName) {
    return {
      type: 'excluded',
      value: {
        slug,
        name: coord?.name || flavorData.name || slug,
        address: coord?.address || '',
        reasons: ['No confirmed flavor today.'],
        reason_codes: ['no_confirmed'],
        source: 'none',
      },
    };
  }

  const tags = extractFlavorTags(flavorName, description);
  const matchedExcluded = excludeTags.filter((tag) => tags.includes(tag) && HARD_EXCLUDE_TAGS.has(tag));
  const matchedBoostTags = boostTags.filter((tag) => tags.includes(tag));
  const matchedAvoidTags = avoidTags.filter((tag) => tags.includes(tag));
  const vibes = buildVibeTags(tags);
  const dealbreakers = buildDealbreakers(matchedExcluded);

  const rarity = await fetchFlavorCadence(env.DB, slug, flavorName);
  const rarityBonus = clamp(Math.round((rarity.avg_gap_days || 0) / 7), 0, 18);
  const noveltyBonus = rarity.novelty ? 10 : 0;
  const detourPenalty = Number.isFinite(distanceMiles) ? clamp(Math.round(distanceMiles * 1.5), 0, 20) : 0;
  const scoreBeforeClamp = 50
    + (matchedBoostTags.length * 12)
    + rarityBonus
    + noveltyBonus
    - (matchedAvoidTags.length * 8)
    - detourPenalty;
  const score = clamp(scoreBeforeClamp, 0, 100);
  const hardPass = matchedExcluded.length > 0;
  const mapBucket = hardPass ? 'hard_pass' : scoreBucket(score);
  const recommendation = buildRecommendationLine({
    flavorName,
    dealbreakers,
    matchedBoostTags,
    matchedAvoidTags,
    novelty: rarity.novelty,
    avgGapDays: rarity.avg_gap_days,
  });

  const card = {
    slug,
    name: coord?.name || flavorData.name || slug,
    address: coord?.address || '',
    lat: coord?.lat ?? null,
    lon: coord?.lng ?? null,
    flavor: flavorName,
    description,
    date,
    source,
    certainty_tier: certaintyTier,
    tags,
    vibe: vibes,
    dealbreakers,
    recommendation,
    distance_miles: Number.isFinite(distanceMiles) ? Math.round(distanceMiles * 10) / 10 : null,
    eta_minutes: etaMinutes,
    rarity: {
      avg_gap_days: rarity.avg_gap_days,
      days_since_last: rarity.days_since_last,
      last_seen: rarity.last_seen,
      novelty_bonus_applied: rarity.novelty,
    },
    score,
    score_breakdown: {
      base: 50,
      boost: matchedBoostTags.length * 12,
      rarity_bonus: rarityBonus,
      novelty_bonus: noveltyBonus,
      avoid_penalty: matchedAvoidTags.length * 8,
      detour_penalty: detourPenalty,
      matched_boost_tags: matchedBoostTags,
      matched_avoid_tags: matchedAvoidTags,
      matched_exclude_tags: matchedExcluded,
    },
    map_bucket: mapBucket,
  };
  if (includeTomorrow) {
    card.tomorrow = tomorrowEntry && tomorrowEntry.title
      ? {
          date: tomorrowEntry.date,
          flavor: tomorrowEntry.title,
          description: tomorrowEntry.description || '',
          certainty_tier: 'confirmed',
        }
      : null;
  }

  if (hardPass) {
    return {
      type: 'excluded',
      value: {
        slug: card.slug,
        name: card.name,
        address: card.address,
        flavor: card.flavor,
        reasons: card.dealbreakers,
        reason_codes: matchedExcluded,
        source: card.source,
      },
    };
  }

  return { type: 'card', value: card };
}

export async function handleDrive(url, env, corsHeaders) {
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;
  const slugs = parseSlugs(url.searchParams.get('slugs'), validSlugs);
  if (slugs.length < 2 || slugs.length > 5) {
    return Response.json(
      { error: 'Invalid "slugs" parameter. Provide 2 to 5 Culver\'s store slugs.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const locationRaw = url.searchParams.get('location');
  const location = parseLocation(locationRaw);
  if (locationRaw && !location) {
    return Response.json(
      { error: 'Invalid "location" parameter. Expected format: "lat,lon".' },
      { status: 400, headers: corsHeaders },
    );
  }

  const excludeTags = parseCsvList(url.searchParams.get('exclude'), HARD_EXCLUDE_TAGS);
  const boostTags = parseCsvList(url.searchParams.get('boost'), BOOST_TAGS);
  const avoidTags = parseCsvList(url.searchParams.get('avoid'), BOOST_TAGS);
  const sortModeRaw = String(url.searchParams.get('sort') || 'match').toLowerCase();
  const sortMode = SORT_MODES.has(sortModeRaw) ? sortModeRaw : 'match';
  const includeEstimated = String(url.searchParams.get('include_estimated') || '0') === '1';
  const includeTomorrow = String(url.searchParams.get('include_tomorrow') || '0') === '1';
  const radius = clamp(Number.parseInt(url.searchParams.get('radius') || '25', 10) || 25, 1, 100);

  const results = await Promise.all(
    slugs.map((slug) => buildCard({
      slug,
      env,
      location,
      excludeTags,
      boostTags,
      avoidTags,
      includeEstimated,
      allowEstimatedFallback: false,
      includeTomorrow,
    })),
  );

  let cards = results.filter((row) => row.type === 'card').map((row) => row.value);
  const excluded = results.filter((row) => row.type === 'excluded').map((row) => row.value);

  // Confirmed-first default: if none confirmed cards and estimates are not explicitly
  // enabled, run one estimated fallback pass.
  const hasConfirmed = cards.some((row) => row.source === 'confirmed');
  if (!hasConfirmed && !includeEstimated) {
    const fallbackResults = await Promise.all(
      slugs.map((slug) => buildCard({
        slug,
        env,
        location,
        excludeTags,
        boostTags,
        avoidTags,
        includeEstimated: true,
        allowEstimatedFallback: true,
        includeTomorrow,
      })),
    );
    cards = fallbackResults.filter((row) => row.type === 'card').map((row) => row.value);
  }

  cards = sortCards(cards, sortMode);
  const nearbyLeaderboard = await fetchNearbyLeaderboard({
    env,
    corsHeaders,
    location,
    radius,
    selectedSlugs: new Set(slugs),
  });

  return Response.json(
    {
      query: {
        slugs,
        location: location ? `${location.lat},${location.lon}` : null,
        exclude: excludeTags,
        boost: boostTags,
        avoid: avoidTags,
        sort: sortMode,
        include_estimated: includeEstimated ? 1 : 0,
        include_tomorrow: includeTomorrow ? 1 : 0,
        radius,
      },
      cards,
      excluded,
      nearby_leaderboard: nearbyLeaderboard,
      generated_at: new Date().toISOString(),
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=120',
      },
    },
  );
}
