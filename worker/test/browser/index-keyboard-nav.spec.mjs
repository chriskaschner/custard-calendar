import { expect, test } from "@playwright/test";

test("index store search supports arrow-key navigation", async ({ page }) => {
  await page.route(
    "https://custard-calendar.chris-kaschner.workers.dev/api/v1/flavor-colors",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          base_colors: {},
          cone_colors: { waffle: "#D2691E", waffle_dark: "#B8860B" },
          topping_colors: {},
          ribbon_colors: {},
          profiles: {},
        }),
      });
    },
  );

  await page.goto("/index.html");

  const searchInput = page.locator("#store-search");
  const dropdown = page.locator("#store-dropdown");
  const items = page.locator("#store-dropdown .store-dropdown-item");

  await expect(searchInput).toBeVisible();

  await searchInput.fill("Madison");
  await expect(dropdown).toBeVisible();
  await expect.poll(async () => items.count()).toBeGreaterThan(1);

  await searchInput.press("ArrowDown");
  await expect(items.nth(0)).toHaveClass(/is-active/);
  await expect(items.nth(0)).toHaveAttribute("aria-selected", "true");

  await searchInput.press("ArrowDown");
  await expect(items.nth(1)).toHaveClass(/is-active/);
  await expect(items.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(items.nth(0)).toHaveAttribute("aria-selected", "false");

  await searchInput.press("ArrowUp");
  await expect(items.nth(0)).toHaveClass(/is-active/);
  await expect(items.nth(0)).toHaveAttribute("aria-selected", "true");

  await searchInput.press("Escape");
  await expect(dropdown).toBeHidden();
});
