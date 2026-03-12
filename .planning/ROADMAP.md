# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Shipped **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (shipped 2026-03-09)
- Shipped **v1.3 Asset Parity** -- Phases 13-17 (shipped 2026-03-12)
- Active **v1.4 Bug Fixes** -- Phases 18-19 (in progress)

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

<details>
<summary>Shipped v1.3 Asset Parity (Phases 13-17) -- SHIPPED 2026-03-12</summary>

- [x] Phase 13: Rendering Quality Fixes (2/2 plans) -- color sync, HD geometry, 300 DPI pipeline
- [x] Phase 14: Validation Tooling (2/2 plans) -- palette drift CI, contrast checker, golden baselines
- [x] Phase 15: Palette Expansion & Aliases (2/2 plans) -- 10 base colors, 12 topping colors, 37 aliases
- [x] Phase 16: Bulk Profile Authoring (3/3 plans) -- 54 new profiles (94 total), zero unprofiled
- [x] Phase 17: PNG Generation & Deployment (2/2 plans) -- 94 Hero PNGs, alias resolution, cache v19

</details>

### v1.4 Bug Fixes (In Progress)

- [ ] **Phase 18: Store Selection Fixes** - Today and Compare pages respect geolocated store correctly
- [ ] **Phase 19: Map Geolocation Fixes** - Map centers on user, shows nearest store, displays position dot

## Phase Details

### Phase 18: Store Selection Fixes
**Goal**: Users who already have a geolocated store see correct initial state on Today and Compare pages
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: STOR-01, STOR-02
**Success Criteria** (what must be TRUE):
  1. User with a previously selected store sees the flavor card immediately on Today page -- no onboarding banner
  2. User visiting Today page for the first time (no store selected) still sees the onboarding banner
  3. User arriving on Compare page with a geolocated store sees only that single store's schedule -- not 4 nearby stores
  4. User can still add additional stores on Compare page after the single-store initial load
**Plans**: TBD

### Phase 19: Map Geolocation Fixes
**Goal**: Map page accurately reflects user's real-world position and shows relevant nearby stores
**Depends on**: Phase 18 (correct geolocation flow)
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Map viewport centers on user's actual GPS coordinates when geolocation is granted -- not St. Louis or any fallback
  2. When user is physically near a store, that store's marker is visually highlighted or selected on the map
  3. A "you are here" dot appears at the user's precise GPS position, distinct from store markers
  4. Map falls back gracefully to a reasonable default view when geolocation is denied or unavailable
**Plans**: TBD

## Progress

**Execution Order:** Phase 18 then Phase 19.

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-5 | v1.0 | 15/15 | Complete | 2026-03-08 |
| 6-8 | v1.1 | 4/4 | Complete | 2026-03-09 |
| 9-12 | v1.2 | 9/9 | Complete | 2026-03-09 |
| 13-17 | v1.3 | 11/11 | Complete | 2026-03-12 |
| 18. Store Selection Fixes | v1.4 | 0/TBD | Not started | - |
| 19. Map Geolocation Fixes | v1.4 | 0/TBD | Not started | - |

**Total: 19 phases, 39+ plans across 5 milestones**

Full phase details for completed milestones archived:
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/milestones/v1.3-ROADMAP.md`
