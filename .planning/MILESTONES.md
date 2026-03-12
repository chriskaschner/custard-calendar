# Milestones

## v1.3 Asset Parity (Shipped: 2026-03-12)

**Phases completed:** 5 phases, 11 plans

**Key accomplishments:**
- Fixed rendering pipeline: 300 DPI supersample, integer downscale, HD geometry sync, color palette parity across all 4 sync files
- Built validation tooling: CI palette drift gate, WCAG 3:1 contrast checker, pixelmatch golden baselines for visual regression
- Expanded color palette from 34 to 56 colors (23 base + 33 topping) and created 37 flavor alias mappings
- Authored 54 new FLAVOR_PROFILES (94 total) covering every known flavor -- zero unprofiled entries remain
- Regenerated all 94 Hero cone PNGs from scratch with alias resolution in heroConeSrc() and cache bump to v19

**Stats:**
- Files modified: 488 | Lines added: 1,602 | Lines removed: 161
- Timeline: 2 days (2026-03-09 to 2026-03-10)
- Execution time: ~82 min across 11 plans (~7.5 min/plan)
- Commits: 24
- Requirements: 13/13 satisfied
- UAT: 6/6 passed

**Known tech debt:**
- FLAVOR_ALIASES not included in API /flavor-colors response (low severity -- FALLBACK copy works)
- No CI gate for FLAVOR_ALIASES -> FALLBACK_FLAVOR_ALIASES sync (medium severity -- currently 37/37 in sync)
- Nyquist validation partial on all 5 phases

---

## v1.2 Feature Completion & Cleanup (Shipped: 2026-03-09)

**Phases completed:** 4 phases, 9 plans

**Key accomplishments:**
- Fixed CI pipeline and deployed all code with reusable 6-page smoke test script
- Full SW coverage on all 8 user-facing pages with stores.json pre-cached for offline access (v16->v17->v18)
- 6 legacy pages replaced with ~410-byte redirect stubs preserving query params and hash fragments
- Mad Libs chips migrated from inline JS styles to CSS classes with design token integration
- Monolith planner-shared.js split from 1,639 lines into 117-line facade + 3 focused IIFE sub-modules (60 exports preserved)
- Map exclusion filter with localStorage persistence, quiz image grid on mobile, compare localStorage isolation

**Stats:**
- Files modified: 49 | Lines added: 8,205 | Lines removed: 1,186
- Timeline: 1 day (2026-03-09)
- Commits: 41
- Requirements: 13/13 satisfied

**Known tech debt:**
- Hero cone PNGs cover 40/176 flavors (CONE-01 deferred to future release)
- 14 pre-existing browser test failures (not regressions from v1.2 work)
- Nyquist validation partial on all 4 phases (draft status)

---

## v1.0 Custard Calendar Site Restructuring (Shipped: 2026-03-08)

**Phases completed:** 5 phases, 17 plans, 0 tasks

**Key accomplishments:**
- Shared navigation with persistent store indicator and IP geolocation across all 15 pages
- Simplified Today page -- cone, flavor, description above the fold at 375px with progressive disclosure
- Compare page -- store-by-day card stack grid with accordion expand and exclusion filter chips
- Fun page (quiz cards, Mad Libs, Group Vote, Fronts) and consolidated Get Updates page
- Unified visual system -- design tokens, .card component system, seasonal rarity suppression, hero cone PNG pipeline
- 38/38 v1 requirements satisfied with full Playwright test coverage

**Stats:**
- Files modified: 63 | Lines added: 12,592
- Timeline: 2 days (2026-03-07 to 2026-03-08)
- Execution time: ~2 hours across 15 plans

**Tech debt carried forward:**
- Design tokens defined but not consumed (8 of 17 tokens unused in CSS rules)
- Hero cone PNGs cover 40/176 flavors (SVG fallback for rest)
- stores.json not in SW pre-cache list
- Stale TODO in nav-clickthrough.spec.mjs

---

## v1.1 Production Launch + Polish (Shipped: 2026-03-09)

**Phases completed:** 3 phases, 4 plans, 9 tasks

**Key accomplishments:**
- Extended design token system to 37 tokens with 419 systematic CSS replacements (zero hardcoded colors/spacing)
- Eliminated all inline style attributes in fun.html, updates.html, and quiz.html
- Shipped 49 commits to production at custard.chriskaschner.com with automated smoke test verification
- Implemented per-mode visual differentiation for all 7 quiz modes via data-quiz-mode attribute theming
- Created static analysis test suite preventing design token and quiz mode regression

**Stats:**
- Files modified: 10 | Lines added: 2,090 | Lines removed: 545
- Timeline: 2 days (2026-03-08 to 2026-03-09)
- Execution time: ~28 min across 4 plans
- Requirements: 7/7 satisfied

**Known tech debt:**
- Mad Libs chip CSS classes assigned but no CSS definitions (inline styles handle rendering)
- Phase 8 commits not pushed to origin/main (quiz mode visual differentiation not deployed)
- CI Repo Structure Check fails (.planning/ not in REPO_CONTRACT.md)
- Hero cone PNGs cover 40/176 flavors
- planner-shared.js is a 1,624-line untested monolith

---

