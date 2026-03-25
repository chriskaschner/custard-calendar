# S03: PNG OG Page Cards

**Goal:** Every page URL shared on social platforms renders a real 1200×630 PNG preview image instead of the current blank card (SVG og:image is universally unsupported).
**Demo:** `rg "og:image.*\.png" docs/*.html` returns 8 matches. `rg "og:image.*\.svg" docs/*.html` returns 0. `cd worker && npm test` passes with new page PNG card tests covering all defined slugs.

## Must-Haves

- `renderPageCardPng()` function using `ImageResponse` from `workers-og` (matching quiz/flavor card pattern)
- `handlePageCardPng()` handler with 404 for unknown slugs, CORS headers, 24h cache TTL
- PNG route regex `/^\/og\/page\/([\w-]+)\.png$/` added to `handleSocialCard` before the existing `.svg` match
- `compare` and `fun` entries added to `PAGE_CARD_DEFS` so every HTML page has a distinct card
- All 8 HTML files' `og:image` meta tags updated from `.svg` to `.png` with correct per-page slugs
- Existing SVG page card route and tests remain untouched and green
- All worker tests pass (existing + new)

## Proof Level

- This slice proves: contract (PNG endpoint returns valid image response for all slugs; HTML meta tags point to PNG URLs)
- Real runtime required: no (vitest mock covers `ImageResponse`; HTML tag correctness is static)
- Human/UAT required: yes (spot-check one shared URL on Twitter/iMessage after deploy — not blocking for slice completion)

## Verification

- `cd worker && npm test` — all tests pass including new page PNG card describe block
- `cd worker && npm test -- test/social-card.test.js` — social card tests pass in isolation
- `rg "og:image.*\.svg" docs/*.html` — returns nothing (zero SVG og:image references)
- `rg "og:image.*\.png" docs/*.html` — returns exactly 8 matches
- New tests cover: valid slug → 200 PNG, unknown slug → 404, CORS headers present, 24h cache TTL, cone fetch failure fallback, all 13 page slugs return 200, no interference with existing SVG routes

## Tasks

- [ ] **T01: Add PNG page card renderer, handler, route, and tests** `est:45m`
  - Why: Core backend work — adds the `renderPageCardPng` and `handlePageCardPng` functions mirroring the proven quiz/flavor card pattern, wires the PNG route into `handleSocialCard`, adds `compare`/`fun` entries to `PAGE_CARD_DEFS`, and writes comprehensive vitest tests.
  - Files: `worker/src/social-card.js`, `worker/test/social-card.test.js`
  - Do: Add `compare` and `fun` to `PAGE_CARD_DEFS`. Write `renderPageCardPng()` using `ImageResponse` with the same HTML template structure as `renderQuizCardPng`. Write `handlePageCardPng()` following `handleQuizCard` pattern (lookup def → 404 if missing → get accent color → fetch cone → render → copy CORS + cache headers). Add PNG regex match **before** the existing `.svg` page match in `handleSocialCard`. Add a new describe block in the test file with tests for: valid slug returns 200 PNG, unknown slug returns 404, 24h cache, CORS headers, all 13 slugs return 200, cone fetch failure fallback, no interference with SVG routes.
  - Verify: `cd worker && npm test -- test/social-card.test.js` passes with new tests
  - Done when: `handleSocialCard('/og/page/forecast.png', {}, cors)` returns a 200 PNG response and all new + existing tests pass

- [ ] **T02: Update HTML og:image meta tags from SVG to PNG** `est:15m`
  - Why: Closes the loop — the PNG endpoint exists (T01) but pages still reference `.svg`. This task updates all 8 HTML files to point to the correct `.png` URLs with proper per-page slugs.
  - Files: `docs/index.html`, `docs/compare.html`, `docs/fun.html`, `docs/map.html`, `docs/quiz.html`, `docs/group.html`, `docs/updates.html`, `docs/widget.html`
  - Do: Update `og:image` content attribute in each file: index→`forecast.png`, compare→`compare.png`, fun→`fun.png`, map→`map.png`, quiz→`quiz.png`, group→`group.png`, updates→`alerts.png`, widget→`widget.png`. Each change is a single-line `sed` or `edit` replacing `.svg` with `.png` and fixing the slug where needed.
  - Verify: `rg "og:image.*\.svg" docs/*.html` returns nothing; `rg "og:image.*\.png" docs/*.html` returns 8 matches; `cd worker && npm test` still green
  - Done when: All 8 pages reference `.png` og:image URLs matching defined `PAGE_CARD_DEFS` slugs, and zero SVG og:image references remain

## Files Likely Touched

- `worker/src/social-card.js`
- `worker/test/social-card.test.js`
- `docs/index.html`
- `docs/compare.html`
- `docs/fun.html`
- `docs/map.html`
- `docs/quiz.html`
- `docs/group.html`
- `docs/updates.html`
- `docs/widget.html`
