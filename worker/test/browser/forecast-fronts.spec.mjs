import { expect, test } from "@playwright/test";

test("forecast fronts page loads with mocked nearby + forecast data", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await page.route("https://custard.chriskaschner.com/api/v1/geolocate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ city: "Madison", state: "WI" }),
    });
  });

  await page.route(/https:\/\/custard\.chriskaschner\.com\/api\/v1\/nearby-flavors\?.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: { location: "Madison, WI", flavor: null },
        matches: [],
        suggestions: [],
        all_flavors_today: ["Mint Explosion", "Turtle"],
        nearby: [
          {
            slug: "mt-horeb",
            name: "Mt. Horeb, WI",
            address: "505 Springdale St",
            lat: 43.011,
            lon: -89.718,
            flavor: "Mint Explosion",
            description: "Cool mint with cookie pieces",
            rank: 1,
          },
          {
            slug: "madison-todd-drive",
            name: "Madison, WI",
            address: "6418 Odana Rd",
            lat: 43.056,
            lon: -89.478,
            flavor: "Turtle",
            description: "Caramel and pecans",
            rank: 2,
          },
        ],
      }),
    });
  });

  await page.route(/https:\/\/custard\.chriskaschner\.com\/api\/v1\/forecast\/.*/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        store_slug: "mock-store",
        generated_at: new Date().toISOString(),
        days: [
          {
            date: today,
            predictions: [
              { flavor: "Mint Explosion", probability: 0.24 },
              { flavor: "Turtle", probability: 0.12 },
            ],
          },
          {
            date: tomorrow,
            predictions: [
              { flavor: "Turtle", probability: 0.21 },
              { flavor: "Mint Explosion", probability: 0.11 },
            ],
          },
        ],
      }),
    });
  });

  await page.goto("/forecast-map.html");

  await expect(page.locator("#fronts-map")).toBeVisible();
  await expect(page.locator("#fronts-status")).toContainText("Loaded");

  const flavorOptionCount = await page.locator("#fronts-flavor option").count();
  expect(flavorOptionCount).toBeGreaterThan(0);

  const hotspotCount = await page.locator("#fronts-hotspots li").count();
  expect(hotspotCount).toBeGreaterThan(0);

  await page.locator("#fronts-day").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#fronts-day-label")).toContainText("Tomorrow");
});
