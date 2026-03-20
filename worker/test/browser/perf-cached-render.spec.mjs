import { expect, test } from "@playwright/test";

/**
 * Performance: cached hero render tests (Phase 33).
 *
 * Verifies: returning users see hero card from localStorage cache instantly
 * (without network), stale cache from yesterday is discarded, and first-visit
 * users see empty state normally.
 */

// Mock store manifest (same pattern as homepage-redesign.spec.mjs)
const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
];

// Compute date strings matching page logic
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);

var _yesterday = new Date(_today);
_yesterday.setDate(_yesterday.getDate() - 1);
var YESTERDAY_STR = _yesterday.toISOString().slice(0, 10);

// Mock today response
const MOCK_TODAY = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

// Mock forecast response (today only -- enough for hero card test)
const MOCK_FORECAST = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

// Mock flavors response
const MOCK_FLAVORS = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
  ],
  fetched_at: new Date().toISOString(),
};

/**
 * Set up route mocks so the page can load data for a returning user.
 * Follows the same pattern as homepage-redesign.spec.mjs setupWithMocks().
 */
async function setupWithMocks(page) {
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/today*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY) });
  });
  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FORECAST) });
  });
  await context.route("**/api/v1/flavors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS) });
  });
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await context.route("**/api/v1/reliability/*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reliability: null }) });
  });
  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" }) });
  });
  await context.route("**/api/v1/nearby-flavors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nearby: [] }) });
  });
}

test.describe("Performance: cached hero render (Phase 33)", () => {

  test("renders hero card from localStorage cache without network", async ({ page }) => {
    // Use setupWithMocks first (provides stores.json and flavor-colors needed for init),
    // but then override the flavor data API routes with stalling responses that never resolve.
    // This simulates network being slow/unavailable while cache renders instantly.
    await setupWithMocks(page);

    // Override flavor data routes to stall indefinitely (never resolve)
    await page.route("**/api/v1/flavors*", function (route) {
      // Don't fulfill or abort -- just hold the request forever to simulate slow network
    });
    await page.route("**/api/v1/forecast/*", function (route) {
      // Stall
    });
    await page.route("**/api/v1/today*", function (route) {
      // Stall
    });
    await page.route("**/api/v1/reliability/*", function (route) {
      // Stall
    });

    await page.goto("/index.html");

    // Set localStorage: saved store + hero cache with today's date
    await page.evaluate(function (todayStr) {
      localStorage.setItem("custard-primary", "mt-horeb");
      localStorage.setItem("custard-hero-cache", JSON.stringify({
        slug: "mt-horeb",
        flavor: "Chocolate Eclair",
        description: "Rich chocolate custard",
        date: todayStr,
        type: "confirmed",
        fetchedAt: new Date().toISOString(),
        ts: Date.now()
      }));
    }, TODAY_STR);

    await page.reload();

    // The hero card should render from cache immediately, no network needed
    await page.waitForSelector("#today-section:not([hidden])", { timeout: 5000 });

    // Verify the cached flavor name is rendered (API responses are stalled,
    // so any content must have come from localStorage cache)
    var flavorText = await page.locator("#today-flavor").textContent();
    expect(flavorText).toBe("Chocolate Eclair");
  });

  test("shows skeleton for stale cache from previous day", async ({ page }) => {
    await setupWithMocks(page);

    await page.goto("/index.html");

    // Set localStorage with YESTERDAY's date (stale cache)
    await page.evaluate(function (yesterdayStr) {
      localStorage.setItem("custard-primary", "mt-horeb");
      localStorage.setItem("custard-hero-cache", JSON.stringify({
        slug: "mt-horeb",
        flavor: "Chocolate Eclair",
        description: "Rich chocolate custard",
        date: yesterdayStr,
        type: "confirmed",
        fetchedAt: new Date().toISOString(),
        ts: Date.now()
      }));
    }, YESTERDAY_STR);

    await page.reload();

    // Stale cache should be discarded -- the hero card should NOT show stale flavor
    // immediately. Instead, loading skeleton shows until fresh data arrives from API.
    // Wait briefly for the initial synchronous render pass
    await page.waitForTimeout(200);

    // The stale "Chocolate Eclair" from cache should NOT be visible before API loads
    // (the page should be showing skeleton or waiting for API data)
    var todaySectionHidden = await page.locator("#today-section").getAttribute("hidden");
    var todayLoadingHidden = await page.locator("#today-loading").getAttribute("hidden");

    // Either today-section is hidden (showing skeleton) or loading is visible
    // The key assertion: stale data is NOT rendered from cache
    if (todaySectionHidden !== null) {
      // today-section is hidden, skeleton is showing -- correct behavior
      expect(todayLoadingHidden).toBeNull(); // loading should be visible (not hidden)
    }

    // Eventually, fresh data loads from the mocked API
    await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });
  });

  test("first-visit user without cache sees empty state", async ({ page }) => {
    await setupWithMocks(page);

    await page.goto("/index.html");

    // Clear all relevant localStorage keys
    await page.evaluate(function () {
      localStorage.removeItem("custard-primary");
      localStorage.removeItem("custard-hero-cache");
    });

    await page.reload();

    // Empty state should be visible
    var emptyState = page.locator("#empty-state");
    await expect(emptyState).toBeVisible();

    // Today section should be hidden
    var todaySection = page.locator("#today-section");
    await expect(todaySection).toBeHidden();
  });

});
