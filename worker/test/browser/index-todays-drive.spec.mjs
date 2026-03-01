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
        tags: ["caramel", "nuts", "kids", "rich"],
        vibe: ["Caramel", "Rich", "Crunchy"],
        dealbreakers: [],
        distance_miles: 8.4,
        eta_minutes: 21,
        rarity: {
          avg_gap_days: 63,
          days_since_last: 8,
          last_seen: "2026-02-20",
          novelty_bonus_applied: false,
        },
        lat: 43.01,
        lon: -89.72,
      },
      {
        slug: "madison-todd-drive",
        name: "Madison, WI",
        flavor: "Lemon Berry Crisp",
        description: "Bright lemon custard with berry swirl",
        tags: ["fruit", "bright", "seasonal"],
        vibe: ["Fruity", "Bright", "Pie-crust"],
        dealbreakers: [],
        distance_miles: 2.1,
        eta_minutes: 7,
        rarity: {
          avg_gap_days: 35,
          days_since_last: 31,
          last_seen: "2026-01-28",
          novelty_bonus_applied: true,
        },
        lat: 43.07,
        lon: -89.39,
      },
    ],
    excluded: [],
    nearby_leaderboard: [],
    generated_at: "2026-02-28T00:00:00.000Z",
  };
}

test("index Today’s Drive reranks locally and persists preferences", async ({ page }) => {
  let driveCalls = 0;

  await page.route("https://custard.chriskaschner.com/api/v1/drive*", async (route) => {
    driveCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockDrivePayload()),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/flavor-colors", async (route) => {
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
  });

  await page.route("https://custard.chriskaschner.com/api/v1/flavors?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Mt. Horeb, WI",
        flavors: [
          {
            date: "2026-02-28",
            title: "Caramel Cashew",
            description: "Vanilla custard with caramel and cashew pieces",
          },
        ],
      }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/today?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        store: "Mt. Horeb, WI",
        date: "2026-02-28",
        flavor: "Caramel Cashew",
        description: "Vanilla custard with caramel and cashew pieces",
        rarity: null,
      }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/forecast/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        store_slug: "mt-horeb",
        forecast: { date: "2026-02-28", predictions: [] },
      }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/reliability*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/signals/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signals: [] }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/index.html");

  await expect(page.getByRole("heading", { name: "Today's Drive" })).toBeVisible();
  await expect(page.locator(".drive-card")).toHaveCount(2);

  const beforeToggleCalls = driveCalls;
  await page.locator('.drive-chip[data-kind="exclude"][data-tag="nuts"]').click();
  await expect(page.locator(".drive-card")).toHaveCount(1);
  await expect.poll(() => driveCalls).toBe(beforeToggleCalls);

  await page.locator('.drive-sort-btn[data-sort="detour"]').click();
  await page.reload();

  await expect(page.locator('.drive-chip[data-kind="exclude"][data-tag="nuts"]')).toHaveClass(/is-active/);
  await expect(page.locator('.drive-sort-btn[data-sort="detour"]')).toHaveClass(/is-active/);

  const saved = await page.evaluate(() => localStorage.getItem("custard:v1:preferences"));
  expect(saved).toBeTruthy();
});
