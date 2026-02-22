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
import { sendAlertEmail } from './email-sender.js';
import { accumulateFlavors } from './flavor-catalog.js';

/**
 * Main scheduled handler — called by Cloudflare Worker cron trigger.
 * @param {Object} env - Worker environment bindings
 * @param {Function} getFlavorsCachedFn - Flavor fetcher (injected for testing)
 */
export async function checkAlerts(env, getFlavorsCachedFn) {
  const kv = env.FLAVOR_CACHE;
  const apiKey = env.RESEND_API_KEY;
  const fromAddress = env.ALERT_FROM_EMAIL || 'alerts@custard-calendar.com';
  const baseUrl = env.WORKER_BASE_URL || 'https://custard-calendar.chris-kaschner.workers.dev';

  if (!apiKey) {
    console.log('RESEND_API_KEY not configured, skipping alert check');
    return { sent: 0, checked: 0, errors: [] };
  }

  // List all active subscriptions
  const subscriptions = await listAllSubscriptions(kv);
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
  const allNewFlavors = [];

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
    for (const flavor of upcomingFlavors) {
      for (const fav of sub.favorites) {
        if (matchesFlavor(flavor.title, fav, flavor.description)) {
          // Check dedup
          const dedupKey = `alert:sent:${sub.id}:${flavor.date}:${normalize(flavor.title)}`;
          const alreadySent = await kv.get(dedupKey);
          if (!alreadySent) {
            matches.push(flavor);
            // Write dedup key with 7-day TTL
            await kv.put(dedupKey, '1', { expirationTtl: 604800 });
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
    try {
      const result = await sendAlertEmail(
        {
          email: sub.email,
          storeName: storeData.name || sub.slug,
          storeAddress: storeData.address || '',
          matches,
          statusUrl,
          unsubscribeUrl,
        },
        apiKey,
        fromAddress,
      );

      if (result.ok) {
        sent++;
      } else {
        errors.push(`${sub.email}/${sub.slug}: ${result.error}`);
      }
    } catch (err) {
      errors.push(`${sub.email}/${sub.slug}: ${err.message}`);
    }
  }

  // Accumulate new flavors into catalog
  await accumulateFlavors(kv, allNewFlavors);

  // Write run metadata
  await writeRunMetadata(kv, subscriptions.length, sent);

  return { sent, checked: subscriptions.length, errors };
}

/**
 * List all active subscriptions from KV.
 * Uses KV list with prefix and paginates with cursor.
 * @param {Object} kv
 * @returns {Promise<Array<{id: string, email: string, slug: string, favorites: string[], unsubToken: string}>>}
 */
async function listAllSubscriptions(kv) {
  const subs = [];
  let cursor = undefined;

  do {
    const opts = { prefix: 'alert:sub:', limit: 1000 };
    if (cursor) opts.cursor = cursor;

    const list = await kv.list(opts);

    for (const key of list.keys) {
      const raw = await kv.get(key.name);
      if (raw) {
        try {
          const sub = JSON.parse(raw);
          sub.id = key.name.replace('alert:sub:', '');
          subs.push(sub);
        } catch {
          // Skip corrupted entries
        }
      }
    }

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return subs;
}

/**
 * Write metadata about the latest alert run for health monitoring.
 */
async function writeRunMetadata(kv, checked, sent) {
  await kv.put('meta:last-alert-run', JSON.stringify({
    timestamp: new Date().toISOString(),
    checked,
    sent,
  }));
}
