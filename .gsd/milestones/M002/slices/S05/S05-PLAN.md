# S05: Social Sharing

**Goal:** Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.
**Demo:** Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.

## Must-Haves


## Tasks

- [x] **T01: 34-social-sharing 01**
  - Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.

Purpose: Social platforms (Twitter, Facebook, iMessage, WhatsApp) require PNG og:image URLs and do not execute JavaScript. This plan creates the server-side infrastructure that makes shared links render rich preview cards on social platforms.

Note on .png vs .svg endpoints: CONTEXT.md specifies `.svg` endpoints (`/og/quiz/{archetype}/{flavor}.svg`, `/og/flavor/{flavor-name}.svg`). RESEARCH.md confirmed that SVG og:image is not supported by any social platform -- Twitter, Facebook, iMessage, WhatsApp, Discord, and Slack all require PNG/JPEG. Endpoints use `.png` extension instead to ensure cards actually render on social platforms. This is a necessary technical override; SVG cards would display as blank placeholders, making the entire sharing feature non-functional.

Output: Two new PNG card types in social-card.js, two new OG route patterns, crawler interception in index.js, and comprehensive tests.
- [x] **T02: 34-social-sharing 02**
  - Add quiz skip-to-result mode, flavor-themed share text, and per-flavor share icons on the Radar flavor entries (week strip on homepage).

Purpose: When someone clicks a shared quiz result or flavor link, they see meaningful content immediately and are encouraged to engage (take the quiz, explore flavors). Share buttons generate the URLs that Plan 01's crawler interception and OG cards power. Per user decision, flavor share links use `radar.html?flavor=X` (radar.html redirects to index.html preserving query params, where today-page.js handles the ?flavor= param).

Output: Modified engine.js with skip-to-result path, modified today-page.js with flavor highlight and Radar share icons, updated quiz.html with CTA button, CSS for highlight animation.

## Files Likely Touched

- `worker/package.json`
- `worker/src/social-card.js`
- `worker/src/index.js`
- `worker/test/social-card.test.js`
- `docs/quizzes/engine.js`
- `docs/quiz.html`
- `docs/today-page.js`
- `docs/style.css`

## Observability / Diagnostics

- **`data-skip-result` attribute on `<body>`**: When `quiz.html?archetype=X&flavor=Y` triggers the skip-to-result path, `document.body.dataset.skipResult === 'true'`. Inspect via DevTools or `document.body.getAttribute('data-skip-result')`.
- **`console.debug('[quiz] skip-to-result: ...')`**: Engine logs the resolved archetype ID and flavor name when the skip path activates. Check browser console.
- **Share copy feedback**: After clipboard copy, the week strip share icon adds `.week-day-share-btn--copied` class (visible 2s) and reads "Link copied!" in aria-label. Inspect via DevTools.
- **Highlight animation**: `?flavor=X` causes `.week-day-card--highlight` class + `flavor-highlight-pulse` keyframe animation on the matching card. Verify with DevTools element inspector.
- **Failure path**: If `?archetype=` refers to an unknown archetype ID, `setStatus('Unknown archetype in shared link: ...', 'error')` fires and the skip path returns false (falls back to normal quiz load). Verify by loading `quiz.html?archetype=nonexistent`.
- **Crawler interception diagnostic** (from T01): `curl -H "User-Agent: facebookexternalhit/1.1" "https://custard.chriskaschner.com/quiz.html?archetype=cool-front&flavor=Turtle"` — should return HTML with `og:image` pointing to `/og/quiz/cool-front/Turtle.png`.

## Verification

- `cd worker && npm test` — all tests pass (no regressions from T01)
- `docs/quizzes/engine.js` exports `showSkipToResult` as observable surface (named function, inspectable in DevTools)
- Open `quiz.html?archetype=cool-front&flavor=Turtle` in browser → result card shows immediately; quiz form is hidden; "Take the quiz yourself" button is visible; `document.body.getAttribute('data-skip-result') === 'true'`
- Open `quiz.html?archetype=nonexistent` in browser → error status message shown; quiz form remains visible
- Share button in quiz result generates `I'm a {Archetype} ({Flavor}) -- what's your custard personality?` title
- Open `index.html?flavor=Turtle` in browser → week strip card for Turtle shows `.week-day-card--highlight` class; card scrolls into view
- Week strip cards with a flavor show a small share icon button → clicking copies `radar.html?flavor=X` URL to clipboard
- Diagnostic failure check: load `quiz.html?archetype=nonexistent` → `quiz-status` element reads "Unknown archetype in shared link: nonexistent"
