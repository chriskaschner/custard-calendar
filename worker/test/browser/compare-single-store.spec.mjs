import { expect, test } from "@playwright/test";

/**
 * Compare page single-store tests.
 *
 * Covers: 1-store grid rendering with add-more hint, auto-inherit from
 * custard-primary, zero-store empty state, add-store button from 1-store
 * view, and regression guard for 2+ store behavior.
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

// Mock geo response
var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up API mocks on the browser context.
 */
async function setupMocks(context) {
  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_MT_HOREB) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_VERONA) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
    }
  });

  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_MT_HOREB) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_VERONA) });
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

// ---------------------------------------------------------------------------
// Test 1: Single store shows grid, not empty state
// ---------------------------------------------------------------------------
test("single store shows grid with 3 day-cards, not empty state", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  // Set localStorage before page loads
  await page.addInitScript(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb"]));
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Should have 3 day cards
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // Each day card should have 1 store row with mt-horeb's flavors
  for (var i = 0; i < 3; i++) {
    var rows = dayCards.nth(i).locator(".compare-store-row");
    await expect(rows).toHaveCount(1);
  }

  // Empty state should be hidden
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeHidden();
});

// ---------------------------------------------------------------------------
// Test 2: Single store shows add-more hint
// ---------------------------------------------------------------------------
test("single store shows add-more hint in each day card", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  await page.addInitScript(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb"]));
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Each day card should contain an add-more hint
  var hints = page.locator(".compare-add-hint");
  await expect(hints).toHaveCount(3);

  // Hint text should mention adding/comparing
  var firstHintText = await hints.first().textContent();
  expect(firstHintText.toLowerCase()).toContain("add");
  expect(firstHintText.toLowerCase()).toContain("store");
});

// ---------------------------------------------------------------------------
// Test 3: Auto-inherit from custard-primary when compare:stores is empty
// ---------------------------------------------------------------------------
test("auto-inherits from custard-primary when compare:stores is empty", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  // Set only the primary store, no compare stores
  await page.addInitScript(function () {
    localStorage.removeItem("custard:compare:stores");
    localStorage.setItem("custard-primary", "mt-horeb");
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Grid should render with mt-horeb's data
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  // First day card should have a store row for mt-horeb
  var mtHorebRow = dayCards.first().locator('.compare-store-row[data-slug="mt-horeb"]');
  await expect(mtHorebRow).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4: Zero stores shows empty state
// ---------------------------------------------------------------------------
test("zero stores shows empty state with no day-cards", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  // Clear both storage keys
  await page.addInitScript(function () {
    localStorage.removeItem("custard:compare:stores");
    localStorage.removeItem("custard-primary");
  });

  await page.goto("/compare.html");

  // Wait for empty state to appear
  await page.waitForSelector("#compare-empty", { timeout: 10000 });

  // Empty state should be visible
  var emptyState = page.locator("#compare-empty");
  await expect(emptyState).toBeVisible();

  // Grid should not have day cards
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Test 5: Add-store button works from single-store view
// ---------------------------------------------------------------------------
test("add-store button visible and opens picker from single-store view", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  await page.addInitScript(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb"]));
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Store bar should have an "+ Add store" button
  var addBtn = page.locator(".compare-store-add-btn");
  await expect(addBtn).toBeVisible();

  // Click it and verify the picker modal appears
  await addBtn.click();
  var picker = page.locator(".compare-picker");
  await expect(picker).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 6: Existing 2+ store behavior unchanged (regression guard)
// ---------------------------------------------------------------------------
test("2+ stores render grid with multiple rows and no add-more hint", async ({ page }) => {
  var context = page.context();
  await setupMocks(context);

  await page.addInitScript(function () {
    localStorage.setItem("custard:compare:stores", JSON.stringify(["mt-horeb", "verona"]));
  });

  await page.goto("/compare.html");
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });

  // Should have 3 day cards with 2 store rows each
  var dayCards = page.locator(".compare-day-card");
  await expect(dayCards).toHaveCount(3);

  for (var i = 0; i < 3; i++) {
    var rows = dayCards.nth(i).locator(".compare-store-row");
    await expect(rows).toHaveCount(2);
  }

  // Should NOT have add-more hint
  var hints = page.locator(".compare-add-hint");
  await expect(hints).toHaveCount(0);
});
