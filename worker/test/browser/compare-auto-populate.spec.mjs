import { expect, test } from "@playwright/test";

/**
 * Compare page auto-populate tests.
 *
 * Covers: geo-aware auto-populate for first-time visitors (COMP-01),
 * header change button override to Compare picker (COMP-02),
 * geo failure/timeout fallback to empty state (COMP-03),
 * SharedNav first-visit prompt suppression, custard-primary cross-page
 * seeding, and returning-user regression guard.
 */

// Mock store manifest
var MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", address: "100 Main St", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", address: "200 Elm St", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", address: "300 Oak Ave", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Compute date strings matching the page's logic: setHours(12,0,0,0) then toISOString()
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);
var _tomorrow = new Date(_today);
_tomorrow.setDate(_tomorrow.getDate() + 1);
var TOMORROW_STR = _tomorrow.toISOString().slice(0, 10);
var _day2 = new Date(_today);
_day2.setDate(_day2.getDate() + 2);
var DAY2_STR = _day2.toISOString().slice(0, 10);

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

// Mock today response for mt-horeb
var MOCK_TODAY_MT_HOREB = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

// Mock geo response -- coordinates near Mt. Horeb, WI
var MOCK_GEO = { lat: 43.0, lon: -89.7, city: "Mt. Horeb", regionName: "Wisconsin" };

/**
 * Set up API mocks on the browser context (geo success variant).
 */
async function setupMocks(context) {
  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_MT_HOREB) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
    }
  });

  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_MT_HOREB) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    }
  });

  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_GEO) });
  });

  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await context.route("**/api/v1/flavor-config*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}

/**
 * Set up API mocks with geo FAILURE (500 response).
 */
async function setupMocksGeoFail(context) {
  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
  });

  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "geo unavailable" }) });
  });

  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await context.route("**/api/v1/flavor-config*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}

// ---------------------------------------------------------------------------
// Test 1 (COMP-01/COMP-03): First-time user auto-populates from geolocation
// ---------------------------------------------------------------------------
test("first-time user auto-populates from geolocation", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  // 1. Clear both localStorage keys -- simulate first-time visitor
  await page.addInitScript(function () {
    localStorage.removeItem("custard:compare:stores");
    localStorage.removeItem("custard-primary");
  });

  // 2. Navigate to Compare page
  await page.goto("/compare.html");

  // 3. Wait for grid to populate with day cards (geo resolves, nearest store seeded)
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // 4. Grid should have 3 day cards (today, tomorrow, day after)
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // 5. Empty state should be hidden
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeHidden();

  // 6. SharedNav first-visit-prompt should NOT be visible (suppressed on Compare)
  var firstVisitPrompt = page.locator(".first-visit-prompt");
  await expect(firstVisitPrompt).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Test 2 (COMP-01): Auto-populate sets custard-primary for cross-page benefit
// ---------------------------------------------------------------------------
test("auto-populate sets custard-primary for cross-page benefit", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  // Clear localStorage
  await page.addInitScript(function () {
    localStorage.removeItem("custard:compare:stores");
    localStorage.removeItem("custard-primary");
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // custard-primary should now be set to the nearest store slug
  var primarySlug = await page.evaluate(function () {
    return localStorage.getItem("custard-primary");
  });
  expect(primarySlug).toBe("mt-horeb");
});

// ---------------------------------------------------------------------------
// Test 3 (COMP-01): Auto-populated store shows store bar with chip and add button
// ---------------------------------------------------------------------------
test("auto-populated store shows store bar with chip and add button", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  await page.addInitScript(function () {
    localStorage.removeItem("custard:compare:stores");
    localStorage.removeItem("custard-primary");
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Store bar should have 1 store chip
  var chips = page.locator(".compare-store-chip");
  await expect(chips).toHaveCount(1);

  // Add store button should be visible
  var addBtn = page.locator(".compare-store-add-btn");
  await expect(addBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4 (COMP-02): Header change button opens Compare picker, not SharedNav picker
// ---------------------------------------------------------------------------
test("header change button opens Compare picker not SharedNav picker", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  // Set up a returning user with a saved store
  await page.addInitScript(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb"]));
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Click the header "change" button (rendered by SharedNav in .store-indicator)
  var changeBtn = page.locator(".store-indicator .btn-text");
  await expect(changeBtn).toBeVisible();
  await changeBtn.click();

  // Compare's multi-store picker should be visible
  var comparePicker = page.locator(".compare-picker");
  await expect(comparePicker).toBeVisible();

  // SharedNav's single-store picker should NOT be visible
  var sharedNavPicker = page.locator(".store-picker");
  await expect(sharedNavPicker).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Test 5 (COMP-01/COMP-03): Geo failure falls back to empty state with CTA
// ---------------------------------------------------------------------------
test("geo failure falls back to empty state with CTA", async ({ page }) => {
  var context = page.context();
  await setupMocksGeoFail(context);

  // Clear localStorage -- first-time visitor
  await page.addInitScript(function () {
    localStorage.removeItem("custard:compare:stores");
    localStorage.removeItem("custard-primary");
  });

  await page.goto("/compare.html");

  // Wait for empty state to appear (geo fails, falls back)
  await page.waitForSelector("#compare-empty", { state: "visible", timeout: 10000 });

  // Empty state should be visible
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeVisible();

  // Add stores CTA button should be visible
  var addStoresBtn = page.locator("#compare-add-stores");
  await expect(addStoresBtn).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 6: Returning user skips geo and renders grid directly
// ---------------------------------------------------------------------------
test("returning user skips geo and renders grid directly", async ({ page }) => {
  var context = page.context();

  // Track geolocate requests
  var geoRequests = [];
  page.on("request", function (request) {
    if (request.url().indexOf("/api/v1/geolocate") !== -1) {
      geoRequests.push(request.url());
    }
  });

  await setupMocks(context);

  // Set saved stores -- returning user
  await page.addInitScript(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb"]));
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Should have 3 day cards
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // No geolocate fetch should have been made
  expect(geoRequests.length).toBe(0);
});
