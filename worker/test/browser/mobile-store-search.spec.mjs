import { expect, test } from "@playwright/test";

/**
 * iPhone-sized browser test: open store picker, type "horeb", select store.
 * Covers header layout, store chip, picker bottom sheet, search filtering,
 * and store selection on a 390x844 viewport (iPhone 14).
 */

const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", address: "505 E Main St", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", address: "601 Hometown Cir", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", address: "4602 E Washington Ave", lat: 43.0731, lng: -89.3012, brand: "culvers" },
  { slug: "mineral-point", name: "Mineral Point", city: "Mineral Point", state: "WI", address: "301 Dodge St", lat: 42.8600, lng: -90.1798, brand: "culvers" },
  { slug: "madison-todd-drive", name: "Madison Todd Drive", city: "Madison", state: "WI", address: "6602 Mineral Point Rd", lat: 43.0540, lng: -89.5009, brand: "culvers" },
];

function setupRoutes(context) {
  return Promise.all([
    context.route("**/stores.json*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: MOCK_STORES }),
      });
    }),
    context.route("**/api/v1/geolocate", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ lat: 43.0, lon: -89.4 }),
      });
    }),
    context.route("**/api/v1/**", (route) => {
      if (route.request().url().includes("geolocate")) return route.continue();
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }),
  ]);
}

// iPhone 14 viewport
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

test("header elements do not overlap at iPhone width", async ({ page }) => {
  await setupRoutes(page.context());
  await page.goto("/index.html");
  await page.evaluate(() => {
    localStorage.setItem("custard-primary", "mineral-point");
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(2000);

  // Header should exist
  const header = page.locator(".site-header");
  await expect(header).toBeVisible();

  // Nav pill and store chip should both be visible
  const navLinks = page.locator(".nav-links");
  const storeChip = page.locator(".store-indicator");
  await expect(navLinks).toBeVisible();
  await expect(storeChip).toBeVisible();

  // They should not overlap -- store chip should be to the right of nav
  const navBox = await navLinks.boundingBox();
  const chipBox = await storeChip.boundingBox();
  expect(navBox).toBeTruthy();
  expect(chipBox).toBeTruthy();

  // The chip left edge should be at or past the nav right edge (no overlap)
  expect(chipBox.x).toBeGreaterThanOrEqual(navBox.x + navBox.width - 2); // 2px tolerance

  // Nothing should overflow the viewport
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(390 + 1);
  expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(390 + 1);

  await page.screenshot({ path: "test-results/mobile-header-layout.png" });
});

test("store picker opens, search filters to 'horeb', and selection works", async ({ page }) => {
  await setupRoutes(page.context());
  await page.goto("/index.html");
  await page.evaluate(() => {
    localStorage.setItem("custard-primary", "verona");
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(2000);

  // Step 1: Tap the store chip to open picker
  const storeChip = page.locator(".store-indicator");
  await expect(storeChip).toBeVisible();
  await storeChip.click();
  await page.waitForTimeout(500);

  // Step 2: Picker panel should be visible
  const panel = page.locator(".store-picker-panel");
  await expect(panel).toBeVisible();

  // Step 3: Store list should be visible (not hidden behind keyboard)
  const list = page.locator(".store-picker-list");
  await expect(list).toBeVisible();
  const listBox = await list.boundingBox();
  expect(listBox.height).toBeGreaterThan(50);

  // Step 4: All stores should be visible initially
  const allItems = page.locator(".store-picker-item");
  await expect(allItems).toHaveCount(5);

  // Step 5: Search input should NOT be focused (touch device)
  const searchFocused = await page.evaluate(() => {
    return document.querySelector(".store-picker-search") === document.activeElement;
  });
  expect(searchFocused).toBe(false);

  await page.screenshot({ path: "test-results/mobile-picker-open.png" });

  // Step 6: Simulate the virtual keyboard appearing (covers bottom ~50%)
  // iOS keyboard on iPhone 14 is roughly 300-340px tall, leaving ~500px visible.
  // We simulate this by firing a visualViewport resize event.
  await page.evaluate(() => {
    if (window.visualViewport) {
      // Simulate keyboard opening: viewport shrinks from 844 to ~500px
      Object.defineProperty(window.visualViewport, 'height', {
        value: 500,
        writable: true,
        configurable: true,
      });
      window.visualViewport.dispatchEvent(new Event('resize'));
    }
  });
  await page.waitForTimeout(100);

  // Step 7: Tap search field and type "horeb"
  const searchInput = page.locator(".store-picker-search");
  await searchInput.click();
  await searchInput.fill("horeb");
  await page.waitForTimeout(300);

  // Step 8: Only "Mt. Horeb" should be visible (others filtered out)
  const visibleItems = page.locator(".store-picker-item:not(.hidden)");
  await expect(visibleItems).toHaveCount(1);
  const visibleText = await visibleItems.first().textContent();
  expect(visibleText).toContain("Mt. Horeb");

  // Step 9: The filtered result must be within the visible area (above keyboard)
  // The keyboard starts at y=500, so the result must be above that
  const resultBox = await visibleItems.first().boundingBox();
  expect(resultBox).toBeTruthy();
  expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(500);

  await page.screenshot({ path: "test-results/mobile-picker-filtered.png" });

  // Step 10: Tap the filtered result to select it
  await visibleItems.first().click();
  await page.waitForTimeout(500);

  // Step 9: Picker should close
  await expect(panel).not.toBeVisible();

  // Step 10: Store chip should now show "Mt. Horeb"
  const chipText = await storeChip.textContent();
  expect(chipText).toContain("Mt. Horeb");

  // Step 11: localStorage should be updated
  const savedStore = await page.evaluate(() => localStorage.getItem("custard-primary"));
  expect(savedStore).toBe("mt-horeb");

  await page.screenshot({ path: "test-results/mobile-store-selected.png" });
});

test("store picker list is scrollable when it exceeds viewport", async ({ page }) => {
  // Use a large store list
  const manyStores = [];
  for (let i = 0; i < 200; i++) {
    manyStores.push({
      slug: `store-${i}`,
      name: `Store ${i}`,
      city: `City ${i}`,
      state: "WI",
      address: `${i} Main St`,
      lat: 43.0 + i * 0.01,
      lng: -89.0 - i * 0.01,
      brand: "culvers",
    });
  }

  const context = page.context();
  await context.route("**/stores.json*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: manyStores }),
    });
  });
  await context.route("**/api/v1/geolocate", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lat: 43.0, lon: -89.4 }),
    });
  });
  await context.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("geolocate")) return route.continue();
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/index.html");
  await page.evaluate(() => {
    localStorage.setItem("custard-primary", "store-0");
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(2000);

  await page.locator(".store-indicator").click();
  await page.waitForTimeout(500);

  const list = page.locator(".store-picker-list");
  const listBox = await list.boundingBox();

  // List should be contained within the viewport (scrollable, not overflowing)
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(844 + 1);

  // List should be scrollable -- scrollHeight > clientHeight
  const isScrollable = await page.evaluate(() => {
    const el = document.querySelector(".store-picker-list");
    return el.scrollHeight > el.clientHeight;
  });
  expect(isScrollable).toBe(true);

  await page.screenshot({ path: "test-results/mobile-picker-scrollable.png" });
});
