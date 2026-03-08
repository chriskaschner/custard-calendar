import { expect, test } from "@playwright/test";

/**
 * Today page hero card tests (TDAY-01, TDAY-02, TDAY-05, TDAY-06, TDAY-07).
 *
 * Covers: hero card display, rarity badge, flavor signal nudge,
 * "Want this every day?" CTA, and absence of removed sections.
 */

// Mock store manifest
const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Compute date strings matching page logic (same pattern as other test files)
var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);
var _tomorrow = new Date(_today);
_tomorrow.setDate(_tomorrow.getDate() + 1);
var TOMORROW_STR = _tomorrow.toISOString().slice(0, 10);
var _day2 = new Date(_today); _day2.setDate(_day2.getDate() + 2);
var DAY2_STR = _day2.toISOString().slice(0, 10);
var _day3 = new Date(_today); _day3.setDate(_day3.getDate() + 3);
var DAY3_STR = _day3.toISOString().slice(0, 10);
var _day4 = new Date(_today); _day4.setDate(_day4.getDate() + 4);
var DAY4_STR = _day4.toISOString().slice(0, 10);
var _day5 = new Date(_today); _day5.setDate(_day5.getDate() + 5);
var DAY5_STR = _day5.toISOString().slice(0, 10);
var _day6 = new Date(_today); _day6.setDate(_day6.getDate() + 6);
var DAY6_STR = _day6.toISOString().slice(0, 10);

// Mock today response with rarity
const MOCK_TODAY = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

// Mock forecast response
const MOCK_FORECAST = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces", type: "confirmed" },
    { date: TOMORROW_STR, flavor: "Butter Pecan", description: "Buttery pecan custard", type: "confirmed" },
    { date: DAY2_STR, flavor: "Vanilla", description: "Classic vanilla", type: "confirmed" },
    { date: DAY3_STR, flavor: "Mint Chip", description: "Cool mint with chocolate chips", type: "confirmed" },
    { date: DAY4_STR, flavor: "Caramel Cashew", description: "Caramel swirl with cashews", type: "confirmed" },
    { date: DAY5_STR, flavor: "Cookie Dough", description: "Vanilla with cookie dough", type: "confirmed" },
    { date: DAY6_STR, flavor: "Strawberry", description: "Fresh strawberry", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

// Mock flavors response
const MOCK_FLAVORS = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces" },
    { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan custard" },
    { date: DAY2_STR, title: "Vanilla", description: "Classic vanilla" },
    { date: DAY3_STR, title: "Mint Chip", description: "Cool mint with chocolate chips" },
    { date: DAY4_STR, title: "Caramel Cashew", description: "Caramel swirl with cashews" },
    { date: DAY5_STR, title: "Cookie Dough", description: "Vanilla with cookie dough" },
    { date: DAY6_STR, title: "Strawberry", description: "Fresh strawberry" },
  ],
  fetched_at: new Date().toISOString(),
};

// Mock signals response
const MOCK_SIGNALS = {
  signals: [{ headline: "Peaks on Sundays", explanation: "This flavor appears 2x more on Sundays" }],
};

// Mock geo response
const MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up page with API mocks and localStorage for today page tests.
 */
async function setupTodayPage(page) {
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

  // Mock flavor-colors endpoint (used by cone-renderer.js)
  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Mock reliability endpoint (used by loadForecast)
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
// TDAY-01: Hero card shows cone, flavor name, and description
// ---------------------------------------------------------------------------
test("TDAY-01: hero card shows cone, flavor name, and description", async ({ page }) => {
  await setupTodayPage(page);

  // today-section should be visible
  var todaySection = page.locator("#today-section");
  await expect(todaySection).toBeVisible();

  // Cone should contain SVG or hero PNG <img>
  var todayCone = page.locator("#today-cone");
  await expect(todayCone).toBeVisible();
  var coneHtml = await todayCone.innerHTML();
  // After VIZP-01, hero card may render a PNG <img> or fall back to SVG
  expect(coneHtml).toMatch(/svg|img/);

  // Flavor name should be "Chocolate Eclair"
  var todayFlavor = page.locator("#today-flavor");
  await expect(todayFlavor).toHaveText("Chocolate Eclair");

  // Description should have text content
  var todayDesc = page.locator("#today-desc");
  var descText = await todayDesc.textContent();
  expect(descText.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// TDAY-02: Rarity badge displays when flavor is rare
// ---------------------------------------------------------------------------
test("TDAY-02: rarity badge displays when flavor is rare", async ({ page }) => {
  await setupTodayPage(page);

  var todayRarity = page.locator("#today-rarity");
  await expect(todayRarity).toBeVisible();

  var rarityText = await todayRarity.textContent();
  expect(rarityText).toMatch(/Rare/);
  expect(rarityText).toMatch(/120/);
});

// ---------------------------------------------------------------------------
// TDAY-05: Flavor signal displays when relevant
// ---------------------------------------------------------------------------
test("TDAY-05: flavor signal displays when relevant", async ({ page }) => {
  await setupTodayPage(page);

  // Wait a bit for signals to load (async fetch)
  await page.waitForTimeout(2000);

  var signalsSection = page.locator("#signals-section");
  await expect(signalsSection).toBeVisible();

  var signalsText = await signalsSection.textContent();
  expect(signalsText).toMatch(/Peaks on Sundays/);
});

// ---------------------------------------------------------------------------
// TDAY-06: "Want this every day?" CTA links to calendar
// ---------------------------------------------------------------------------
test("TDAY-06: want this every day CTA links to updates", async ({ page }) => {
  await setupTodayPage(page);

  // Look for the CTA text
  var ctaSection = page.locator("#updates-cta");
  await expect(ctaSection).toBeVisible();

  var ctaText = await ctaSection.textContent();
  expect(ctaText).toMatch(/Want this every day/);

  // Find link to updates page (changed from calendar.html to updates.html)
  var updatesLink = ctaSection.locator("a[href*='updates']");
  await expect(updatesLink).toBeVisible();
});

// ---------------------------------------------------------------------------
// TDAY-07: Removed sections are absent
// ---------------------------------------------------------------------------
test("TDAY-07: removed sections are absent", async ({ page }) => {
  await setupTodayPage(page);

  // Today's Drive section should be hidden or removed
  var driveSection = page.locator("#todays-drive-section");
  var driveCount = await driveSection.count();
  if (driveCount > 0) {
    await expect(driveSection).toBeHidden();
  }

  // Calendar preview section should be hidden or removed
  var calPreview = page.locator("#calendar-preview-section");
  var calCount = await calPreview.count();
  if (calCount > 0) {
    await expect(calPreview).toBeHidden();
  }

  // Predictions should be hidden or removed
  var predictions = page.locator("#today-predictions");
  var predCount = await predictions.count();
  if (predCount > 0) {
    await expect(predictions).toBeHidden();
  }

  // Badge should be hidden or empty
  var badge = page.locator("#today-badge");
  var badgeCount = await badge.count();
  if (badgeCount > 0) {
    var badgeText = await badge.textContent();
    expect(badgeText.trim()).toBe("");
  }
});
