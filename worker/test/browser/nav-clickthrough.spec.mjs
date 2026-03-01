import { expect, test } from "@playwright/test";

const NAV_LINKS = [
  { label: "Forecast", href: /\/index\.html$/ },
  { label: "Calendar", href: /\/calendar\.html$/ },
  { label: "Map", href: /\/map\.html$/ },
  { label: "Radar", href: /\/radar\.html$/ },
  { label: "Alerts", href: /\/alerts\.html$/ },
  { label: "Siri", href: /\/siri\.html$/ },
  { label: "Fronts", href: /\/forecast-map\.html$/ },
  { label: "Quiz", href: /\/quiz\.html$/ },
  { label: "Widget", href: /\/widget\.html$/ },
  { label: "The Scoop", href: /\/scoop\.html$/ },
];

test("nav click-through across all docs pages", async ({ page }) => {
  await page.goto("/index.html");

  const nav = page.locator("header nav.nav-links");
  await expect(nav).toBeVisible();

  const labels = await nav.locator("a").allTextContents();
  expect(labels.map((x) => x.trim())).toEqual(NAV_LINKS.map((x) => x.label));

  const sequence = ["Calendar", "Map", "Radar", "Alerts", "Siri", "Fronts", "Quiz", "Widget", "The Scoop", "Forecast"];
  for (const label of sequence) {
    const target = NAV_LINKS.find((x) => x.label === label);
    expect(target).toBeTruthy();

    await Promise.all([
      page.waitForURL(target.href),
      nav.getByRole("link", { name: label, exact: true }).click(),
    ]);

    const activeLink = nav.locator("a.nav-active");
    await expect(activeLink).toHaveCount(1);
    await expect(activeLink).toHaveText(label);
  }
});

const ALL_PAGES = [
  "/index.html",
  "/calendar.html",
  "/map.html",
  "/radar.html",
  "/alerts.html",
  "/siri.html",
  "/forecast-map.html",
  "/quiz.html",
  "/widget.html",
  "/scoop.html",
];

const EXPECTED_LABELS = NAV_LINKS.map((x) => x.label);

for (const pagePath of ALL_PAGES) {
  const pageName = pagePath.replace(/^\//, "").replace(/\.html$/, "");

  test(`${pageName} has complete nav with all ${EXPECTED_LABELS.length} links`, async ({ page }) => {
    await page.goto(pagePath);
    const nav = page.locator("header nav.nav-links");
    await expect(nav).toBeVisible();
    const labels = await nav.locator("a").allTextContents();
    expect(labels.map((x) => x.trim())).toEqual(EXPECTED_LABELS);
  });
}
