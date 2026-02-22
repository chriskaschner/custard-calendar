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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="color: #003366;">A favorite flavor is coming up!</h2>
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
