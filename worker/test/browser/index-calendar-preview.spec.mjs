import { expect, test } from "@playwright/test";

test("index calendar preview renders and updates with selected store context", async ({ page }) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  await page.route(
    "https://custard.chriskaschner.com/api/v1/flavor-colors",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          base_colors: { vanilla: "#F5DEB3" },
          cone_colors: { waffle: "#D2691E", waffle_dark: "#B8860B" },
          topping_colors: {},
          ribbon_colors: {},
          profiles: {},
        }),
      });
    },
  );

  await page.route(
    /https:\/\/custard-calendar\.chris-kaschner\.workers\.dev\/api\/v1\/flavors\?slug=.*/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          fetched_at: new Date().toISOString(),
          flavors: [
            {
              date: todayIso,
              title: "Turtle",
              description: "A Culver's classic with caramel and pecans.",
            },
          ],
        }),
      });
    },
  );

  await page.route(
    /https:\/\/custard-calendar\.chris-kaschner\.workers\.dev\/api\/v1\/forecast\/.*/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ days: [] }),
      });
    },
  );

  await page.route(
    /https:\/\/custard-calendar\.chris-kaschner\.workers\.dev\/api\/v1\/today\?slug=.*/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rarity: null }),
      });
    },
  );

  await page.goto("/index.html");

  await expect(page.locator("#calendar-preview-section")).toBeVisible();
  await expect(page.locator("#calendar-preview-section")).toContainText("Google Calendar style");
  await expect(page.locator("#calendar-preview-section")).toContainText("Apple Calendar style");

  const searchInput = page.locator("#store-search");
  const dropdownItems = page.locator("#store-dropdown .store-dropdown-item");
  await searchInput.fill("Madison");
  await expect.poll(async () => dropdownItems.count()).toBeGreaterThan(0);
  await dropdownItems.first().click();

  await expect(page.locator("#current-store")).toBeVisible();
  await expect(page.locator("#sample-google-location")).not.toContainText("Select a store");
  await expect(page.locator("#sample-apple-location")).not.toContainText("Select a store");
});
