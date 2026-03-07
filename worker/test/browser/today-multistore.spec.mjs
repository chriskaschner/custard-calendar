import { expect, test } from "@playwright/test";

/**
 * Today page multi-store row tests (TDAY-04).
 *
 * Covers: multi-store glance row visibility with 2+ stores,
 * and hidden state with only 1 store.
 */

// Mock store manifest
const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Mock today responses for different stores
const MOCK_TODAY_MT_HOREB = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: "2026-03-07",
  rarity: null,
};

const MOCK_TODAY_VERONA = {
  slug: "verona",
  flavor: "Butter Pecan",
  description: "Buttery pecan custard",
  date: "2026-03-07",
  rarity: null,
};

// Mock forecast response
const MOCK_FORECAST = {
  slug: "mt-horeb",
  forecast: [
    { date: "2026-03-07", flavor: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces", type: "confirmed" },
  ],
  fetchedAt: "2026-03-07T12:00:00Z",
};

// Mock flavors response
const MOCK_FLAVORS = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: "2026-03-07", title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
  ],
  fetched_at: "2026-03-07T12:00:00Z",
};

// Mock signals response
const MOCK_SIGNALS = {
  signals: [],
};

// Mock geo response
const MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up page with API mocks for multi-store tests.
 * Sets localStorage preferences with 2 stores by default.
 */
async function setupMultiStorePage(page, { singleStore = false } = {}) {
  var context = page.context();

  // Mock stores manifest
  await context.route("**/stores.json*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
    });
  });

  // Mock today endpoint -- return different flavors per slug
  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    if (url.includes("slug=verona")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TODAY_VERONA),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TODAY_MT_HOREB),
      });
    }
  });

  // Mock forecast endpoint
  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FORECAST),
    });
  });

  // Mock flavors endpoint
  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FLAVORS),
    });
  });

  // Mock signals endpoint
  await context.route("**/api/v1/signals/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SIGNALS),
    });
  });

  // Mock geolocate endpoint
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GEO),
    });
  });

  // Mock flavor-colors endpoint
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Mock reliability endpoint
  await context.route("**/api/v1/reliability/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reliability: null }),
    });
  });

  // Navigate to index.html
  await page.goto("/index.html");

  // Set localStorage for saved store + multi-store preferences
  if (singleStore) {
    await page.evaluate(function () {
      localStorage.setItem("custard-primary", "mt-horeb");
      // Clear any multi-store preferences
      localStorage.removeItem("custard:v1:preferences");
    });
  } else {
    await page.evaluate(function () {
      localStorage.setItem("custard-primary", "mt-horeb");
      // Set preferences with 2 stores
      var prefs = {
        version: 1,
        activeRoute: {
          stores: ["mt-horeb", "verona"],
        },
      };
      localStorage.setItem("custard:v1:preferences", JSON.stringify(prefs));
    });
  }

  // Reload so the page picks up the saved store and preferences
  await page.reload();

  // Wait for hero card to become visible
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// TDAY-04: Multi-store row shows when 2+ stores saved
// ---------------------------------------------------------------------------
test("TDAY-04: multi-store row shows when 2+ stores saved", async ({ page }) => {
  await setupMultiStorePage(page);

  // Wait for multi-store row to populate (async fetches)
  await page.waitForTimeout(2000);

  var multiStoreSection = page.locator("#multi-store-section");
  await expect(multiStoreSection).toBeVisible();

  // Should contain at least 2 cells with flavor names
  var cells = page.locator(".multi-store-cell");
  var cellCount = await cells.count();
  expect(cellCount).toBeGreaterThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// TDAY-04 (negative): Multi-store row hidden when only 1 store
// ---------------------------------------------------------------------------
test("multi-store row hidden when only 1 store", async ({ page }) => {
  await setupMultiStorePage(page, { singleStore: true });

  // Wait a moment for any async rendering
  await page.waitForTimeout(2000);

  var multiStoreSection = page.locator("#multi-store-section");
  await expect(multiStoreSection).toBeHidden();
});
