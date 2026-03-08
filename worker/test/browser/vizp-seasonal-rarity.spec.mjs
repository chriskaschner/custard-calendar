import { expect, test } from "@playwright/test";

/**
 * VIZP-03: Seasonal rarity cadence suppression tests.
 *
 * Verifies that seasonal flavors (pumpkin, eggnog, etc.) suppress cadence text
 * like "every N days" while still showing rarity badges, and that non-seasonal
 * flavors continue to display cadence text normally.
 */

// Mock store manifest
var MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", address: "100 Main St", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", address: "200 Elm St", lat: 42.9919, lng: -89.5332, brand: "culvers" },
];

// Compute date strings matching the page's logic
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);
var _tomorrow = new Date(_today);
_tomorrow.setDate(_tomorrow.getDate() + 1);
var TOMORROW_STR = _tomorrow.toISOString().slice(0, 10);
var _day2 = new Date(_today);
_day2.setDate(_day2.getDate() + 2);
var DAY2_STR = _day2.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Mock data: seasonal flavor (Pumpkin Spice)
// ---------------------------------------------------------------------------
var MOCK_TODAY_SEASONAL = {
  slug: "mt-horeb",
  flavor: "Pumpkin Spice",
  description: "Pumpkin spice custard with seasonal spices",
  date: TODAY_STR,
  rarity: { appearances: 2, avg_gap_days: 90, label: "Rare" },
};

var MOCK_FORECAST_SEASONAL = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Pumpkin Spice", description: "Pumpkin spice custard", type: "confirmed" },
    { date: TOMORROW_STR, flavor: "Vanilla", description: "Classic vanilla", type: "confirmed" },
    { date: DAY2_STR, flavor: "Chocolate", description: "Rich chocolate", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

var MOCK_FLAVORS_SEASONAL = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Pumpkin Spice", description: "Pumpkin spice custard with seasonal spices" },
    { date: TOMORROW_STR, title: "Vanilla", description: "Classic vanilla" },
    { date: DAY2_STR, title: "Chocolate", description: "Rich chocolate" },
  ],
  fetched_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Mock data: non-seasonal flavor (Chocolate Eclair)
// ---------------------------------------------------------------------------
var MOCK_TODAY_NONSEASONAL = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 90, label: "Rare" },
};

var MOCK_FORECAST_NONSEASONAL = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Chocolate Eclair", description: "Rich chocolate custard", type: "confirmed" },
    { date: TOMORROW_STR, flavor: "Vanilla", description: "Classic vanilla", type: "confirmed" },
    { date: DAY2_STR, flavor: "Chocolate", description: "Rich chocolate", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

var MOCK_FLAVORS_NONSEASONAL = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
    { date: TOMORROW_STR, title: "Vanilla", description: "Classic vanilla" },
    { date: DAY2_STR, title: "Chocolate", description: "Rich chocolate" },
  ],
  fetched_at: new Date().toISOString(),
};

// Compare page mock data
var MOCK_FLAVORS_VERONA_SEASONAL = {
  slug: "verona",
  name: "Verona",
  flavors: [
    { date: TODAY_STR, title: "Eggnog", description: "Holiday eggnog custard" },
    { date: TOMORROW_STR, title: "Strawberry", description: "Fresh strawberry" },
    { date: DAY2_STR, title: "Caramel Swirl", description: "Caramel swirl custard" },
  ],
  fetched_at: new Date().toISOString(),
};

var MOCK_TODAY_VERONA_SEASONAL = {
  slug: "verona",
  flavor: "Eggnog",
  description: "Holiday eggnog custard",
  date: TODAY_STR,
  rarity: { appearances: 1, avg_gap_days: 150, label: "Ultra Rare" },
};

var MOCK_SIGNALS = { signals: [] };
var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up Today page with given mock data.
 */
async function setupTodayPage(page, opts) {
  var todayData = opts.todayData;
  var forecastData = opts.forecastData;
  var flavorsData = opts.flavorsData;
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(todayData) });
  });
  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(forecastData) });
  });
  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(flavorsData) });
  });
  await context.route("**/api/v1/signals/*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SIGNALS) });
  });
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_GEO) });
  });
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await context.route("**/api/v1/reliability/*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reliability: null }) });
  });

  await page.goto("/index.html");
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
  });
  await page.reload();
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });
}

/**
 * Set up Compare page with seasonal and non-seasonal stores.
 */
async function setupComparePage(page, opts) {
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/flavors*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(opts.flavorsMtHoreb) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_VERONA_SEASONAL) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
    }
  });
  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(opts.todayMtHoreb) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_VERONA_SEASONAL) });
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

  await page.goto("/compare.html");
  await page.evaluate(function () {
    localStorage.setItem("custard:v1:preferences", JSON.stringify({
      activeRoute: { stores: ["mt-horeb", "verona"] },
    }));
  });
  await page.reload();
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Test 1: Seasonal flavor on Today page shows rarity badge but NOT cadence text
// ---------------------------------------------------------------------------
test("VIZP-03: seasonal flavor on Today page shows rarity badge but not cadence text", async ({ page }) => {
  await setupTodayPage(page, {
    todayData: MOCK_TODAY_SEASONAL,
    forecastData: MOCK_FORECAST_SEASONAL,
    flavorsData: MOCK_FLAVORS_SEASONAL,
  });

  var todayRarity = page.locator("#today-rarity");
  await expect(todayRarity).toBeVisible();

  var rarityText = await todayRarity.textContent();
  // Should show the "Rare" badge
  expect(rarityText).toContain("Rare");
  // Should NOT show cadence text
  expect(rarityText).not.toContain("every");
  expect(rarityText).not.toContain("90 days");
});

// ---------------------------------------------------------------------------
// Test 2: Non-seasonal flavor on Today page shows both badge AND cadence text
// ---------------------------------------------------------------------------
test("VIZP-03: non-seasonal flavor on Today page shows badge and cadence text", async ({ page }) => {
  await setupTodayPage(page, {
    todayData: MOCK_TODAY_NONSEASONAL,
    forecastData: MOCK_FORECAST_NONSEASONAL,
    flavorsData: MOCK_FLAVORS_NONSEASONAL,
  });

  var todayRarity = page.locator("#today-rarity");
  await expect(todayRarity).toBeVisible();

  var rarityText = await todayRarity.textContent();
  // Should show both badge and cadence
  expect(rarityText).toContain("Rare");
  expect(rarityText).toMatch(/every.*90/);
});

// ---------------------------------------------------------------------------
// Test 3: Seasonal flavor on Compare page detail panel does NOT show cadence text
// ---------------------------------------------------------------------------
test("VIZP-03: seasonal flavor on Compare detail panel does not show cadence text", async ({ page }) => {
  await setupComparePage(page, {
    todayMtHoreb: MOCK_TODAY_SEASONAL,
    flavorsMtHoreb: MOCK_FLAVORS_SEASONAL,
  });

  // Click on the Pumpkin Spice row (first day card, first store row that has the seasonal flavor)
  var pumpkinRow = page.locator(".compare-store-row", { hasText: "Pumpkin Spice" });
  await expect(pumpkinRow).toBeVisible();
  await pumpkinRow.click();

  // Wait for detail panel to appear
  var detail = page.locator(".compare-store-detail:not([hidden])");
  await expect(detail).toBeVisible();

  var detailText = await detail.textContent();
  // Should NOT have cadence text
  expect(detailText).not.toContain("every");
  expect(detailText).not.toContain("90 days");
});

// ---------------------------------------------------------------------------
// Test 4: Non-seasonal flavor on Compare page detail panel shows cadence text
// ---------------------------------------------------------------------------
test("VIZP-03: non-seasonal flavor on Compare detail panel shows cadence text", async ({ page }) => {
  await setupComparePage(page, {
    todayMtHoreb: MOCK_TODAY_NONSEASONAL,
    flavorsMtHoreb: MOCK_FLAVORS_NONSEASONAL,
  });

  // Click on the Chocolate Eclair row
  var eclairRow = page.locator(".compare-store-row", { hasText: "Chocolate Eclair" });
  await expect(eclairRow).toBeVisible();
  await eclairRow.click();

  var detail = page.locator(".compare-store-detail:not([hidden])");
  await expect(detail).toBeVisible();

  var detailText = await detail.textContent();
  // Should have cadence text
  expect(detailText).toMatch(/every.*90/);
});

// ---------------------------------------------------------------------------
// Test 5: Seasonal flavor still shows rarity badge label text
// ---------------------------------------------------------------------------
test("VIZP-03: seasonal flavor still shows rarity badge label text on Today page", async ({ page }) => {
  await setupTodayPage(page, {
    todayData: MOCK_TODAY_SEASONAL,
    forecastData: MOCK_FORECAST_SEASONAL,
    flavorsData: MOCK_FLAVORS_SEASONAL,
  });

  var todayRarity = page.locator("#today-rarity");
  await expect(todayRarity).toBeVisible();

  // Badge element should contain "Rare" text
  var badge = todayRarity.locator(".rarity-badge");
  await expect(badge).toBeVisible();
  var badgeText = await badge.textContent();
  expect(badgeText).toBe("Rare");
});
