import { expect, test } from "@playwright/test";

/**
 * Multi-flavor hero card rendering (Kopp's-style stores that serve more than
 * one flavor of the day).
 *
 * These paths had zero coverage. They are also the paths that carried the
 * inline-style violations removed in the 2026-07-25 audit, so this spec pins
 * both the layout classes and the teardown that clears them.
 */

const MOCK_STORES = [
  { slug: "kopps-greenfield", name: "Kopp's Greenfield", city: "Greenfield", state: "WI", lat: 42.9614, lng: -88.0126, brand: "kopps" },
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", lat: 43.0045, lng: -89.7387, brand: "culvers" },
];

var _today = new Date();
_today.setHours(12, 0, 0, 0);
var TODAY_STR = _today.toISOString().slice(0, 10);
var _tomorrow = new Date(_today);
_tomorrow.setDate(_tomorrow.getDate() + 1);
var TOMORROW_STR = _tomorrow.toISOString().slice(0, 10);

// buildTimeline() derives a multi-flavor day from two /api/v1/flavors entries
// sharing the same date -- not from the forecast payload.
const MULTI_FLAVORS = {
  slug: "kopps-greenfield",
  name: "Kopp's Greenfield",
  flavors: [
    { date: TODAY_STR, title: "Blue Moon", description: "Almond-vanilla classic" },
    { date: TODAY_STR, title: "Turtle Sundae", description: "Caramel, chocolate, pecans" },
    { date: TOMORROW_STR, title: "Chocolate Chip Cookie Dough", description: "Cookie dough" },
    { date: TOMORROW_STR, title: "Raspberry Cheesecake", description: "Raspberry and cheesecake" },
  ],
  fetched_at: new Date().toISOString(),
};

const SINGLE_FLAVORS = {
  slug: "mt-horeb",
  name: "Mt. Horeb",
  flavors: [
    { date: TODAY_STR, title: "Chocolate Eclair", description: "Rich chocolate custard" },
    { date: TOMORROW_STR, title: "Butter Pecan", description: "Buttery pecan custard" },
  ],
  fetched_at: new Date().toISOString(),
};

const EMPTY_FORECAST = { forecast: [], fetchedAt: new Date().toISOString() };

/**
 * Route every endpoint the today page touches, switching the forecast payload
 * on the requested slug so a store change swaps single <-> multi flavor.
 */
async function setupMultiFlavorPage(page, initialSlug) {
  var context = page.context();

  await context.route("**/stores.json*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
    });
  });

  await context.route("**/api/v1/forecast/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPTY_FORECAST),
    });
  });

  await context.route("**/api/v1/today*", function (route) {
    var isKopps = route.request().url().indexOf("kopps-greenfield") !== -1;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        isKopps
          ? { slug: "kopps-greenfield", date: TODAY_STR, flavor: "Blue Moon" }
          : { slug: "mt-horeb", date: TODAY_STR, flavor: "Chocolate Eclair" }
      ),
    });
  });

  await context.route("**/api/v1/flavors*", function (route) {
    var isKopps = route.request().url().indexOf("kopps-greenfield") !== -1;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isKopps ? MULTI_FLAVORS : SINGLE_FLAVORS),
    });
  });

  await context.route("**/api/v1/geolocate", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lat: 43.0, lon: -89.4, city: "Madison", regionName: "Wisconsin" }),
    });
  });

  await context.route("**/api/v1/flavor-colors*", function (route) {
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await context.route("**/api/v1/reliability/*", function (route) {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reliability: null }),
    });
  });

  await page.goto("/index.html");
  await page.evaluate(function (slug) {
    localStorage.setItem("custard-primary", slug);
  }, initialSlug);
  await page.reload();
  await page.waitForSelector("#today-section:not([hidden])", { timeout: 10000 });
}

// ---------------------------------------------------------------------------

test("multi-flavor hero card stacks cones via classes, not inline styles", async ({ page }) => {
  await setupMultiFlavorPage(page, "kopps-greenfield");

  var cone = page.locator("#today-cone");
  await expect(cone).toHaveClass(/today-flavor-cone--multi/);

  // Parent switches to the column layout via a modifier class.
  // Scope to #today-section -- #today-loading has its own .today-flavor-body skeleton.
  var body = page.locator("#today-section .today-flavor-body");
  await expect(body).toHaveClass(/today-flavor-body--multi/);

  // One item per flavor, each with a label.
  var items = page.locator("#today-cone .multi-flavor-item");
  await expect(items).toHaveCount(2);
  await expect(page.locator("#today-cone .multi-flavor-label").first()).toHaveText("Blue Moon");
  await expect(page.locator("#today-cone .multi-flavor-label").nth(1)).toHaveText("Turtle Sundae");

  // Both flavor names land in the hero title.
  await expect(page.locator("#today-flavor")).toHaveText("Blue Moon & Turtle Sundae");

  // No inline styles anywhere in the multi-flavor subtree.
  var inlineStyleCount = await page.evaluate(function () {
    var root = document.getElementById("today-cone");
    var body = root.parentElement;
    var nodes = [body, root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    return nodes.filter(function (n) {
      return n.getAttribute("style");
    }).length;
  });
  expect(inlineStyleCount).toBe(0);
});

test("switching from a multi-flavor store to a single-flavor store clears the column layout", async ({ page }) => {
  await setupMultiFlavorPage(page, "kopps-greenfield");

  // Precondition: column layout is applied.
  await expect(page.locator("#today-section .today-flavor-body")).toHaveClass(/today-flavor-body--multi/);

  // Switch stores the same way SharedNav does.
  await page.evaluate(function () {
    localStorage.setItem("custard-primary", "mt-horeb");
    document.dispatchEvent(
      new CustomEvent("sharednav:storechange", {
        detail: { slug: "mt-horeb", store: { slug: "mt-horeb", name: "Mt. Horeb" } },
      })
    );
  });

  // The single-flavor render must tear the multi layout back down.
  await expect(page.locator("#today-flavor")).toHaveText("Chocolate Eclair", { timeout: 10000 });
  await expect(page.locator("#today-section .today-flavor-body")).not.toHaveClass(/today-flavor-body--multi/);
  await expect(page.locator("#today-cone")).toHaveClass(/today-flavor-cone cone-lg/);
  await expect(page.locator("#today-cone .multi-flavor-item")).toHaveCount(0);
});
