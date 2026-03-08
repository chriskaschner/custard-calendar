import { expect, test } from "@playwright/test";

test("nav fits at 375px without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/index.html");

  const nav = page.locator("#shared-nav nav.nav-links");
  await expect(nav).toBeVisible();

  // Nav container should not overflow horizontally
  const navBox = await nav.boundingBox();
  expect(navBox.width).toBeLessThanOrEqual(375);

  // All 4 links should be visible
  const links = nav.locator("a");
  await expect(links).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(links.nth(i)).toBeVisible();
  }
});
