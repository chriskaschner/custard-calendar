import { expect, test } from "@playwright/test";

/**
 * Compare page expand/accordion tests (COMP-03).
 *
 * Covers: tapping a store row expands inline detail panel with description
 * and directions link, only one expanded at a time, tap again to collapse.
 *
 * NOTE: These tests will fail RED until Plan 02 implements accordion expand.
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

// Mock flavors responses
var MOCK_FLAVORS_MT_HOREB = {
  slug: "mt-horeb", name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
    { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan custard" },
    { date: DAY2_STR, title: "Vanilla", description: "Classic vanilla" },
  ],
};

var MOCK_FLAVORS_VERONA = {
  slug: "verona", name: "Verona",
  flavors: [
    { date: TODAY_STR, title: "Mint Chip", description: "Cool mint with chocolate chips" },
    { date: TOMORROW_STR, title: "Caramel Swirl", description: "Caramel swirl custard" },
    { date: DAY2_STR, title: "Strawberry", description: "Fresh strawberry" },
  ],
};

var MOCK_FLAVORS_MADISON = {
  slug: "madison-east", name: "Madison East",
  flavors: [
    { date: TODAY_STR, title: "Turtle Sundae", description: "Turtle sundae custard" },
    { date: TOMORROW_STR, title: "Cookie Dough", description: "Vanilla with cookie dough" },
    { date: DAY2_STR, title: "Peanut Butter Cup", description: "Peanut butter cup custard" },
  ],
};

var MOCK_TODAY_MT_HOREB = { slug: "mt-horeb", flavor: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces", date: TODAY_STR, rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" } };
var MOCK_TODAY_VERONA = { slug: "verona", flavor: "Mint Chip", description: "Cool mint with chocolate chips", date: TODAY_STR, rarity: null };
var MOCK_TODAY_MADISON = { slug: "madison-east", flavor: "Turtle Sundae", description: "Turtle sundae custard", date: TODAY_STR, rarity: null };
var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up compare page with 3 stores.
 */
async function setupComparePage(page) {
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
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
      activeRoute: { stores: ["mt-horeb", "verona", "madison-east"] },
    }));
  });
  await page.reload();
  await page.waitForSelector(".compare-day-card", { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// COMP-03: Tapping a store row expands inline detail panel
// ---------------------------------------------------------------------------
test("COMP-03: tapping store row expands detail panel with description and directions", async ({ page }) => {
  await setupComparePage(page);

  var todayCard = page.locator(".compare-day-card").first();
  var firstRow = todayCard.locator(".compare-store-row").first();

  // Click the row to expand
  await firstRow.click();

  // Detail panel should become visible
  var detail = todayCard.locator(".compare-store-detail").first();
  await expect(detail).toBeVisible();

  // Should contain flavor description
  var detailText = await detail.textContent();
  expect(detailText.length).toBeGreaterThan(0);

  // Should contain a directions link
  var directionsLink = detail.locator("a.compare-directions");
  await expect(directionsLink).toBeVisible();
  var href = await directionsLink.getAttribute("href");
  expect(href).toContain("google.com/maps/dir");
});

// ---------------------------------------------------------------------------
// COMP-03: Tapping a different row collapses the previous one
// ---------------------------------------------------------------------------
test("COMP-03: tapping different row collapses previous one", async ({ page }) => {
  await setupComparePage(page);

  var todayCard = page.locator(".compare-day-card").first();
  var rows = todayCard.locator(".compare-store-row");

  // Expand first row
  await rows.nth(0).click();
  var detail0 = todayCard.locator(".compare-store-detail").nth(0);
  await expect(detail0).toBeVisible();

  // Click second row -- first should collapse
  await rows.nth(1).click();

  // First detail should be hidden
  await expect(detail0).toBeHidden();

  // Second detail should be visible
  var detail1 = todayCard.locator(".compare-store-detail").nth(1);
  await expect(detail1).toBeVisible();
});

// ---------------------------------------------------------------------------
// COMP-03: Tapping same row again collapses it
// ---------------------------------------------------------------------------
test("COMP-03: tapping same row again collapses it", async ({ page }) => {
  await setupComparePage(page);

  var todayCard = page.locator(".compare-day-card").first();
  var firstRow = todayCard.locator(".compare-store-row").first();

  // Expand
  await firstRow.click();
  var detail = todayCard.locator(".compare-store-detail").first();
  await expect(detail).toBeVisible();

  // Collapse
  await firstRow.click();
  await expect(detail).toBeHidden();
});
