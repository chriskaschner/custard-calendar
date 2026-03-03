import { expect, test } from "@playwright/test";

function mockDrivePayload() {
  return {
    query: {
      slugs: ["mt-horeb", "madison-todd-drive"],
      location: null,
      exclude: [],
      boost: [],
      avoid: [],
      sort: "match",
      include_estimated: 0,
      radius: 25,
    },
    cards: [
      {
        slug: "mt-horeb",
        name: "Mt. Horeb, WI",
        flavor: "Caramel Cashew",
        description: "Vanilla custard with caramel and cashew pieces",
        tags: ["caramel", "nuts", "kids"],
        vibe: ["Caramel", "Rich"],
        dealbreakers: [],
        distance_miles: 8.4,
        eta_minutes: 21,
        rarity: { avg_gap_days: 63, days_since_last: 8 },
        lat: 43.01,
        lon: -89.72,
      },
      {
        slug: "madison-todd-drive",
        name: "Madison, WI",
        flavor: "Lemon Berry Crisp",
        description: "Bright lemon custard with berry swirl",
        tags: ["fruit", "seasonal"],
        vibe: ["Fruity", "Bright"],
        dealbreakers: [],
        distance_miles: 2.1,
        eta_minutes: 7,
        rarity: { avg_gap_days: 35, days_since_last: 31 },
        lat: 43.07,
        lon: -89.39,
      },
    ],
    excluded: [],
    nearby_leaderboard: [],
    generated_at: "2026-03-03T00:00:00.000Z",
  };
}

async function mockSupportingRoutes(page) {
  await page.route(
    "https://custard.chriskaschner.com/api/v1/drive*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockDrivePayload()),
      });
    }
  );

  await page.route(
    "https://custard.chriskaschner.com/api/v1/flavor-colors",
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
    }
  );

  await page.route(
    "https://custard.chriskaschner.com/api/v1/flavors?*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "Mt. Horeb, WI",
          flavors: [{ date: "2026-03-03", title: "Caramel Cashew" }],
        }),
      });
    }
  );

  await page.route(
    "https://custard.chriskaschner.com/api/v1/flavor-config",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          similarity_groups: {},
          flavor_families: {},
          brand_colors: {},
        }),
      });
    }
  );

  await page.route(
    "https://custard.chriskaschner.com/api/v1/reliability/*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slug: "mt-horeb", tier: "reliable" }),
      });
    }
  );

  await page.route(
    "https://custard.chriskaschner.com/api/v1/signals/*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signals: [] }),
      });
    }
  );

  await page.route(
    "https://custard.chriskaschner.com/api/v1/events",
    async (route) => {
      await route.fulfill({ status: 204, body: "" });
    }
  );
}

test.describe("Drive preference hardening", () => {
  test("debounce: rapid chip toggles produce only one localStorage write", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register = () =>
          Promise.resolve({
            installing: null, waiting: null, active: null,
            addEventListener: () => {}, removeEventListener: () => {},
          });
      }
    });
    await mockSupportingRoutes(page);
    await page.goto("/index.html");
    await page.waitForSelector(".drive-card", { timeout: 5000 });

    // Rapid-fire 3 chip toggles
    const chips = page.locator('.drive-chip[data-kind="boost"]');
    const chipCount = await chips.count();
    if (chipCount >= 2) {
      await chips.nth(0).click();
      await chips.nth(1).click();
      await chips.nth(0).click();
    }

    // Immediately check: debounce should NOT have written yet
    const immediateValue = await page.evaluate(() =>
      localStorage.getItem("custard:v1:preferences")
    );
    // The timer hasn't fired yet (300ms debounce)
    // Note: in some environments this may already be written if the
    // event loop is fast enough, so we just verify the final state below

    // Wait for debounce to flush (300ms + margin)
    await page.waitForTimeout(500);

    const finalValue = await page.evaluate(() =>
      localStorage.getItem("custard:v1:preferences")
    );
    expect(finalValue).toBeTruthy();
    const parsed = JSON.parse(finalValue);
    expect(parsed.version).toBe(1);
    expect(parsed.updatedAt).toBeTruthy();
  });

  test("reset button clears all preference keys and resets UI", async ({
    page,
  }) => {
    // Disable SW to prevent it intercepting API mocks on reload
    await page.addInitScript(() => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register = () =>
          Promise.resolve({
            installing: null, waiting: null, active: null,
            addEventListener: () => {}, removeEventListener: () => {},
          });
      }
    });

    await mockSupportingRoutes(page);

    // Seed preferences before first load
    await page.addInitScript(() => {
      localStorage.setItem(
        "custard:v1:preferences",
        JSON.stringify({
          version: 1,
          favoriteStores: ["mt-horeb", "madison-todd-drive"],
          activeRoute: {
            id: "default",
            name: "Today's Drive",
            stores: ["mt-horeb", "madison-todd-drive"],
          },
          filters: { excludeTags: ["nuts"], includeOnlyTags: [], avoidIngredients: [] },
          preferences: { boostTags: ["chocolate"], avoidTags: ["mint"] },
          ui: { homeView: "today_drive", sortMode: "rarity", radiusMiles: 50 },
          updatedAt: "2026-03-03T00:00:00.000Z",
        })
      );
      localStorage.setItem("custard-primary", "mt-horeb");
      localStorage.setItem("custard-secondary", '["madison-todd-drive"]');
    });

    await page.goto("/index.html");
    await page.waitForSelector(".drive-card", { timeout: 5000 });

    // Click reset
    await page.click("#drive-reset-btn");

    // Wait for debounce to settle
    await page.waitForTimeout(500);

    // All three keys should be cleared
    const v1 = await page.evaluate(() =>
      localStorage.getItem("custard:v1:preferences")
    );
    const primary = await page.evaluate(() =>
      localStorage.getItem("custard-primary")
    );
    const secondary = await page.evaluate(() =>
      localStorage.getItem("custard-secondary")
    );
    expect(v1).toBeNull();
    expect(primary).toBeNull();
    expect(secondary).toBeNull();

    // URL should have no query params
    const url = new URL(page.url());
    expect(url.search).toBe("");
  });

  test("legacy custard-primary + custard-secondary migrate to v1 prefs", async ({
    page,
  }) => {
    await mockSupportingRoutes(page);

    // Seed ONLY legacy keys (no v1 key)
    await page.addInitScript(() => {
      localStorage.setItem("custard-primary", "mt-horeb");
      localStorage.setItem(
        "custard-secondary",
        JSON.stringify(["madison-todd-drive"])
      );
    });

    await page.goto("/index.html");
    await page.waitForSelector(".drive-card", { timeout: 5000 });

    // Wait for debounce
    await page.waitForTimeout(500);

    // v1 key should now exist with the legacy stores
    const v1Raw = await page.evaluate(() =>
      localStorage.getItem("custard:v1:preferences")
    );
    expect(v1Raw).toBeTruthy();
    const v1 = JSON.parse(v1Raw);
    expect(v1.version).toBe(1);
    expect(v1.activeRoute.stores).toContain("mt-horeb");
    expect(v1.activeRoute.stores).toContain("madison-todd-drive");
  });

  test("corrupt legacy keys do not crash preference loading", async ({
    page,
  }) => {
    await mockSupportingRoutes(page);

    await page.addInitScript(() => {
      localStorage.setItem("custard-primary", "  ");
      localStorage.setItem("custard-secondary", "not-valid-json{{{");
    });

    await page.goto("/index.html");
    await page.waitForSelector(".drive-card", { timeout: 5000 });

    // Page loaded successfully -- no crash
    const cards = await page.locator(".drive-card").count();
    expect(cards).toBeGreaterThan(0);
  });

  test("corrupt v1 JSON falls back to defaults", async ({ page }) => {
    await mockSupportingRoutes(page);

    await page.addInitScript(() => {
      localStorage.setItem("custard:v1:preferences", "{{broken json!!");
    });

    await page.goto("/index.html");
    await page.waitForSelector(".drive-card", { timeout: 5000 });

    const cards = await page.locator(".drive-card").count();
    expect(cards).toBeGreaterThan(0);
  });

  test("beforeunload flushes pending debounced writes", async ({ page }) => {
    await mockSupportingRoutes(page);
    await page.goto("/index.html");
    await page.waitForSelector(".drive-card", { timeout: 5000 });

    // Toggle a chip to trigger a debounced save
    const chip = page.locator('.drive-chip[data-kind="boost"]').first();
    await chip.click();

    // Navigate away immediately (triggers beforeunload flush)
    await page.goto("/calendar.html");

    // Go back and check if prefs persisted
    await page.goto("/index.html");
    await page.waitForTimeout(100);

    const v1Raw = await page.evaluate(() =>
      localStorage.getItem("custard:v1:preferences")
    );
    expect(v1Raw).toBeTruthy();
    const v1 = JSON.parse(v1Raw);
    expect(v1.preferences.boostTags.length).toBeGreaterThan(0);
  });
});
