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
  { pattern: /^kopps-/, fetcher: fetchKoppsFlavors, url: 'https://www.kopps.com/flavor-forecast', brand: "Kopp's", kvPrefix: 'flavors:kopps-shared' },
  { pattern: /^gilles$/, fetcher: fetchGillesFlavors, url: 'https://gillesfrozencustard.com/flavor-of-the-day', brand: "Gille's" },
  { pattern: /^hefners$/, fetcher: fetchHefnersFlavors, url: 'https://www.hefnerscustard.com', brand: "Hefner's" },
  { pattern: /^kraverz$/, fetcher: fetchKraverzFlavors, url: 'https://kraverzcustard.com/FlavorSchedule', brand: 'Kraverz' },
  { pattern: /^oscars/, fetcher: fetchOscarsFlavors, url: 'https://www.oscarscustard.com/index.php/flavors/', brand: "Oscar's", kvPrefix: 'flavors:oscars-shared' },
];

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
