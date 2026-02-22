/**
 * Fetches and parses Kopp's Frozen Custard flavor data.
 *
 * Kopp's publishes a ~7 day forecast at kopps.com/flavor-forecast (WordPress).
 * All 3 locations share the same flavors, so we use a single fetch + shared KV key.
 *
 * HTML structure: div[id=dayNumber] > h2 (date heading) + .flavor-card h3 (flavor names)
 * Date format in headings: "Today's Flavors -- Saturday 2/21" or "Monday 2/23"
 */

/**
 * Parse date from Kopp's heading text.
 * Formats: "Today's Flavors -- Saturday 2/21", "Tomorrow -- Sunday 2/22", "Monday 2/23"
 * @param {string} heading - The h2 heading text
 * @returns {string|null} YYYY-MM-DD or null
 */
function parseDateFromHeading(heading) {
  // Match M/DD or MM/DD pattern
  const match = heading.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const now = new Date();
  let year = now.getFullYear();

  // Handle year boundary (December forecast showing January dates)
  if (now.getMonth() === 11 && month === 1) {
    year += 1;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Parse Kopp's flavor forecast HTML.
 * @param {string} html - Raw HTML from kopps.com/flavor-forecast
 * @returns {{ name: string, address: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseKoppsHtml(html) {
  const flavors = [];

  // Find each day section: div with numeric id containing h2 + flavor cards
  // Match day divs by their id attribute (numeric)
  const dayPattern = /<div\s+id="(\d+)"[^>]*>([\s\S]*?)(?=<div\s+id="\d+"|<\/main|$)/gi;
  let dayMatch;

  while ((dayMatch = dayPattern.exec(html)) !== null) {
    const dayContent = dayMatch[2];

    // Extract date from h2 heading
    const h2Match = dayContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (!h2Match) continue;

    // Clean HTML entities and tags from heading
    const headingText = h2Match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&rsquo;/g, "'")
      .replace(/&#8211;/g, '--')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    const date = parseDateFromHeading(headingText);
    if (!date) continue;

    // Extract flavor names from h3 tags inside .flavor-card
    const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    const flavorNames = [];
    let h3Match;

    // Only look at flavor-card divs, not footer/location content
    const flavorCardPattern = /<div[^>]*class="[^"]*flavor-card"[^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>\s*(?:<div|$)|<div[^>]*class="[^"]*flavor-card)/gi;
    let cardMatch;
    const flavorEntries = [];

    // Simpler approach: find all flavor-card blocks within this day section
    const cardBlocks = dayContent.split(/class="flavor-card"/i);
    for (let c = 1; c < cardBlocks.length; c++) {
      const block = cardBlocks[c];

      // Extract name from h3
      const nameMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (!nameMatch) continue;

      const name = nameMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&rsquo;/g, "'")
        .replace(/&#8216;/g, "\u2018")
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/&#39;/g, "'")
        .replace(/&reg;/gi, '')
        .replace(/\u00ae/g, '')
        .replace(/\(R\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Extract description from first <p> after h3
      let desc = '';
      const descMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (descMatch) {
        desc = descMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }

      if (name) flavorEntries.push({ name, desc });
    }

    if (flavorEntries.length > 0) {
      const names = flavorEntries.map(e => e.name);
      const descs = flavorEntries.map(e => e.desc).filter(Boolean);
      flavors.push({
        date,
        title: names.join(' & '),
        description: descs.length > 0 ? descs.join(' | ') : (names.length > 1 ? `Flavors: ${names.join(', ')}` : ''),
      });
    }
  }

  return {
    name: "Kopp's Frozen Custard",
    address: '',
    flavors,
  };
}

/**
 * Fetch flavor data for a Kopp's location.
 * All 3 locations share the same flavors, so the slug is ignored for fetching.
 * @param {string} slug - e.g. "kopps-greenfield"
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, address: string, flavors: Array}>}
 */
export async function fetchKoppsFlavors(slug, fetchFn = globalThis.fetch) {
  const url = 'https://www.kopps.com/flavor-forecast';
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Kopp's flavor page: ${response.status}`);
  }

  const html = await response.text();
  return parseKoppsHtml(html);
}
