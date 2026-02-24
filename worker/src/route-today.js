import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { normalize } from './flavor-matcher.js';
import { isValidSlug } from './slug-validation.js';
import { getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';

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

    // Find today's flavor (or fall back to the first available)
    const todayFlavor = data.flavors.find(f => f.date === today) || data.flavors[0] || null;

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
    let spoken = `Today the flavor of the day at ${spokenStore} is ${flavorName}`;
    if (todayFlavor.description) {
      const desc = todayFlavor.description.replace(/\.+$/, '');
      spoken += ' - ' + desc;
    }
    spoken += '.';

    const spokenDate = formatSpeechDate(todayFlavor.date);
    const spokenLocation = storeEntry
      ? `${storeEntry.city}, ${storeEntry.state}`
      : data.name;
    let spokenVerbose = `For ${spokenDate}, ${spokenStore} is serving ${flavorName}.`;
    if (todayFlavor.description) {
      const desc = todayFlavor.description.replace(/\.+$/, '');
      spokenVerbose += ` ${desc}.`;
    }
    spokenVerbose += ` Location: ${spokenLocation}.`;

    const nextFlavor = (data.flavors || [])
      .filter((f) => f && f.date && f.date > todayFlavor.date && f.title)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (nextFlavor) {
      spokenVerbose += ` Next listed flavor is ${nextFlavor.title} on ${formatSpeechDate(nextFlavor.date)}.`;
    }

    // Compute rarity from D1 snapshots (best-effort, never breaks response)
    let rarity = null;
    try {
      if (env.DB) {
        const normalizedFlavor = normalize(flavorName);

        // Query 1: this flavor's appearance dates at this store
        const flavorDates = await env.DB.prepare(
          'SELECT date FROM snapshots WHERE slug = ? AND normalized_flavor = ? ORDER BY date ASC'
        ).bind(slug, normalizedFlavor).all();

        // Query 2: all flavor counts at this store (for percentile ranking)
        const allCounts = await env.DB.prepare(
          'SELECT normalized_flavor, COUNT(*) as cnt FROM snapshots WHERE slug = ? GROUP BY normalized_flavor'
        ).bind(slug).all();

        if (flavorDates.results && flavorDates.results.length > 0 && allCounts.results && allCounts.results.length > 0) {
          const appearances = flavorDates.results.length;

          // Compute average gap between consecutive appearances
          let avgGapDays = null;
          if (appearances >= 2) {
            const dates = flavorDates.results.map(r => new Date(r.date + 'T00:00:00Z'));
            let totalGap = 0;
            for (let i = 1; i < dates.length; i++) {
              totalGap += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
            }
            avgGapDays = Math.round(totalGap / (dates.length - 1));
          }

          // Percentile ranking: where does this flavor's count fall among all flavors?
          const thisCnt = appearances;
          const counts = allCounts.results.map(r => r.cnt).sort((a, b) => a - b);
          const rank = counts.filter(c => c < thisCnt).length;
          const percentile = rank / counts.length;

          let label = null;
          if (percentile < 0.10) label = 'Ultra Rare';
          else if (percentile < 0.25) label = 'Rare';
          else if (percentile < 0.50) label = 'Uncommon';
          else if (percentile < 0.75) label = 'Common';
          else label = 'Staple';

          rarity = { appearances, avg_gap_days: avgGapDays, label };
        }
      }
    } catch (_) {
      // D1 failure is non-fatal; rarity stays null
    }

    // Append rarity info to spoken text for rare flavors
    if (rarity && rarity.avg_gap_days && (rarity.label === 'Ultra Rare' || rarity.label === 'Rare')) {
      spoken = spoken.replace(/\.$/, '');
      spoken += `. This flavor averages ${rarity.avg_gap_days} days between appearances at your store.`;
      spokenVerbose += ` This flavor averages ${rarity.avg_gap_days} days between appearances at your store.`;
    }

    return Response.json({
      store: data.name,
      slug,
      brand,
      date: todayFlavor.date,
      flavor: flavorName,
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
