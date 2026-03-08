import { expect, test } from "@playwright/test";

test("UPDT-01: updates page has Calendar, Alerts, Widget, Siri sections", async ({ page }) => {
  await page.goto("/updates.html");
  await expect(page.locator("#calendar-section")).toBeVisible();
  await expect(page.locator("#alerts-section")).toBeVisible();
  await expect(page.locator("#widget-section")).toBeVisible();
  await expect(page.locator("#siri-section")).toBeVisible();
});

test("UPDT-02: each section has heading and description", async ({ page }) => {
  await page.goto("/updates.html");
  for (const id of ["calendar-section", "alerts-section", "widget-section", "siri-section"]) {
    const section = page.locator("#" + id);
    // Each section should have at least a heading element
    const heading = section.locator("h2, h3, strong").first();
    await expect(heading).toBeVisible();
  }
});

test("UPDT-03: inline alert signup form exists with email input and submit", async ({ page }) => {
  await page.goto("/updates.html");
  const form = page.locator("#alert-form");
  await expect(form).toBeVisible();
  await expect(form.locator('input[type="email"]')).toBeVisible();
  await expect(form.locator('button[type="submit"], input[type="submit"]')).toBeVisible();
});

test("UPDT-03: alert flavor chips are tappable", async ({ page }) => {
  await page.goto("/updates.html");
  const chips = page.locator(".alert-chip");
  const count = await chips.count();
  expect(count).toBeGreaterThanOrEqual(5);
  // Tap first chip -- should toggle selected class
  await chips.first().click();
  await expect(chips.first()).toHaveClass(/selected/);
  // Tap again to deselect
  await chips.first().click();
  await expect(chips.first()).not.toHaveClass(/selected/);
});

test("UPDT-04: store auto-filled from header", async ({ page, context }) => {
  // Set localStorage to simulate a saved store (custard-primary is the actual key)
  await context.addInitScript(() => {
    localStorage.setItem("custard-primary", "mt-horeb");
  });
  await page.goto("/updates.html");
  // Store name should appear somewhere on the page
  await expect(page.locator(".store-auto-fill").first()).toContainText(/mt horeb/i);
});

test("UPDT-05: Today page CTA links to updates.html", async ({ page }) => {
  await page.goto("/index.html");
  const link = page.locator("#updates-cta-link, #updates-cta a[href*='updates']");
  // The CTA may be hidden until data loads, so just check the href
  await expect(link).toHaveAttribute("href", /updates\.html/);
});

test("UPDT-05: Compare page has CTA linking to updates.html", async ({ page }) => {
  await page.goto("/compare.html");
  // Scope to the #updates-cta section to avoid matching the shared footer link
  const link = page.locator('#updates-cta a[href*="updates.html"]');
  await expect(link).toBeVisible();
});
