import { expect, test } from "@playwright/test";

test("shared footer renders Get Updates and Privacy links", async ({ page }) => {
  await page.goto("/index.html");
  const footer = page.locator("footer.shared-footer");
  await expect(footer).toBeVisible();

  const updatesLink = footer.getByRole("link", { name: "Get Updates" });
  await expect(updatesLink).toBeVisible();
  await expect(updatesLink).toHaveAttribute("href", "updates.html");

  const privacyLink = footer.getByRole("link", { name: "Privacy" });
  await expect(privacyLink).toBeVisible();
  await expect(privacyLink).toHaveAttribute("href", "privacy.html");
});

test("footer renders on compare page too", async ({ page }) => {
  await page.goto("/compare.html");
  const footer = page.locator("footer.shared-footer");
  await expect(footer).toBeVisible();
  await expect(footer.getByRole("link", { name: "Get Updates" })).toBeVisible();
});
