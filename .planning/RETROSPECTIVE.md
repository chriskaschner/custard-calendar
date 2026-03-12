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

## Milestone: v1.1 -- Production Launch + Polish

**Shipped:** 2026-03-09
**Phases:** 3 | **Plans:** 4 | **Sessions:** ~4

### What Was Built
- Extended design token system to 37 tokens with 419 systematic replacements across all CSS
- Eliminated all inline style attributes from fun.html, updates.html, quiz.html
- Shipped 49 commits to production at custard.chriskaschner.com
- Per-mode visual differentiation for all 7 quiz modes via data-quiz-mode attribute theming
- Static analysis test suite (test_design_tokens.py) preventing token and quiz mode regression

### What Worked
- Gap closure phase (Phase 8) was fast and focused -- 2 minutes to implement what Phase 6 couldn't fully deliver
- Static analysis tests for CSS token compliance caught real issues and prevented regression
- Selector-context-aware test parsing solved false-positive problem that would have made tests useless
- Production deploy plan with human verification checkpoint caught 5 real issues for future work
- Audit-driven gap closure: milestone audit identified QUIZ-01 gap, Phase 8 closed it cleanly

### What Was Inefficient
- Phase 6 Plan 02 SUMMARY incorrectly claimed QUIZ-01 completion when it only prepared infrastructure -- required a separate Phase 8 to actually deliver
- Mad Libs chip CSS classes were assigned in engine.js but no CSS rules were written -- inline styles still handle rendering
- The CLI milestone tools ran in the wrong directory (custard-calendar submodule instead of root), requiring manual archive work

### Patterns Established
- data-quiz-mode attribute pattern: JS sets attribute on body, CSS responds with custom property overrides
- CSS class replacement of JS inline styles: prefer .classList.add/remove over style.cssText
- Curl-based production smoke testing to bypass service worker cache
- Milestone audit before completion catches deployment and integration gaps

### Key Lessons
1. Audit before completing milestones -- the v1.1 audit caught the Phase 8 deployment gap and Mad Libs tech debt
2. Gap closure phases should be budgeted -- Phase 8 was needed because Phase 6 couldn't fully deliver QUIZ-01
3. SUMMARY frontmatter must accurately reflect what was delivered, not what was attempted
4. Production deploy plans should include automated smoke tests AND human verification checkpoints

### Cost Observations
- Model mix: 100% opus (quality profile)
- Sessions: ~4 across 2 days
- Notable: 28 min total execution time for 4 plans, ~7 min average per plan

---

## Milestone: v1.2 -- Feature Completion & Cleanup

**Shipped:** 2026-03-09
**Phases:** 4 | **Plans:** 9 | **Sessions:** ~6

### What Was Built
- CI pipeline fixed and all code deployed with reusable 6-page smoke test script
- Full SW coverage on all 8 user-facing pages with stores.json pre-cached (v16->v17->v18)
- 6 legacy pages replaced with ~410-byte redirect stubs preserving query params and hash fragments
- Mad Libs chips migrated from inline JS styles to CSS classes with design token integration
- planner-shared.js split from 1,639-line monolith into 117-line facade + 3 IIFE sub-modules (data/domain/ui)
- Map exclusion filter with localStorage persistence, quiz image grid on mobile, compare localStorage isolation

### What Worked
- Milestone audit pre-flight caught no gaps -- all 13 requirements verified 3 ways before completion
- 3-file monolith split was the right granularity -- avoided both under-splitting (no benefit) and over-splitting (complexity)
- Test-api-surface.html harness caught split regressions before production wiring (all 60 exports verified)
- Page-scoped localStorage keys (custard:map:exclusions, custard:compare:stores) cleanly isolated cross-page state
- Phase ordering (infra -> redirects -> refactor -> features) reduced risk by stabilizing foundation first
- Dimming excluded map markers (0.15 opacity) instead of hiding preserved spatial context

### What Was Inefficient
- ROADMAP.md progress table had misaligned columns for phases 10-12 (milestone column missing) -- carried forward from phase execution without cleanup
- Nyquist validation remained partial on all 4 phases (draft status) -- validation ceremony without completion
- cleanTelemetrySlug duplicated across modules to avoid load-time dependency -- minor duplication accepted as pragmatic trade-off

### Patterns Established
- IIFE + Object.assign sub-module pattern: `Object.assign(window.CustardPlanner, { ... })` for extending global namespace
- Underscore-prefixed internal helpers (_normalizeStringList) to signal private APIs within public namespace
- Meta-refresh redirect stubs: bare HTML (~410 bytes) with query param and hash forwarding
- Exclusion filter pattern: Set-based filter with `.selected` class toggle and localStorage persistence
- Page-scoped localStorage keys prevent cross-page state leaks

### Key Lessons
1. Monolith splits work best at 3-file granularity for codebases under 2K lines -- data/domain/ui is a natural boundary
2. API surface smoke tests (test-api-surface.html) should be created BEFORE splitting, not after
3. Redirect stubs should be bare HTML with no framework dependencies -- ~410 bytes is the right size
4. Page-scoped localStorage keys should be namespaced by feature (custard:map:*, custard:compare:*) from day one

### Cost Observations
- Model mix: 100% opus (quality profile)
- Sessions: ~6 across 1 day
- Notable: 9 plans total, ~11 min average per plan, all 13 requirements satisfied

---

## Milestone: v1.3 -- Asset Parity

**Shipped:** 2026-03-12
**Phases:** 5 | **Plans:** 11 | **Sessions:** ~4

### What Was Built
- Rendering pipeline fixes: 300 DPI supersample, integer downscale, HD geometry sync, color palette parity across 4 sync files
- Validation tooling: CI palette drift gate (16 tests), WCAG 3:1 contrast checker (132 tests), pixelmatch golden baselines (376 tests)
- Expanded color palette from 34 to 56 colors (23 base + 33 topping) and created 37 flavor alias mappings
- 54 new FLAVOR_PROFILES authored across 5 families (chocolate, vanilla, caramel, fruit, specialty) -- 94 total, zero unprofiled
- All 94 Hero cone PNGs regenerated with alias resolution in heroConeSrc() and service worker cache bumped to v19

### What Worked
- Phase ordering (fix quality -> build validators -> expand palette -> author profiles -> generate PNGs) prevented rework
- Contrast checker caught 10 topping colors that needed adjustment BEFORE bulk authoring began -- saved per-profile debugging
- Golden baselines with zero-tolerance pixelmatch threshold caught genuine visual regressions (deterministic PRNG = no false positives)
- Family-based profile authoring (chocolate -> vanilla -> caramel -> fruit -> specialty) made batch work manageable
- Clean-slate PNG regeneration (delete all 40, regenerate 94) was simpler and safer than incremental generation
- Milestone audit (13/13 requirements, 14/14 integrations, 4/4 E2E flows) confirmed completeness before archiving

### What Was Inefficient
- ROADMAP.md plan checkboxes for phases 13-16 were never updated from `[ ]` to `[x]` during execution -- only Phase 17 was kept current
- FLAVOR_ALIASES not included in API response (low severity but creates sync dependency between hardcoded FALLBACK copy and canonical)
- No CI gate for FLAVOR_ALIASES -> FALLBACK_FLAVOR_ALIASES drift -- currently in sync but could diverge silently
- Nyquist validation partial on all 5 phases -- same pattern as v1.0-v1.2

### Patterns Established
- Family-based bulk authoring: group related flavors by base color family for efficient batch profiling
- Structural contrast exemptions: document dark-on-dark and light-on-light pairs that intentionally fail contrast checks
- Alias resolution chain: exact match -> unicode normalize -> alias lookup -> keyword fallback -> default
- FALLBACK_ pattern for client-side copies of server data (works offline, needs sync discipline)
- Golden baseline PNGs under 1KB each -- small enough for git, visually inspectable in PRs

### Key Lessons
1. Build validation tooling BEFORE bulk authoring -- contrast checker and golden baselines caught issues early, not late
2. Zero-tolerance pixelmatch works when rendering is deterministic (seeded PRNG) -- no need for fuzzy thresholds
3. Clean-slate regeneration beats incremental when profiles have changed -- simpler, fewer edge cases
4. Family-based batching (18 chocolate, 23 vanilla, 2 caramel, 14 fruit/specialty) makes large authoring tasks tractable
5. FALLBACK copies of server data need CI sync gates -- manual sync works today but won't scale

### Cost Observations
- Model mix: 100% opus (quality profile)
- Sessions: ~4 across 2 days
- Notable: 82 min total execution time for 11 plans, ~7.5 min average per plan

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 5 | Baseline: IIFE pattern, Playwright scaffolds, SW bump discipline |
| v1.1 | ~4 | 3 | Audit-driven gap closure, CSS static analysis tests, production deploy with human verification |
| v1.2 | ~6 | 4 | Monolith split (3-file IIFE), page-scoped localStorage, redirect stubs, API surface smoke tests |
| v1.3 | ~4 | 5 | Validation-first pipeline, family-based bulk authoring, golden baselines, alias resolution chain |

### Cumulative Quality

| Milestone | Playwright Tests | Worker Tests | Python Tests | Notes |
|-----------|-----------------|--------------|--------------|-------|
| v1.0 | 32+ | 810+ | 179 | All 38 requirements verified 3 ways |
| v1.1 | 32+ | 810+ | 179+ | 7/7 requirements satisfied, 5 static analysis tests added |
| v1.2 | 50+ | 810+ | 179+ | 13/13 requirements satisfied, map/quiz/compare browser tests added |
| v1.3 | 50+ | 1,351 | 179+ | 13/13 requirements, +541 worker tests (palette sync, contrast, golden baselines, PNG count) |

### Top Lessons (Verified Across Milestones)

1. Audit before completing milestones -- caught deployment gap in v1.1, caught unused tokens in v1.0, confirmed clean v1.2 and v1.3
2. Gap closure plans are high-value and fast -- budget 1-2 per milestone
3. Static analysis tests for CSS/token compliance prevent silent regression
4. Monolith splits at data/domain/ui boundaries work well for codebases under 2K lines -- verified in v1.2
5. Page-scoped localStorage keys prevent cross-page state leaks -- established in v1.2, apply from day one
6. Build validation tooling before bulk work -- v1.3 contrast checker caught 10 issues before they multiplied across 54 profiles
7. Clean-slate regeneration beats incremental when upstream data has changed fundamentally -- v1.3 PNG regen
