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

