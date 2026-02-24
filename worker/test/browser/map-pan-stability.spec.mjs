import { expect, test } from "@playwright/test";

const COORD_LOCATION = "43.0679,-89.3937";

test("map retains markers when map-move search falls back to coordinate location", async ({ page }) => {
  await page.route("https://custard.chriskaschner.com/api/v1/geolocate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ city: "Fitchburg", state: "WI" }),
    });
  });

  await page.route(/https:\/\/custard\.chriskaschner\.com\/api\/v1\/nearby-flavors\?.*/, async (route) => {
    const url = new URL(route.request().url());
    const location = (url.searchParams.get("location") || "").trim();
    const isCoordinateQuery = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(location);

    if (isCoordinateQuery) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          query: { location, flavor: null },
          matches: [],
          nearby: [],
          suggestions: [],
          all_flavors_today: [],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: { location: "Fitchburg, WI", flavor: null },
        matches: [],
        suggestions: [],
        all_flavors_today: ["Turtle", "Mint Explosion", "Caramel Turtle"],
        nearby: [
          {
            slug: "fitchburg-east",
            name: "Fitchburg East, WI",
            address: "123 Main St",
            lat: 43.012,
            lon: -89.42,
            flavor: "Turtle",
            description: "Caramel and pecans",
            rank: 1,
          },
          {
            slug: "fitchburg-west",
            name: "Fitchburg West, WI",
            address: "456 Oak St",
            lat: 42.99,
            lon: -89.47,
            flavor: "Mint Explosion",
            description: "Mint with cookie pieces",
            rank: 2,
          },
          {
            slug: "madison-south",
            name: "Madison South, WI",
            address: "789 Pine St",
            lat: 43.04,
            lon: -89.39,
            flavor: "Caramel Turtle",
            description: "Caramel and chocolate",
            rank: 3,
          },
        ],
      }),
    });
  });

  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();

  await expect.poll(async () => page.locator(".flavor-map-marker").count()).toBeGreaterThan(0);
  const initialMarkerCount = await page.locator(".flavor-map-marker").count();
  expect(initialMarkerCount).toBeGreaterThan(0);

  const doSearchType = await page.evaluate(() => typeof window.doSearch);
  expect(doSearchType).toBe("function");

  // Simulate repeated map-move refreshes that hand coordinates back into search.
  for (let i = 0; i < 3; i++) {
    await page.fill("#location-input", COORD_LOCATION);
    await page.evaluate(async () => {
      await window.doSearch(true);
    });
  }

  const markerCountAfterCoordinateRefreshes = await page.locator(".flavor-map-marker").count();
  expect(markerCountAfterCoordinateRefreshes).toBe(initialMarkerCount);

  // Ensure original result cards remain instead of blanking out.
  await expect(page.locator("#results-body")).toContainText("Fitchburg East");
});

