import { expect, test } from "@playwright/test";

/**
 * Compare page exclusion filter tests (COMP-05, COMP-06).
 *
 * Covers: exclusion filter chips above grid, toggling a chip dims matching
 * store rows, toggling again un-dims, excluded rows have reduced opacity
 * and pointer-events:none.
 *
 * NOTE: These tests will fail RED until Plan 02 implements exclusion filters.
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

// Verona has Mint Chip today (mint family) -- used for filter testing
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
// COMP-05: Exclusion filter chips are visible above the grid
// ---------------------------------------------------------------------------
test("COMP-05: exclusion filter chips are visible above grid", async ({ page }) => {
  await setupComparePage(page);

  var filterBar = page.locator(".compare-filter-bar");
  await expect(filterBar).toBeVisible();

  // Should have at least one filter chip
  var chips = page.locator(".compare-filter-chip");
  var chipCount = await chips.count();
  expect(chipCount).toBeGreaterThan(0);

  // Should have a "No Mint" chip
  var mintChip = page.locator('.compare-filter-chip:has-text("No Mint")');
  await expect(mintChip).toBeVisible();
});

// ---------------------------------------------------------------------------
// COMP-06: Tapping "No Mint" dims mint-family store rows
// ---------------------------------------------------------------------------
test("COMP-06: tapping No Mint chip dims mint-family rows", async ({ page }) => {
  await setupComparePage(page);

  // Find Verona row in first day card (has Mint Chip -- mint family)
  var todayCard = page.locator(".compare-day-card").first();
  var veronaRow = todayCard.locator('.compare-store-row[data-slug="verona"]');
  await expect(veronaRow).toBeVisible();

  // Before tapping, row should not be excluded
  await expect(veronaRow).not.toHaveClass(/compare-excluded/);

  // Tap the "No Mint" chip
  var mintChip = page.locator('.compare-filter-chip:has-text("No Mint")');
  await mintChip.click();

  // Verona row should now have reduced opacity (excluded class)
  await expect(veronaRow).toHaveClass(/compare-excluded/);

  // Check computed opacity is less than 1
  var opacity = await veronaRow.evaluate(function (el) {
    return parseFloat(window.getComputedStyle(el).opacity);
  });
  expect(opacity).toBeLessThan(1);
});

// ---------------------------------------------------------------------------
// COMP-06: Tapping chip again un-dims rows (toggle)
// ---------------------------------------------------------------------------
test("COMP-06: tapping chip again un-dims rows", async ({ page }) => {
  await setupComparePage(page);

  var todayCard = page.locator(".compare-day-card").first();
  var veronaRow = todayCard.locator('.compare-store-row[data-slug="verona"]');

  // Tap to exclude
  var mintChip = page.locator('.compare-filter-chip:has-text("No Mint")');
  await mintChip.click();
  await expect(veronaRow).toHaveClass(/compare-excluded/);

  // Tap again to un-exclude
  await mintChip.click();
  await expect(veronaRow).not.toHaveClass(/compare-excluded/);

  // Opacity should be back to 1
  var opacity = await veronaRow.evaluate(function (el) {
    return parseFloat(window.getComputedStyle(el).opacity);
  });
  expect(opacity).toBe(1);
});

// ---------------------------------------------------------------------------
// COMP-06: Excluded rows have pointer-events:none
// ---------------------------------------------------------------------------
test("COMP-06: excluded rows have pointer-events none", async ({ page }) => {
  await setupComparePage(page);

  var mintChip = page.locator('.compare-filter-chip:has-text("No Mint")');
  await mintChip.click();

  var todayCard = page.locator(".compare-day-card").first();
  var veronaRow = todayCard.locator('.compare-store-row[data-slug="verona"]');
  await expect(veronaRow).toHaveClass(/compare-excluded/);

  var pointerEvents = await veronaRow.evaluate(function (el) {
    return window.getComputedStyle(el).pointerEvents;
  });
  expect(pointerEvents).toBe("none");
});
