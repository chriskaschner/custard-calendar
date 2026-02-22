/**
 * Fetches and parses Oscar's Frozen Custard flavor data.
 *
 * Oscar's publishes a full month schedule (+ next month forecast) at
 * oscarscustard.com/index.php/flavors/ via a WordPress page.
 *
 * The page is JS-rendered (Divi theme) so we fetch via the WP REST API:
 *   /wp-json/wp/v2/pages?slug=flavors&_fields=content
 *
 * HTML structure: table.wpsm-comptable > tbody > tr > td (day) + td (flavor links)
 * Date format in cells: "Sun 1", "Mon 2", "Tue 3", etc.
 * Month determined from heading: "February FLAVORS", "March FLAVOR FORECAST"
 * Some days have "-or-" alternatives: "CHERRY CHIP -or- BUTTER ALMOND"
 */

const MONTH_NAMES = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse Oscar's flavor page HTML content (from WP REST API).
 * @param {string} html - The rendered content from the WordPress page
 * @returns {{ name: string, address: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseOscarsHtml(html) {
  const flavors = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  // Find all tables and their preceding month headings
  // Split content by table tags to process each table with its heading
  const sections = html.split(/<table[^>]*class="[^"]*wpsm-comptable[^"]*"[^>]*>/i);

  for (let i = 1; i < sections.length; i++) {
    // Look for month name in the content before this table (previous section's tail)
    const preceding = sections[i - 1];
    let month = null;

    // Match month names in headings like "February FLAVORS" or "March FLAVOR FORECAST"
    for (const [name, num] of Object.entries(MONTH_NAMES)) {
      const pattern = new RegExp(name, 'i');
      if (pattern.test(preceding.slice(-500))) { // Check last 500 chars before table
        month = num;
      }
    }

    if (!month) {
      // Fallback: use current month for first table, next month for second
      month = i === 1 ? now.getMonth() + 1 : ((now.getMonth() + 1) % 12) + 1;
    }

    const tableContent = sections[i].split(/<\/table>/i)[0] || '';

    // Parse rows: td with "Day N" pattern + td with flavor links
    const rowPattern = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
      const dateCell = rowMatch[1].replace(/<[^>]+>/g, '').trim();
      const flavorCell = rowMatch[2];

      // Parse "Day N" format (e.g., "Sun 1", "Mon 2", "Thur 12")
      const dateMatch = dateCell.match(/^(?:Sun|Mon|Tue|Wed|Thur?|Fri|Sat)\s+(\d{1,2})$/i);
      if (!dateMatch) continue;

      const day = parseInt(dateMatch[1], 10);
      let year = currentYear;
      // Handle year boundary
      if (now.getMonth() === 11 && month <= 2) year += 1;

      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Extract flavor names from links and text
      // Remove HTML tags but preserve " -or- " separators
      const flavorText = flavorCell
        .replace(/<strong>/gi, '').replace(/<\/strong>/gi, '')
        .replace(/<b>/gi, '').replace(/<\/b>/gi, '')
        .replace(/<a[^>]*>/gi, '').replace(/<\/a>/gi, '')
        .replace(/&amp;/g, '&')
        .replace(/&#0*38;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/\u2019/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/&#8230;/g, '...')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!flavorText) continue;

      // Title case the ALL CAPS name (include possessive 's to keep "OSCAR'S" → "Oscar's")
      const title = flavorText.replace(/\b[A-Z]{2,}(?:'[A-Z])?/g, w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).replace(/\bM&m\b/gi, 'M&M')
       .replace(/-or-/g, '-or-')
       .replace(/\bPb\b/g, 'PB');

      flavors.push({ date, title, description: '' });
    }
  }

  return {
    name: "Oscar's Frozen Custard",
    address: '3799 S Moorland Rd, New Berlin, WI',
    flavors,
  };
}

/**
 * Fetch flavor data for Oscar's via WordPress REST API.
 * @param {string} slug - "oscars" or "oscars-muskego"
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, address: string, flavors: Array}>}
 */
export async function fetchOscarsFlavors(slug, fetchFn = globalThis.fetch) {
  const url = 'https://www.oscarscustard.com/wp-json/wp/v2/pages?slug=flavors&_fields=content';
  const response = await fetchFn(url, {
    headers: { 'User-Agent': 'CustardCalendar/1.0 (+https://github.com/chriskaschner/custard-calendar)' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Oscar's flavor page: ${response.status}`);
  }

  const pages = await response.json();
  if (!pages.length || !pages[0].content || !pages[0].content.rendered) {
    throw new Error("No flavor content found in Oscar's WordPress API response");
  }

  return parseOscarsHtml(pages[0].content.rendered);
}
