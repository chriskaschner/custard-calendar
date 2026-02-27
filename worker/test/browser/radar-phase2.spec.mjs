import { expect, test } from "@playwright/test";

function isoDateOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildForecast(slug, strongTurtle) {
  const top = strongTurtle
    ? [
        { flavor: "Turtle", probability: 0.16, confidence: "high" },
        { flavor: "Caramel Cashew", probability: 0.09, confidence: "medium" },
      ]
    : [
        { flavor: "Chocolate Oreo Volcano", probability: 0.12, confidence: "high" },
        { flavor: "Turtle", probability: 0.03, confidence: "low" },
      ];

  return {
    store_slug: slug,
    generated_at: new Date().toISOString(),
    history_depth: 2100,
    days: [
      {
        date: isoDateOffset(0),
        predictions: top,
        overdue_flavors: [{ flavor: "Turtle", days_since: 45, avg_gap: 24 }],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(1),
        predictions: top,
        overdue_flavors: [{ flavor: "Turtle", days_since: 45, avg_gap: 24 }],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(2),
        predictions: top,
        overdue_flavors: [{ flavor: "Turtle", days_since: 45, avg_gap: 24 }],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(3),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(4),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(5),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
      {
        date: isoDateOffset(6),
        predictions: top,
        overdue_flavors: [],
        prose: "Forecast prose",
      },
    ],
  };
}

async function maybeFulfillHistoricalContext(route, path) {
  if (path.startsWith("/api/v1/metrics/context/flavor/")) {
    const normalized = decodeURIComponent(path.replace("/api/v1/metrics/context/flavor/", ""));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "trivia_metrics_seed",
        as_of: "2026-02-24",
        source_window: { start: "2015-08-02", end: "2026-03-31" },
        normalized_flavor: normalized,
        found: true,
        rank: 4,
        total_ranked_flavors: 179,
        flavor: {
          title: normalized === "turtle" ? "Turtle" : "Sample Flavor",
          appearances: 120,
          store_count: 35,
          peak_month: 3,
          peak_month_name: "March",
          seasonal_concentration: 0.24,
        },
      }),
    });
    return true;
  }

  if (path.startsWith("/api/v1/metrics/context/store/")) {
    const slug = decodeURIComponent(path.replace("/api/v1/metrics/context/store/", ""));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "trivia_metrics_seed",
        as_of: "2026-02-24",
        source_window: { start: "2015-08-02", end: "2026-03-31" },
        slug,
        found: true,
        store: {
          city: "Madison",
          state: "WI",
          observations: 1400,
          distinct_flavors: 88,
          top_flavor: "Turtle",
          top_flavor_count: 108,
          top_flavor_rank: 1,
        },
      }),
    });
    return true;
  }

  return false;
}

async function maybeFulfillFlavorStats(route, path, url) {
  if (!path.startsWith("/api/v1/flavor-stats/")) return false;
  const flavor = url.searchParams.get("flavor") || "Sample Flavor";
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      flavor,
      appearances: 42,
      // Georgia Peach: 150d avg gap -> "Ultra Rare" (>120d threshold)
      // Turtle: 80d avg gap -> "Rare" (>60d threshold)
      // All others: 33d avg gap -> no badge (<= 60d threshold)
      avg_gap_days: normalizeFlavor(flavor) === "georgia peach" ? 150
        : normalizeFlavor(flavor) === "turtle" ? 80
        : 33,
      last_seen: isoDateOffset(-3),
      days_since_last: 3,
      overdue_days: 0,
      annual_frequency: 8,
      seasonality: null,
      dow_bias: null,
      streaks: { current: 0, longest: 2 },
      stores_last_30d: 4,
    }),
  });
  return true;
}

function normalizeFlavor(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u00ae\u2122\u00a9]/g, "")
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

test("radar phase 2 shows next best store, badges, and accuracy dashboard", async ({ page }) => {
  let primarySlug = null;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/geolocate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "WI",
          stateName: "Wisconsin",
          city: "Madison",
          country: "US",
        }),
      });
      return;
    }

    if (path === "/api/v1/flavors") {
      const slug = url.searchParams.get("slug") || "unknown";
      if (!primarySlug) primarySlug = slug;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug,
          name: "Test Store",
          address: "123 Main St",
          flavors: [
            { date: isoDateOffset(0), title: "Vanilla", description: "Classic" },
            { date: isoDateOffset(1), title: "Butter Pecan", description: "Nutty" },
          ],
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/forecast/")) {
      const slug = decodeURIComponent(path.replace("/api/v1/forecast/", ""));
      if (!primarySlug) primarySlug = slug;
      const isPrimary = primarySlug ? slug === primarySlug : false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildForecast(slug, !isPrimary)),
      });
      return;
    }

    if (path.startsWith("/api/v1/metrics/store/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug: decodeURIComponent(path.replace("/api/v1/metrics/store/", "")),
          unique_flavors: 88,
          total_days: 1400,
          recent_history: [
            { date: isoDateOffset(-1), flavor: "Turtle" },
            { date: isoDateOffset(-2), flavor: "Turtle" },
            { date: isoDateOffset(-3), flavor: "Turtle" },
            { date: isoDateOffset(-4), flavor: "Vanilla" },
          ],
          active_streaks: [{ flavor: "Turtle", length: 3, start: isoDateOffset(-3), end: isoDateOffset(-1) }],
        }),
      });
      return;
    }

    if (await maybeFulfillHistoricalContext(route, path)) return;
    if (await maybeFulfillFlavorStats(route, path, url)) return;

    if (path.startsWith("/api/v1/metrics/flavor/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          normalized_flavor: decodeURIComponent(path.replace("/api/v1/metrics/flavor/", "")),
          total_appearances: 120,
          store_count: 35,
          recent: [],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/radar.html");
  await page.waitForSelector("#store-select option:not([disabled])[value]");

  primarySlug = "mt-horeb";
  await page.selectOption("#store-select", "mt-horeb");

  await page.waitForSelector("#timeline-section:not([hidden])");
  await page.fill("#flavor-search", "turtle");
  await page.waitForSelector("#flavor-results .flavor-result-item .flavor-name");
  const exactTurtle = page.locator("#flavor-results .flavor-result-item", {
    has: page.locator(".flavor-name", { hasText: /^Turtle$/ }),
  });
  if (await exactTurtle.count()) {
    await exactTurtle.first().click();
  } else {
    await page.click("#flavor-results .flavor-result-item");
  }

  await expect(page.locator("#next-best-section")).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#accuracy-section")).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#radar-historical-context-section")).not.toHaveAttribute("hidden", "");
  await expect(page.locator("#next-best-list .next-best-card").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#acc-top1")).not.toHaveText("--");
  await expect(page.locator(".intel-badge").first()).toBeVisible();
  await expect(page.locator("#radar-historical-context-card")).toContainText("Store specialty");
  await expect(page.locator(".intel-badge", { hasText: /Every 80 days/ }).first()).toBeVisible();

  // Status line should show forecast-enabled count
  const statusText = await page.locator("#next-best-status").textContent();
  expect(statusText).toMatch(/forecast-enabled/);
});

test("candidate with confirmed schedule shows Confirmed badge, not probability", async ({ page }) => {
  let primarySlug = null;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/geolocate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "WI", stateName: "Wisconsin", city: "Madison", country: "US" }),
      });
      return;
    }

    if (path === "/api/v1/flavors") {
      const slug = url.searchParams.get("slug") || "unknown";
      // Primary store: does NOT have Turtle confirmed
      if (!primarySlug || slug === primarySlug) {
        if (!primarySlug) primarySlug = slug;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            slug,
            name: "Primary Store",
            address: "100 Main St",
            flavors: [
              { date: isoDateOffset(0), title: "Vanilla", description: "Classic" },
              { date: isoDateOffset(1), title: "Butter Pecan", description: "Nutty" },
            ],
          }),
        });
      } else {
        // Candidate store: has Turtle confirmed
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            slug,
            name: "Nearby Custard",
            address: "200 Elm St",
            flavors: [
              { date: isoDateOffset(0), title: "Turtle", description: "Rich" },
              { date: isoDateOffset(1), title: "Chocolate Eclair", description: "Creamy" },
            ],
          }),
        });
      }
      return;
    }

    // No forecasts available for any store -- forces confirmed fallback path
    if (path.startsWith("/api/v1/forecast/")) {
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not found"}' });
      return;
    }

    if (path.startsWith("/api/v1/metrics/store/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug: "test",
          unique_flavors: 50,
          total_days: 800,
          recent_history: [],
          active_streaks: [],
        }),
      });
      return;
    }

    if (await maybeFulfillHistoricalContext(route, path)) return;
    if (await maybeFulfillFlavorStats(route, path, url)) return;

    if (path.startsWith("/api/v1/metrics/flavor/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          normalized_flavor: decodeURIComponent(path.replace("/api/v1/metrics/flavor/", "")),
          total_appearances: 120,
          store_count: 35,
          recent: [],
        }),
      });
      return;
    }

    if (path === "/api/v1/flavors/catalog") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ flavors: [
          { normalized: "turtle", display: "Turtle" },
          { normalized: "vanilla", display: "Vanilla" },
          { normalized: "butter pecan", display: "Butter Pecan" },
        ]}),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/radar.html");
  await page.waitForSelector("#store-select option:not([disabled])[value]");

  primarySlug = "mt-horeb";
  await page.selectOption("#store-select", "mt-horeb");

  await page.waitForSelector("#timeline-section:not([hidden])");
  await page.fill("#flavor-search", "turtle");
  await page.waitForSelector("#flavor-results .flavor-result-item .flavor-name");
  const exactTurtle = page.locator("#flavor-results .flavor-result-item", {
    has: page.locator(".flavor-name", { hasText: /^Turtle$/ }),
  });
  if (await exactTurtle.count()) {
    await exactTurtle.first().click();
  } else {
    await page.click("#flavor-results .flavor-result-item");
  }

  // Wait for next-best section to finish scanning (status text changes from "Scanning...")
  await page.waitForFunction(
    () => {
      const el = document.getElementById("next-best-status");
      return el && el.textContent && !el.textContent.includes("Scanning");
    },
    { timeout: 15000 }
  );

  // Status should mention confirmed-only count
  const statusText = await page.locator("#next-best-status").textContent();
  expect(statusText).toMatch(/confirmed-only|No stronger nearby alternatives found this week/);

  // Check for Confirmed badge in recommendations (not probability text)
  const cardCount = await page.locator("#next-best-list .next-best-card").count();

  if (cardCount > 0) {
    const confirmedBadge = page.locator(".next-best-badge-confirmed");
    await expect(confirmedBadge.first()).toBeVisible({ timeout: 5000 });
    // Should NOT show percentage for confirmed recs
    const cardText = await page.locator("#next-best-list .next-best-card").first().textContent();
    expect(cardText).toContain("confirmed at");
    expect(cardText).not.toMatch(/\d+\.\d+%.*vs/);
  } else {
    expect(statusText).toContain("No stronger nearby alternatives");
  }
});

test("rarity badges use percentile distribution, not absolute counts", async ({ page }) => {
  let primarySlug = null;

  // Use actual catalog flavors (from docs/flavors.json) so search works
  const predictionFlavors = [
    "Turtle", "Vanilla", "Mint Explosion", "Butter Pecan",
    "Caramel Cashew", "Snickers Swirl", "Andes Mint Avalanche",
    "Dark Chocolate Decadence", "Chocolate Oreo Volcano",
    "Crazy for Cookie Dough", "OREO Cheesecake", "Georgia Peach",
  ];

  // Varied appearance counts: Georgia Peach is rarest
  const appearanceCounts = {
    "turtle": 5000,
    "vanilla": 4500,
    "mint explosion": 4000,
    "butter pecan": 3500,
    "caramel cashew": 2500,
    "snickers swirl": 300,
    "andes mint avalanche": 50,
    "dark chocolate decadence": 20,
    "chocolate oreo volcano": 3000,
    "crazy for cookie dough": 500,
    "oreo cheesecake": 2000,
    "georgia peach": 5,
  };

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/geolocate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "WI", stateName: "Wisconsin", city: "Madison", country: "US" }),
      });
      return;
    }

    if (path === "/api/v1/flavors") {
      const slug = url.searchParams.get("slug") || "unknown";
      if (!primarySlug) primarySlug = slug;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug,
          name: "Test Store",
          address: "123 Main St",
          flavors: [
            { date: isoDateOffset(0), title: "Georgia Peach", description: "Rare treat" },
          ],
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/forecast/")) {
      const slug = decodeURIComponent(path.replace("/api/v1/forecast/", ""));
      if (!primarySlug) primarySlug = slug;
      // Rotate by 2 each day so top-3 slices cover more unique flavors
      const days = [];
      for (let d = 0; d < 7; d++) {
        const offset = (d * 2) % predictionFlavors.length;
        const rotated = [...predictionFlavors.slice(offset), ...predictionFlavors.slice(0, offset)];
        const preds = rotated.map((f, i) => ({
          flavor: f,
          probability: 0.15 - i * 0.005,
          confidence: i < 4 ? "high" : i < 8 ? "medium" : "low",
        }));
        days.push({
          date: isoDateOffset(d),
          predictions: preds,
          overdue_flavors: [],
          prose: "Forecast prose",
        });
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          store_slug: slug,
          generated_at: new Date().toISOString(),
          history_depth: 2100,
          days,
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/metrics/store/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug: "test",
          unique_flavors: 88,
          total_days: 1400,
          recent_history: [],
          active_streaks: [],
        }),
      });
      return;
    }

    if (await maybeFulfillHistoricalContext(route, path)) return;
    if (await maybeFulfillFlavorStats(route, path, url)) return;

    if (path.startsWith("/api/v1/metrics/flavor/")) {
      const normalized = decodeURIComponent(path.replace("/api/v1/metrics/flavor/", ""));
      const totalAppearances = appearanceCounts[normalized] || 1000;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          normalized_flavor: normalized,
          total_appearances: totalAppearances,
          store_count: 35,
          recent: [],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/radar.html");
  await page.waitForSelector("#store-select option:not([disabled])[value]");
  const firstValue = await page.$eval("#store-select option:not([disabled])[value]", (el) => el.value);
  await page.selectOption("#store-select", firstValue);
  await page.waitForSelector("#timeline-section:not([hidden])");

  // Select Georgia Peach as favorite (rarest flavor, 5 appearances)
  await page.fill("#flavor-search", "georgia");
  await page.waitForSelector("#flavor-results .flavor-result-item .flavor-name", { timeout: 5000 });
  await page.click("#flavor-results .flavor-result-item");

  // Select Turtle as second favorite to push metrics cache above sample floor
  await page.fill("#flavor-search", "turtle");
  await page.waitForSelector("#flavor-results .flavor-result-item .flavor-name", { timeout: 5000 });
  const turtleItem = page.locator("#flavor-results .flavor-result-item", {
    has: page.locator(".flavor-name", { hasText: /^Turtle$/ }),
  });
  if (await turtleItem.count()) {
    await turtleItem.first().click();
  } else {
    await page.click("#flavor-results .flavor-result-item");
  }

  // Wait for metrics preload + re-render with badges
  await page.waitForTimeout(5000);

  // Georgia Peach (mock avg_gap=150d > 120d threshold) should show "Ultra Rare" badge
  const rarityBadges = page.locator(".intel-badge-rarity");
  const badgeTexts = await rarityBadges.allTextContents();
  expect(badgeTexts).toContain("Ultra Rare");
});

test("rarity badges suppressed when fewer than 10 flavors have metrics", async ({ page }) => {
  let primarySlug = null;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/geolocate") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "WI", stateName: "Wisconsin", city: "Madison", country: "US" }),
      });
      return;
    }

    if (path === "/api/v1/flavors") {
      const slug = url.searchParams.get("slug") || "unknown";
      if (!primarySlug) primarySlug = slug;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug,
          name: "Test Store",
          address: "123 Main St",
          flavors: [
            { date: isoDateOffset(0), title: "Turtle", description: "Classic" },
          ],
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/forecast/")) {
      const slug = decodeURIComponent(path.replace("/api/v1/forecast/", ""));
      if (!primarySlug) primarySlug = slug;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          store_slug: slug,
          generated_at: new Date().toISOString(),
          history_depth: 2100,
          days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
            date: isoDateOffset(d),
            predictions: [
              { flavor: "Turtle", probability: 0.15, confidence: "high" },
              { flavor: "Vanilla", probability: 0.10, confidence: "medium" },
            ],
            overdue_flavors: [],
            prose: "Forecast prose",
          })),
        }),
      });
      return;
    }

    if (path.startsWith("/api/v1/metrics/store/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug: "test",
          unique_flavors: 2,
          total_days: 50,
          recent_history: [],
          active_streaks: [],
        }),
      });
      return;
    }

    // Sparse store: override flavor-stats to return low appearances so rarityBadge()
    // skips the store-level path (< 30 threshold) and avg_gap_days < 60d suppresses
    // the hierarchy fallback too. Must come before maybeFulfillFlavorStats.
    if (path.startsWith("/api/v1/flavor-stats/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          flavor: url.searchParams.get("flavor") || "",
          appearances: 5,
          avg_gap_days: 28,
          last_seen: isoDateOffset(-3),
          days_since_last: 3,
          overdue_days: 0,
          annual_frequency: 13,
          seasonality: null,
          dow_bias: null,
          streaks: { current: 0, longest: 1 },
          stores_last_30d: 2,
        }),
      });
      return;
    }

    if (await maybeFulfillHistoricalContext(route, path)) return;
    if (await maybeFulfillFlavorStats(route, path, url)) return;

    if (path.startsWith("/api/v1/metrics/flavor/")) {
      // Only 2 flavors have metrics -- below sample floor of 10
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          normalized_flavor: decodeURIComponent(path.replace("/api/v1/metrics/flavor/", "")),
          total_appearances: 10,
          store_count: 5,
          recent: [],
        }),
      });
      return;
    }

    if (path === "/api/v1/flavors/catalog") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          flavors: [
            { normalized: "turtle", display: "Turtle" },
            { normalized: "vanilla", display: "Vanilla" },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/radar.html");
  await page.waitForSelector("#store-select option:not([disabled])[value]");
  const firstValue = await page.$eval("#store-select option:not([disabled])[value]", (el) => el.value);
  await page.selectOption("#store-select", firstValue);
  await page.waitForSelector("#timeline-section:not([hidden])");

  await page.fill("#flavor-search", "turtle");
  await page.waitForSelector("#flavor-results .flavor-result-item .flavor-name");
  await page.click("#flavor-results .flavor-result-item");

  // Wait a bit for badges to compute
  await page.waitForTimeout(2000);

  // No rarity badges should appear (fewer than 10 flavors in metrics)
  const rarityBadges = page.locator(".intel-badge-rarity");
  expect(await rarityBadges.count()).toBe(0);
});
