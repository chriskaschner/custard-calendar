# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Shipped **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (shipped 2026-03-09)
- Shipped **v1.3 Asset Parity** -- Phases 13-17 (shipped 2026-03-12)
- Shipped **v1.4 Bug Fixes** -- Phases 18-19 (shipped 2026-03-13)
- Shipped **v1.5 Visual Polish** -- Phases 20-25 (shipped 2026-03-18)
- Shipped **v2.0 Art Quality** -- Phases 26-29 (shipped 2026-03-19)
- Active **v3.0 Sharpen the Core** -- Phases 30-34 (in progress)

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

<details>
<summary>Shipped v2.0 Art Quality (Phases 26-29) -- SHIPPED 2026-03-19</summary>

- [x] Phase 26: AI Cone Generation (3/3 plans) -- L5 pixel art PNGs for all 94 flavors
- [x] Phase 27: Client-Side Art Migration (2/2 plans) -- L5 PNGs primary, dead renderers removed
- [x] Phase 28: Worker Social Card Migration (2/2 plans) -- L5 PNGs in OG cards, dead Worker SVG removed
- [x] Phase 29: Scriptable Widget Unification (1/1 plan) -- shared art pipeline for widget

</details>

### v3.0 Sharpen the Core (In Progress)

**Milestone Goal:** Simplify the product to its essential experience, fix performance, and optimize for discoverability -- the first milestone focused on finding users rather than adding features.

- [x] **Phase 30: Housekeeping & Closure** - Formally close ML prediction roadmap items and clean up deferred tech debt
- [x] **Phase 31: Homepage Redesign** - Rebuild the homepage around a single hero card showing today's flavor at the user's store
- [ ] **Phase 33: Performance** - Fix cold-start LCP to under 3 seconds
- [ ] **Phase 34: Social Sharing** - Optimize quiz results and flavor stats for social platform sharing
- [ ] **Phase 32: Page Consolidation** - Consolidate zero-traffic pages and simplify navigation to reflect actual usage (deferred -- needs real traffic data)

## Phase Details

<details>
<summary>v2.0 Phase Details (shipped)</summary>

### Phase 26: AI Cone Generation
**Goal**: All 94 profiled flavors have AI-generated pixel art cone PNGs that pass human visual review, with generation prompts version-controlled and post-processing automated
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. 94 AI-generated cone PNGs exist at docs/assets/cones/{slug}.png with transparent backgrounds and 288x336 dimensions
  2. A generation manifest JSON file is committed alongside images recording model, prompt, parameters, and timestamp per flavor
  3. A QA gallery HTML page renders all 94 cones in a grid for side-by-side visual comparison, and a human has reviewed and approved all 94
  4. Post-processing pipeline (trim, resize, nearest-neighbor, optimize) runs via a single script invocation with no manual steps
**Plans:** 3/3 plans complete

Plans:
- [x] 26-01-PLAN.md -- Prompt data foundation: author 93 premium overrides, 54 descriptions, verification script
- [x] 26-02-PLAN.md -- Generation pipeline + trial: new generate_cone_art.mjs for Azure gpt-image-1.5, post-processing, trial run with quality checkpoint
- [x] 26-03-PLAN.md -- Full batch + QA + finalize: generate 282 candidates, QA gallery, human review, deploy to cones/

### Phase 27: Client-Side Art Migration
**Goal**: Every client-side rendering site displays L5 AI PNGs as the primary art, with L0 micro SVG as the only fallback, and all dead intermediate renderers are removed
**Depends on**: Phase 26
**Requirements**: INT-01, INT-02, INT-05, CLN-01, CLN-03, CLN-04
**Success Criteria** (what must be TRUE):
  1. Today page hero cone and quiz result cone both display the AI-generated L5 PNG for any of the 94 profiled flavors
  2. renderHeroCone() falls back to L0 mini SVG (not HD SVG) when a flavor has no PNG
  3. renderMiniConeHDSVG() and all HD scatter utilities are deleted from cone-renderer.js with zero references remaining
  4. flavor-audit.html shows exactly two tiers (L0 micro SVG and L5 AI PNG) with no intermediate columns
  5. Service worker cache version is bumped and pixelmatch golden baselines are regenerated
**Plans:** 2/2 plans complete

Plans:
- [x] 27-01-PLAN.md -- Remove HD SVG renderer, wire quiz to renderHeroCone, delete scatter utilities
- [x] 27-02-PLAN.md -- Rewrite flavor-audit.html to two-tier grid, bump SW cache to v21

### Phase 28: Worker Social Card Migration
**Goal**: OG social card images embed L5 AI PNGs instead of inline SVG cones, and all dead SVG renderers are removed from the Worker codebase
**Depends on**: Phase 26
**Requirements**: INT-04, CLN-02
**Success Criteria** (what must be TRUE):
  1. social-card.js generates OG images using L5 PNG data instead of calling renderConeHDSVG()
  2. renderConeHDSVG, renderConeHeroSVG, and renderConePremiumSVG are deleted from worker/src/flavor-colors.js
  3. All Worker tests pass after renderer removal
**Plans:** 2/2 plans complete

Plans:
- [x] 28-01-PLAN.md -- Embed L5 PNG cone art in social cards via base64 fetch
- [x] 28-02-PLAN.md -- Delete dead HD/Hero/Premium SVG renderers from flavor-colors.js

### Phase 29: Scriptable Widget Unification
**Goal**: The Scriptable widget uses the shared art pipeline (L5 PNG online, L0 SVG-aligned fallback offline)
**Depends on**: Phase 26
**Requirements**: INT-03
**Success Criteria** (what must be TRUE):
  1. Scriptable widget displays L5 AI PNG cones when online via Image.fromURL()
  2. Offline fallback renders using the canonical 23-entry BASE_COLORS palette
  3. Both docs/assets/custard-today.js and widgets/custard-today.js are updated and in sync
**Plans:** 1/1 plans complete

Plans:
- [x] 29-01-PLAN.md -- Add L5 PNG loading via getConeImage(), replace 15-color palette with 23-entry BASE_COLORS

</details>

### Phase 30: Housekeeping & Closure
**Goal**: Deferred roadmap items are formally resolved so the project backlog reflects reality
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: SIMP-03
**Success Criteria** (what must be TRUE):
  1. ML prediction pipeline items (ensemble, XGBoost, confidence intervals) are moved to "Won't Do" in TODO.md with documented rationale
  2. Any other stale TODO items from prior milestones are triaged: either closed with rationale, promoted to v3.0 scope, or explicitly deferred
**Plans**: 1 plan

Plans:
- [x] 30-01: Triage TODO.md -- move ML items to Won't Do, review and resolve all stale entries

### Phase 31: Homepage Redesign
**Goal**: Users see today's flavor at their store immediately upon landing, with a clean information hierarchy that eliminates visual noise
**Depends on**: Phase 30
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04
**Success Criteria** (what must be TRUE):
  1. A user with a saved store sees a single hero card with today's flavor name, cone art, and store name above the fold at 375px -- no scrolling required
  2. A week-ahead forecast section exists below the hero card, collapsed by default, and expands on tap to show upcoming flavors
  3. The page loads with no visible layout shift -- skeleton or placeholder occupies the hero card space until data arrives (CLS < 0.1)
  4. All homepage sections (hero card, week-ahead, any CTAs) use the existing card system with consistent design token spacing and borders -- no one-off styles
**Plans**: 2 plans

Plans:
- [x] 31-01-PLAN.md -- Hero card with CTAs/meta footer, simplified empty state, CLS-preventing skeleton
- [x] 31-02-PLAN.md -- CTA text line replacement, dead CSS cleanup, Playwright tests, visual verification

### Phase 32: Page Consolidation
**Goal**: The site contains only pages that serve real users, and navigation reflects the reduced footprint
**Depends on**: Phase 34 (deferred until real traffic data available)
**Requirements**: SIMP-01, SIMP-02
**Success Criteria** (what must be TRUE):
  1. Zero-traffic pages (compare, forecast-map, fun) are either consolidated into remaining pages or replaced with redirect stubs pointing to the best alternative
  2. Navigation contains no more than 4 items and every nav item links to a page that serves an active use case
  3. All existing external links and bookmarks to removed pages land on a functioning redirect (no 404s)
**Plans**: TBD

Plans:
- [ ] 32-01: Audit page traffic, decide keep/consolidate/redirect for each page
- [ ] 32-02: Execute consolidation -- redirects, nav update, dead page removal

### Phase 33: Performance
**Goal**: The site loads fast enough that a user checking their phone in the car gets an answer before losing patience
**Depends on**: Phase 31 (homepage redesign complete)
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):
  1. Homepage LCP P90 is under 3 seconds as measured by a Lighthouse audit on mobile throttling (currently ~10s due to Worker cold starts)
  2. The critical rendering path for the hero card does not depend on the Worker API -- a skeleton or cached response renders first, then hydrates when data arrives
**Plans**: TBD

Plans:
- [ ] 33-01: Diagnose cold-start bottleneck and implement LCP fix

### Phase 34: Social Sharing
**Goal**: Users who discover a fun result or rare flavor can share it on social platforms with a rich preview that drives clicks back to the site
**Depends on**: Phase 33 (performance fixes complete)
**Requirements**: SHARE-01, SHARE-02
**Success Criteria** (what must be TRUE):
  1. Quiz results page generates a unique shareable URL per result that, when pasted into Twitter/Facebook/iMessage, renders an og:image card showing the result with cone art
  2. Individual flavor rarity stats have a shareable URL that renders an OG card showing the flavor name, cone art, and rarity classification (e.g., "Served 3 times this year")
  3. Shared URLs load a standalone page (not the full quiz flow) so recipients see the content without completing the quiz themselves
**Plans**: TBD

Plans:
- [ ] 34-01: Quiz result shareable URLs with OG cards
- [ ] 34-02: Flavor rarity OG cards and share links

## Progress

**Execution Order:**
Phases execute sequentially: 30 -> 31 -> 33 -> 34 -> 32. (Page Consolidation deferred to last -- needs real traffic data.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 15/15 | Complete | 2026-03-08 |
| 6-8 | v1.1 | 4/4 | Complete | 2026-03-09 |
| 9-12 | v1.2 | 9/9 | Complete | 2026-03-09 |
| 13-17 | v1.3 | 11/11 | Complete | 2026-03-12 |
| 18-19 | v1.4 | 4/4 | Complete | 2026-03-13 |
| 20-25 | v1.5 | 10/10 | Complete | 2026-03-18 |
| 26-29 | v2.0 | 8/8 | Complete | 2026-03-19 |
| 30. Housekeeping & Closure | v3.0 | Complete    | 2026-03-19 | 2026-03-19 |
| 31. Homepage Redesign | v3.0 | Complete    | 2026-03-20 | 2026-03-19 |
| 32. Page Consolidation | v3.0 | 0/2 | Not started | - |
| 33. Performance | v3.0 | 0/1 | Not started | - |
| 34. Social Sharing | v3.0 | 0/2 | Not started | - |

**Total: 34 phases, 69 plans across 8 milestones**
