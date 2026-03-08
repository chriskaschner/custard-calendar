import { expect, test } from "@playwright/test";

/**
 * VIZP-02: Card system unification tests.
 *
 * Verifies that .card base class exists on Today, Compare, and Fun pages
 * with consistent computed styles (border-radius, background, box-shadow),
 * and that design tokens resolve via getComputedStyle.
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

// Mock today response
var MOCK_TODAY = {
  slug: "mt-horeb",
  flavor: "Chocolate Eclair",
  description: "Rich chocolate custard with eclair pieces",
  date: TODAY_STR,
  rarity: { appearances: 3, avg_gap_days: 120, label: "Rare" },
};

// Mock forecast response
var MOCK_FORECAST = {
  slug: "mt-horeb",
  forecast: [
    { date: TODAY_STR, flavor: "Chocolate Eclair", description: "Rich chocolate custard with eclair pieces", type: "confirmed" },
    { date: TOMORROW_STR, flavor: "Butter Pecan", description: "Buttery pecan custard", type: "confirmed" },
    { date: DAY2_STR, flavor: "Vanilla", description: "Classic vanilla", type: "confirmed" },
  ],
  fetchedAt: new Date().toISOString(),
};

// Mock flavors response
var MOCK_FLAVORS = {
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

var MOCK_TODAY_VERONA = {
  slug: "verona",
  flavor: "Mint Chip",
  description: "Cool mint with chocolate chips",
  date: TODAY_STR,
  rarity: null,
};

var MOCK_SIGNALS = { signals: [] };
var MOCK_GEO = { lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" };

/**
 * Set up Today page with API mocks and localStorage.
 */
async function setupTodayPage(page) {
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
 * Set up Compare page with API mocks and localStorage.
 */
async function setupComparePage(page) {
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stores: MOCK_STORES }) });
  });
  await context.route("**/api/v1/flavors*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=mt-horeb") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS) });
    } else if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_FLAVORS_VERONA) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ flavors: [] }) });
    }
  });
  await context.route("**/api/v1/today*", function (route) {
    var url = route.request().url();
    if (url.indexOf("slug=verona") !== -1) {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY_VERONA) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TODAY) });
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
// Test 1: Today hero has .card class with correct computed styles
// ---------------------------------------------------------------------------
test("VIZP-02: Today hero card has .card class with 12px border-radius, white bg, and box-shadow", async ({ page }) => {
  await setupTodayPage(page);

  var todayCard = page.locator("#today-card");
  await expect(todayCard).toBeVisible();

  // Verify .card class is present
  var classes = await todayCard.getAttribute("class");
  expect(classes).toContain("card");

  // Verify computed styles
  var styles = await todayCard.evaluate(function (el) {
    var cs = getComputedStyle(el);
    return {
      borderRadius: cs.borderRadius,
      backgroundColor: cs.backgroundColor,
      boxShadow: cs.boxShadow,
    };
  });

  expect(styles.borderRadius).toBe("12px");
  expect(styles.backgroundColor).toBe("rgb(255, 255, 255)");
  expect(styles.boxShadow).not.toBe("none");
});

// ---------------------------------------------------------------------------
// Test 2: Compare day cards have .card class with matching styles
// ---------------------------------------------------------------------------
test("VIZP-02: Compare day cards have .card class with matching border-radius and background", async ({ page }) => {
  await setupComparePage(page);

  var dayCards = page.locator(".compare-day-card");
  var count = await dayCards.count();
  expect(count).toBeGreaterThan(0);

  // Check first day card
  var firstCard = dayCards.first();
  var classes = await firstCard.getAttribute("class");
  expect(classes).toContain("card");

  var styles = await firstCard.evaluate(function (el) {
    var cs = getComputedStyle(el);
    return {
      borderRadius: cs.borderRadius,
      backgroundColor: cs.backgroundColor,
    };
  });

  expect(styles.borderRadius).toBe("12px");
  expect(styles.backgroundColor).toBe("rgb(255, 255, 255)");
});

// ---------------------------------------------------------------------------
// Test 3: Fun quiz mode cards have .card class with matching styles
// ---------------------------------------------------------------------------
test("VIZP-02: Fun quiz mode cards have .card class with matching border-radius and background", async ({ page }) => {
  await page.goto("/fun.html");

  var quizCards = page.locator(".quiz-mode-card");
  await expect(quizCards.first()).toBeVisible();

  var firstCard = quizCards.first();
  var classes = await firstCard.getAttribute("class");
  expect(classes).toContain("card");

  var styles = await firstCard.evaluate(function (el) {
    var cs = getComputedStyle(el);
    return {
      borderRadius: cs.borderRadius,
      backgroundColor: cs.backgroundColor,
    };
  });

  expect(styles.borderRadius).toBe("12px");
  expect(styles.backgroundColor).toBe("rgb(255, 255, 255)");
});

// ---------------------------------------------------------------------------
// Test 4: Design tokens resolve to non-empty values
// ---------------------------------------------------------------------------
test("VIZP-02: Design tokens (--text-base, --space-4, --text-primary) resolve to non-empty values", async ({ page }) => {
  await page.goto("/index.html");

  var tokens = await page.evaluate(function () {
    var root = getComputedStyle(document.documentElement);
    return {
      textBase: root.getPropertyValue("--text-base").trim(),
      space4: root.getPropertyValue("--space-4").trim(),
      textPrimary: root.getPropertyValue("--text-primary").trim(),
    };
  });

  expect(tokens.textBase).not.toBe("");
  expect(tokens.space4).not.toBe("");
  expect(tokens.textPrimary).not.toBe("");
});
