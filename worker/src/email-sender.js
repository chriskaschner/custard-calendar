/**
 * Email sender — Resend API integration for flavor alert emails.
 *
 * Handles confirmation emails (double opt-in) and alert emails (flavor matches).
 * Includes List-Unsubscribe headers required by Gmail/Yahoo since Feb 2024.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Send an email via the Resend API.
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML body
 * @param {Object} [params.headers] - Additional email headers (e.g. List-Unsubscribe)
 * @param {string} apiKey - Resend API key
 * @param {string} fromAddress - Verified sender address
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendEmail({ to, subject, html, headers }, apiKey, fromAddress) {
  const body = {
    from: fromAddress,
    to: [to],
    subject,
    html,
  };

  if (headers) {
    body.headers = headers;
  }

  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { ok: false, error: `Resend API ${resp.status}: ${text}` };
  }

  return { ok: true };
}

/**
 * Build and send a confirmation email for double opt-in.
 * @param {Object} params
 * @param {string} params.email - Recipient
 * @param {string} params.storeName - Human-readable store name
 * @param {string[]} params.favorites - Selected favorite flavors
 * @param {string} params.confirmUrl - Full URL with token
 * @param {string} apiKey
 * @param {string} fromAddress
 */
export async function sendConfirmationEmail({ email, storeName, favorites, confirmUrl }, apiKey, fromAddress) {
  const favList = favorites.map(f => `<li>${escapeHtml(f)}</li>`).join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #003366;">Confirm your Custard Calendar alerts</h2>
  <p>You're signing up for flavor alerts at <strong>${escapeHtml(storeName)}</strong>.</p>
  <p>Your favorites:</p>
  <ul>${favList}</ul>
  <p>
    <a href="${escapeHtml(confirmUrl)}"
       style="display: inline-block; padding: 12px 24px; background: #003366; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
      Confirm my alerts
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">If you didn't request this, just ignore this email. The link expires in 24 hours.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">Custard Calendar — Flavor of the Day alerts</p>
</body>
</html>`.trim();

  return sendEmail(
    { to: email, subject: 'Confirm your Custard Calendar alerts', html },
    apiKey,
    fromAddress,
  );
}

/**
 * Build and send a flavor alert email.
 * @param {Object} params
 * @param {string} params.email - Recipient
 * @param {string} params.storeName - Human-readable store name
 * @param {string} params.storeAddress - Store street address
 * @param {Array<{title: string, date: string, description: string}>} params.matches - Matched flavors
 * @param {string} params.statusUrl - Full URL to manage subscription (token-gated)
 * @param {string} params.unsubscribeUrl - Full URL to unsubscribe (token-gated)
 * @param {string} apiKey
 * @param {string} fromAddress
 */
export async function sendAlertEmail({ email, storeName, storeAddress, matches, statusUrl, unsubscribeUrl }, apiKey, fromAddress) {
  const firstMatch = matches[0];
  const dateObj = new Date(firstMatch.date + 'T12:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const subject = matches.length === 1
    ? `\u{1F366} ${firstMatch.title} is coming to ${storeName} on ${dayName} ${monthDay}!`
    : `\u{1F366} ${matches.length} favorites coming to ${storeName}!`;

  const matchRows = matches.map(m => {
    const d = new Date(m.date + 'T12:00:00');
    const dn = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong style="font-size: 16px;">\u{1F366} ${escapeHtml(m.title)}</strong><br>
        <span style="color: #666;">${escapeHtml(dn)}</span>
        ${m.description ? `<br><span style="color: #999; font-size: 13px;">${escapeHtml(m.description)}</span>` : ''}
      </td>
    </tr>`;
  }).join('\n');

  const quip = getRandomQuip();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #003366;">A favorite flavor is coming up!</h2>
  <p style="color: #888; font-style: italic;">${escapeHtml(quip)}</p>
  <p>\u{1F4CD} <strong>${escapeHtml(storeName)}</strong>${storeAddress ? ` \u2014 ${escapeHtml(storeAddress)}` : ''}</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    ${matchRows}
  </table>
  <p>
    <a href="${escapeHtml(statusUrl)}" style="color: #003366; text-decoration: underline;">Manage preferences</a>
    &nbsp;&middot;&nbsp;
    <a href="${escapeHtml(unsubscribeUrl)}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">Custard Calendar — Flavor of the Day alerts</p>
</body>
</html>`.trim();

  return sendEmail(
    {
      to: email,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
    apiKey,
    fromAddress,
  );
}

/**
 * Build and send a weekly forecast digest email.
 * @param {Object} params
 * @param {string} params.email - Recipient
 * @param {string} params.storeName - Human-readable store name
 * @param {string} params.storeAddress - Store street address
 * @param {Array<{title: string, date: string, description: string}>} params.matches - Matched flavors this week
 * @param {Array<{title: string, date: string}>} params.allFlavors - All flavors for the week
 * @param {string} params.statusUrl
 * @param {string} params.unsubscribeUrl
 * @param {string} [params.narrative] - Fun commentary about the week's flavors
 * @param {string} apiKey
 * @param {string} fromAddress
 */
export async function sendWeeklyDigestEmail({ email, storeName, storeAddress, matches, allFlavors, statusUrl, unsubscribeUrl, narrative }, apiKey, fromAddress) {
  const quip = getRandomQuip();

  const subject = matches.length > 0
    ? `\u{1F4CB} Your weekly flavor forecast for ${storeName}`
    : `\u{1F4CB} This week at ${storeName} — your flavor forecast`;

  // Build the full week schedule
  const weekRows = (allFlavors || []).map(f => {
    const d = new Date(f.date + 'T12:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const isMatch = matches.some(m => m.date === f.date && m.title === f.title);
    const highlight = isMatch ? 'background: #e8f5e9; font-weight: bold;' : '';
    const matchBadge = isMatch ? ' \u2b50' : '';
    return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; ${highlight}">
        <span style="color: #666;">${escapeHtml(dayName)}</span>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; ${highlight}">
        ${escapeHtml(f.title)}${matchBadge}
      </td>
    </tr>`;
  }).join('\n');

  const narrativeBlock = narrative
    ? `<p style="font-style: italic; color: #555; margin: 16px 0;">${escapeHtml(narrative)}</p>`
    : '';

  const matchSummary = matches.length > 0
    ? `<p>\u2b50 <strong>${matches.length} favorite${matches.length > 1 ? 's' : ''}</strong> spotted this week!</p>`
    : `<p>No favorites this week — but there's always next week.</p>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #003366;">Your Weekly Flavor Forecast</h2>
  <p style="color: #888; font-style: italic;">${escapeHtml(quip)}</p>
  <p>\u{1F4CD} <strong>${escapeHtml(storeName)}</strong>${storeAddress ? ` \u2014 ${escapeHtml(storeAddress)}` : ''}</p>
  ${matchSummary}
  ${narrativeBlock}
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <thead>
      <tr style="background: #f8f9fa;">
        <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #666;">Day</th>
        <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #666;">Flavor</th>
      </tr>
    </thead>
    <tbody>
      ${weekRows}
    </tbody>
  </table>
  <p style="color: #888; font-size: 13px;">\u2b50 = one of your favorites</p>
  <p>
    <a href="${escapeHtml(statusUrl)}" style="color: #003366; text-decoration: underline;">Manage preferences</a>
    &nbsp;&middot;&nbsp;
    <a href="${escapeHtml(unsubscribeUrl)}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">Custard Calendar — Your weekly flavor intelligence briefing</p>
</body>
</html>`.trim();

  return sendEmail(
    {
      to: email,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
    apiKey,
    fromAddress,
  );
}

/**
 * Rotating quips for flavor alert emails — custard-grade humor.
 */
const ALERT_QUIPS = [
  "Your custard intelligence has arrived.",
  "Breaking flavor news from the frozen frontier.",
  "This just in from the custard beat.",
  "Your flavor radar is picking something up...",
  "The cones have spoken.",
  "Alert: incoming frozen deliciousness.",
  "Custard dispatch reporting for duty.",
  "Your frozen asset report is ready.",
  "The scoops don't lie.",
  "Flavor intel, hot off the machine.",
  "From the desk of the Chief Custard Officer.",
  "Priority transmission from flavor HQ.",
  "Your daily scoop of frozen intelligence.",
  "The custard market is moving.",
  "Fresh from the flavor surveillance network.",
];

/**
 * Get a random quip for email personalization.
 */
export function getRandomQuip() {
  return ALERT_QUIPS[Math.floor(Math.random() * ALERT_QUIPS.length)];
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
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
