/**
 * Alert subscription routes — double opt-in email alerts for favorite flavors.
 *
 * Endpoints:
 *   POST /api/alerts/subscribe  — Create pending subscription, send confirmation email
 *   GET  /api/alerts/confirm    — Activate subscription (token from email)
 *   GET  /api/alerts/unsubscribe — Delete subscription (token from email)
 *   GET  /api/alerts/status     — View/manage subscription (token from email)
 *
 * All subscriber-specific access is token-gated. No endpoint accepts email as a query param.
 */

import { sendConfirmationEmail } from './email-sender.js';
import { isValidSlug } from './index.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';

// Validation constants
const MAX_FAVORITES = 10;
const MAX_FAVORITE_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBSCRIPTIONS_PER_EMAIL = 5;
const MAX_PENDING_PER_EMAIL_PER_HOUR = 3;
const MAX_SUBSCRIBE_PER_IP_PER_HOUR = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Hash a string to hex using SHA-256 (first 32 hex chars = 128 bits).
 */
async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Get store display name from the store index.
 */
function getStoreName(slug, env) {
  const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
  const store = storeIndex.find(s => s.slug === slug);
  return store ? store.name : slug;
}

/**
 * Route an alert API request to the appropriate handler.
 * @param {URL} url
 * @param {Request} request
 * @param {Object} env
 * @param {Object} corsHeaders
 * @returns {Promise<Response|null>} Response if handled, null if not an alert route
 */
export async function handleAlertRoute(url, request, env, corsHeaders) {
  if (url.pathname === '/api/alerts/subscribe' && request.method === 'POST') {
    return handleSubscribe(request, env, corsHeaders);
  }
  if (url.pathname === '/api/alerts/confirm' && request.method === 'GET') {
    return handleConfirm(url, env, corsHeaders);
  }
  if (url.pathname === '/api/alerts/unsubscribe' && request.method === 'GET') {
    return handleUnsubscribe(url, env, corsHeaders);
  }
  if (url.pathname === '/api/alerts/status' && request.method === 'GET') {
    return handleStatus(url, env, corsHeaders);
  }
  return null;
}

/**
 * POST /api/alerts/subscribe
 *
 * Creates a pending subscription record and sends a confirmation email.
 * The subscription only activates after the user clicks the confirmation link.
 */
async function handleSubscribe(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { email, slug, favorites } = body;

  // Validate email
  if (!email || typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return Response.json(
      { error: 'Invalid email address' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate slug
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;
  const slugCheck = isValidSlug(slug, validSlugs);
  if (!slugCheck.valid) {
    return Response.json(
      { error: `Invalid store: ${slugCheck.reason}` },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate favorites
  if (!Array.isArray(favorites) || favorites.length < 1 || favorites.length > MAX_FAVORITES) {
    return Response.json(
      { error: `favorites must be an array of 1-${MAX_FAVORITES} strings` },
      { status: 400, headers: corsHeaders },
    );
  }
  for (const f of favorites) {
    if (typeof f !== 'string' || f.length === 0 || f.length > MAX_FAVORITE_LENGTH) {
      return Response.json(
        { error: `Each favorite must be a non-empty string (max ${MAX_FAVORITE_LENGTH} chars)` },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  const kv = env.FLAVOR_CACHE;

  // Per-IP rate limiting: max 10 subscribe attempts per IP per hour
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipKey = `alert:ratelimit:ip:${clientIP}`;
  const ipCount = parseInt(await kv.get(ipKey) || '0', 10);
  if (ipCount >= MAX_SUBSCRIBE_PER_IP_PER_HOUR) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders },
    );
  }

  // Per-email rate limiting: max 3 pending confirmations per email per hour
  // Prevents confirmation email bombing (attacker spamming a victim's inbox)
  const emailRateKey = `alert:ratelimit:email:${email.toLowerCase()}`;
  const emailPendingCount = parseInt(await kv.get(emailRateKey) || '0', 10);
  if (emailPendingCount >= MAX_PENDING_PER_EMAIL_PER_HOUR) {
    // Return same success message to avoid leaking rate limit state
    return Response.json(
      { ok: true, message: 'Check your email to confirm your subscription.' },
      { status: 200, headers: corsHeaders },
    );
  }

  // Check active subscription count for this email
  const subCount = await countActiveSubscriptions(kv, email);
  if (subCount >= MAX_SUBSCRIPTIONS_PER_EMAIL) {
    // Return same success message to avoid leaking subscription count
    return Response.json(
      { ok: true, message: 'Check your email to confirm your subscription.' },
      { status: 200, headers: corsHeaders },
    );
  }

  // Check for existing active subscription — return same response to prevent enumeration
  const subId = await sha256Hex(`${email.toLowerCase()}:${slug}`);
  const existing = await kv.get(`alert:sub:${subId}`);
  if (existing) {
    return Response.json(
      { ok: true, message: 'Check your email to confirm your subscription.' },
      { status: 200, headers: corsHeaders },
    );
  }

  // Generate confirmation token
  const confirmToken = crypto.randomUUID();

  // Write pending subscription with 24h TTL
  await kv.put(`alert:pending:${confirmToken}`, JSON.stringify({
    email: email.toLowerCase(),
    slug,
    favorites,
  }), { expirationTtl: 86400 });

  // Increment rate limit counters
  await kv.put(ipKey, String(ipCount + 1), { expirationTtl: 3600 });
  await kv.put(emailRateKey, String(emailPendingCount + 1), { expirationTtl: 3600 });

  // Send confirmation email
  const apiKey = env.RESEND_API_KEY;
  const fromAddress = env.ALERT_FROM_EMAIL || 'alerts@custard-calendar.com';
  const baseUrl = env.WORKER_BASE_URL || new URL(request.url).origin;
  const confirmUrl = `${baseUrl}/api/alerts/confirm?token=${confirmToken}`;
  const storeName = getStoreName(slug, env);

  if (apiKey) {
    const result = await sendConfirmationEmail(
      { email: email.toLowerCase(), storeName, favorites, confirmUrl },
      apiKey,
      fromAddress,
    );
    if (!result.ok) {
      // Clean up pending record on email failure
      await kv.delete(`alert:pending:${confirmToken}`);
      return Response.json(
        { error: 'Failed to send confirmation email. Please try again.' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  return Response.json(
    { ok: true, message: 'Check your email to confirm your subscription.' },
    { status: 200, headers: corsHeaders },
  );
}

/**
 * GET /api/alerts/confirm?token=X
 *
 * Activates a pending subscription. Returns an HTML success page.
 */
async function handleConfirm(url, env, corsHeaders) {
  const token = url.searchParams.get('token');
  if (!token) {
    return htmlResponse('Missing confirmation token.', 400, corsHeaders);
  }

  const kv = env.FLAVOR_CACHE;
  const raw = await kv.get(`alert:pending:${token}`);
  if (!raw) {
    return htmlResponse('This confirmation link has expired or was already used.', 404, corsHeaders);
  }

  const pending = JSON.parse(raw);
  const { email, slug, favorites } = pending;

  // Create subscription ID from email+slug
  const subId = await sha256Hex(`${email}:${slug}`);

  // Check if already activated (idempotent)
  const existing = await kv.get(`alert:sub:${subId}`);
  if (existing) {
    await kv.delete(`alert:pending:${token}`);
    return htmlResponse('Your subscription is already active!', 200, corsHeaders);
  }

  // Generate tokens for management
  const unsubToken = crypto.randomUUID();

  // Write active subscription
  await kv.put(`alert:sub:${subId}`, JSON.stringify({
    email,
    slug,
    favorites,
    unsubToken,
    createdAt: new Date().toISOString(),
  }));

  // Write unsubscribe token reverse lookup
  await kv.put(`alert:unsub:${unsubToken}`, subId);

  // Increment email subscription count
  await incrementEmailCount(kv, email);

  // Delete pending record
  await kv.delete(`alert:pending:${token}`);

  const storeName = getStoreName(slug, env);
  return htmlResponse(
    `<h2>You're all set!</h2>
     <p>Flavor alerts for <strong>${escapeHtml(storeName)}</strong> are now active.</p>
     <p>We'll email you when any of your favorites are coming up:</p>
     <ul>${favorites.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
     <p><a href="https://chriskaschner.github.io/custard-calendar/alerts.html">Set up more alerts</a></p>`,
    200,
    corsHeaders,
  );
}

/**
 * GET /api/alerts/unsubscribe?token=X
 *
 * Deletes a subscription. Returns an HTML confirmation page.
 */
async function handleUnsubscribe(url, env, corsHeaders) {
  const token = url.searchParams.get('token');
  if (!token) {
    return htmlResponse('Missing unsubscribe token.', 400, corsHeaders);
  }

  const kv = env.FLAVOR_CACHE;
  const subId = await kv.get(`alert:unsub:${token}`);
  if (!subId) {
    return htmlResponse('This unsubscribe link is invalid or the subscription was already removed.', 404, corsHeaders);
  }

  // Read subscription to get email for counter decrement
  const raw = await kv.get(`alert:sub:${subId}`);
  if (raw) {
    const sub = JSON.parse(raw);
    await decrementEmailCount(kv, sub.email);
  }

  // Delete subscription and reverse lookup
  await kv.delete(`alert:sub:${subId}`);
  await kv.delete(`alert:unsub:${token}`);

  return htmlResponse(
    `<h2>Unsubscribed</h2>
     <p>Your flavor alerts have been removed. You won't receive any more emails.</p>
     <p><a href="https://chriskaschner.github.io/custard-calendar/alerts.html">Sign up again</a></p>`,
    200,
    corsHeaders,
  );
}

/**
 * GET /api/alerts/status?token=X
 *
 * Returns subscription details for management. Token from confirmation/alert emails.
 */
async function handleStatus(url, env, corsHeaders) {
  const token = url.searchParams.get('token');
  if (!token) {
    return Response.json(
      { error: 'Missing token parameter' },
      { status: 400, headers: corsHeaders },
    );
  }

  const kv = env.FLAVOR_CACHE;
  const subId = await kv.get(`alert:unsub:${token}`);
  if (!subId) {
    return Response.json(
      { error: 'Invalid or expired token' },
      { status: 404, headers: corsHeaders },
    );
  }

  const raw = await kv.get(`alert:sub:${subId}`);
  if (!raw) {
    return Response.json(
      { error: 'Subscription not found' },
      { status: 404, headers: corsHeaders },
    );
  }

  const sub = JSON.parse(raw);
  const storeName = getStoreName(sub.slug, env);

  return Response.json({
    slug: sub.slug,
    storeName,
    favorites: sub.favorites,
    createdAt: sub.createdAt,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'private, no-store' },
  });
}

/**
 * Count active subscriptions for an email address.
 * Scans KV keys with alert:sub: prefix — in production this uses KV list.
 * Limited to avoid abuse scanning.
 */
async function countActiveSubscriptions(kv, email) {
  // KV list with prefix to find all subscriptions
  // We can't directly query by email, so we check known subscription IDs
  // For efficiency, we use a counter key
  const counterKey = `alert:email-count:${email.toLowerCase()}`;
  const raw = await kv.get(counterKey);
  return raw ? parseInt(raw, 10) : 0;
}

/**
 * Increment subscription count for an email.
 */
export async function incrementEmailCount(kv, email) {
  const counterKey = `alert:email-count:${email.toLowerCase()}`;
  const raw = await kv.get(counterKey);
  const count = raw ? parseInt(raw, 10) : 0;
  await kv.put(counterKey, String(count + 1));
}

/**
 * Decrement subscription count for an email.
 */
export async function decrementEmailCount(kv, email) {
  const counterKey = `alert:email-count:${email.toLowerCase()}`;
  const raw = await kv.get(counterKey);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count > 1) {
    await kv.put(counterKey, String(count - 1));
  } else {
    await kv.delete(counterKey);
  }
}

/**
 * Return a styled HTML page response.
 */
function htmlResponse(bodyContent, status, corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custard Calendar Alerts</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
    h2 { color: #003366; }
    a { color: #003366; }
    ul { padding-left: 20px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
