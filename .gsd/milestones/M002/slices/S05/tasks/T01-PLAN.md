# T01: 34-social-sharing 01

**Slice:** S05 — **Milestone:** M002

## Description

Add PNG OG card generation for quiz results and flavor rarity stats, plus Worker-level crawler interception for shared URLs.

Purpose: Social platforms (Twitter, Facebook, iMessage, WhatsApp) require PNG og:image URLs and do not execute JavaScript. This plan creates the server-side infrastructure that makes shared links render rich preview cards on social platforms.

Note on .png vs .svg endpoints: CONTEXT.md specifies `.svg` endpoints (`/og/quiz/{archetype}/{flavor}.svg`, `/og/flavor/{flavor-name}.svg`). RESEARCH.md confirmed that SVG og:image is not supported by any social platform -- Twitter, Facebook, iMessage, WhatsApp, Discord, and Slack all require PNG/JPEG. Endpoints use `.png` extension instead to ensure cards actually render on social platforms. This is a necessary technical override; SVG cards would display as blank placeholders, making the entire sharing feature non-functional.

Output: Two new PNG card types in social-card.js, two new OG route patterns, crawler interception in index.js, and comprehensive tests.

## Must-Haves

- [ ] "Quiz OG card endpoint returns a PNG image with archetype name, flavor name, and cone art"
- [ ] "Flavor rarity OG card endpoint returns a PNG image with flavor name, rarity label, appearance count, and cone art"
- [ ] "Social crawlers requesting quiz.html?archetype=X&flavor=Y receive HTML with correct og:image pointing to the quiz PNG card"
- [ ] "Social crawlers requesting radar.html?flavor=X or index.html?flavor=X receive HTML with correct og:image pointing to the flavor PNG card"
- [ ] "Human browsers pass through to GitHub Pages without interception"
- [ ] "All existing social card tests and Worker tests continue to pass"

## Files

- `worker/package.json`
- `worker/src/social-card.js`
- `worker/src/index.js`
- `worker/test/social-card.test.js`
