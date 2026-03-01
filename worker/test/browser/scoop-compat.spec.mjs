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
        tomorrow: {
          date: "2026-03-01",
          flavor: "Mint Explosion",
          description: "Mint with Oreo pieces",
          certainty_tier: "confirmed",
        },
        tags: ["caramel", "nuts", "kids"],
        vibe: ["Caramel", "Rich", "Crunchy"],
        dealbreakers: [],
        distance_miles: 8.4,
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
        tomorrow: null,
        tags: ["fruit", "bright", "seasonal"],
        vibe: ["Fruity", "Bright", "Pie-crust"],
        dealbreakers: [],
        distance_miles: 2.1,
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

test("scoop compatibility preserves ?stores deep link and persists drive route", async ({ page }) => {
  await page.route("https://custard.chriskaschner.com/api/v1/drive*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockDrivePayload()),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/events", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/scoop.html?stores=mt-horeb,madison-todd-drive");

  await expect(page.getByRole("heading", { name: "Today's Drive" })).toBeVisible();
  await expect(page.locator(".drive-route-pill")).toHaveCount(2);
  await expect(page.locator(".drive-tomorrow-kicker")).toHaveCount(2);
  const tomorrowLines = await page.locator(".drive-tomorrow-flavor").allTextContents();
  expect(tomorrowLines.some((line) => line.includes("Mint Explosion"))).toBe(true);
  expect(tomorrowLines.some((line) => line.includes("No confirmed flavor posted yet"))).toBe(true);

  const routeStores = await page
    .locator(".drive-route-pill span")
    .allTextContents();
  expect(routeStores.join(" ")).toContain("Mt. Horeb");
  expect(routeStores.join(" ")).toContain("Madison");

  const savedStores = await page.evaluate(() => {
    const raw = localStorage.getItem("custard:v1:preferences");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.activeRoute && Array.isArray(parsed.activeRoute.stores)
      ? parsed.activeRoute.stores
      : [];
  });

  expect(savedStores.slice(0, 2)).toEqual(["mt-horeb", "madison-todd-drive"]);
});
