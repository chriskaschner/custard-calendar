# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Active **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (in progress)

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

### v1.2 Feature Completion & Cleanup (In Progress)

**Milestone Goal:** Ship all carried-forward active requirements and resolve accumulated tech debt from v1.0/v1.1.

- [x] **Phase 9: Infrastructure & Deployment** - Fix CI, push commits, register SW on remaining pages, add stores.json to pre-cache
- [x] **Phase 10: Redirects & CSS Cleanup** - Old page redirects preserving query params, Mad Libs chip CSS definitions (completed 2026-03-09)
- [ ] **Phase 11: Monolith Refactoring** - Split planner-shared.js into focused modules preserving public API
- [ ] **Phase 12: Feature Development** - Map exclusion filter, quiz image answers, compare multi-store verification

## Phase Details

### Phase 9: Infrastructure & Deployment
**Goal**: CI pipeline is green, all code is deployed, and service worker covers every page with offline store data
**Depends on**: Phase 8 (v1.1 complete)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04
**Success Criteria** (what must be TRUE):
  1. CI repo structure check passes on a fresh push to origin/main
  2. custard.chriskaschner.com serves the latest code including phase 8 quiz mode theming
  3. Service worker installs and activates when visiting fun.html and updates.html
  4. stores.json is available offline after first visit (served from SW cache)
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md -- CI fix, push commits, smoke test script, deploy verification
- [x] 09-02-PLAN.md -- Cache-bust cleanup, SW registration on remaining pages, stores.json pre-cache

### Phase 10: Redirects & CSS Cleanup
**Goal**: Users with old bookmarks land on the correct new page with their query params intact, and Mad Libs chips render from CSS classes instead of inline styles
**Depends on**: Phase 9
**Requirements**: RDIR-01, RDIR-02, DSGN-01
**Success Criteria** (what must be TRUE):
  1. Visiting /scoop.html, /radar.html, /calendar.html, /widget.html, /siri.html, /alerts.html each redirects to the correct new destination
  2. A bookmarked URL like /scoop.html?store=1234 arrives at the new page with ?store=1234 preserved
  3. Redirect pages are minimal stubs (no full JS stack loaded)
  4. Mad Libs chip elements display correct colors and spacing using CSS classes with design tokens (no inline style attributes)
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md -- Redirect stubs for 6 legacy pages, SW cache update, browser test fixes
- [ ] 10-02-PLAN.md -- Mad Libs chip CSS classes, engine.js inline style removal

### Phase 11: Monolith Refactoring
**Goal**: planner-shared.js is split into focused modules with the same public API, enabling targeted browser caching and maintainable code
**Depends on**: Phase 10
**Requirements**: ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. planner-shared.js is smaller than its current 1,624 lines, with extracted code in new focused files
  2. window.CustardPlanner exposes the exact same public API after refactoring (no missing symbols)
  3. All existing Playwright tests pass with zero regressions
  4. New JS files are included in the SW STATIC_ASSETS list with a CACHE_VERSION bump
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Feature Development
**Goal**: Users can filter the map by flavor family, see image-based quiz answers on mobile, and compare flavors across multiple stores side-by-side
**Depends on**: Phase 11
**Requirements**: MAP-01, MAP-02, QUIZ-01, CMPR-01
**Success Criteria** (what must be TRUE):
  1. User can tap exclusion chips on the map page to hide/show markers by flavor family
  2. Map exclusion filter selections persist across page reloads (stored in localStorage)
  3. Quiz questions on mobile show image-based answer options in a grid layout
  4. User can select 2+ stores on the compare page and see their flavors side-by-side in the day-first card stack
  5. Compare page store selections do not leak into Today page drive preferences (separate localStorage keys)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD
- [ ] 12-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12

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
| 10. Redirects & CSS Cleanup | 2/2 | Complete    | 2026-03-09 | - |
| 11. Monolith Refactoring | v1.2 | 0/? | Not started | - |
| 12. Feature Development | v1.2 | 0/? | Not started | - |

Full v1.0 phase details archived: `.planning/milestones/v1.0-ROADMAP.md`
Full v1.1 phase details archived: `.planning/milestones/v1.1-ROADMAP.md`
