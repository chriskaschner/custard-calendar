/**
 * Alert checker — scheduled cron handler for flavor alert emails.
 *
 * Runs daily at noon UTC. For each active subscription:
 * 1. Fetches upcoming flavors for the subscriber's store (cached)
 * 2. Matches against subscriber's favorites using matchesFlavor()
 * 3. Sends consolidated alert email if any matches found
 * 4. Writes dedup keys to prevent re-emailing
 * 5. Accumulates new flavors into the catalog
 */

import { normalize, matchesFlavor } from './flavor-matcher.js';
import { sendAlertEmail, sendWeeklyDigestEmail } from './email-sender.js';
import { accumulateFlavors } from './flavor-catalog.js';
import { getForecastData } from './forecast.js';
import { listSubscriptions } from './subscription-store.js';
import { computeSignalsFromDb } from './signals.js';

/**
 * Main scheduled handler — called by Cloudflare Worker cron trigger.
 * @param {Object} env - Worker environment bindings
 * @param {Function} getFlavorsCachedFn - Flavor fetcher (injected for testing)
 */
export async function checkAlerts(env, getFlavorsCachedFn) {
  const kv = env.FLAVOR_CACHE;
  const apiKey = env.RESEND_API_KEY;
  const fromAddress = env.ALERT_FROM_EMAIL || 'alerts@custard-calendar.com';
  const baseUrl = env.WORKER_BASE_URL || 'https://custard.chriskaschner.com';

  if (!apiKey) {
    console.log('RESEND_API_KEY not configured, skipping alert check');
    return { sent: 0, checked: 0, errors: [] };
  }

  // List all active subscriptions, filtering to daily-only
  const allSubscriptions = await listSubscriptions(kv);
  const subscriptions = allSubscriptions.filter(sub => (sub.frequency || 'daily') !== 'weekly');
  if (subscriptions.length === 0) {
    await writeRunMetadata(kv, 0, 0);
    return { sent: 0, checked: 0, errors: [] };
  }

  // Group by slug to minimize flavor fetches
  const bySlug = new Map();
  for (const sub of subscriptions) {
    if (!bySlug.has(sub.slug)) {
      bySlug.set(sub.slug, []);
    }
    bySlug.get(sub.slug).push(sub);
  }

  // Fetch flavors per slug (cached — no budget impact for cache hits)
  const flavorsBySlug = new Map();
  const signalsBySlug = new Map();
  const allNewFlavors = [];
  const signalToday = new Date().toISOString().slice(0, 10);

  for (const slug of bySlug.keys()) {
    try {
      const data = await getFlavorsCachedFn(slug, kv);
      flavorsBySlug.set(slug, data);
      // Collect flavors for catalog accumulation
      if (data.flavors) {
        allNewFlavors.push(...data.flavors.map(f => ({ title: f.title, description: f.description || '' })));
      }
    } catch (err) {
      console.error(`Failed to fetch flavors for ${slug}: ${err.message}`);
    }
    // Compute signals once per slug (best-effort, independent of flavor fetch)
    const slugSignals = await computeSignalsFromDb(slug, env, signalToday, 2);
    signalsBySlug.set(slug, slugSignals);
  }

  // Check each subscriber for matches and send emails
  let sent = 0;
  const errors = [];
  const lookAheadDays = 3;

  for (const sub of subscriptions) {
    const storeData = flavorsBySlug.get(sub.slug);
    if (!storeData || !storeData.flavors) continue;

    // Get upcoming flavors (next N days from today)
    const today = new Date();
    const upcomingDates = [];
    for (let i = 0; i <= lookAheadDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      upcomingDates.push(d.toISOString().slice(0, 10));
    }

    const upcomingFlavors = storeData.flavors.filter(f => upcomingDates.includes(f.date));

    // Find matches against favorites
    const matches = [];
    const dedupKeysToWrite = [];
    for (const flavor of upcomingFlavors) {
      for (const fav of sub.favorites) {
        if (matchesFlavor(flavor.title, fav, flavor.description)) {
          // Check dedup
          const dedupKey = `alert:sent:${sub.id}:${flavor.date}:${normalize(flavor.title)}`;
          const alreadySent = await kv.get(dedupKey);
          if (!alreadySent) {
            matches.push(flavor);
            dedupKeysToWrite.push(dedupKey);
          }
          break; // Don't double-match same flavor against multiple favorites
        }
      }
    }

    if (matches.length === 0) continue;

    // Build URLs
    const statusUrl = `${baseUrl}/api/alerts/status?token=${sub.unsubToken}`;
    const unsubscribeUrl = `${baseUrl}/api/alerts/unsubscribe?token=${sub.unsubToken}`;

    // Send consolidated alert email
    const slugSignals = signalsBySlug.get(sub.slug) || [];
    try {
      const result = await sendAlertEmail(
        {
          email: sub.email,
          storeName: storeData.name || sub.slug,
          storeAddress: storeData.address || '',
          matches,
          statusUrl,
          unsubscribeUrl,
          signal: slugSignals[0] || null,
        },
        apiKey,
        fromAddress,
      );

      if (result.ok) {
        for (const dedupKey of dedupKeysToWrite) {
          // Write dedup key with 7-day TTL (best-effort), only after a successful send.
          try {
            await kv.put(dedupKey, '1', { expirationTtl: 604800 });
          } catch (err) {
            console.error(`Dedup key write failed for ${dedupKey}: ${err.message}`);
          }
        }
        sent++;
      } else {
        errors.push(`${sub.email}/${sub.slug}: ${result.error}`);
        // O4: Count email send errors for observability via /health endpoint.
        try {
          const today = new Date().toISOString().slice(0, 10);
          const errKey = `meta:email-errors:${today}`;
          const raw = await kv.get(errKey);
          const cnt = raw ? parseInt(raw, 10) : 0;
          await kv.put(errKey, String(cnt + 1), { expirationTtl: 86400 });
        } catch { /* counter write is best-effort */ }
      }
    } catch (err) {
      errors.push(`${sub.email}/${sub.slug}: ${err.message}`);
    }
  }

  // Accumulate new flavors into catalog
  await accumulateFlavors(kv, allNewFlavors);

  // Write run metadata
  await writeRunMetadata(kv, subscriptions.length, sent);

  return { sent, checked: subscriptions.length, errors, fetchedSlugs: new Set(flavorsBySlug.keys()) };
}

/**
 * Weekly digest handler — called by Sunday cron trigger.
 * Sends a full-week flavor forecast to weekly subscribers.
 * @param {Object} env - Worker environment bindings
 * @param {Function} getFlavorsCachedFn - Flavor fetcher (injected for testing)
 */
export async function checkWeeklyDigests(env, getFlavorsCachedFn) {
  const kv = env.FLAVOR_CACHE;
  const apiKey = env.RESEND_API_KEY;
  const fromAddress = env.ALERT_FROM_EMAIL || 'alerts@custard-calendar.com';
  const baseUrl = env.WORKER_BASE_URL || 'https://custard.chriskaschner.com';

  if (!apiKey) {
    console.log('RESEND_API_KEY not configured, skipping weekly digest');
    return { sent: 0, checked: 0, errors: [] };
  }

  // List all active subscriptions, filtering to weekly-only
  const allSubscriptions = await listSubscriptions(kv);
  const subscriptions = allSubscriptions.filter(sub => sub.frequency === 'weekly');
  if (subscriptions.length === 0) {
    return { sent: 0, checked: 0, errors: [] };
  }

  // Group by slug to minimize flavor fetches
  const bySlug = new Map();
  for (const sub of subscriptions) {
    if (!bySlug.has(sub.slug)) {
      bySlug.set(sub.slug, []);
    }
    bySlug.get(sub.slug).push(sub);
  }

  // Fetch flavors, forecasts, and signals per slug
  const flavorsBySlug = new Map();
  const forecastBySlug = new Map();
  const signalsBySlug = new Map();
  const signalToday = new Date().toISOString().slice(0, 10);
  for (const slug of bySlug.keys()) {
    try {
      const data = await getFlavorsCachedFn(slug, kv);
      flavorsBySlug.set(slug, data);
    } catch (err) {
      console.error(`Weekly digest: failed to fetch flavors for ${slug}: ${err.message}`);
    }
    // Pull pre-computed forecast (best-effort, non-blocking)
    try {
      const { forecast } = await getForecastData(slug, env);
      if (forecast) forecastBySlug.set(slug, forecast);
    } catch {
      // Forecast data is optional -- degrade gracefully
    }
    // Compute signals once per slug (best-effort)
    const slugSignals = await computeSignalsFromDb(slug, env, signalToday, 3);
    signalsBySlug.set(slug, slugSignals);
  }

  // Build week date range (today through next 6 days = 7 days total)
  const today = new Date();
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    weekDates.push(d.toISOString().slice(0, 10));
  }

  let sent = 0;
  const errors = [];

  for (const sub of subscriptions) {
    const storeData = flavorsBySlug.get(sub.slug);
    if (!storeData || !storeData.flavors) continue;

    // Get all flavors for the week
    const weekFlavors = storeData.flavors.filter(f => weekDates.includes(f.date));
    if (weekFlavors.length === 0) continue;

    // Find matches against favorites
    const matches = [];
    for (const flavor of weekFlavors) {
      for (const fav of sub.favorites) {
        if (matchesFlavor(flavor.title, fav, flavor.description)) {
          matches.push(flavor);
          break;
        }
      }
    }

    // Build URLs
    const statusUrl = `${baseUrl}/api/alerts/status?token=${sub.unsubToken}`;
    const unsubscribeUrl = `${baseUrl}/api/alerts/unsubscribe?token=${sub.unsubToken}`;

    // Send weekly digest (even if no matches — the full week forecast is the value)
    const forecast = forecastBySlug.get(sub.slug) || null;
    const slugSignals = signalsBySlug.get(sub.slug) || [];
    try {
      const result = await sendWeeklyDigestEmail(
        {
          email: sub.email,
          storeName: storeData.name || sub.slug,
          storeAddress: storeData.address || '',
          matches,
          allFlavors: weekFlavors.map(f => ({ title: f.title, date: f.date })),
          statusUrl,
          unsubscribeUrl,
          narrative: forecast ? forecast.prose : null,
          forecast,
          signals: slugSignals.slice(0, 2),
        },
        apiKey,
        fromAddress,
      );

      if (result.ok) {
        sent++;
      } else {
        errors.push(`${sub.email}/${sub.slug}: ${result.error}`);
        // O4: Count email send errors for observability via /health endpoint.
        try {
          const today = new Date().toISOString().slice(0, 10);
          const errKey = `meta:email-errors:${today}`;
          const raw = await kv.get(errKey);
          const cnt = raw ? parseInt(raw, 10) : 0;
          await kv.put(errKey, String(cnt + 1), { expirationTtl: 86400 });
        } catch { /* counter write is best-effort */ }
      }
    } catch (err) {
      errors.push(`${sub.email}/${sub.slug}: ${err.message}`);
    }
  }

  return { sent, checked: subscriptions.length, errors };
}

/**
 * Write metadata about the latest alert run for health monitoring.
 */
async function writeRunMetadata(kv, checked, sent) {
  try {
    await kv.put('meta:last-alert-run', JSON.stringify({
      timestamp: new Date().toISOString(),
      checked,
      sent,
    }));
  } catch (err) {
    console.error(`Run metadata write failed: ${err.message}`);
  }
}
