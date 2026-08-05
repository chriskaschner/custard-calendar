/**
 * Fetches and parses Hefner's Frozen Custard flavor data.
 *
 * Hefner's shows only today's flavor on their homepage (ASP.NET MVC).
 * No multi-day forecast available in HTML.
 *
 * HTML structure: .flavor-content .flavor-text h3 (flavor name) + p (description)
 */

import { centralDateString } from './date-util.js';

/**
 * Parse Hefner's homepage HTML for today's flavor.
 *
 * The page carries no date -- it just shows whatever is being served now -- so
 * the date has to come from the clock. It must be the Central date: Hefner's is
 * in West Allis, and stamping the UTC date files every evening's flavor under
 * tomorrow.
 *
 * @param {string} html - Raw HTML from hefnerscustard.com
 * @param {string} [today] - Central date (YYYY-MM-DD); injectable for tests
 * @returns {{ name: string, address: string, flavors: Array<{date: string, title: string, description: string}> }}
 */
export function parseHefnersHtml(html, today = centralDateString()) {
  const flavors = [];

  // Find .flavor-content section with .flavor-text h3
  const sectionMatch = html.match(/<div class="flavor-content">([\s\S]*?)<\/div>\s*<\/div>/i);
  if (!sectionMatch) {
    return { name: "Hefner's Frozen Custard", address: '2325 S 108th St, West Allis, WI', flavors: [] };
  }

  const section = sectionMatch[1];

  // Extract flavor name from h3
  const h3Match = section.match(/<h3>([\s\S]*?)<\/h3>/i);
  if (!h3Match) {
    return { name: "Hefner's Frozen Custard", address: '2325 S 108th St, West Allis, WI', flavors: [] };
  }

  const title = h3Match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract description from p tag
  let description = '';
  const pMatch = section.match(/<p>(?:<p>)?([\s\S]*?)(?:<\/p>)?<\/p>/i);
  if (pMatch) {
    description = pMatch[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (title) {
    flavors.push({ date: today, title, description });
  }

  return {
    name: "Hefner's Frozen Custard",
    address: '2325 S 108th St, West Allis, WI',
    flavors,
  };
}

/**
 * Fetch flavor data for Hefner's.
 * @param {string} slug - "hefners"
 * @param {Function} [fetchFn] - Injectable fetch function for testing
 * @returns {Promise<{name: string, address: string, flavors: Array}>}
 */
export async function fetchHefnersFlavors(slug, fetchFn = globalThis.fetch) {
  const url = 'https://www.hefnerscustard.com';
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Hefner's page: ${response.status}`);
  }

  const html = await response.text();
  return parseHefnersHtml(html);
}
