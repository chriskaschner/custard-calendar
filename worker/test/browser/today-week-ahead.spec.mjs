import { expect, test } from "@playwright/test";

/**
 * Today page week-ahead section tests (TDAY-03).
 *
 * Covers: week-ahead is a collapsed <details> element,
 * and expands on click to show day cards.
 */

// Mock store manifest
const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Mock today response
const MOCK_TODAY = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: "2026-03-07",
  rarity: null,
};

// Mock forecast response with 7-day forecast
const MOCK_FORECAST = {
  slug: "mt-horeb",
  forecast: [
    { date: "2026-03-07", flavor: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces", type: "confirmed" },
    { date: "2026-03-08", flavor: "Butter Pecan", description: "Buttery pecan custard", type: "confirmed" },
    { date: "2026-03-09", flavor: "Vanilla", description: "Classic vanilla", type: "confirmed" },
    { date: "2026-03-10", flavor: "Mint Chip", description: "Cool mint with chocolate chips", type: "confirmed" },
    { date: "2026-03-11", flavor: "Caramel Cashew", description: "Caramel swirl with cashews", type: "confirmed" },
    { date: "2026-03-12", flavor: "Cookie Dough", description: "Vanilla with cookie dough", type: "confirmed" },
    { date: "2026-03-13", flavor: "Strawberry", description: "Fresh strawberry", type: "confirmed" },
  ],
  fetchedAt: "2026-03-07T12:00:00Z",
};

// Mock flavors response
const MOCK_FLAVORS = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: "2026-03-07", title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
    { date: "2026-03-08", title: "Butter Pecan", description: "Buttery pecan custard" },
    { date: "2026-03-09", title: "Vanilla", description: "Classic vanilla" },
    { date: "2026-03-10", title: "Mint Chip", description: "Cool mint with chocolate chips" },
    { date: "2026-03-11", title: "Caramel Cashew", description: "Caramel swirl with cashews" },
    { date: "2026-03-12", title: "Cookie Dough", description: "Vanilla with cookie dough" },
    { date: "2026-03-13", title: "Strawberry", description: "Fresh strawberry" },
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
 * Set up page with API mocks and localStorage for week-ahead tests.
 */
async function setupWeekAheadPage(page) {
  var context = page.context();

  // Mock stores manifest
  await context.route("**/stores.json*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
    });
  });

  // Mock today endpoint
  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TODAY),
    });
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

  // Set localStorage for saved store
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
  });

  // Reload so the page picks up the saved store
  await page.reload();

  // Wait for hero card to become visible
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// TDAY-03: Week ahead is collapsed details element
// ---------------------------------------------------------------------------
test("TDAY-03: week ahead is collapsed details element", async ({ page }) => {
  await setupWeekAheadPage(page);

  // details#week-section should exist
  var weekSection = page.locator("details#week-section");
  await expect(weekSection).toBeVisible();

  // Should NOT be open by default
  var isOpen = await weekSection.getAttribute("open");
  expect(isOpen).toBeNull();

  // .week-strip should not be visible when collapsed
  var weekStrip = page.locator(".week-strip");
  await expect(weekStrip).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// TDAY-03: Week ahead expands on click
// ---------------------------------------------------------------------------
test("week ahead expands on click", async ({ page }) => {
  await setupWeekAheadPage(page);

  // Click the summary element to expand
  var summary = page.locator("details#week-section > summary");
  await summary.click();

  // .week-strip should now be visible
  var weekStrip = page.locator(".week-strip");
  await expect(weekStrip).toBeVisible();

  // Should contain day cards
  var dayCards = page.locator(".week-day-card");
  var cardCount = await dayCards.count();
  expect(cardCount).toBeGreaterThan(0);
});
