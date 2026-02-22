/**
 * RFC 5545 .ics calendar generator for Culver's Flavor of the Day.
 *
 * Produces subscribable iCalendar output matching the event format
 * from calendar_sync.py (🍦 primary, 🍨 backups in description).
 */

/**
 * Fold a single content line to comply with RFC 5545 line length limits.
 * Lines must be at most 75 octets. Continuation lines start with a space.
 * @param {string} line - A single unfolded line (no CRLF)
 * @returns {string} The folded line(s) joined with CRLF
 */
function foldLine(line) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);

  if (bytes.length <= 75) {
    return line;
  }

  const parts = [];
  let start = 0;

  while (start < bytes.length) {
    // First line gets 75 bytes, continuation lines get 74 (75 minus the leading space)
    const maxBytes = start === 0 ? 75 : 74;
    let end = Math.min(start + maxBytes, bytes.length);

    // Don't split in the middle of a multi-byte UTF-8 character
    // UTF-8 continuation bytes start with 10xxxxxx (0x80-0xBF)
    while (end < bytes.length && (bytes[end] & 0xC0) === 0x80) {
      end--;
    }

    const chunk = new TextDecoder().decode(bytes.slice(start, end));
    parts.push(start === 0 ? chunk : ' ' + chunk);
    start = end;
  }

  return parts.join('\r\n');
}

/**
 * Escape special characters in iCalendar text values per RFC 5545 section 3.3.11.
 * @param {string} text
 * @returns {string}
 */
function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format a Date or date string as YYYYMMDD for VALUE=DATE properties.
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {string} YYYYMMDD
 */
function formatDateValue(dateStr) {
  return dateStr.replace(/-/g, '');
}

/**
 * Get the next day in YYYYMMDD format (for DTEND of all-day events).
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {string} YYYYMMDD of the next day
 */
function nextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * Generate an RFC 5545 .ics calendar string.
 *
 * @param {Object} options
 * @param {string} options.calendarName - Display name for the calendar
 * @param {Array<{slug: string, name: string, address?: string, role: 'primary'|'secondary'}>} options.stores
 * @param {Object<string, Array<{date: string, title: string, description: string}>>} options.flavorsBySlug
 * @returns {string} RFC 5545 .ics content
 */
export function generateIcs({ calendarName, stores, flavorsBySlug }) {
  const lines = [];

  function addLine(line) {
    lines.push(foldLine(line));
  }

  // Calendar header
  addLine('BEGIN:VCALENDAR');
  addLine('VERSION:2.0');
  addLine('PRODID:-//CustardCalendar//EN');
  addLine('CALSCALE:GREGORIAN');
  addLine('METHOD:PUBLISH');
  addLine(`X-WR-CALNAME:${calendarName}`);
  addLine("X-WR-CALDESC:Culver's Flavor of the Day calendar");
  addLine('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
  addLine('X-PUBLISHED-TTL:PT12H');

  // Find primary store
  const primary = stores.find(s => s.role === 'primary');
  if (!primary) {
    addLine('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  const primaryFlavors = flavorsBySlug[primary.slug] || [];
  const secondaryStores = stores.filter(s => s.role === 'secondary');

  // Build a date→flavor lookup for each secondary store
  const secondaryLookups = secondaryStores.map(store => ({
    store,
    byDate: Object.fromEntries(
      (flavorsBySlug[store.slug] || []).map(f => [f.date, f])
    ),
  }));

  for (const flavor of primaryFlavors) {
    // DTSTAMP derived from event date for deterministic output.
    // Same event data → same .ics bytes → no calendar client churn.
    const dtstamp = formatDateValue(flavor.date) + 'T120000Z';
    addLine('BEGIN:VEVENT');
    addLine(`UID:${flavor.date}-${primary.slug}@custard-calendar`);
    addLine(`DTSTAMP:${dtstamp}`);
    addLine(`DTSTART;VALUE=DATE:${formatDateValue(flavor.date)}`);
    addLine(`DTEND;VALUE=DATE:${nextDay(flavor.date)}`);
    addLine(`SUMMARY:🍦 ${escapeText(flavor.title)}`);
    if (primary.address) {
      addLine(`LOCATION:${escapeText(primary.address)}`);
    }
    addLine(`TRANSP:TRANSPARENT`);

    // Build description: flavor description + restaurant link + backup options
    let desc = flavor.description || '';
    const primaryUrl = primary.url || `https://www.culvers.com/restaurants/${primary.slug}`;
    desc += `\nMore info: ${primaryUrl}`;

    const backupLines = [];
    let backupIndex = 0;
    for (const { store, byDate } of secondaryLookups) {
      const secondaryFlavor = byDate[flavor.date];
      if (secondaryFlavor) {
        const emoji = backupIndex % 2 === 0 ? '🍨' : '🍦';
        backupLines.push(`${emoji}: ${secondaryFlavor.title} - ${store.name}`);
        backupIndex++;
      }
    }
    if (backupLines.length > 0) {
      const header = backupLines.length === 1 ? 'Backup Option' : 'Backup Options';
      desc += `\n\n\n${header}\n${backupLines.join('\n')}`;
    }

    if (desc) {
      addLine(`DESCRIPTION:${escapeText(desc)}`);
    }

    addLine('END:VEVENT');
  }

  addLine('END:VCALENDAR');

  return lines.join('\r\n') + '\r\n';
}
