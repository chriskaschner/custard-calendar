# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 -- Custard Calendar Site Restructuring

**Shipped:** 2026-03-08
**Phases:** 5 | **Plans:** 15 | **Sessions:** ~8

### What Was Built
- Shared navigation with persistent store indicator and IP geolocation across 15 pages
- Today page: above-the-fold flavor card at 375px with rarity tags, multi-store row, progressive disclosure
- Compare page: day-first card stack grid with accordion expand and exclusion filter chips
- Fun page: quiz mode cards, Mad Libs chip UI, Group Vote and Fronts link-outs
- Get Updates page: consolidated Calendar/Widget/Siri/Alerts with inline alert signup
- Visual system: design tokens, .card component system, seasonal rarity suppression, 40 hero cone PNGs

### What Worked
- IIFE module pattern kept each page self-contained with no build step -- fast iteration
- Parallel Phase 2+3 execution (both depended only on Phase 1) saved wall-clock time
- Playwright test scaffolds created early in each phase caught regressions immediately
- Gap closure plans (01-03, 01-04) addressed real issues found during deployment without scope creep
- CustomEvent bridge pattern (sharednav:storechange) enabled clean cross-component communication
- Service worker cache-version-bump discipline ensured fresh content after each phase

### What Was Inefficient
- Plans 04-04 and 05-03 were defined in the roadmap but never executed -- their work was absorbed into adjacent plans or tracked as tech debt. Plan count mismatch (17 defined vs 15 executed) caused confusion at milestone completion
- Design tokens were defined (Phase 5 Plan 01) but not consumed in CSS rules -- the gap closure plan (05-03) was created but never executed, leaving 8 unused tokens
- Nyquist validation files were created for all phases but none completed wave 0 -- validation was ceremonial rather than functional

### Patterns Established
- IIFE revealing module pattern: `window.CustardX = (function() { ... })()` with DOMContentLoaded auto-init
- SharedNav injection: every page loads shared-nav.js, which renders nav + store indicator + footer
- Service worker bump discipline: each phase's final plan bumps CACHE_VERSION
- Playwright context.route() for cross-origin API mocking (page.route doesn't intercept cross-origin)
- Day-first card stack layout for mobile grid UIs instead of table columns

### Key Lessons
1. Define plans at execution granularity, not wishlist granularity -- unused plans create tracking confusion
2. Gap closure plans (inserted during execution) are high-value; budget for 1-2 per phase
3. Static HTML + vanilla JS + GitHub Pages is genuinely fast -- 15 plans in 2 hours with zero build issues
4. isSeasonalFlavor() guard pattern prevents misleading UX claims -- worth applying to any temporal data display

### Cost Observations
- Model mix: 100% opus (quality profile)
- Sessions: ~8 across 2 days
- Notable: 2 hours total execution time for 15 plans, ~8 min average per plan

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 5 | Baseline: IIFE pattern, Playwright scaffolds, SW bump discipline |

### Cumulative Quality

| Milestone | Playwright Tests | Worker Tests | Notes |
|-----------|-----------------|--------------|-------|
| v1.0 | 32+ | 810+ | All 38 requirements verified 3 ways (VERIFICATION + SUMMARY + REQUIREMENTS) |

### Top Lessons (Verified Across Milestones)

1. (First milestone -- cross-validation starts at v1.1)
