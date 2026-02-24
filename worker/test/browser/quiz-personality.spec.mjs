import { expect, test } from '@playwright/test';

test('quiz page returns an in-radius available flavor match', async ({ page }) => {
  let telemetryPosts = 0;

  await page.route('https://custard.chriskaschner.com/api/v1/geolocate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city: 'Madison', state: 'WI' }),
    });
  });

  await page.route('https://nominatim.openstreetmap.org/search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ lat: '43.0731', lon: '-89.4012' }]),
    });
  });

  await page.route('https://custard.chriskaschner.com/api/v1/nearby-flavors**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nearby: [
          {
            slug: 'madison-east',
            name: 'Madison East',
            address: '4301 East Towne Blvd',
            lat: 43.1283,
            lon: -89.3041,
            flavor: 'Mint Explosion',
            rank: 1,
          },
          {
            slug: 'fitchburg',
            name: 'Fitchburg',
            address: '3040 Cahill Main',
            lat: 43.0086,
            lon: -89.4573,
            flavor: 'Turtle',
            rank: 2,
          },
        ],
      }),
    });
  });

  await page.route('https://custard.chriskaschner.com/api/v1/quiz/events', async (route) => {
    telemetryPosts += 1;
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/quiz.html');

  await expect(page.locator('h1')).toContainText('Custard Personality Engine');
  await expect(page.locator('#quiz-variant')).toHaveValue('classic-v1');
  await page.locator('#quiz-variant').selectOption('weather-v1');
  await page.locator('#quiz-location').fill('Madison, WI');
  await page.locator('#quiz-radius').selectOption('20');

  const questions = page.locator('.quiz-question');
  await expect(questions).toHaveCount(5);

  for (let idx = 0; idx < 5; idx += 1) {
    await questions.nth(idx).locator('input[type="radio"]').first().check({ force: true });
  }

  await page.locator('#quiz-submit').click();

  await expect(page.locator('#quiz-result')).toBeVisible();
  await expect(page.locator('#result-availability')).toContainText('Available now');
  await expect(page.locator('#result-map-link')).toHaveAttribute('href', /map\.html\?location=Madison%2C%20WI&flavor=/);
  expect(telemetryPosts).toBeGreaterThan(0);
});
