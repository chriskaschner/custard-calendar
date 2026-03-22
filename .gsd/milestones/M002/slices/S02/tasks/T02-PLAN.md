# T02: 31-homepage-redesign 02

**Slice:** S02 — **Milestone:** M002

## Description

Replace the "Want this every day?" CTA card with a single text line, clean up dead CSS from removed sections, ensure week-ahead is collapsed by default (HOME-02), update existing today-hero.spec.mjs tests that conflict with the redesign, and add new Playwright browser tests verifying the redesigned homepage layout at 375px.

Purpose: HOME-02 requires week-ahead collapsed by default. HOME-04 requires unified visual language. Dead CSS from Plan 01 removals must be cleaned to prevent style drift. Existing TDAY-05 (signals section visible) and TDAY-06 ("Want this every day" CTA) tests will fail against the redesigned page and must be updated. Browser tests lock in the redesigned layout as regression protection.
Output: Simplified CTA line, cleaned CSS, updated today-hero.spec.mjs, new Playwright test suite for homepage redesign.

## Must-Haves

- [ ] "Week-ahead section is collapsed by default and expands on tap to show upcoming flavors"
- [ ] "Below-fold CTA is a single text line with link -- not a full card"
- [ ] "All homepage sections use unified card system with design token spacing"
- [ ] "Dead CSS for removed sections is cleaned up -- no orphan styles"
- [ ] "Playwright test verifies hero card visible above fold at 375px and week-ahead collapsed"
- [ ] "Existing today-hero.spec.mjs tests updated to match redesigned page (no signals section, new CTA text)"

## Files

- `docs/index.html`
- `docs/today-page.js`
- `docs/style.css`
- `worker/test/browser/homepage-redesign.spec.mjs`
- `worker/test/browser/today-hero.spec.mjs`
