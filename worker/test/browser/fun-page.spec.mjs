import { expect, test } from "@playwright/test";

test("FUN-01: quiz mode cards are visible with names and descriptions", async ({ page }) => {
  await page.goto("/fun.html");
  const cards = page.locator(".quiz-mode-card");
  await expect(cards).toHaveCount(6);
  // Verify each mode name is present
  for (const name of ["Classic", "Weather", "Trivia", "Date Night", "Build-a-Scoop", "Compatibility"]) {
    await expect(page.locator(".quiz-mode-card", { hasText: name })).toBeVisible();
  }
});

test("FUN-01: quiz card links to quiz.html with correct mode param", async ({ page }) => {
  await page.goto("/fun.html");
  const classicCard = page.locator('a.quiz-mode-card[href*="mode=classic-v1"]');
  await expect(classicCard).toBeVisible();
  await expect(classicCard).toHaveAttribute("href", "quiz.html?mode=classic-v1");
});

test("FUN-02: Mad Libs section is visible with link to mad-libs-v1", async ({ page }) => {
  await page.goto("/fun.html");
  const section = page.locator("#mad-libs-section");
  await expect(section).toBeVisible();
  await expect(section.locator("h2")).toHaveText("Mad Libs");
  const madlibsLink = section.locator('a[href*="mode=mad-libs-v1"]');
  await expect(madlibsLink).toBeVisible();
});

test("FUN-03: quiz.html reads ?mode param and auto-selects quiz", async ({ page }) => {
  await page.goto("/quiz.html?mode=weather-v1");
  // Wait for quiz engine to initialize and populate the select
  const select = page.locator("#quiz-variant");
  await expect(select).toHaveValue("weather-v1", { timeout: 10000 });
});

test("FUN-04: Group Vote card links to group.html", async ({ page }) => {
  await page.goto("/fun.html");
  const link = page.locator('a[href="group.html"]');
  await expect(link).toBeVisible();
});
