import { expect, test } from "@playwright/test";

// docs/sw.js:53 puts /api/v1/flavors in its cache list, and service-worker
// requests bypass page.route. Without this the mocks below silently miss and
// every store reads as unreachable.
test.use({ serviceWorkers: "block" });

/**
 * Map local-brand flavor states.
 *
 * Regression cover for the Milwaukee outage: the brand path used to fall back to
 * data.flavors[0] -- any date, unlabelled -- whenever today's entry was missing,
 * rendering another day's custard as though it were today's. It also set
 * flavor: 'Unavailable', a truthy string, so a store we could not reach still
 * earned a "Confirmed" badge.
 *
 * Three states must stay distinguishable: known / posted-nothing-today /
 * unreachable.
 */

const STORES = {
  generated: "2026-08-04",
  count: 3,
  stores: [
    { slug: "gilles", name: "Gille's Milwaukee, WI", city: "Milwaukee", state: "WI",
      address: "7515 W Bluemound Rd", brand: "gilles", lat: 43.04, lng: -88.006 },
    { slug: "hefners", name: "Hefner's West Allis, WI", city: "West Allis", state: "WI",
      address: "2325 S 108th St", brand: "hefners", lat: 43.0, lng: -88.05 },
    { slug: "kopps-glendale", name: "Kopp's Glendale, WI", city: "Glendale", state: "WI",
      address: "5373 N Port Washington Rd", brand: "kopps", lat: 43.12, lng: -87.91 },
  ],
};

// Frozen so the assertions do not drift with the wall clock.
const TODAY = "2026-08-04";
const STALE_DAY = "2026-07-31";

const FLAVORS = {
  // Reachable, but upstream stopped posting days ago -- the Gille's Wix case.
  gilles: { status: 200, body: { name: "Gille's Frozen Custard", flavors: [
    { date: STALE_DAY, title: "Vanilla Chocolate", description: "" },
  ] } },
  // Upstream unreachable -- the Oscar's bot-block case.
  hefners: { status: 502, body: { error: "Failed to fetch flavor data." } },
  // Healthy.
  "kopps-glendale": { status: 200, body: { name: "Kopp's Frozen Custard", flavors: [
    { date: TODAY, title: "Chocolate Chip Cookie Dough", description: "Hershey's chips" },
  ] } },
};

async function mockRoutes(page) {
  await page.addInitScript((today) => {
    // Pin the clock so "today" is deterministic. Central noon, well away from
    // the UTC rollover the fix is about.
    const fixed = new Date(`${today}T12:00:00-05:00`).getTime();
    const RealDate = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    };
  }, TODAY);

  await page.route("**/sw.js", (r) =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "// noop" }));
  await page.route("**/stores.json", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STORES) }));
  await page.route("**/api/v1/flavors*", async (route, request) => {
    const slug = new URL(request.url()).searchParams.get("slug");
    const entry = FLAVORS[slug];
    if (!entry) return route.fulfill({ status: 404, body: "{}" });
    await route.fulfill({
      status: entry.status,
      contentType: "application/json",
      body: JSON.stringify(entry.body),
    });
  });

  for (const [pattern, body] of [
    ["**/api/v1/geolocate", { city: "Milwaukee", state: "WI" }],
    ["**/api/v1/nearby-flavors*", { query: { flavor: "", location: "Milwaukee, WI" }, matches: [], nearby: [], suggestions: [], all_flavors_today: [] }],
    ["**/api/flavors/catalog", { flavors: [] }],
    ["**/api/v1/flavor-config", { families: {} }],
    ["**/api/v1/flavor-colors", {}],
    ["**/api/v1/events*", { events: [] }],
  ]) {
    await page.route(pattern, (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  }
}

async function showAllBrands(page) {
  await mockRoutes(page);
  await page.goto("/map.html");
  await expect(page.locator("#map")).toBeVisible();
  await page.locator('.brand-chip[data-brand="all"]').click();
  await expect(page.locator(".store-card").first()).toBeVisible({ timeout: 15_000 });
}

test("a store that posted nothing today never shows another day's flavor as today's", async ({ page }) => {
  await showAllBrands(page);

  const gilles = page.locator(".store-card", { hasText: "Gille's" }).first();
  await expect(gilles).toBeVisible();

  // The headline must not be the stale flavor name.
  await expect(gilles.locator(".store-card-flavor")).toHaveText(/No flavor posted for today/i);
  await expect(gilles.locator(".store-card-flavor")).not.toHaveText(/Vanilla Chocolate/i);

  // The stale reading survives, dated, as secondary text.
  await expect(gilles.locator(".store-card-description")).toHaveText(/Last posted Jul 31: Vanilla Chocolate/i);
});

test("an unreachable store says so rather than showing a flavor", async ({ page }) => {
  await showAllBrands(page);

  const hefners = page.locator(".store-card", { hasText: "Hefner's" }).first();
  await expect(hefners).toBeVisible();
  await expect(hefners.locator(".store-card-flavor")).toHaveText(/Couldn't load today's flavor/i);
});

test("a healthy store still shows today's flavor", async ({ page }) => {
  await showAllBrands(page);

  const kopps = page.locator(".store-card", { hasText: "Kopp's" }).first();
  await expect(kopps).toBeVisible();
  await expect(kopps.locator(".store-card-flavor")).toHaveText(/Chocolate Chip Cookie Dough/i);
});

test("stores with no known flavor are not badged Confirmed", async ({ page }) => {
  await showAllBrands(page);

  // 'Unavailable' was a truthy string, so a store we could not reach still
  // passed the store.flavor guard that gates the Confirmed badge -- the map
  // asserted it had confirmed data for a store it had failed to load.
  const markers = page.locator(".flavor-map-marker");
  const total = await markers.count();
  expect(total).toBeGreaterThan(0);

  for (let i = 0; i < total; i++) {
    await markers.nth(i).click({ force: true });
  }
  await expect(page.locator(".store-popup").first()).toBeVisible();

  const popups = await page.locator(".store-popup").evaluateAll((nodes) =>
    nodes.map((n) => ({
      text: n.innerText,
      confirmed: n.querySelectorAll(".popup-confirmed").length,
    })));

  const unknown = popups.filter((p) =>
    /No flavor posted for today|Couldn't load today's flavor/i.test(p.text));

  // Gille's (posted nothing today) and Hefner's (unreachable).
  expect(unknown).toHaveLength(2);
  for (const p of unknown) expect(p.confirmed).toBe(0);

  // The healthy store still earns its badge, so this is not just an absent class.
  const known = popups.filter((p) => /Chocolate Chip Cookie Dough/i.test(p.text));
  expect(known).toHaveLength(1);
  expect(known[0].confirmed).toBe(1);
});
