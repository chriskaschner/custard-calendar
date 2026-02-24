/**
 * Flavor matching and similarity logic for the nearby-flavors endpoint.
 *
 * Provides normalization (strip trademark symbols, lowercase, collapse whitespace),
 * exact matching after normalization, and group-based similarity suggestions.
 */

/**
 * Normalize a flavor name for comparison.
 * Strips ®™©, lowercases, collapses whitespace.
 * @param {string} name
 * @returns {string}
 */
export function normalize(name) {
  if (!name) return '';
  return name
    .replace(/\u00ae/g, '')  // ®
    .replace(/\u2122/g, '')  // ™
    .replace(/\u00a9/g, '')  // ©
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a store's flavor matches the query after normalization.
 * First checks for an exact name match; if that fails, checks whether
 * the query appears as a substring in the flavor description.
 * @param {string} storeFlavor - Flavor name from store data
 * @param {string} query - User's search query
 * @param {string} [storeDescription] - Flavor description with ingredient details
 * @returns {boolean}
 */
export function matchesFlavor(storeFlavor, query, storeDescription) {
  const normalizedQuery = normalize(query);
  if (normalize(storeFlavor) === normalizedQuery) return true;
  if (storeDescription && normalizedQuery) {
    return normalize(storeDescription).includes(normalizedQuery);
  }
  return false;
}

/**
 * Flavor similarity groups. Each group represents a "family" of flavors
 * that share a base ingredient or theme. A user looking for one flavor
 * in a group is likely interested in others from the same group.
 */
export const BRAND_COLORS = {
  culvers: '#005696',
  kopps: '#000000',
  gilles: '#EBCC35',
  hefners: '#93BE46',
  kraverz: '#CE742D',
  oscars: '#BC272C',
};

/**
 * Flavor families and canonical palette for grouping across surfaces.
 */
export const FLAVOR_FAMILIES = {
  mint: { color: '#2ECC71', members: ['andes mint avalanche', 'mint cookie', 'mint explosion'] },
  chocolate: { color: '#6F4E37', members: ['chocolate caramel twist', 'chocolate heath crunch', 'chocolate volcano', 'dark chocolate decadence', 'dark chocolate pb crunch', 'chocolate oreo volcano'] },
  caramel: { color: '#D4A056', members: ['caramel cashew', 'caramel fudge cookie dough', 'caramel pecan', 'caramel turtle', 'salted caramel pecan pie', 'chocolate caramel twist'] },
  cheesecake: { color: '#FFF8DC', members: ['oreo cheesecake', 'oreo cookie cheesecake', 'raspberry cheesecake', 'strawberry cheesecake', 'turtle cheesecake'] },
  turtle: { color: '#8B6914', members: ['turtle', 'turtle dove', 'turtle cheesecake', 'caramel turtle'] },
  cookie: { color: '#C4A882', members: ['crazy for cookie dough', 'caramel fudge cookie dough', 'mint cookie', 'oreo cookie cheesecake', 'oreo cookies and cream'] },
  peanutButter: { color: '#C8A96E', members: ['dark chocolate pb crunch', 'peanut butter cup', 'reeses peanut butter cup'] },
  berry: { color: '#E91E63', members: ['blackberry cobbler', 'raspberry cheesecake', 'strawberry cheesecake', 'lemon berry layer cake'] },
  pecan: { color: '#A67B5B', members: ['butter pecan', 'caramel pecan', 'salted caramel pecan pie', 'georgia peach pecan'] },
};

export const SIMILARITY_GROUPS = {
  mint: [
    'andes mint avalanche',
    'mint cookie',
    'mint explosion',
  ],
  chocolate: [
    'chocolate caramel twist',
    'chocolate heath crunch',
    'chocolate volcano',
    'dark chocolate decadence',
    'dark chocolate pb crunch',
    'chocolate oreo volcano',
  ],
  caramel: [
    'caramel cashew',
    'caramel fudge cookie dough',
    'caramel pecan',
    'caramel turtle',
    'salted caramel pecan pie',
    'chocolate caramel twist',
  ],
  cheesecake: [
    'oreo cheesecake',
    'oreo cookie cheesecake',
    'raspberry cheesecake',
    'strawberry cheesecake',
    'turtle cheesecake',
  ],
  turtle: [
    'turtle',
    'turtle dove',
    'turtle cheesecake',
    'caramel turtle',
  ],
  cookie: [
    'crazy for cookie dough',
    'caramel fudge cookie dough',
    'mint cookie',
    'oreo cookie cheesecake',
    'oreo cookies and cream',
  ],
  peanutButter: [
    'dark chocolate pb crunch',
    'peanut butter cup',
    'reeses peanut butter cup',
  ],
  berry: [
    'blackberry cobbler',
    'raspberry cheesecake',
    'strawberry cheesecake',
    'lemon berry layer cake',
  ],
  pecan: [
    'butter pecan',
    'caramel pecan',
    'salted caramel pecan pie',
    'georgia peach pecan',
  ],
};

/**
 * Find similar flavors from the same group(s) as the target.
 * Returns an array of normalized flavor names that are in the same
 * similarity group as the target but are not the target itself.
 *
 * @param {string} target - The flavor to find similar flavors for
 * @param {string[]} availableFlavors - Flavors currently available at nearby stores
 * @returns {string[]} Normalized names of similar flavors
 */
export function findSimilarFlavors(target, availableFlavors) {
  const normalizedTarget = normalize(target);
  const normalizedAvailable = new Set(availableFlavors.map(normalize));

  // Find all groups containing the target
  const matchingGroups = [];
  for (const [, members] of Object.entries(SIMILARITY_GROUPS)) {
    if (members.includes(normalizedTarget)) {
      matchingGroups.push(members);
    }
  }

  if (matchingGroups.length === 0) return [];

  // Collect all similar flavors from matching groups
  const similar = new Set();
  for (const members of matchingGroups) {
    for (const member of members) {
      if (member !== normalizedTarget && normalizedAvailable.has(member)) {
        similar.add(member);
      }
    }
  }

  return [...similar];
}
