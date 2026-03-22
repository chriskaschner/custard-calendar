# S05: Social Sharing

**Goal:** Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.
**Demo:** Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.

## Must-Haves


## Tasks

- [ ] **T01: 34-social-sharing 01**
  - Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.

Purpose: Social platforms (Twitter, Facebook, iMessage, WhatsApp) require PNG og:image URLs and do not execute JavaScript. This plan creates the server-side infrastructure that makes shared links render rich preview cards on social platforms.

Note on .png vs .svg endpoints: CONTEXT.md specifies `.svg` endpoints (`/og/quiz/{archetype}/{flavor}.svg`, `/og/flavor/{flavor-name}.svg`). RESEARCH.md confirmed that SVG og:image is not supported by any social platform -- Twitter, Facebook, iMessage, WhatsApp, Discord, and Slack all require PNG/JPEG. Endpoints use `.png` extension instead to ensure cards actually render on social platforms. This is a necessary technical override; SVG cards would display as blank placeholders, making the entire sharing feature non-functional.

Output: Two new PNG card types in social-card.js, two new OG route patterns, crawler interception in index.js, and comprehensive tests.
- [ ] **T02: 34-social-sharing 02**
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
