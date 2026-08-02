import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { normalize } from './flavor-matcher.js';
import { isValidSlug } from './slug-validation.js';
import { getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';
import { computeGapStats, queryDatesForSlugs, computeGapStatsPerSlug } from './metrics.js';
import { WI_METRO_MAP } from './leaderboard.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';

const CACHE_MAX_AGE = 3600; // 1 hour (browser + edge cache)

/**
 * Handle /api/today?slug=<slug> requests.
 * Returns today's single flavor for a store, with a pre-composed spoken sentence
 * for voice assistants (Siri Shortcuts, Alexa, etc.).
 */
export async function handleApiToday(url, env, corsHeaders, fetchFlavorsFn = defaultFetchFlavors) {
  const isOverride = fetchFlavorsFn !== defaultFetchFlavors;
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;

  const slug = url.searchParams.get('slug');
  if (!slug) {
    return Response.json(
      { error: 'Missing required "slug" parameter. Usage: /api/today?slug=<store-slug>' },
      { status: 400, headers: corsHeaders }
    );
  }

  const check = isValidSlug(slug, validSlugs);
  if (!check.valid) {
    return Response.json(
      { error: `Invalid store: ${check.reason}` },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
    const brand = getBrandForSlug(slug);
    const today = new Date().toISOString().slice(0, 10);
    const formatSpeechDate = (isoDate) => {
      const d = new Date((isoDate || today) + 'T12:00:00Z');
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    };

    // Find today's flavors -- some brands (Kopp's) serve multiple per day
    const todayFlavors = data.flavors.filter(f => f.date === today);
    if (todayFlavors.length === 0) {
      // Fall back to the first available date's flavors
      const firstDate = data.flavors[0]?.date;
      if (firstDate) todayFlavors.push(...data.flavors.filter(f => f.date === firstDate));
    }
    const todayFlavor = todayFlavors[0] || null;

    if (!todayFlavor) {
      const spokenMissing = `I couldn't find today's flavor of the day at ${data.name}. Check back later.`;
      return Response.json({
        store: data.name,
        slug,
        brand,
        date: today,
        flavor: null,
        description: null,
        spoken: spokenMissing,
        spoken_verbose: `${spokenMissing} Try again later today for an updated flavor listing.`,
      }, {
        headers: { ...corsHeaders, 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` },
      });
    }

    const flavorName = todayFlavor.title;
    // Build a short spoken store name: "Culver's of Mt. Horeb" instead of the
    // verbose upstream name ("Culver's of Mt. Horeb, WI - Springdale St").
    const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
    const storeEntry = storeIndex.find(s => s.slug === slug);
    const spokenStore = storeEntry ? `${brand} of ${storeEntry.city}` : data.name;
    // Placeholder days have no flavor name. Slotting the placeholder title into
    // the usual sentence produces "the flavor of the day is Not yet announced",
    // which a listener hears as a flavor called "Not yet announced".
    const isPremiere = todayFlavor.source === 'premiere';
    let spoken;
    if (todayFlavors.length > 1) {
      const names = todayFlavors.map(f => f.title);
      spoken = `Today the flavors at ${spokenStore} are ${names.join(' and ')}.`;
    } else if (isPremiere) {
      spoken = `${spokenStore} hasn't announced today's flavor yet.`;
    } else {
      spoken = `Today the flavor of the day at ${spokenStore} is ${flavorName}`;
      if (todayFlavor.description) {
        const desc = todayFlavor.description.replace(/\.+$/, '');
        spoken += ' - ' + desc;
      }
      spoken += '.';
    }

    const spokenDate = formatSpeechDate(todayFlavor.date);
    const spokenLocation = storeEntry
      ? `${storeEntry.city}, ${storeEntry.state}`
      : data.name;
    let spokenVerbose;
    if (isPremiere) {
      // The placeholder description repeats this in prose, so skip appending it.
      spokenVerbose = `For ${spokenDate}, ${spokenStore} hasn't announced a flavor yet.`;
    } else {
      spokenVerbose = `For ${spokenDate}, ${spokenStore} is serving ${flavorName}.`;
      if (todayFlavor.description) {
        const desc = todayFlavor.description.replace(/\.+$/, '');
        spokenVerbose += ` ${desc}.`;
      }
    }
    spokenVerbose += ` Location: ${spokenLocation}.`;

    // Placeholders are not a "next listed flavor" -- naming one would say
    // "Next listed flavor is Not yet announced on Wednesday".
    const nextFlavor = (data.flavors || [])
      .filter((f) => f && f.date && f.date > todayFlavor.date && f.title && f.source !== 'premiere')
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (nextFlavor) {
      spokenVerbose += ` Next listed flavor is ${nextFlavor.title} on ${formatSpeechDate(nextFlavor.date)}.`;
    }

    // Compute rarity from D1 snapshots with hierarchical scope fallback.
    // When a store has insufficient data (<10 appearances or <90-day span),
    // fall back through metro -> state -> national scopes (D-01, D-02).
    let rarity = null;
    try {
      if (env.DB) {
        const normalizedFlavor = normalize(flavorName);
        const STORE_INDEX = env._storeIndexOverride || DEFAULT_STORE_INDEX;

        // --- Store scope queries (existing pattern, unchanged) ---
        const flavorDates = await env.DB.prepare(
          'SELECT date FROM snapshots WHERE slug = ? AND normalized_flavor = ? ORDER BY date ASC'
        ).bind(slug, normalizedFlavor).all();

        const allCounts = await env.DB.prepare(
          'SELECT normalized_flavor, COUNT(*) as cnt FROM snapshots WHERE slug = ? GROUP BY normalized_flavor'
        ).bind(slug).all();

        if (flavorDates.results && flavorDates.results.length > 0 && allCounts.results && allCounts.results.length > 0) {
          const storeAppearances = flavorDates.results.length;
          const dates = flavorDates.results.map(r => r.date);
          const parsedDates = dates.map(d => new Date(d + 'T00:00:00Z'));

          // Gate 1 (store): 10 appearances AND 90+ day span (per D-03)
          const spanDays = storeAppearances >= 2
            ? (parsedDates[parsedDates.length - 1] - parsedDates[0]) / 86400000
            : 0;
          const storeHasSufficientData = storeAppearances >= 10 && spanDays >= 90;

          // Gate 2: network-wide suppression
          // Disabled: with ~800+ Culver's locations, even rare flavors appear
          // at 600+ stores in any 30-day window. The avg_gap_days thresholds
          // already handle frequency -- this gate added no signal.
          const meetsNetworkGate = true;

          // Compute store-scope gap stats
          const storeGapStats = computeGapStats(dates);

          let effectiveScope = null;
          let effectiveAppearances = storeGapStats.appearances;
          let effectiveAvgGap = storeGapStats.avg_gap_days;

          if (storeHasSufficientData) {
            // Per D-10: store has enough data, use it directly
            effectiveScope = 'store';
          } else {
            // Per D-02: early-exit fallback through wider scopes
            // Per D-03: 30-appearance minimum for wider scopes
            const MIN_WIDER_APPEARANCES = 30;
            const hierStoreEntry = STORE_INDEX.find(s => s.slug === slug);
            const storeCity = (hierStoreEntry?.city || '').toLowerCase().trim();
            const storeState = hierStoreEntry?.state || null;

            // Metro scope
            const metro = storeCity ? (WI_METRO_MAP[storeCity] || null) : null;
            if (!effectiveScope && metro && metro !== 'other') {
              try {
                const metroSlugs = STORE_INDEX
                  .filter(s => WI_METRO_MAP[(s.city || '').toLowerCase().trim()] === metro)
                  .map(s => s.slug);
                const rows = await queryDatesForSlugs(env.DB, metroSlugs, normalizedFlavor);
                const stats = computeGapStatsPerSlug(rows);
                if (stats.appearances >= MIN_WIDER_APPEARANCES) {
                  effectiveScope = 'metro';
                  effectiveAppearances = stats.appearances;
                  effectiveAvgGap = stats.avg_gap_days;
                }
              } catch (_) { /* per D-09: non-fatal */ }
            }

            // State scope
            if (!effectiveScope && storeState) {
              try {
                const stateSlugs = STORE_INDEX
                  .filter(s => s.state === storeState)
                  .map(s => s.slug);
                const rows = await queryDatesForSlugs(env.DB, stateSlugs, normalizedFlavor);
                const stats = computeGapStatsPerSlug(rows);
                if (stats.appearances >= MIN_WIDER_APPEARANCES) {
                  effectiveScope = 'state';
                  effectiveAppearances = stats.appearances;
                  effectiveAvgGap = stats.avg_gap_days;
                }
              } catch (_) { /* per D-09: non-fatal */ }
            }

            // National scope (from seed, no D1 query)
            if (!effectiveScope) {
              const seed = TRIVIA_METRICS_SEED || {};
              const lookup = seed?.planner_features?.flavor_lookup || {};
              const seedRow = lookup[normalizedFlavor] || null;
              if (seedRow) {
                const seedAppearances = Number(seedRow.appearances || 0);
                if (seedAppearances >= MIN_WIDER_APPEARANCES) {
                  const storeCount = Number(seedRow.store_count || 1);
                  const summary = seed.dataset_summary || {};
                  let seedAvgGap = null;
                  if (seedAppearances > 0 && storeCount > 0 && summary.min_date && summary.max_date) {
                    const seedSpan = (new Date(summary.max_date) - new Date(summary.min_date)) / 86400000;
                    const appsPerStore = seedAppearances / storeCount;
                    if (appsPerStore > 0) seedAvgGap = Math.round(seedSpan / appsPerStore);
                  }
                  effectiveScope = 'national';
                  effectiveAppearances = seedAppearances;
                  effectiveAvgGap = seedAvgGap;
                }
              }
            }
          }

          // Gate 3: derive label from avg_gap_days (per D-04: same thresholds all scopes)
          let label = null;
          if (effectiveScope && meetsNetworkGate && effectiveAvgGap !== null) {
            if (effectiveAvgGap > 150) label = 'Ultra Rare';
            else if (effectiveAvgGap > 90) label = 'Rare';
          }

          // Per D-07: include scope in rarity object
          rarity = {
            appearances: effectiveAppearances,
            avg_gap_days: effectiveAvgGap,
            label,
            scope: effectiveScope,
          };
        }
      }
    } catch (_) {
      // D1 failure is non-fatal; rarity stays null
    }

    // Append rarity info to spoken text for rare flavors (scope-aware phrasing)
    if (rarity && rarity.avg_gap_days && (rarity.label === 'Ultra Rare' || rarity.label === 'Rare')) {
      spoken = spoken.replace(/\.$/, '');
      const scopePhrase = rarity.scope === 'store' ? 'at your store'
        : rarity.scope === 'metro' ? 'in your area'
        : rarity.scope === 'state' ? 'statewide'
        : 'nationwide';
      spoken += `. This flavor averages ${rarity.avg_gap_days} days between appearances ${scopePhrase}.`;
      spokenVerbose += ` This flavor averages ${rarity.avg_gap_days} days between appearances ${scopePhrase}.`;
    }

    // Build flavors array for multi-flavor stores (Kopp's serves 2 per day)
    const allFlavors = todayFlavors.map(f => ({
      name: f.title,
      description: f.description || null,
    }));

    return Response.json({
      store: data.name,
      slug,
      brand,
      date: todayFlavor.date,
      flavor: flavorName,
      flavors: allFlavors.length > 1 ? allFlavors : undefined,
      description: todayFlavor.description || null,
      rarity,
      spoken,
      spoken_verbose: spokenVerbose,
    }, {
      headers: { ...corsHeaders, 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` },
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch flavor data. Please try again later.' },
      { status: 502, headers: corsHeaders }
    );
  }
}
