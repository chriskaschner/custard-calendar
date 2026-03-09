import { expect, test } from '@playwright/test';

/**
 * API surface smoke test for window.CustardPlanner.
 *
 * Verifies that all 60 public exports are present after loading the
 * planner scripts. This test was created BEFORE the monolith split to
 * establish a baseline, and continues to gate correctness after extraction.
 */

const EXPECTED_KEYS = [
  // Facade (planner-shared.js)
  'WORKER_BASE',
  'escapeHtml',

  // Data (planner-data.js)
  'BRAND_COLORS',
  'BRAND_DISPLAY',
  'brandFromSlug',
  'brandDisplayName',
  'normalize',
  'haversineMiles',
  'SIMILARITY_GROUPS',
  'FLAVOR_FAMILIES',
  'FLAVOR_FAMILY_MEMBERS',
  'getFamilyForFlavor',
  'getFamilyColor',
  'findSimilarFlavors',
  'findSimilarToFavorites',
  'isSeasonalFlavor',

  // Domain (planner-domain.js)
  'CERTAINTY',
  'CERTAINTY_LABELS',
  'certaintyTier',
  'certaintyBadgeHTML',
  'certaintyCardClass',
  'confidenceStripClass',
  'buildTimeline',
  'fetchReliability',
  'watchBannerHTML',
  'fetchFlavorHistoricalContext',
  'fetchStoreHistoricalContext',
  'historicalContextHTML',
  'getPrimaryStoreSlug',
  'setPrimaryStoreSlug',
  'getSavedStore',
  'setSavedStore',
  'getFavorites',
  'addFavorite',
  'removeFavorite',
  'getDrivePreferences',
  'saveDrivePreferences',
  'flushDrivePreferences',
  'resetDrivePreferences',
  'pickDefaultDriveStores',
  'parseDriveUrlState',
  'buildDriveUrlState',
  'DRIVE_PREFERENCES_KEY',
  'DRIVE_DEBOUNCE_MS',
  'rarityLabelFromGapDays',
  'rarityLabelFromPercentile',
  'rarityLabelFromRank',
  'formatCadenceText',

  // UI (planner-ui.js)
  'directionsUrl',
  'calendarIcsUrl',
  'alertPageUrl',
  'actionCTAsHTML',
  'emitInteractionEvent',
  'emitPageView',
  'getPageLoadId',
  'signalCardHTML',
  'fetchSignals',
  'initShareButton',
];

test('CustardPlanner API surface is complete after module split', async ({ page }) => {
  // Use the test harness that loads all 4 scripts (facade + 3 sub-modules).
  // Production HTML pages are updated in Plan 02; this harness verifies the split.
  await page.goto('/test-api-surface.html');

  const result = await page.evaluate((expectedKeys) => {
    const cp = window.CustardPlanner;
    if (!cp) return { error: 'CustardPlanner not found on window' };
    const actualKeys = Object.keys(cp);
    const missing = expectedKeys.filter(k => !(k in cp));
    return { actualKeys, missing, count: actualKeys.length };
  }, EXPECTED_KEYS);

  if (result.error) {
    throw new Error(result.error);
  }

  for (const key of EXPECTED_KEYS) {
    expect(result.missing, `Missing export: ${key}`).not.toContain(key);
  }

  expect(result.missing).toHaveLength(0);
});

test('CustardPlanner exports have correct types', async ({ page }) => {
  await page.goto('/test-api-surface.html');

  const types = await page.evaluate(() => {
    const cp = window.CustardPlanner;
    if (!cp) return null;
    const result = {};
    for (const key of Object.keys(cp)) {
      result[key] = typeof cp[key];
    }
    return result;
  });

  expect(types).not.toBeNull();

  // Verify functions are functions
  const expectedFunctions = [
    'escapeHtml', 'brandFromSlug', 'brandDisplayName', 'normalize',
    'haversineMiles', 'getFamilyForFlavor', 'getFamilyColor',
    'findSimilarFlavors', 'findSimilarToFavorites', 'isSeasonalFlavor',
    'certaintyTier', 'certaintyBadgeHTML', 'certaintyCardClass',
    'confidenceStripClass', 'buildTimeline', 'fetchReliability',
    'watchBannerHTML', 'fetchFlavorHistoricalContext',
    'fetchStoreHistoricalContext', 'historicalContextHTML',
    'getPrimaryStoreSlug', 'setPrimaryStoreSlug', 'getSavedStore',
    'setSavedStore', 'getFavorites', 'addFavorite', 'removeFavorite',
    'getDrivePreferences', 'saveDrivePreferences', 'flushDrivePreferences',
    'resetDrivePreferences', 'pickDefaultDriveStores', 'parseDriveUrlState',
    'buildDriveUrlState', 'rarityLabelFromGapDays', 'rarityLabelFromPercentile',
    'rarityLabelFromRank', 'formatCadenceText', 'directionsUrl',
    'calendarIcsUrl', 'alertPageUrl', 'actionCTAsHTML',
    'emitInteractionEvent', 'emitPageView', 'getPageLoadId',
    'signalCardHTML', 'fetchSignals', 'initShareButton',
  ];
  for (const fn of expectedFunctions) {
    expect(types[fn], `${fn} should be a function`).toBe('function');
  }

  // Verify objects are objects
  const expectedObjects = [
    'BRAND_COLORS', 'BRAND_DISPLAY', 'SIMILARITY_GROUPS',
    'FLAVOR_FAMILIES', 'FLAVOR_FAMILY_MEMBERS', 'CERTAINTY', 'CERTAINTY_LABELS',
  ];
  for (const obj of expectedObjects) {
    expect(types[obj], `${obj} should be an object`).toBe('object');
  }

  // Verify strings are strings
  expect(types['WORKER_BASE']).toBe('string');
  expect(types['DRIVE_PREFERENCES_KEY']).toBe('string');

  // Verify numbers are numbers
  expect(types['DRIVE_DEBOUNCE_MS']).toBe('number');
});
