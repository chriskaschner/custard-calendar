# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Shipped **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (shipped 2026-03-09)
- Shipped **v1.3 Asset Parity** -- Phases 13-17 (shipped 2026-03-12)
- Shipped **v1.4 Bug Fixes** -- Phases 18-19 (shipped 2026-03-13)
- Shipped **v1.5 Visual Polish** -- Phases 20-25 (shipped 2026-03-18)
- Active **v2.0 Art Quality** -- Phases 26-29 (in progress)

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

<details>
<summary>Shipped v1.5 Visual Polish (Phases 20-25) -- SHIPPED 2026-03-18</summary>

- [x] Phase 20: Design Token Expansion (2/2 plans) -- semantic state, rarity, interactive tokens
- [x] Phase 21: Card & Button Unification (3/3 plans) -- .card base, .btn consolidation
- [x] Phase 22: Inline Style Elimination (2/2 plans) -- CSS classes consuming design tokens
- [x] Phase 23: Compare UX Fix (1/1 plan) -- geo-aware auto-populate, SharedNav suppression
- [x] Phase 24: Cone Rendering Quality (2/2 plans) -- 5-shape topping vocabulary, scatter placement
- [x] Phase 25: Test Cleanup (0/0 plans) -- skipped (deferred to out-of-scope)

</details>

### v2.0 Art Quality (In Progress)

**Milestone Goal:** Replace multi-tier algorithmic cone renderers with a two-tier art pipeline: L0 micro SVG for small displays, L5 AI-generated PNGs for everything else.

- [ ] **Phase 26: AI Cone Generation** - Generate, curate, and commit L5 pixel art PNGs for all 94 profiled flavors
- [x] **Phase 27: Client-Side Art Migration** - Swap all client-side rendering to L5 PNGs, remove dead renderers, update baselines (completed 2026-03-19)
- [ ] **Phase 28: Worker Social Card Migration** - Embed L5 PNGs in OG social cards and remove dead Worker-side SVG renderers
- [ ] **Phase 29: Scriptable Widget Unification** - Unify Scriptable widget cone rendering into the shared L0/L5 art pipeline

## Phase Details

### Phase 26: AI Cone Generation
**Goal**: All 94 profiled flavors have AI-generated pixel art cone PNGs that pass human visual review, with generation prompts version-controlled and post-processing automated
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. 94 AI-generated cone PNGs exist at docs/assets/cones/{slug}.png with transparent backgrounds and 288x336 dimensions
  2. A generation manifest JSON file is committed alongside images recording model, prompt, parameters, and timestamp per flavor
  3. A QA gallery HTML page renders all 94 cones in a grid for side-by-side visual comparison, and a human has reviewed and approved all 94
  4. Post-processing pipeline (trim, resize, nearest-neighbor, optimize) runs via a single script invocation with no manual steps
**Plans:** 2/3 plans executed

Plans:
- [ ] 26-01-PLAN.md -- Prompt data foundation: author 93 premium overrides, 54 descriptions, verification script
- [ ] 26-02-PLAN.md -- Generation pipeline + trial: new generate_cone_art.mjs for Azure gpt-image-1.5, post-processing, trial run with quality checkpoint
- [ ] 26-03-PLAN.md -- Full batch + QA + finalize: generate 282 candidates, QA gallery, human review, deploy to cones/

### Phase 27: Client-Side Art Migration
**Goal**: Every client-side rendering site displays L5 AI PNGs as the primary art, with L0 micro SVG as the only fallback, and all dead intermediate renderers are removed
**Depends on**: Phase 26 (all 94 PNGs must exist before integration begins)
**Requirements**: INT-01, INT-02, INT-05, CLN-01, CLN-03, CLN-04
**Success Criteria** (what must be TRUE):
  1. Today page hero cone and quiz result cone both display the AI-generated L5 PNG for any of the 94 profiled flavors -- no HD SVG rendering path exists
  2. renderHeroCone() falls back to L0 mini SVG (not HD SVG) when a flavor has no PNG
  3. renderMiniConeHDSVG() and all HD scatter utilities are deleted from cone-renderer.js with zero references remaining
  4. flavor-audit.html shows exactly two tiers (L0 micro SVG and L5 AI PNG) with no intermediate columns
  5. Service worker cache version is bumped and pixelmatch golden baselines are regenerated -- all visual regression tests pass at zero tolerance
**Plans:** 2/2 plans complete

Plans:
- [ ] 27-01-PLAN.md -- Remove HD SVG renderer from cone-renderer.js, wire quiz engine to renderHeroCone, delete scatter utilities
- [ ] 27-02-PLAN.md -- Rewrite flavor-audit.html to two-tier grid (L0 + L5), bump service worker cache to v21

### Phase 28: Worker Social Card Migration
**Goal**: OG social card images embed L5 AI PNGs instead of inline SVG cones, and all dead SVG renderers are removed from the Worker codebase
**Depends on**: Phase 26 (L5 PNGs must exist), can run in parallel with Phase 27
**Requirements**: INT-04, CLN-02
**Success Criteria** (what must be TRUE):
  1. social-card.js generates OG images using L5 PNG data (base64 in KV or equivalent) instead of calling renderConeHDSVG()
  2. renderConeHDSVG, renderConeHeroSVG, and renderConePremiumSVG are deleted from worker/src/flavor-colors.js with no remaining callers
  3. All Worker tests pass (cd worker && npm test) after renderer removal
**Plans**: TBD

Plans:
- [ ] 28-01: TBD
- [ ] 28-02: TBD

### Phase 29: Scriptable Widget Unification
**Goal**: The Scriptable widget uses the shared art pipeline (L5 PNG online, L0 SVG-aligned fallback offline) instead of its own independent drawConeIcon renderer
**Depends on**: Phase 26 (L5 PNGs must exist), independent of Phases 27-28
**Requirements**: INT-03
**Success Criteria** (what must be TRUE):
  1. Scriptable widget displays L5 AI PNG cones when the device is online, loaded via Image.fromURL() from the GitHub Pages asset path
  2. Offline fallback renders a color-aligned cone using the canonical 23-entry BASE_COLORS palette (not the drifted 15-color FLAVOR_SCOOP_COLORS)
  3. Both docs/assets/custard-today.js and widgets/custard-today.js are updated and kept in sync
**Plans**: TBD

Plans:
- [ ] 29-01: TBD

## Progress

**Execution Order:**
Phases 26 is strictly first. Phases 27, 28, and 29 can proceed in parallel after Phase 26 completes. Recommended order: 26 -> 27 -> 28 -> 29.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 15/15 | Complete | 2026-03-08 |
| 6-8 | v1.1 | 4/4 | Complete | 2026-03-09 |
| 9-12 | v1.2 | 9/9 | Complete | 2026-03-09 |
| 13-17 | v1.3 | 11/11 | Complete | 2026-03-12 |
| 18-19 | v1.4 | 4/4 | Complete | 2026-03-13 |
| 20-25 | v1.5 | 10/10 | Complete | 2026-03-18 |
| 26. AI Cone Generation | 2/3 | In Progress|  | - |
| 27. Client-Side Art Migration | 2/2 | Complete   | 2026-03-19 | - |
| 28. Worker Social Card Migration | v2.0 | 0/TBD | Not started | - |
| 29. Scriptable Widget Unification | v2.0 | 0/TBD | Not started | - |

**Total: 29 phases, 58+ plans across 7 milestones**
