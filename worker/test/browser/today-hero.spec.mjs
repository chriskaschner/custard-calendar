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

// Mock today response with rarity
const MOCK_TODAY = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: "2026-03-07",
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

// Mock forecast response
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

  // Cone should contain SVG
  var todayCone = page.locator("#today-cone");
  await expect(todayCone).toBeVisible();
  var coneHtml = await todayCone.innerHTML();
  expect(coneHtml).toContain("svg");

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
test("TDAY-06: want this every day CTA links to calendar", async ({ page }) => {
  await setupTodayPage(page);

  // Look for the CTA text
  var ctaSection = page.locator("#updates-cta");
  await expect(ctaSection).toBeVisible();

  var ctaText = await ctaSection.textContent();
  expect(ctaText).toMatch(/Want this every day/);

  // Find link to calendar
  var calLink = ctaSection.locator("a[href*='calendar']");
  await expect(calLink).toBeVisible();
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
