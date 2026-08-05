import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { fetchKoppsFlavors } from './kopp-fetcher.js';
import { fetchGillesFlavors } from './gilles-fetcher.js';
import { fetchHefnersFlavors } from './hefners-fetcher.js';
import { fetchKraverzFlavors } from './kraverz-fetcher.js';
import { fetchOscarsFlavors } from './oscars-fetcher.js';

/**
 * Brand registry — maps slug patterns to fetcher functions + metadata.
 * MKE custard brands get explicit entries; Culver's is the default.
 */
const BRAND_REGISTRY = [
  { pattern: /^kopps-/, fetcher: fetchKoppsFlavors, url: 'https://kopps.com/flavor-preview', brand: "Kopp's", kvPrefix: 'flavors:kopps-shared', watchSlug: 'kopps-glendale' },
  { pattern: /^gilles$/, fetcher: fetchGillesFlavors, url: 'https://gillesfrozencustard.com/flavor-of-the-day', brand: "Gille's", watchSlug: 'gilles' },
  { pattern: /^hefners$/, fetcher: fetchHefnersFlavors, url: 'https://www.hefnerscustard.com', brand: "Hefner's", watchSlug: 'hefners' },
  { pattern: /^kraverz$/, fetcher: fetchKraverzFlavors, url: 'https://kraverzcustard.com/FlavorSchedule', brand: 'Kraverz', watchSlug: 'kraverz' },
  { pattern: /^oscars/, fetcher: fetchOscarsFlavors, url: 'https://www.oscarscustard.com/index.php/flavors/', brand: "Oscar's", kvPrefix: 'flavors:oscars-shared', watchSlug: 'oscars-new-berlin' },
];

/** Culver's has no registry entry -- it is the fallback for every unmatched slug. */
export const DEFAULT_BRAND = "Culver's";

/**
 * One representative slug per non-Culver's brand, for monitoring.
 *
 * A brand is only as observable as the slugs something actually checks. In
 * Aug 2026 the operator watch list was three Culver's stores in Madison, so
 * Oscar's failed for five months and Gille's for weeks without an alert.
 * Deriving the list here means a new brand is watched the day it is added.
 *
 * @returns {string[]}
 */
export function getBrandWatchSlugs() {
  return BRAND_REGISTRY.map(entry => entry.watchSlug).filter(Boolean);
}

/**
 * Every brand name this Worker serves, Culver's included.
 * @returns {string[]}
 */
export function getMonitoredBrands() {
  return [DEFAULT_BRAND, ...BRAND_REGISTRY.map(entry => entry.brand)];
}

/**
 * Get fetcher + brand metadata for a slug.
 * Returns default Culver's fetcher when no MKE brand matches.
 */
export function getFetcherForSlug(slug, fallbackFetcher = defaultFetchFlavors) {
  for (const entry of BRAND_REGISTRY) {
    if (entry.pattern.test(slug)) {
      return { fetcher: entry.fetcher, url: entry.url, brand: entry.brand, kvPrefix: entry.kvPrefix || null };
    }
  }
  return { fetcher: fallbackFetcher, url: `https://www.culvers.com/restaurants/${slug}`, brand: "Culver's", kvPrefix: null };
}

/**
 * Get the brand name for a slug.
 */
export function getBrandForSlug(slug) {
  return getFetcherForSlug(slug).brand;
}
