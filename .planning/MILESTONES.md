# Milestones

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

