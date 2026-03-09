import { expect, test } from '@playwright/test';

/**
 * QUIZ-01: Image-based answer options for quiz questions on mobile.
 *
 * When ALL options in a question have icon fields, the quiz-options-grid
 * should gain a .quiz-image-grid class and render as a 2-column grid
 * with icons above labels.
 *
 * Classic-v1 quiz has:
 *   Q0 (mood-color)   - ALL 4 options have color: icons  -> should trigger grid
 *   Q2 (instrument)   - ALL 4 options have pixel: icons  -> should trigger grid
 *   Q3 (animal)       - ALL 4 options have pixel: icons  -> should trigger grid
 *   Q1, Q4-Q14        - NO icons                         -> standard layout
 *
 * We mock the quiz JSON to serve exactly 2 questions: one with all icons
 * and one without, so the test is deterministic.
 */

// Minimal quiz JSON with controlled question set
const MOCK_QUIZ_CLASSIC = {
  id: 'classic-v1',
  name: 'Classic',
  title: 'Classic Flavor Match',
  description: 'Find your frozen custard personality.',
  question_count: 2,
  questions: [
    {
      id: 'mood-color',
      prompt: 'What color best describes your mood?',
      options: [
        { id: 'mint', label: 'Mint green', icon: 'color:#7ecfa0', traits: { calm: 2 } },
        { id: 'caramel', label: 'Caramel gold', icon: 'color:#d4a843', traits: { warm: 2 } },
        { id: 'cherry', label: 'Cherry red', icon: 'color:#c0394f', traits: { bold: 2 } },
        { id: 'dark', label: 'Dark chocolate', icon: 'color:#3e2723', traits: { intense: 2 } },
      ],
    },
    {
      id: 'snack',
      prompt: 'What is your go-to snack?',
      options: [
        { id: 'chips', label: 'Chips and salsa', traits: { bold: 1 } },
        { id: 'fruit', label: 'Fresh fruit', traits: { calm: 1 } },
        { id: 'cheese', label: 'Cheese and crackers', traits: { warm: 1 } },
        { id: 'chocolate', label: 'Chocolate bar', traits: { intense: 1 } },
      ],
    },
  ],
};

// Minimal archetype data so the engine doesn't crash
const MOCK_ARCHETYPES = {
  traits: [
    { id: 'calm', label: 'Calm' },
    { id: 'warm', label: 'Warm' },
    { id: 'bold', label: 'Bold' },
    { id: 'intense', label: 'Intense' },
  ],
  archetypes: [
    {
      id: 'a1',
      name: 'The Classic',
      blurb: 'You are a classic.',
      traits: { calm: 2, warm: 1 },
      flavors: ['Vanilla'],
    },
  ],
};

// Minimal stub for any non-classic quiz
function makeStubQuiz(name) {
  const id = name.replace('quiz-', '').replace('.json', '');
  return {
    id,
    name: id,
    title: id,
    description: 'test',
    question_count: 2,
    questions: [
      { id: 'q1', prompt: 'Placeholder?', options: [
        { id: 'a', label: 'A', traits: { calm: 1 } },
        { id: 'b', label: 'B', traits: { bold: 1 } },
      ]},
      { id: 'q2', prompt: 'Another?', options: [
        { id: 'c', label: 'C', traits: { calm: 1 } },
        { id: 'd', label: 'D', traits: { bold: 1 } },
      ]},
    ],
  };
}

/**
 * Set up route mocks shared by all tests.
 * Intercepts quiz JSON fetches so we control the question set.
 */
async function setupRoutes(page) {
  // Intercept ALL quiz JSON fetches with a single handler to avoid race conditions
  await page.route('**/quizzes/quiz-*.json', async (route) => {
    const url = route.request().url();
    let body;
    if (url.includes('quiz-classic-v1.json')) {
      body = MOCK_QUIZ_CLASSIC;
    } else {
      const filename = url.split('/').pop();
      body = makeStubQuiz(filename);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // Mock the archetypes JSON
  await page.route('**/quizzes/flavor-archetypes.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ARCHETYPES),
    });
  });

  // Mock telemetry endpoint
  await page.route('**/api/v1/quiz/events', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Mock geolocate
  await page.route('**/api/v1/geolocate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ city: 'Madison', state: 'WI' }),
    });
  });
}

test.describe('QUIZ-01: Image grid for icon-bearing quiz options', () => {
  test.beforeEach(async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await setupRoutes(page);

    // Use mode query param so engine auto-selects classic-v1 on init
    await page.goto('/quiz.html?mode=classic-v1');

    // Wait for the mood-color question to render (always selected since it is Q0)
    await expect(page.locator('.quiz-question', {
      has: page.locator('legend', { hasText: 'What color best describes your mood?' }),
    })).toBeVisible();
  });

  test('QUIZ-01 Test 1: all-icon question gets .quiz-image-grid class on grid container', async ({ page }) => {
    // The mood-color question has all 4 options with icons
    // Find the question by its legend text
    const iconQuestion = page.locator('.quiz-question', {
      has: page.locator('legend', { hasText: 'What color best describes your mood?' }),
    });
    await expect(iconQuestion).toBeVisible();

    const grid = iconQuestion.locator('.quiz-options-grid');
    await expect(grid).toHaveClass(/quiz-image-grid/);
  });

  test('QUIZ-01 Test 2: image grid has 2-column layout on mobile viewport (375px)', async ({ page }) => {
    const iconQuestion = page.locator('.quiz-question', {
      has: page.locator('legend', { hasText: 'What color best describes your mood?' }),
    });
    const grid = iconQuestion.locator('.quiz-options-grid');

    // The computed grid-template-columns should resolve to two equal columns
    const columns = await grid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    // Should be two column values (e.g., "155.5px 155.5px" or similar)
    const columnParts = columns.split(' ').filter((s) => s.length > 0);
    expect(columnParts).toHaveLength(2);
  });

  test('QUIZ-01 Test 3: each option in image grid shows icon above label (flex-direction: column)', async ({ page }) => {
    const iconQuestion = page.locator('.quiz-question', {
      has: page.locator('legend', { hasText: 'What color best describes your mood?' }),
    });

    const copyElements = iconQuestion.locator('.quiz-option-copy');
    const count = await copyElements.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const flexDir = await copyElements.nth(i).evaluate((el) => {
        return window.getComputedStyle(el).flexDirection;
      });
      expect(flexDir).toBe('column');
    }
  });

  test('QUIZ-01 Test 4: non-icon question does NOT get .quiz-image-grid class', async ({ page }) => {
    // Check every quiz-options-grid on the page: grids WITHOUT all-icon options
    // should NOT have the quiz-image-grid class. The mood-color question is the
    // only one guaranteed to have all icons, so any other grid must lack the class.
    const results = await page.evaluate(() => {
      const grids = document.querySelectorAll('.quiz-options-grid');
      return Array.from(grids).map((grid) => {
        const icons = grid.querySelectorAll('.quiz-option-icon');
        const options = grid.querySelectorAll('.quiz-option');
        return {
          hasImageGridClass: grid.classList.contains('quiz-image-grid'),
          allHaveIcons: options.length > 0 && icons.length === options.length,
        };
      });
    });

    // Every grid that does NOT have all icons must NOT have quiz-image-grid
    const nonIconGrids = results.filter((r) => !r.allHaveIcons);
    expect(nonIconGrids.length).toBeGreaterThan(0);
    for (const grid of nonIconGrids) {
      expect(grid.hasImageGridClass).toBe(false);
    }

    // Every grid that DOES have all icons must have quiz-image-grid
    const iconGrids = results.filter((r) => r.allHaveIcons);
    for (const grid of iconGrids) {
      expect(grid.hasImageGridClass).toBe(true);
    }
  });

  test('QUIZ-01 Test 5: icon images in grid are rendered at larger size (min 48px)', async ({ page }) => {
    const iconQuestion = page.locator('.quiz-question', {
      has: page.locator('legend', { hasText: 'What color best describes your mood?' }),
    });

    const iconElements = iconQuestion.locator('.quiz-option-icon');
    const count = await iconElements.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const box = await iconElements.nth(i).boundingBox();
      // Round to handle sub-pixel rendering (e.g. 47.9999 -> 48)
      expect(Math.round(box.width)).toBeGreaterThanOrEqual(48);
      expect(Math.round(box.height)).toBeGreaterThanOrEqual(48);
    }
  });
});
