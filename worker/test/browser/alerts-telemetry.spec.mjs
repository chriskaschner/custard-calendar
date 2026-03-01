import { expect, test } from "@playwright/test";

test("alerts page emits alert_form_view and alert_subscribe_success telemetry", async ({ page }) => {
  const telemetryEvents = [];

  await page.route("**/stores.json**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stores: [
          {
            slug: "mt-horeb",
            name: "Culver's of Mt. Horeb",
            city: "Mt. Horeb",
            state: "WI",
            address: "1 Main St",
            brand: "culvers",
          },
        ],
      }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/flavors/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        flavors: [
          { title: "Turtle", description: "Chocolate caramel pecan" },
          { title: "Mint Explosion", description: "Mint with cookie pieces" },
        ],
      }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/alerts/subscribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("https://custard.chriskaschner.com/api/v1/events", async (route) => {
    const req = route.request();
    const raw = req.postData();
    if (raw) {
      try {
        telemetryEvents.push(JSON.parse(raw));
      } catch {
        // Ignore malformed telemetry during test; assertions use parsed payloads.
      }
    }
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/alerts.html");
  await page.waitForSelector('#store-select option[value="mt-horeb"]');

  await page.selectOption("#store-select", "mt-horeb");
  await page.fill("#flavor-search", "tur");
  await page.click(".flavor-result-item");
  await page.fill("#email-input", "test@example.com");
  await page.click("#subscribe-btn");

  await expect(page.locator("#subscribe-status")).toContainText("Check your email");

  await expect.poll(() => telemetryEvents.map((event) => event && event.event_type).filter(Boolean)).toContain("alert_form_view");
  await expect.poll(() => telemetryEvents.map((event) => event && event.event_type).filter(Boolean)).toContain("alert_subscribe_success");

  const pageView = telemetryEvents.find((event) => event && event.event_type === "page_view");
  expect(pageView).toBeTruthy();
  expect(Object.prototype.hasOwnProperty.call(pageView, "referrer")).toBe(true);
  expect(pageView.referrer === null || typeof pageView.referrer === "string").toBe(true);
  expect(["mobile", "desktop", "tablet"]).toContain(pageView.device_type);
});
