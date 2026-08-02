import { expect, test } from "@playwright/test";

/**
 * Mobile store picker regression tests.
 * Runs at 375x667 (iPhone SE viewport) to verify the store picker bottom
 * sheet displays a scrollable list on mobile, and that the search input
 * is NOT auto-focused on touch devices (which would open the virtual keyboard
 * and hide the store list).
 */

const MOCK_STORES = [
  { slug: "mt-horeb", name: "Mt. Horeb", city: "Mt. Horeb", state: "WI", address: "123 Main St", lat: 43.0045, lng: -89.7387, brand: "culvers" },
  { slug: "verona", name: "Verona", city: "Verona", state: "WI", address: "456 Oak Ave", lat: 42.9919, lng: -89.5332, brand: "culvers" },
  { slug: "madison-east", name: "Madison East", city: "Madison", state: "WI", address: "789 University Ave", lat: 43.0731, lng: -89.3012, brand: "culvers" },
];

// Generate a large store list similar to production (1012 stores)
const LARGE_STORE_LIST = [];
for (let i = 0; i < 1012; i++) {
  LARGE_STORE_LIST.push({
    slug: `store-${i}`,
    name: `Store ${i}`,
    city: `City ${i}`,
    state: "WI",
    address: `${i} Main St`,
    lat: 43.0 + (i * 0.01),
    lng: -89.0 - (i * 0.01),
    brand: "culvers",
  });
}

test.use({
  viewport: { width: 375, height: 667 },
});

test("store picker list items are visible on mobile after opening", async ({ page }) => {
  const context = page.context();

  // Intercept stores.json
  await context.route("**/stores.json*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
    });
  });

  // Intercept geolocation
  await context.route("**/api/v1/geolocate", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lat: 43.0, lon: -89.4 }),
    });
  });

  // Block the actual Worker API to avoid network issues
  await context.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("geolocate")) return route.continue();
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Navigate to index.html with a saved store
  await page.goto("/index.html");

  // Set a primary store so the indicator chip appears
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.setItem("custard-primary", "mt-horeb");
  });

  // Reload to pick up the localStorage change
  await page.reload();
  await page.waitForTimeout(2000);

  // Check if the store indicator (chip) is visible
  const indicator = page.locator(".store-indicator");
  const indicatorVisible = await indicator.isVisible().catch(() => false);
  console.log("Store indicator visible:", indicatorVisible);

  if (!indicatorVisible) {
    // Maybe it's a "Find your store" button or first-visit prompt
    const findBtn = page.locator(".header-find-store");
    const findVisible = await findBtn.isVisible().catch(() => false);
    console.log("Find-store button visible:", findVisible);
    if (findVisible) {
      await findBtn.click();
    } else {
      // Try clicking anywhere that might open the picker
      console.log("No indicator or find button. Page HTML:", await page.evaluate(() => document.querySelector("#shared-nav")?.innerHTML || "NO #shared-nav"));
      return;
    }
  } else {
    // Click the store indicator chip to open the picker
    await indicator.click();
  }

  // Wait for the picker to appear
  await page.waitForTimeout(500);

  // Check: does the store picker exist in DOM?
  const pickerExists = await page.locator(".store-picker").count();
  console.log("Store picker elements in DOM:", pickerExists);

  // Check: is the store picker panel visible?
  const panel = page.locator(".store-picker-panel");
  const panelVisible = await panel.isVisible().catch(() => false);
  console.log("Store picker panel visible:", panelVisible);

  // Check: how many list items?
  const listItemCount = await page.locator(".store-picker-item").count();
  console.log("Store picker list items in DOM:", listItemCount);

  // Check: is the list element visible?
  const list = page.locator(".store-picker-list");
  const listVisible = await list.isVisible().catch(() => false);
  console.log("Store picker list visible:", listVisible);

  // Check list dimensions
  const listBox = await list.boundingBox().catch(() => null);
  console.log("Store picker list bounding box:", JSON.stringify(listBox));

  // Check first item dimensions
  if (listItemCount > 0) {
    const firstItem = page.locator(".store-picker-item").first();
    const firstItemVisible = await firstItem.isVisible().catch(() => false);
    const firstItemBox = await firstItem.boundingBox().catch(() => null);
    console.log("First list item visible:", firstItemVisible);
    console.log("First list item bounding box:", JSON.stringify(firstItemBox));
  }

  // Check panel dimensions
  const panelBox = await panel.boundingBox().catch(() => null);
  console.log("Panel bounding box:", JSON.stringify(panelBox));

  // Check if the search input has focus (which triggers keyboard)
  const searchFocused = await page.evaluate(() => {
    const search = document.querySelector(".store-picker-search");
    return search === document.activeElement;
  });
  console.log("Search input has focus:", searchFocused);

  // Get computed styles on the list
  const listStyles = await page.evaluate(() => {
    const el = document.querySelector(".store-picker-list");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      visibility: cs.visibility,
      height: cs.height,
      maxHeight: cs.maxHeight,
      overflow: cs.overflow,
      flex: cs.flex,
      opacity: cs.opacity,
    };
  });
  console.log("List computed styles:", JSON.stringify(listStyles));

  // Get computed styles on the panel
  const panelStyles = await page.evaluate(() => {
    const el = document.querySelector(".store-picker-panel");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      height: cs.height,
      maxHeight: cs.maxHeight,
      overflow: cs.overflow,
      flexDirection: cs.flexDirection,
    };
  });
  console.log("Panel computed styles:", JSON.stringify(panelStyles));

  // Take a screenshot for visual inspection
  await page.screenshot({ path: "test-results/store-picker-mobile-small.png", fullPage: false });

  // The actual assertions for the bug
  expect(listItemCount).toBeGreaterThan(0);
  expect(listVisible).toBe(true);
  if (listBox) {
    expect(listBox.height).toBeGreaterThan(0);
  }
});

test("store picker list visible with 1012 stores (production-size)", async ({ page }) => {
  const context = page.context();

  // Intercept stores.json with large list
  await context.route("**/stores.json*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: LARGE_STORE_LIST }),
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
    sessionStorage.clear();
    localStorage.setItem("custard-primary", "store-0");
  });
  await page.reload();
  await page.waitForTimeout(2000);

  const indicator = page.locator(".store-indicator");
  await indicator.click();
  await page.waitForTimeout(1000);

  const listItemCount = await page.locator(".store-picker-item").count();
  console.log("Large list: items in DOM:", listItemCount);

  const list = page.locator(".store-picker-list");
  const listBox = await list.boundingBox().catch(() => null);
  console.log("Large list: bounding box:", JSON.stringify(listBox));

  const panel = page.locator(".store-picker-panel");
  const panelBox = await panel.boundingBox().catch(() => null);
  console.log("Large list: panel box:", JSON.stringify(panelBox));

  // Take screenshot
  await page.screenshot({ path: "test-results/store-picker-mobile-large.png", fullPage: false });

  // Check first item
  const firstItem = page.locator(".store-picker-item").first();
  const firstItemBox = await firstItem.boundingBox().catch(() => null);
  console.log("Large list: first item box:", JSON.stringify(firstItemBox));

  expect(listItemCount).toBe(1012);
  expect(listBox?.height).toBeGreaterThan(0);
});

test("search input is NOT auto-focused on touch devices (prevents keyboard from hiding list)", async ({ page }) => {
  const context = page.context();

  await context.route("**/stores.json*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
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

  // Simulate a touch device by setting ontouchstart and maxTouchPoints BEFORE the picker opens
  await page.evaluate(() => {
    window.ontouchstart = function () {};
    Object.defineProperty(navigator, "maxTouchPoints", { value: 1, writable: false });
    sessionStorage.clear();
    localStorage.setItem("custard-primary", "mt-horeb");
  });

  await page.reload();

  // Re-apply touch simulation after reload
  await page.evaluate(() => {
    window.ontouchstart = function () {};
    Object.defineProperty(navigator, "maxTouchPoints", { value: 1, writable: false });
  });

  await page.waitForTimeout(2000);

  // Open the store picker
  const indicator = page.locator(".store-indicator");
  await indicator.click();
  await page.waitForTimeout(500);

  // Verify the search input exists but does NOT have focus
  const searchFocused = await page.evaluate(() => {
    const search = document.querySelector(".store-picker-search");
    return search === document.activeElement;
  });
  console.log("Touch device - search input has focus:", searchFocused);

  // On touch devices, search should NOT be auto-focused
  expect(searchFocused).toBe(false);

  // But the list should still be visible
  const listItemCount = await page.locator(".store-picker-item").count();
  expect(listItemCount).toBeGreaterThan(0);

  const list = page.locator(".store-picker-list");
  const listVisible = await list.isVisible();
  expect(listVisible).toBe(true);

  const listBox = await list.boundingBox();
  expect(listBox?.height).toBeGreaterThan(0);
  console.log("Touch device - list visible with height:", listBox?.height);
});

test("search input IS auto-focused on desktop (non-touch) devices", async ({ page }) => {
  const context = page.context();

  await context.route("**/stores.json*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stores: MOCK_STORES }),
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
    sessionStorage.clear();
    localStorage.setItem("custard-primary", "mt-horeb");
  });
  await page.reload();
  await page.waitForTimeout(2000);

  // Open the store picker (default Playwright has no touch support = desktop)
  const indicator = page.locator(".store-indicator");
  await indicator.click();
  await page.waitForTimeout(500);

  // On desktop, search input SHOULD be auto-focused
  const searchFocused = await page.evaluate(() => {
    const search = document.querySelector(".store-picker-search");
    return search === document.activeElement;
  });
  console.log("Desktop - search input has focus:", searchFocused);
  expect(searchFocused).toBe(true);
});
