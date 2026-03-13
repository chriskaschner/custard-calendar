import { expect, test } from "@playwright/test";

/**
 * Map GPS centering and position dot tests (MAP-01, MAP-03).
 *
 * Covers: GPS auto-request on load, map centering on GPS coords,
 * position dot visibility, IP fallback, graceful degradation.
 */

// Mock nearby-flavors API response with stores near Madison
var MOCK_NEARBY = {
  query: { flavor: "", location: "Madison, WI" },
  matches: [],
  nearby: [
    {
      slug: "madison-east",
      name: "Madison East",
      address: "300 Oak Ave, Madison WI",
      lat: 43.07,
      lon: -89.30,
      flavor: "Turtle",
      description: "Caramel and pecans",
    },
    {
      slug: "fitchburg",
      name: "Fitchburg",
      address: "123 Main St, Fitchburg WI",
      lat: 43.01,
      lon: -89.42,
      flavor: "Mint Explosion",
      description: "Cool mint with fudge",
    },
  ],
  suggestions: [],
  all_flavors_today: ["Turtle", "Mint Explosion"],
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

test("GPS granted: map centers on GPS coordinates, not default Wisconsin center", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.05, longitude: -89.40 });

  await mockRoutes(page, { city: "Madison", state: "WI" });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Wait for GPS init to complete -- location input should be populated
  await expect(page.locator("#location-input")).not.toHaveValue("", { timeout: 10000 });

  // Check that map center is near GPS coords, not the default (43.0, -89.5)
  const center = await page.evaluate(() => {
    const c = window.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  });

  // GPS coords: 43.05, -89.40. Default: 43.0, -89.5.
  // Map should be within 0.5 degrees of GPS position
  expect(Math.abs(center.lat - 43.05)).toBeLessThan(0.5);
  expect(Math.abs(center.lng - (-89.40))).toBeLessThan(0.5);

  // Crucially, the map should NOT be at the exact default center
  const isAtDefault = Math.abs(center.lat - 43.0) < 0.01 && Math.abs(center.lng - (-89.5)) < 0.01;
  expect(isAtDefault).toBe(false);
});

test("GPS granted: position dot element visible on the map", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 43.05, longitude: -89.40 });

  await mockRoutes(page, { city: "Madison", state: "WI" });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Wait for GPS init to complete
  await expect(page.locator("#location-input")).not.toHaveValue("", { timeout: 10000 });

  // Position dot should be visible in the map
  const dotCount = await page.locator(".user-position-dot").count();
  expect(dotCount).toBe(1);
  await expect(page.locator(".user-position-dot")).toBeVisible();
});

test("GPS denied: falls back to IP geolocation, no position dot", async ({ page }) => {
  // Do NOT grant geolocation -- browser will deny by default in Playwright
  await mockRoutes(page, { city: "Milwaukee", state: "WI" });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Wait for IP fallback to populate location input
  await expect(page.locator("#location-input")).toHaveValue(/Milwaukee/, { timeout: 10000 });

  // No position dot should exist when GPS is not active
  const dotCount = await page.locator(".user-position-dot").count();
  expect(dotCount).toBe(0);
});

test("GPS denied + IP fails: map loads gracefully with no crash", async ({ page }) => {
  // Do NOT grant geolocation, mock IP geolocate to fail
  await mockRoutes(page, null);

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  // Page should load without crashing -- map element still visible
  await page.waitForTimeout(2000); // Give time for fallback logic to complete

  // Location input should be empty (no source succeeded)
  const locationValue = await page.locator("#location-input").inputValue();
  expect(locationValue).toBe("");

  // No position dot
  const dotCount = await page.locator(".user-position-dot").count();
  expect(dotCount).toBe(0);
});
