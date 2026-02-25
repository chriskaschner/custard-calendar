import { test, expect } from "@playwright/test";

test("primary store selection persists across alerts, siri, and radar", async ({ page }) => {
  await page.goto("/alerts.html");
  await page.waitForSelector('#store-select option[value="mt-horeb"]');
  await page.selectOption("#store-select", "mt-horeb");
  await expect(page.locator("#store-selected")).toBeVisible();

  await page.goto("/siri.html");
  await page.waitForSelector('#store-select option[value="mt-horeb"]');
  await expect(page.locator("#store-select")).toHaveValue("mt-horeb");
  await expect(page.locator("#store-selected")).toBeVisible();

  await page.goto("/radar.html");
  await page.waitForSelector('#store-select option[value="mt-horeb"]');
  await expect(page.locator("#store-select")).toHaveValue("mt-horeb");
  await expect(page.locator("#flavor-section")).toBeVisible();
});
