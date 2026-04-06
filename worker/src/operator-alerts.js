import { sendEmail } from './email-sender.js';

const DEFAULT_PARSE_FAILURE_THRESHOLD = 3;
const DEFAULT_PAYLOAD_ANOMALY_THRESHOLD = 10;
const DEFAULT_CONSECUTIVE_ERROR_DAYS = 2;
const DEFAULT_MONTH_END_LOOKAHEAD_DAYS = 5;
const DEFAULT_UNKNOWN_FLAVOR_THRESHOLD = 5;
const DEFAULT_DUPLICATE_DAY_THRESHOLD = 1;
const DEFAULT_STALE_STORE_THRESHOLD_DAYS = 7;
const DEFAULT_PRIORITY_SLUGS = ['mt-horeb', 'verona', 'madison-todd-drive'];

function readIntEnv(raw, fallback) {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function firstDayOfNextMonth(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function daysUntilMonthEnd(now) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / msPerDay);
}

function parsePrioritySlugs(env) {
  const raw = env.OPERATOR_PRIORITY_SLUGS || '';
  if (!raw.trim()) return DEFAULT_PRIORITY_SLUGS;
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function readDailyCounter(kv, keyPrefix, dateStr) {
  if (!kv) return 0;
  const raw = await kv.get(`${keyPrefix}:${dateStr}`);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readConsecutiveErrorDays(db, handler, days) {
  if (!db || days <= 0) return 0;
  const result = await db.prepare(
    'SELECT errors_count FROM cron_runs WHERE handler = ? ORDER BY ran_at DESC LIMIT ?'
  ).bind(handler, days).all();
  const rows = result?.results || [];
  let consecutive = 0;
  for (const row of rows) {
    if ((row?.errors_count || 0) > 0) {
      consecutive++;
    } else {
      break;
    }
  }
  return consecutive;
}

async function findCoverageGaps(db, slugs, coversThroughDate) {
  if (!db || !Array.isArray(slugs) || slugs.length === 0) return [];
  const placeholders = slugs.map(() => '?').join(',');
  const result = await db.prepare(
    `SELECT slug, MAX(date) AS max_date
     FROM snapshots
     WHERE slug IN (${placeholders})
     GROUP BY slug`
  ).bind(...slugs).all();

  const maxBySlug = new Map();
  for (const row of result?.results || []) {
    if (row?.slug) {
      maxBySlug.set(row.slug, row.max_date || null);
    }
  }

  const gaps = [];
  for (const slug of slugs) {
    const maxDate = maxBySlug.get(slug) || null;
    if (!maxDate || maxDate < coversThroughDate) {
      gaps.push({ slug, max_date: maxDate });
    }
  }
  return gaps;
}

async function findStaleStores(db, slugs, now, thresholdDays) {
  if (!db || !Array.isArray(slugs) || slugs.length === 0) return [];
  const placeholders = slugs.map(() => '?').join(',');
  const result = await db.prepare(
    `SELECT slug, MAX(date) AS max_date
     FROM snapshots
     WHERE slug IN (${placeholders})
     GROUP BY slug`
  ).bind(...slugs).all();

  const maxBySlug = new Map();
  for (const row of result?.results || []) {
    if (row?.slug) maxBySlug.set(row.slug, row.max_date || null);
  }

  const stale = [];
  const today = now.toISOString().slice(0, 10);
  for (const slug of slugs) {
    const maxDate = maxBySlug.get(slug) || null;
    if (!maxDate) {
      stale.push({ slug, max_date: null, days_stale: null });
      continue;
    }
    const diffMs = new Date(today + 'T00:00:00Z') - new Date(maxDate + 'T00:00:00Z');
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > thresholdDays) {
      stale.push({ slug, max_date: maxDate, days_stale: diffDays });
    }
  }
  return stale;
}

function buildOperatorAlertHtml({ baseUrl, issues, context }) {
  const issueItems = issues.map((issue) => `<li><strong>${issue.title}:</strong> ${issue.detail}</li>`).join('\n');
  const checked = context.checked ?? 0;
  const sent = context.sent ?? 0;
  const errors = context.errors_count ?? 0;
  const ranAt = context.ran_at || new Date().toISOString();

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #a80000;">Custard Calendar Operator Alert</h2>
  <p>One or more reliability thresholds were crossed during the daily cron.</p>
  <ul>${issueItems}</ul>
  <h3 style="margin-top: 20px;">Current run snapshot</h3>
  <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
    <tr><td style="padding: 6px 10px; border: 1px solid #eee;">Ran at</td><td style="padding: 6px 10px; border: 1px solid #eee;">${ranAt}</td></tr>
    <tr><td style="padding: 6px 10px; border: 1px solid #eee;">Subscriptions checked</td><td style="padding: 6px 10px; border: 1px solid #eee;">${checked}</td></tr>
    <tr><td style="padding: 6px 10px; border: 1px solid #eee;">Emails sent</td><td style="padding: 6px 10px; border: 1px solid #eee;">${sent}</td></tr>
    <tr><td style="padding: 6px 10px; border: 1px solid #eee;">Run errors</td><td style="padding: 6px 10px; border: 1px solid #eee;">${errors}</td></tr>
  </table>
  <p style="margin-top: 16px;">
    <a href="${baseUrl}/health" style="color: #005696; text-decoration: underline;">Open /health</a>
    &nbsp;&middot;&nbsp;
    <a href="${baseUrl}/alerts.html" style="color: #005696; text-decoration: underline;">Open Alerts UI</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">This message is generated automatically by the Worker cron operator checks.</p>
</body>
</html>`.trim();
}

/**
 * Evaluate operator alert thresholds and send an email when they are crossed.
 * Runs on daily cron only. Best-effort: never throws.
 */
export async function maybeSendOperatorAlert({ env, handler, result, now = new Date() }) {
  if (handler !== 'daily_alerts') return { sent: false, reason: 'not_daily_handler' };
  if (!env?.FLAVOR_CACHE || !env?.RESEND_API_KEY || !env?.OPERATOR_EMAIL) {
    return { sent: false, reason: 'not_configured' };
  }

  const today = toIsoDate(now);
  const dedupeKey = `meta:operator-alert-sent:${today}`;
  try {
    const alreadySent = await env.FLAVOR_CACHE.get(dedupeKey);
    if (alreadySent) return { sent: false, reason: 'already_sent' };
  } catch {
    // Continue if dedupe read fails; send path remains best-effort.
  }

  const parseThreshold = readIntEnv(env.OPERATOR_PARSE_FAILURE_THRESHOLD, DEFAULT_PARSE_FAILURE_THRESHOLD);
  const anomalyThreshold = readIntEnv(env.OPERATOR_PAYLOAD_ANOMALY_THRESHOLD, DEFAULT_PAYLOAD_ANOMALY_THRESHOLD);
  const consecutiveDaysThreshold = readIntEnv(env.OPERATOR_CONSECUTIVE_ERROR_DAYS, DEFAULT_CONSECUTIVE_ERROR_DAYS);
  const monthEndLookaheadDays = readIntEnv(env.OPERATOR_MONTH_END_LOOKAHEAD_DAYS, DEFAULT_MONTH_END_LOOKAHEAD_DAYS);
  const prioritySlugs = parsePrioritySlugs(env);

  const issues = [];
  try {
    const parseFailures = await readDailyCounter(env.FLAVOR_CACHE, 'meta:parse-fail-count', today);
    if (parseFailures > parseThreshold) {
      issues.push({
        title: 'Parse failures spike',
        detail: `${parseFailures} parse failures today (threshold: ${parseThreshold})`,
      });
    }

    const payloadAnomalies = await readDailyCounter(env.FLAVOR_CACHE, 'meta:payload-anomaly-count', today);
    if (payloadAnomalies > anomalyThreshold) {
      issues.push({
        title: 'Payload anomalies spike',
        detail: `${payloadAnomalies} anomalies today (threshold: ${anomalyThreshold})`,
      });
    }

    const unknownFlavors = await readDailyCounter(env.FLAVOR_CACHE, 'meta:unknown-flavor-count', today);
    const unknownThreshold = readIntEnv(env.OPERATOR_UNKNOWN_FLAVOR_THRESHOLD, DEFAULT_UNKNOWN_FLAVOR_THRESHOLD);
    if (unknownFlavors > unknownThreshold) {
      issues.push({
        title: 'Unknown flavors detected',
        detail: `${unknownFlavors} unknown flavor names today (threshold: ${unknownThreshold}). Review catalog and consider adding to FLAVOR_PROFILES or FLAVOR_ALIASES.`,
      });
    }

    const duplicateDays = await readDailyCounter(env.FLAVOR_CACHE, 'meta:duplicate-day-count', today);
    const dupeThreshold = readIntEnv(env.OPERATOR_DUPLICATE_DAY_THRESHOLD, DEFAULT_DUPLICATE_DAY_THRESHOLD);
    if (duplicateDays > dupeThreshold) {
      issues.push({
        title: 'Duplicate same-day entries',
        detail: `${duplicateDays} stores had duplicate dates in upstream payloads today (threshold: ${dupeThreshold}).`,
      });
    }
  } catch (err) {
    issues.push({
      title: 'Counter read error',
      detail: err.message || 'failed to read health counters',
    });
  }

  try {
    const consecutive = await readConsecutiveErrorDays(env.DB, 'daily_alerts', consecutiveDaysThreshold);
    if (consecutive >= consecutiveDaysThreshold && consecutiveDaysThreshold > 0) {
      issues.push({
        title: 'Consecutive cron error days',
        detail: `${consecutive} consecutive daily runs with errors_count > 0`,
      });
    }
  } catch (err) {
    issues.push({
      title: 'Cron history query error',
      detail: err.message || 'failed to evaluate consecutive cron errors',
    });
  }

  try {
    if (daysUntilMonthEnd(now) <= monthEndLookaheadDays) {
      const nextMonthStart = toIsoDate(firstDayOfNextMonth(now));
      const gaps = await findCoverageGaps(env.DB, prioritySlugs, nextMonthStart);
      if (gaps.length > 0) {
        const detail = gaps
          .map(g => `${g.slug} (max_date=${g.max_date || 'none'})`)
          .join(', ');
        issues.push({
          title: 'Priority-store forward coverage gap',
          detail: `${detail}; expected coverage through ${nextMonthStart}`,
        });
      }
    }
  } catch (err) {
    issues.push({
      title: 'Coverage query error',
      detail: err.message || 'failed to evaluate forward coverage',
    });
  }

  try {
    const staleThreshold = readIntEnv(env.OPERATOR_STALE_STORE_THRESHOLD_DAYS, DEFAULT_STALE_STORE_THRESHOLD_DAYS);
    const staleStores = await findStaleStores(env.DB, prioritySlugs, now, staleThreshold);
    if (staleStores.length > 0) {
      const detail = staleStores
        .map(s => `${s.slug} (last: ${s.max_date || 'never'}, ${s.days_stale ?? '?'} days)`)
        .join(', ');
      issues.push({
        title: 'Stale stores detected',
        detail: `${staleStores.length} priority store(s) have no new flavor data in ${staleThreshold}+ days: ${detail}`,
      });
    }
  } catch (err) {
    issues.push({
      title: 'Stale store check error',
      detail: err.message || 'failed to evaluate stale stores',
    });
  }

  if (issues.length === 0) return { sent: false, reason: 'no_threshold_crossed' };

  const baseUrl = env.WORKER_BASE_URL || 'https://custard.chriskaschner.com';
  const html = buildOperatorAlertHtml({
    baseUrl,
    issues,
    context: {
      checked: result?.checked || 0,
      sent: result?.sent || 0,
      errors_count: Array.isArray(result?.errors) ? result.errors.length : 0,
      ran_at: new Date().toISOString(),
    },
  });

  const mail = await sendEmail(
    {
      to: env.OPERATOR_EMAIL,
      subject: `Custard operator alert (${today})`,
      html,
    },
    env.RESEND_API_KEY,
    env.ALERT_FROM_EMAIL || 'alerts@custard-calendar.com'
  );

  if (!mail.ok) {
    return { sent: false, reason: 'email_failed', error: mail.error, issues };
  }

  try {
    await env.FLAVOR_CACHE.put(dedupeKey, '1', { expirationTtl: 86400 });
  } catch {
    // Dedupe write failure should not turn this into a hard error.
  }
  return { sent: true, issues };
}

