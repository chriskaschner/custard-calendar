# S02: Homepage Redesign

**Goal:** Redesign the homepage hero card to be a complete decision-making unit (flavor + rarity + action CTAs + store meta) and the only content above the fold.
**Demo:** Redesign the homepage hero card to be a complete decision-making unit (flavor + rarity + action CTAs + store meta) and the only content above the fold.

## Must-Haves


## Tasks

- [x] **T01: 31-homepage-redesign 01** `est:6min`
  - Redesign the homepage hero card to be a complete decision-making unit (flavor + rarity + action CTAs + store meta) and the only content above the fold. Strip the page header, simplify the empty state to a minimal prompt, add a CLS-preventing skeleton with cone placeholder, and wire action CTAs into the hero card.

Purpose: HOME-01 requires the hero card above fold with full decision info. HOME-02 requires week-ahead collapsed by default. HOME-03 requires zero layout shift. HOME-04 requires unified card system usage. This plan delivers the primary content area and ensures the week-ahead details element has no open attribute.
Output: Redesigned index.html with hero card, skeleton, empty state, and error state. Updated today-page.js with CTAs and meta footer. Updated style.css with skeleton cone placeholder.
- [x] **T02: 31-homepage-redesign 02** `est:5min`
  - Replace the "Want this every day?" CTA card with a single text line, clean up dead CSS from removed sections, ensure week-ahead is collapsed by default (HOME-02), update existing today-hero.spec.mjs tests that conflict with the redesign, and add new Playwright browser tests verifying the redesigned homepage layout at 375px.

Purpose: HOME-02 requires week-ahead collapsed by default. HOME-04 requires unified visual language. Dead CSS from Plan 01 removals must be cleaned to prevent style drift. Existing TDAY-05 (signals section visible) and TDAY-06 ("Want this every day" CTA) tests will fail against the redesigned page and must be updated. Browser tests lock in the redesigned layout as regression protection.
Output: Simplified CTA line, cleaned CSS, updated today-hero.spec.mjs, new Playwright test suite for homepage redesign.

## Files Likely Touched

- `docs/index.html`
- `docs/today-page.js`
- `docs/style.css`
- `docs/index.html`
- `docs/today-page.js`
- `docs/style.css`
- `worker/test/browser/homepage-redesign.spec.mjs`
- `worker/test/browser/today-hero.spec.mjs`
