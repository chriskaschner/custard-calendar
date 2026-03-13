import { expect, test } from "@playwright/test";

/**
 * Nearest store highlighting tests (MAP-02).
 *
 * Covers: nearest store marker CSS class, "Nearest to you" badge in results,
 * no nearest highlighting when GPS is not active.
 */

// Three stores at varying distances from GPS coords (43.05, -89.40)
var MOCK_NEARBY = {
  query: { flavor: "", location: "Madison, WI" },
  matches: [],
  nearby: [
    {
      slug: "madison-close",
      name: "Madison Close",
      address: "100 Main St, Madison WI",
      lat: 43.04,
      lon: -89.39,
      flavor: "Turtle",
      description: "Caramel and pecans",
    },
    {
      slug: "madison-mid",
      name: "Madison Mid",
      address: "200 Oak Ave, Madison WI",
      lat: 43.10,
      lon: -89.50,
      flavor: "Mint Explosion",
      description: "Cool mint with fudge",
    },
    {
      slug: "madison-far",
      name: "Madison Far",
      address: "300 Elm Blvd, Madison WI",
      lat: 43.20,
      lon: -89.70,
      flavor: "Chocolate Eclair",
      description: "Chocolate layers",
    },
  ],
  suggestions: [],
  all_flavors_today: ["Turtle", "Mint Explosion", "Chocolate Eclair"],
};

function mockRoutes(page, geolocateResponse) {
  return Promise.all([
    page.route("https://custard.chriskaschner.com/api/v1/geolocate", async (route) => {
      if (geolocateResponse === null) {
        await route.fulfill({ status: 500, body: "error" });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(geolocateResponse),
        });
      }
    }),
    page.route(/https:\/\/custard\.chriskaschner\.com\/api\/v1\/nearby-flavors\?.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_NEARBY),
      });
    }),
    page.route(/https:\/\/nominatim\.openstreetmap\.org\/reverse\?.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          address: { city: "Madison", state: "Wisconsin" },
        }),
      });
    }),
    page.route(/https:\/\/custard\.chriskaschner\.com\/api\/flavors\/catalog/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ flavors: [] }),
      });
    }),
  ]);
}

test("GPS active: nearest store marker has .flavor-map-marker-nearest class", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.05, longitude: -89.40 });

  await mockRoutes(page, { city: "Madison", state: "WI" });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Wait for GPS init and results to load
  await expect(page.locator("#location-input")).not.toHaveValue("", { timeout: 10000 });

  // Wait for markers to appear on the map
  await expect(page.locator(".flavor-map-marker")).toHaveCount(3, { timeout: 10000 });

  // Exactly 1 marker should have the nearest class
  const nearestCount = await page.locator(".flavor-map-marker-nearest").count();
  expect(nearestCount).toBe(1);
});

test("GPS active: nearest store pinned to top of results with badge", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.05, longitude: -89.40 });

  await mockRoutes(page, { city: "Madison", state: "WI" });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Wait for results to load
  await expect(page.locator("#location-input")).not.toHaveValue("", { timeout: 10000 });
  await expect(page.locator(".card--map-store")).toHaveCount(3, { timeout: 10000 });

  // First result card should contain "Nearest to you" badge
  const firstCard = page.locator("#results-body .card--map-store").first();
  await expect(firstCard).toContainText("Nearest to you");

  // First result card should be the closest store (madison-close)
  await expect(firstCard).toContainText("Madison Close");
});

test("GPS denied: no nearest highlighting, no badge", async ({ page }) => {
  // Do NOT grant geolocation -- Playwright denies by default
  await mockRoutes(page, { city: "Milwaukee", state: "WI" });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Wait for IP fallback to populate location and results to load
  await expect(page.locator("#location-input")).toHaveValue(/Milwaukee/, { timeout: 10000 });
  await expect(page.locator(".card--map-store").first()).toBeVisible({ timeout: 10000 });

  // No marker should have nearest class
  const nearestCount = await page.locator(".flavor-map-marker-nearest").count();
  expect(nearestCount).toBe(0);

  // No result card should contain the badge
  const badgeCount = await page.locator(".nearest-badge").count();
  expect(badgeCount).toBe(0);
});
