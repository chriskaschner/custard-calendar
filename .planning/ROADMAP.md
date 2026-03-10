# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Shipped **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (shipped 2026-03-09)
- Active **v1.3 Asset Parity** -- Phases 13-17 (in progress)

## Phases

<details>
<summary>Shipped v1.0 MVP (Phases 1-5) -- SHIPPED 2026-03-08</summary>

- [x] Phase 1: Foundation (4/4 plans) -- shared nav, store indicator, geolocation
- [x] Phase 2: Today Page (3/3 plans) -- flavor above fold, rarity, multi-store row
- [x] Phase 3: Compare Page (3/3 plans) -- store-by-day grid, filters, accordion
- [x] Phase 4: Supporting Pages + Nav (3/3 plans) -- Fun page, Get Updates, 4-item nav
- [x] Phase 5: Visual Polish (2/2 plans) -- card system, design tokens, hero cone PNGs

</details>

<details>
<summary>Shipped v1.1 Production Launch + Polish (Phases 6-8) -- SHIPPED 2026-03-09</summary>

- [x] Phase 6: CSS + Quiz Polish (2/2 plans) -- completed 2026-03-08
- [x] Phase 7: Production Deploy (1/1 plan) -- completed 2026-03-09
- [x] Phase 8: Quiz Mode Visual Differentiation (1/1 plan) -- completed 2026-03-09

</details>

<details>
<summary>Shipped v1.2 Feature Completion & Cleanup (Phases 9-12) -- SHIPPED 2026-03-09</summary>

- [x] Phase 9: Infrastructure & Deployment (2/2 plans) -- completed 2026-03-09
- [x] Phase 10: Redirects & CSS Cleanup (2/2 plans) -- completed 2026-03-09
- [x] Phase 11: Monolith Refactoring (2/2 plans) -- completed 2026-03-09
- [x] Phase 12: Feature Development (3/3 plans) -- completed 2026-03-09

</details>

### v1.3 Asset Parity (In Progress)

**Milestone Goal:** Every flavor renders at the same quality tier with a proper profile -- no more mixed Hero PNG vs HD SVG fallback on the same page.

- [x] **Phase 13: Rendering Quality Fixes** - Fix color drift across sync files, integer PNG scale, HD geometry sync, higher DPI rasterization (completed 2026-03-10)
- [ ] **Phase 14: Validation Tooling** - CI palette sync test, contrast checker, pixelmatch golden baselines
- [ ] **Phase 15: Palette Expansion & Aliases** - ~10 base colors, ~10 topping colors, ~20 alias mappings across all sync files
- [ ] **Phase 16: Bulk Profile Authoring** - FLAVOR_PROFILES entries for all ~107 unprofiled flavors
- [ ] **Phase 17: PNG Generation & Deployment** - Regenerate Hero PNGs for 176+ flavors, bump service worker cache

## Phase Details

### Phase 13: Rendering Quality Fixes
**Goal**: Existing 40 profiled flavors render correctly and consistently across all four sync files and both renderers
**Depends on**: Phase 12 (v1.2 complete)
**Requirements**: RNDQ-01, RNDQ-02, RNDQ-03, RNDQ-04
**Success Criteria** (what must be TRUE):
  1. Hero cone PNGs use clean integer downscale ratio (no alternating 3px/4px pixel artifacts in waffle cone)
  2. All hex color values are identical across flavor-colors.js, cone-renderer.js, culvers_fotd.star, and flavor-audit.html
  3. HD scoop geometry in cone-renderer.js matches the server renderer (same row-1 taper step)
  4. SVG rasterization produces visibly crisper edges at 300 DPI vs current 72 DPI
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md -- Sync color palettes across all 4 files + fix HD scoop geometry
- [ ] 13-02-PLAN.md -- Fix PNG generation pipeline (1:1 rasterization at 300 DPI)

### Phase 14: Validation Tooling
**Goal**: Automated guards prevent quality regressions before bulk profile authoring begins
**Depends on**: Phase 13
**Requirements**: VALD-01, VALD-02, VALD-03
**Success Criteria** (what must be TRUE):
  1. CI test fails if any color hex value drifts between flavor-colors.js and cone-renderer.js
  2. Contrast checker flags any topping/base combination below 3:1 ratio before profiles are committed
  3. Pixelmatch golden baselines exist for all 4 rendering tiers across reference flavors, detecting unintended visual changes
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

### Phase 15: Palette Expansion & Aliases
**Goal**: All color keys and alias mappings exist so new profiles can reference them without silent failures
**Depends on**: Phase 14
**Requirements**: PROF-01, PROF-02, PROF-04
**Success Criteria** (what must be TRUE):
  1. ~10 new base colors (espresso, cherry, pumpkin, banana, coconut, root_beer, pistachio, orange, blue_moon, maple) resolve correctly in all 4 sync files
  2. ~10 new topping colors resolve correctly in all 4 sync files
  3. ~20 duplicate/alias flavor names resolve to their canonical profile (no duplicate FLAVOR_PROFILES entries needed)
  4. CI palette sync test passes with the expanded color set
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: Bulk Profile Authoring
**Goal**: Every flavor in the catalog has a proper FLAVOR_PROFILES entry with base/ribbon/toppings/density
**Depends on**: Phase 15
**Requirements**: PROF-03
**Success Criteria** (what must be TRUE):
  1. All ~107 previously unprofiled flavors have FLAVOR_PROFILES entries with base, ribbon, toppings, and density fields
  2. Every new profile passes the contrast checker (no topping/base pair below 3:1)
  3. flavor-audit.html shows zero "unprofiled" or "keyword fallback" entries for any known flavor
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

### Phase 17: PNG Generation & Deployment
**Goal**: Every profiled flavor has a Hero cone PNG and users see consistent quality across the site
**Depends on**: Phase 16
**Requirements**: PNGS-01, PNGS-02
**Success Criteria** (what must be TRUE):
  1. Hero cone PNGs exist for all 176+ profiled flavors (no HD SVG fallback for any profiled flavor)
  2. Today page shows consistent Hero-tier rendering -- no mixing of PNG and SVG quality levels in the same view
  3. Service worker CACHE_VERSION is bumped so returning users get fresh PNGs without manual cache clear
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15 -> 16 -> 17

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-07 |
| 2. Today Page | v1.0 | 3/3 | Complete | 2026-03-07 |
| 3. Compare Page | v1.0 | 3/3 | Complete | 2026-03-08 |
| 4. Supporting Pages + Nav | v1.0 | 3/3 | Complete | 2026-03-08 |
| 5. Visual Polish | v1.0 | 2/2 | Complete | 2026-03-08 |
| 6. CSS + Quiz Polish | v1.1 | 2/2 | Complete | 2026-03-08 |
| 7. Production Deploy | v1.1 | 1/1 | Complete | 2026-03-09 |
| 8. Quiz Mode Visual Differentiation | v1.1 | 1/1 | Complete | 2026-03-09 |
| 9. Infrastructure & Deployment | v1.2 | 2/2 | Complete | 2026-03-09 |
| 10. Redirects & CSS Cleanup | v1.2 | 2/2 | Complete | 2026-03-09 |
| 11. Monolith Refactoring | v1.2 | 2/2 | Complete | 2026-03-09 |
| 12. Feature Development | v1.2 | 3/3 | Complete | 2026-03-09 |
| 13. Rendering Quality Fixes | 2/2 | Complete   | 2026-03-10 | - |
| 14. Validation Tooling | v1.3 | 0/0 | Not started | - |
| 15. Palette Expansion & Aliases | v1.3 | 0/0 | Not started | - |
| 16. Bulk Profile Authoring | v1.3 | 0/0 | Not started | - |
| 17. PNG Generation & Deployment | v1.3 | 0/0 | Not started | - |

Full v1.0 phase details archived: `.planning/milestones/v1.0-ROADMAP.md`
Full v1.1 phase details archived: `.planning/milestones/v1.1-ROADMAP.md`
Full v1.2 phase details archived: `.planning/milestones/v1.2-ROADMAP.md`
