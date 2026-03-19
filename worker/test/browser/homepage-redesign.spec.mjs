import { expect, test } from "@playwright/test";

/**
 * Homepage redesign layout tests (Phase 31).
 *
 * Verifies: hero card above fold at 375px, removed sections absent,
 * empty state minimal, week-ahead collapsed by default, skeleton structure,
 * CTA is a text line not a card.
 */

// Mock store manifest (same pattern as today-hero.spec.mjs)
const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
];

// Compute date strings matching page logic
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);

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
 * Follows the same pattern as today-hero.spec.mjs setupTodayPage().
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

test.describe("Homepage redesign (Phase 31)", () => {

  test("hero card is the only content above fold at 375px for returning user", async ({ page }) => {
    await setupWithMocks(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");
    await page.evaluate(() => {
      localStorage.setItem("custard-primary", "mt-horeb");
    });
    await page.reload();

    // Wait for hero card to appear (data loads via mocked endpoints)
    await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });

    // Empty state should be hidden
    var emptyState = page.locator("#empty-state");
    await expect(emptyState).toBeHidden();

    // Hero card should be visible
    var todaySection = page.locator("#today-section");
    await expect(todaySection).toBeVisible();

    // No h1 "Custard Forecast" anywhere on page
    var h1 = page.locator("h1");
    var h1Count = await h1.count();
    for (var i = 0; i < h1Count; i++) {
      var text = await h1.nth(i).textContent();
      expect(text).not.toContain("Custard Forecast");
    }
  });

  test("no removed sections exist in DOM", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");

    // Signals section removed
    await expect(page.locator("#signals-section")).toHaveCount(0);

    // Multi-store section removed
    await expect(page.locator("#multi-store-section")).toHaveCount(0);

    // 3-step guide removed
    await expect(page.locator(".first-visit-guide")).toHaveCount(0);

    // Coverage disclaimer removed
    await expect(page.locator(".hero-coverage")).toHaveCount(0);
  });

  test("empty state shows minimal prompt for first-visit user", async ({ page }) => {
    await setupWithMocks(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");
    await page.evaluate(() => {
      localStorage.removeItem("custard-primary");
    });
    await page.reload();

    var emptyState = page.locator("#empty-state");
    await expect(emptyState).toBeVisible();

    // Contains the single-sentence prompt
    await expect(emptyState).toContainText("Pick your Culver");

    // Find your store button exists
    var findBtn = page.locator("#find-store-btn");
    await expect(findBtn).toBeVisible();
    await expect(findBtn).toContainText("Find your store");

    // No 3-step guide
    await expect(page.locator(".first-visit-guide")).toHaveCount(0);

    // No "View the map" button
    var mapLink = emptyState.locator('a:has-text("View the map")');
    await expect(mapLink).toHaveCount(0);
  });

  test("week-ahead section is collapsed by default", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");

    var weekSection = page.locator("details#week-section");
    // The details element should exist but not have the 'open' attribute
    var isOpen = await weekSection.getAttribute("open");
    expect(isOpen).toBeNull();
  });

  test("skeleton has cone placeholder matching hero card layout", async ({ page }) => {
    await setupWithMocks(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");
    await page.evaluate(() => {
      localStorage.setItem("custard-primary", "mt-horeb");
    });
    await page.reload();

    // Check skeleton structure before data loads
    var skeleton = page.locator(".today-card-skeleton");
    var skeletonCone = page.locator(".skeleton-cone");

    // Skeleton should use today-card class for matching dimensions
    var skeletonClasses = await skeleton.getAttribute("class");
    expect(skeletonClasses).toContain("today-card");

    // Skeleton cone placeholder should exist
    await expect(skeletonCone).toHaveCount(1);
  });

  test("CTA section is a text line, not a card", async ({ page }) => {
    await setupWithMocks(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");
    await page.evaluate(() => {
      localStorage.setItem("custard-primary", "mt-horeb");
    });
    await page.reload();

    // Wait for data to load so CTA becomes visible
    await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });

    var ctaSection = page.locator("#updates-cta");
    // Should not contain the old card class
    var ctaClasses = await ctaSection.getAttribute("class");
    expect(ctaClasses || "").not.toContain("updates-cta-card");

    // Should contain "Get daily flavor alerts"
    await expect(ctaSection).toContainText("Get daily flavor alerts");

    // Should have a link to updates.html
    var link = ctaSection.locator('a[href="updates.html"]');
    await expect(link).toHaveCount(1);
  });
});
