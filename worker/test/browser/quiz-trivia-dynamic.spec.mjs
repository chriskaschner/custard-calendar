import { expect, test } from '@playwright/test';

function makeTriviaQuestions() {
  return Array.from({ length: 5 }, (_, idx) => ({
    id: `trivia-q${idx + 1}`,
    prompt: `Trivia prompt ${idx + 1}`,
    correct_option_id: `q${idx + 1}-a`,
    options: [
      { id: `q${idx + 1}-a`, label: 'Option A', traits: { adventurous: 2, bold: 1 } },
      { id: `q${idx + 1}-b`, label: 'Option B', traits: { classic: 2, calm: 1 } },
      { id: `q${idx + 1}-c`, label: 'Option C', traits: { social: 2, energetic: 1 } },
      { id: `q${idx + 1}-d`, label: 'Option D', traits: { analytical: 2, romantic: 1 } },
    ],
  }));
}

test('trivia mode hydrates from API and reports client-side correctness', async ({ page }) => {
  let triviaHits = 0;
  let lastTelemetry = null;

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
          { slug: 'madison-east', name: 'Madison East', lat: 43.12, lon: -89.30, flavor: 'Mint Explosion', rank: 1 },
          { slug: 'fitchburg', name: 'Fitchburg', lat: 43.00, lon: -89.45, flavor: 'Turtle', rank: 2 },
        ],
        all_flavors_today: ['Mint Explosion', 'Turtle'],
      }),
    });
  });

  await page.route('https://custard.chriskaschner.com/api/v1/trivia**', async (route) => {
    triviaHits += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'trivia-v1',
        name: 'Flavor Trivia Challenge',
        title: 'Flavor Trivia Challenge',
        description: 'Generated trivia for testing.',
        source: 'd1_snapshots',
        question_count: 5,
        questions: makeTriviaQuestions(),
      }),
    });
  });

  await page.route('https://custard.chriskaschner.com/api/v1/quiz/events', async (route) => {
    lastTelemetry = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/quiz.html');

  await page.locator('#quiz-location').fill('Madison, WI');
  await page.locator('#quiz-radius').selectOption('20');
  await page.locator('#quiz-variant').selectOption('trivia-v1');

  await expect(page.locator('.quiz-question')).toHaveCount(5);
  await expect(page.locator('.quiz-question legend').first()).toContainText('Trivia prompt');

  const questions = page.locator('.quiz-question');
  for (let idx = 0; idx < 5; idx += 1) {
    await questions.nth(idx).locator('input[type="radio"]').first().check({ force: true });
  }

  await page.locator('#quiz-submit').click();

  await expect(page.locator('#quiz-result')).toBeVisible();
  await expect(page.locator('#result-traits')).toContainText('Trivia: 5/5 correct.');
  expect(triviaHits).toBeGreaterThan(0);
  expect(lastTelemetry?.trivia_total).toBe(5);
  expect(lastTelemetry?.trivia_correct).toBe(5);
});
