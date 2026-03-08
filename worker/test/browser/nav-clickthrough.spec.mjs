import { expect, test } from "@playwright/test";

const NAV_LINKS = [
  { label: "Today", href: /\/index\.html$/ },
  { label: "Compare", href: /\/compare\.html$/ },
  { label: "Map", href: /\/map\.html$/ },
  { label: "Fun", href: /\/fun\.html$/ },
];

test("nav click-through across existing pages", async ({ page }) => {
  await page.goto("/index.html");

  const nav = page.locator("#shared-nav nav.nav-links");
  await expect(nav).toBeVisible();

  const labels = await nav.locator("a").allTextContents();
  expect(labels.map((x) => x.trim())).toEqual(NAV_LINKS.map((x) => x.label));

  // Only click through pages that currently exist (fun.html not yet created)
  const sequence = ["Compare", "Map", "Today"];
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

// Test nav consistency on pages that currently exist
// TODO: Add fun.html and updates.html after Plan 02 and 03 create them
const ALL_PAGES = [
  "/index.html",
  "/compare.html",
  "/map.html",
  "/calendar.html",
  "/quiz.html",
  "/scoop.html",
  "/group.html",
];

const EXPECTED_LABELS = NAV_LINKS.map((x) => x.label);

for (const pagePath of ALL_PAGES) {
  const pageName = pagePath.replace(/^\//, "").replace(/\.html$/, "");

  test(`${pageName} has complete nav with all ${EXPECTED_LABELS.length} links`, async ({ page }) => {
    await page.goto(pagePath);
    const nav = page.locator("#shared-nav nav.nav-links");
    await expect(nav).toBeVisible();
    const labels = await nav.locator("a").allTextContents();
    expect(labels.map((x) => x.trim())).toEqual(EXPECTED_LABELS);
  });
}
