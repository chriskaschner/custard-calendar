# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Shipped **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (shipped 2026-03-09)
- Shipped **v1.3 Asset Parity** -- Phases 13-17 (shipped 2026-03-12)
- Shipped **v1.4 Bug Fixes** -- Phases 18-19 (shipped 2026-03-13)
- Active **v1.5 Visual Polish** -- Phases 20-25 (in progress)

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

<details>
<summary>Shipped v1.4 Bug Fixes (Phases 18-19) -- SHIPPED 2026-03-13</summary>

- [x] Phase 18: Store Selection Fixes (2/2 plans) -- Today onboarding banner fix, single-store Compare page
- [x] Phase 19: Map Geolocation Fixes (2/2 plans) -- GPS centering, position dot, nearest store highlight

</details>

### v1.5 Visual Polish (In Progress)

- [x] **Phase 20: Design Token Expansion** - Add semantic state, rarity, and interactive tokens to the design system (completed 2026-03-13)
- [x] **Phase 21: Card & Button Unification** - Consolidate all card and button styles to shared base classes (completed 2026-03-14)
- [x] **Phase 22: Inline Style Elimination** - Replace remaining inline styles with CSS classes consuming design tokens (completed 2026-03-14)
- [x] **Phase 23: Compare UX Fix** - Deliver a coherent first-load experience on the Compare page (completed 2026-03-14)
- [x] **Phase 24: Cone Rendering Quality** - Upgrade hero cone topping density, shapes, and visual coherence (completed 2026-03-18)
- [ ] **Phase 25: Test Cleanup** - Remove dead tests, fix flaky tests, document permanent skips

## Phase Details

### Phase 20: Design Token Expansion
**Goal**: Every color in the design system -- state indicators, rarity badges, and interactive feedback -- uses a CSS custom property, not a hardcoded hex value
**Depends on**: Phase 19 (v1.4 complete)
**Requirements**: DTKN-01, DTKN-02, DTKN-04
**Success Criteria** (what must be TRUE):
  1. Confirmed/watch/warning/success states render correctly on Today and Compare pages using CSS custom properties (no hardcoded hex for these states anywhere in style.css)
  2. Rarity badges on map popups, Today page, and Compare page all use the same color scale from a single set of --rarity-* tokens
  3. Focus rings and hover states across all interactive elements derive from brand color via color-mix() tokens
  4. The existing 37 design tokens still work unchanged (additive-only -- zero renames, zero removals)
**Plans**: 2 plans

Plans:
- [ ] 20-01-PLAN.md -- Tests + token definitions + state-color hex replacement (DTKN-01)
- [ ] 20-02-PLAN.md -- Rarity unification + interactive tokens + quiz migration (DTKN-02, DTKN-04)

### Phase 21: Card & Button Unification
**Goal**: Every card-like element and every button across the site inherits from a small set of base classes with no one-off definitions or inline overrides
**Depends on**: Phase 20
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04
**Success Criteria** (what must be TRUE):
  1. All card-like elements (today flavor card, compare day card, quiz card, fun mode card) share .card base class with consistent border, shadow, and border-radius
  2. Only three button base types exist in style.css (.btn-primary, .btn-secondary, .btn-text) plus size modifiers -- all other button definitions removed or aliased
  3. Zero inline style="..." attributes set button properties (padding, color, background, border) anywhere in HTML or JS innerHTML strings
  4. JS-generated card and button markup in compare-page.js, shared-nav.js, and quiz JS uses CSS class names, not hardcoded style strings
**Plans**: 3 plans

Plans:
- [ ] 21-01-PLAN.md -- Tests + CSS foundation (.btn-text, button/card modifiers) (CARD-01, CARD-02, CARD-03)
- [ ] 21-02-PLAN.md -- Card unification sweep (17 standalone cards to .card base) (CARD-01, CARD-04)
- [ ] 21-03-PLAN.md -- Button consolidation + inline style elimination (CARD-02, CARD-03, CARD-04)

### Phase 22: Inline Style Elimination
**Goal**: The 77 inline style attributes across compare.html, index.html, and forecast-map.html headers are replaced with CSS classes that consume design tokens
**Depends on**: Phase 21
**Requirements**: DTKN-03
**Success Criteria** (what must be TRUE):
  1. compare.html has zero style="" attributes (currently 8)
  2. index.html and forecast-map.html header inline styles replaced with CSS classes
  3. compare-page.js and shared-nav.js set no inline styles via style.cssText or element.style assignments -- all visual properties come from CSS classes
**Plans**: 2 plans

Plans:
- [ ] 22-01-PLAN.md -- Tests + CSS classes + HTML inline style removal (DTKN-03)
- [ ] 22-02-PLAN.md -- JS .style.* elimination across all JS files (DTKN-03)

### Phase 23: Compare UX Fix
**Goal**: A user arriving at the Compare page for the first time sees their nearest store's schedule within 3 seconds, without needing to interact with competing store pickers
**Depends on**: Phase 22
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. User arriving at Compare with no stored location sees a single onboarding flow (loading state then auto-populated grid), not two competing store pickers
  2. The header "change" button on Compare opens Compare's multi-store picker, not the single-store SharedNav picker
  3. Compare page auto-populates from geolocated store within 3 seconds of page load with no user interaction required
  4. If geolocation fails or times out, Compare falls back to an empty state with a clear add-store CTA within 3 seconds (no indefinite spinner)
**Plans**: 1 plan

Plans:
- [ ] 23-01-PLAN.md -- Geo-aware auto-populate, SharedNav suppression, change button override (COMP-01, COMP-02, COMP-03)

### Phase 24: Cone Rendering Quality
**Goal**: Every hero cone PNG displays visually rich toppings with per-type shapes distributed across the full scoop width, and all 94 flavors render consistently
**Depends on**: Phase 23
**Requirements**: CONE-01, CONE-02, CONE-03, CONE-04
**Success Criteria** (what must be TRUE):
  1. Hero cone tier (36x42) toppings fill the center columns of the scoop that were previously empty -- no visible topping-free gaps in the center
  2. Different topping types (sprinkles, chips, nuts, etc.) render with distinct multi-pixel shapes, not uniform 2x2 squares
  3. Topping distribution looks visually consistent across all 94 flavor profiles -- no outlier flavors with sparse or clumped toppings
  4. All 94 Hero cone PNGs regenerated from updated renderer, all 376 golden baselines refreshed at zero tolerance, and SW cache version bumped
**Plans**: 2 plans

Plans:
- [ ] 24-01-PLAN.md -- Canonical shape map + hero/premium scatter renderer upgrade (CONE-01, CONE-02, CONE-03)
- [ ] 24-02-PLAN.md -- HD scatter upgrade + client-side sync + PNG regeneration + SW cache bump (CONE-01, CONE-02, CONE-03, CONE-04)

### Phase 25: Test Cleanup
**Goal**: The test suite reflects the actual state of the codebase -- no dead tests, no unexplained skips, no flaky timeouts
**Depends on**: Phase 24
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. The 5 dead skipped browser tests from Drive removal are either replaced with equivalent tests or cleanly removed
  2. map-pan-stability.spec.mjs passes reliably without timeout failures
  3. Every remaining test.skip in the codebase has a documented rationale comment explaining why it is permanently skipped
**Plans**: TBD

Plans:
- [ ] 25-01: TBD

## Progress

**Execution Order:**
Phases execute sequentially: 20 -> 21 -> 22 -> 23 -> 24 -> 25

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 15/15 | Complete | 2026-03-08 |
| 6-8 | v1.1 | 4/4 | Complete | 2026-03-09 |
| 9-12 | v1.2 | 9/9 | Complete | 2026-03-09 |
| 13-17 | v1.3 | 11/11 | Complete | 2026-03-12 |
| 18-19 | v1.4 | 4/4 | Complete | 2026-03-13 |
| 20. Design Token Expansion | 2/2 | Complete    | 2026-03-13 | - |
| 21. Card & Button Unification | 3/3 | Complete    | 2026-03-14 | - |
| 22. Inline Style Elimination | 2/2 | Complete    | 2026-03-14 | - |
| 23. Compare UX Fix | 1/1 | Complete    | 2026-03-14 | - |
| 24. Cone Rendering Quality | 2/2 | Complete   | 2026-03-18 | - |
| 25. Test Cleanup | v1.5 | 0/TBD | Not started | - |

**Total: 25 phases, 50+ plans across 6 milestones**
