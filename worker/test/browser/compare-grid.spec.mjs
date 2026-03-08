import { expect, test } from "@playwright/test";

/**
 * Compare page grid tests (COMP-01, COMP-02, COMP-04, COMP-07, COMP-08).
 *
 * Covers: day-first card stack rendering, cone SVGs, flavor names,
 * rarity badges, 375px viewport, data sources (existing endpoints only),
 * and single-store empty state.
 */

// Mock store manifest
var MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", address: "100 Main St", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", address: "200 Elm St", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", address: "300 Oak Ave", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Today's date string for mock data
var TODAY_STR = new Date().toISOString().slice(0, 10);
var TOMORROW = new Date();
TOMORROW.setDate(TOMORROW.getDate() + 1);
var TOMORROW_STR = TOMORROW.toISOString().slice(0, 10);
var DAY2 = new Date();
DAY2.setDate(DAY2.getDate() + 2);
var DAY2_STR = DAY2.toISOString().slice(0, 10);

// Mock flavors responses per store (3 days each)
var MOCK_FLAVORS_MT_HOREB = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
    { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan custard" },
    { date: DAY2_STR, title: "Vanilla", description: "Classic vanilla" },
  ],
  fetched_at: new Date().toISOString(),
};

var MOCK_FLAVORS_VERONA = {
  slug: "verona",
  name: "Verona",
  flavors: [
    { date: TODAY_STR, title: "Mint Chip", description: "Cool mint with chocolate chips" },
    { date: TOMORROW_STR, title: "Caramel Swirl", description: "Caramel swirl custard" },
    { date: DAY2_STR, title: "Strawberry", description: "Fresh strawberry" },
  ],
  fetched_at: new Date().toISOString(),
};

var MOCK_FLAVORS_MADISON = {
  slug: "madison-east",
  name: "Madison East",
  flavors: [
    { date: TODAY_STR, title: "Turtle Sundae", description: "Turtle sundae custard" },
    { date: TOMORROW_STR, title: "Cookie Dough", description: "Vanilla with cookie dough" },
    { date: DAY2_STR, title: "Peanut Butter Cup", description: "Peanut butter cup custard" },
  ],
  fetched_at: new Date().toISOString(),
};

// Mock today responses per store (rarity data)
var MOCK_TODAY_MT_HOREB = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

var MOCK_TODAY_VERONA = {
  slug: "verona",
  flavor: "Mint Chip",
  description: "Cool mint with chocolate chips",
  date: TODAY_STR,
  rarity: null,
};

var MOCK_TODAY_MADISON = {
  slug: "madison-east",
  flavor: "Turtle Sundae",
  description: "Turtle sundae custard",
  date: TODAY_STR,
  rarity: null,
};

// Mock geo response
var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up compare page with API mocks and localStorage for 3 saved stores.
 */
async function setupComparePage(page, opts) {
  opts = opts || {};
  var storeSlugs = opts.storeSlugs || ["mt-horeb", "verona", "madison-east"];
  var context = page.context();

  // Mock stores manifest
  await context.route("**/stores.json*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
    });
  });

  // Mock flavors endpoint (per slug)
  await context.route("**/api/v1/flavors*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_MT_HOREB) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_VERONA) });
    } else if (url.indexOf("slug=madison-east") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_MADISON) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
    }
  });

  // Mock today endpoint (per slug)
  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_MT_HOREB) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_VERONA) });
    } else if (url.indexOf("slug=madison-east") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_MADISON) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    }
  });

  // Mock geolocate endpoint
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_GEO) });
  });

  // Mock flavor-colors endpoint (used by cone-renderer.js)
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  // Navigate to compare.html
  await page.goto("/compare.html");

  // Set localStorage with saved stores
  await page.evaluate(function (slugs) {
    localStorage.setItem("custard:v1:preferences", JSON.stringify({
      activeRoute: { stores: slugs },
    }));
  }, storeSlugs);

  // Reload so the page picks up saved stores
  await page.reload();

  // Wait for grid to render
  await page.waitForSelector("#compare-grid", { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// COMP-01: Grid shows 3 day-cards with 3 store rows each
// ---------------------------------------------------------------------------
test("COMP-01: page shows 3 day-cards with 3 store rows each", async ({ page }) => {
  await setupComparePage(page);

  // Should have 3 day cards (Today, Tomorrow, Day+2)
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // Each day card should have 3 store rows
  for (var i = 0; i < 3; i++) {
    var rows = dayCards.nth(i).locator(".compare-store-row");
    await expect(rows).toHaveCount(3);
  }
});

// ---------------------------------------------------------------------------
// COMP-01: Day headers show Today, Tomorrow, and day+2
// ---------------------------------------------------------------------------
test("COMP-01: day headers show Today, Tomorrow, and day+2 labels", async ({ page }) => {
  await setupComparePage(page);

  var headers = page.locator(".compare-day-header");
  await expect(headers).toHaveCount(3);

  var firstHeader = await headers.nth(0).textContent();
  expect(firstHeader).toContain("Today");

  var secondHeader = await headers.nth(1).textContent();
  expect(secondHeader).toContain("Tomorrow");

  // Third header should be a day name (not Today or Tomorrow)
  var thirdHeader = await headers.nth(2).textContent();
  expect(thirdHeader).not.toContain("Today");
  expect(thirdHeader).not.toContain("Tomorrow");
});

// ---------------------------------------------------------------------------
// COMP-02: Each store row contains cone SVG, flavor name, and store label
// ---------------------------------------------------------------------------
test("COMP-02: store rows contain cone SVG, flavor name, and store label", async ({ page }) => {
  await setupComparePage(page);

  // Check first day card, first store row
  var firstRow = page.locator(".compare-day-card").first().locator(".compare-store-row").first();

  // Cone should contain SVG
  var cone = firstRow.locator(".compare-cone");
  await expect(cone).toBeVisible();
  var coneHtml = await cone.innerHTML();
  expect(coneHtml.toLowerCase()).toContain("svg");

  // Flavor name should have text
  var flavorName = firstRow.locator(".compare-flavor-name");
  await expect(flavorName).toBeVisible();
  var nameText = await flavorName.textContent();
  expect(nameText.length).toBeGreaterThan(0);

  // Store label should be visible
  var storeLabel = firstRow.locator(".compare-store-label");
  await expect(storeLabel).toBeVisible();
});

// ---------------------------------------------------------------------------
// COMP-04: Rare flavor has rarity badge with gap days
// ---------------------------------------------------------------------------
test("COMP-04: rare flavor row has rarity badge", async ({ page }) => {
  await setupComparePage(page);

  // Mt. Horeb has Chocolate Eclair marked as Rare today
  // Find the store row for mt-horeb in the first day card (Today)
  var todayCard = page.locator(".compare-day-card").first();
  var mtHorebRow = todayCard.locator('.compare-store-row[data-slug="mt-horeb"]');
  await expect(mtHorebRow).toBeVisible();

  // Should have a rarity badge
  var rarityBadge = mtHorebRow.locator(".rarity-badge");
  await expect(rarityBadge).toBeVisible();

  var badgeText = await rarityBadge.textContent();
  expect(badgeText).toContain("Rare");
});

// ---------------------------------------------------------------------------
// COMP-07: At 375px viewport, no horizontal scroll
// ---------------------------------------------------------------------------
test("COMP-07: at 375px width, no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setupComparePage(page);

  // All day cards should be visible
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // Page width should equal viewport width (no horizontal scroll)
  var bodyWidth = await page.evaluate(function () {
    return document.body.scrollWidth;
  });
  expect(bodyWidth).toBeLessThanOrEqual(375);
});

// ---------------------------------------------------------------------------
// COMP-08: Mock setup only uses existing endpoints (no new endpoints)
// ---------------------------------------------------------------------------
test("COMP-08: only existing endpoints are used (no new API endpoints)", async ({ page }) => {
  var requestedUrls = [];
  var context = page.context();

  // Track all requests
  page.on("request", function (req) {
    requestedUrls.push(req.url());
  });

  await setupComparePage(page);

  // Wait a bit for all requests to complete
  await page.waitForTimeout(2000);

  // Filter API requests (exclude static files)
  var apiRequests = requestedUrls.filter(function (url) {
    return url.indexOf("/api/") !== -1;
  });

  // Should only use known existing endpoints
  var allowedPatterns = ["/api/v1/flavors", "/api/v1/today", "/api/v1/geolocate", "/api/v1/flavor-colors"];
  for (var i = 0; i < apiRequests.length; i++) {
    var url = apiRequests[i];
    var matchesAllowed = allowedPatterns.some(function (pattern) {
      return url.indexOf(pattern) !== -1;
    });
    expect(matchesAllowed).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Single-store: shows prompt instead of grid
// ---------------------------------------------------------------------------
test("single-store user sees prompt, not grid", async ({ page }) => {
  // Set up with only 1 store
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_GEO) });
  });
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_MT_HOREB) });
  });
  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_MT_HOREB) });
  });

  await page.goto("/compare.html");

  // Set only 1 store in preferences
  await page.evaluate(function () {
    localStorage.setItem("custard:v1:preferences", JSON.stringify({
      activeRoute: { stores: ["mt-horeb"] },
    }));
  });

  await page.reload();

  // Wait for empty state to appear
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  // Empty state should be visible
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeVisible();

  // Grid should not have day cards
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(0);
});
