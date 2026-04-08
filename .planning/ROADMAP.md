# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- Shipped **v1.1 Production Launch + Polish** -- Phases 6-8 (shipped 2026-03-09)
- Shipped **v1.2 Feature Completion & Cleanup** -- Phases 9-12 (shipped 2026-03-09)
- Shipped **v1.3 Asset Parity** -- Phases 13-17 (shipped 2026-03-12)
- Shipped **v1.4 Bug Fixes** -- Phases 18-19 (shipped 2026-03-13)
- Shipped **v1.5 Visual Polish** -- Phases 20-25 (shipped 2026-03-18)
- Shipped **v2.0 Art Quality** -- Phases 26-29 (shipped 2026-03-19)
- Shipped **v3.0 Sharpen the Core** -- Phases 30-34 (shipped 2026-03-27)
- Active **v4.0 Find Real Users** -- Phases 35-39 (in progress)

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

<details>
<summary>Shipped v3.0 Sharpen the Core (Phases 30-34) -- SHIPPED 2026-03-27</summary>

- [x] Phase 30: Housekeeping & Closure (1/1 plan) -- ML closure, TODO triage
- [x] Phase 31: Homepage Redesign (2/2 plans) -- hero card, CLS skeleton
- [x] Phase 32: Page Consolidation (0/0 plans) -- deferred (needs real traffic data)
- [x] Phase 33: Performance (1/1 plan) -- localStorage hero cache, SW API caching
- [x] Phase 33.1: Bug Fixes (2/2 plans) -- store disambiguation, rarity logic, stale signals
- [x] Phase 34: Social Sharing (0/0 plans) -- deferred (no users to share from)

</details>

### v4.0 Find Real Users (In Progress)

**Milestone Goal:** Get Custard Calendar in front of people who actually check Culver's Flavor of the Day -- through SEO, AI-native interfaces, and social content. Distribution before features.

- [x] **Phase 35: Security + MCP** - Worker hardened for public exposure; MCP server ships AI-native flavor queries
- [ ] **Phase 36: Data Quality** - Audit and clean flavor data so public-facing pages show trustworthy information
- [ ] **Phase 37: SEO Landing Pages** - Per-store pages with structured data and sitemap for Google indexing
- [ ] **Phase 38: OG Share Cards** - Per-store social preview images for link sharing (design TBD with user)
- [ ] **Phase 39: Social Research** - Instagram feasibility investigation for automated flavor posting

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

<details>
<summary>v3.0 Phase Details (shipped)</summary>

### Phase 30: Housekeeping & Closure
**Goal**: Deferred roadmap items are formally resolved so the project backlog reflects reality
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: SIMP-03
**Success Criteria** (what must be TRUE):
  1. ML prediction pipeline items (ensemble, XGBoost, confidence intervals) are moved to "Won't Do" in TODO.md with documented rationale
  2. Any other stale TODO items from prior milestones are triaged: either closed with rationale, promoted to v3.0 scope, or explicitly deferred
**Plans**: 1/1 plans complete

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
**Plans**: 2/2 plans complete

Plans:
- [x] 31-01-PLAN.md -- Hero card with CTAs/meta footer, simplified empty state, CLS-preventing skeleton
- [x] 31-02-PLAN.md -- CTA text line replacement, dead CSS cleanup, Playwright tests, visual verification

### Phase 32: Page Consolidation (Deferred)
**Goal**: The site contains only pages that serve real users, and navigation reflects the reduced footprint
**Depends on**: Deferred until real traffic data available
**Requirements**: SIMP-01, SIMP-02
**Plans**: 0/0 (deferred)

### Phase 33: Performance
**Goal**: The site loads fast enough that a user checking their phone in the car gets an answer before losing patience
**Depends on**: Phase 31
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):
  1. Homepage LCP P90 is under 3 seconds as measured by a Lighthouse audit on mobile throttling
  2. The critical rendering path for the hero card does not depend on the Worker API -- a skeleton or cached response renders first, then hydrates when data arrives
**Plans**: 1/1 plans complete

Plans:
- [x] 33-01-PLAN.md -- localStorage hero cache + service worker API caching for instant return-visit render

### Phase 33.1: Bug Fixes (INSERTED)
**Goal:** Remaining display bugs are fixed: store names truncate gracefully, hero cache shows human-readable names, uncommon rarity badge is suppressed, and DOW insight cards only appear for relevant flavors
**Depends on:** Phase 33
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. Compare store chips and flavor row labels truncate with ellipsis instead of overflowing when store names are long
  2. Hero card cached render shows a disambiguated store display name, not a raw slug
  3. The "Uncommon" rarity badge is hidden via CSS, consistent with the tier's removal from the rarity system
  4. DOW pattern insight cards only render when the signal flavor matches today's FOTD at the user's store
**Plans:** 2/2 plans complete

Plans:
- [x] 33.1-01-PLAN.md -- CSS chip truncation, uncommon badge suppression, hero cache display name fix
- [x] 33.1-02-PLAN.md -- Signal card DOW pattern relevance filter (accepted as dead letter -- signal UI removed in Phase 31)

### Phase 34: Social Sharing (Deferred)
**Goal**: Users who discover a fun result or rare flavor can share it on social platforms with a rich preview that drives clicks back to the site
**Depends on**: Deferred until there are users to share from
**Requirements**: SHARE-01, SHARE-02
**Plans**: 0/0 (deferred)

</details>

### Phase 35: Security + MCP
**Goal**: The Worker is hardened for public exposure and AI assistants can query flavor data natively
**Depends on**: Nothing (first phase of v4.0)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, AI-01
**Success Criteria** (what must be TRUE):
  1. All public endpoints enforce per-IP rate limiting at 300 requests/hour with in-memory tracking (no KV burn)
  2. The /health endpoint requires admin authentication and returns 401 for unauthenticated requests
  3. D1-querying routes reject invalid slugs before hitting the database
  4. Daily upstream proxy requests are capped at 500/day to prevent abuse
  5. An MCP server exposes 6 tools for flavor queries that any MCP-compatible AI client can invoke
**Plans**: Complete

### Phase 36: Data Quality
**Goal**: Flavor data for the 17 Madison-area launch stores is verified clean and trustworthy, with automated gates preventing bad data from reaching users
**Depends on**: Phase 35
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A human-reviewed audit of 17 Madison-area stores confirms zero closure sentinels, garbled text, or missing flavors in current data
  2. Rarity labels, gap-day counts, "last seen" dates, and overdue calculations for those 17 stores match independently computed values from raw D1 snapshots
  3. An automated quality gate runs on ingest and rejects known bad patterns (closure sentinels, corrupted text) with logged alerts for anomalies
  4. Historical bad records (closure sentinels, corrupted entries) are purged from D1 for the 17 launch stores
**Plans:** 3/3 plans complete

Plans:
- [x] 36-01-PLAN.md -- Quality gate tests and stats reconciliation test suite (TDD RED phase)
- [x] 36-02-PLAN.md -- Quality gate implementation: 3 detection patterns in kv-cache.js + operator alert wiring
- [x] 36-03-PLAN.md -- Audit and purge scripts for 17 stores, execute cleanup, human verify clean state

### Phase 36.1: Hierarchical Rarity Fallback (INSERTED)

**Goal:** Wire hierarchical scope resolution into the 3-gate rarity system so sparse stores fall back through metro -> state -> national scopes, and display consumers show scope context
**Requirements**: N/A (inserted phase, no mapped requirements)
**Depends on:** Phase 36
**Success Criteria** (what must be TRUE):
  1. A store with insufficient rarity data falls back through metro -> state -> national scopes to derive a rarity label
  2. The /api/today response includes a `scope` field in the rarity object indicating which geographic level provided the data
  3. Display consumers (homepage, social cards) show scope context ("in your area", "statewide", "nationwide")
  4. metrics.js uses normalize() from flavor-matcher.js (normalizeFlavorKey removed)
**Plans:** 2/2 plans complete

Plans:
- [x] 36.1-01-PLAN.md -- Export scope helpers from metrics.js, unify normalization, wire hierarchical fallback into route-today.js
- [x] 36.1-02-PLAN.md -- Update display consumers (today-page.js, planner-domain.js, social-card.js) with scope-aware rarity rendering

### Phase 37: SEO Landing Pages
**Goal**: Each Madison-area Culver's store has a public landing page that Google can index, showing today's flavor, the week-ahead schedule, and store context
**Depends on**: Phase 36 (clean data is prerequisite for public pages)
**Requirements**: SEO-01, SEO-02, SEO-03
**Success Criteria** (what must be TRUE):
  1. Visiting /store/wi/{city}/{slug}/ returns a fully rendered HTML page with today's flavor name, cone art, week-ahead schedule, and store address for any of the 15 launch stores
  2. Each store page includes a valid FastFoodRestaurant JSON-LD block with name, address, geo coordinates, and today's flavor as a menu item
  3. /sitemap.xml lists all 15 store page URLs with lastmod dates and /robots.txt allows crawling of /store/ paths
  4. Pages render correctly on mobile (375px) with no horizontal overflow or missing content
**Plans**: TBD
**UI hint**: yes

### Phase 38: OG Share Cards
**Goal**: When someone shares a store page link on social media or messaging apps, a rich preview image renders with the store name, today's flavor, and cone art
**Depends on**: Phase 37 (store pages must exist before OG cards make sense)
**Requirements**: SEO-04
**Success Criteria** (what must be TRUE):
  1. Pasting a store page URL into Twitter/Facebook/iMessage/Slack renders an og:image card showing the store name, today's flavor, and cone art
  2. OG card design has been reviewed and approved by the user before going live
**Plans**: TBD

### Phase 39: Social Research
**Goal**: A documented recommendation on whether and how to use Instagram for automated flavor posting, so the decision to proceed (or not) is informed rather than speculative
**Depends on**: Nothing (independent of other phases)
**Requirements**: SOCL-01
**Success Criteria** (what must be TRUE):
  1. Instagram API access requirements (business account, permissions, review process) are documented
  2. Content format options (image post, story, reel, carousel) are evaluated with pros/cons for automated flavor updates
  3. A written recommendation states whether to pursue Instagram automation, defer it, or abandon it -- with rationale
**Plans**: TBD

## Progress

**Execution Order:**
Phase 35 (complete) -> 36 -> 37 -> 38 -> 39. Phase 39 is independent and can execute in parallel with any phase.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 15/15 | Complete | 2026-03-08 |
| 6-8 | v1.1 | 4/4 | Complete | 2026-03-09 |
| 9-12 | v1.2 | 9/9 | Complete | 2026-03-09 |
| 13-17 | v1.3 | 11/11 | Complete | 2026-03-12 |
| 18-19 | v1.4 | 4/4 | Complete | 2026-03-13 |
| 20-25 | v1.5 | 10/10 | Complete | 2026-03-18 |
| 26-29 | v2.0 | 8/8 | Complete | 2026-03-19 |
| 30-34 | v3.0 | 6/6 | Complete | 2026-03-27 |
| 35. Security + MCP | v4.0 | Complete | Complete | 2026-04-05 |
| 36. Data Quality | v4.0 | 3/3 | Complete   | 2026-04-06 |
| 37. SEO Landing Pages | v4.0 | 0/TBD | Not started | - |
| 38. OG Share Cards | v4.0 | 0/TBD | Not started | - |
| 39. Social Research | v4.0 | 0/TBD | Not started | - |

**Total: 39 phases across 9 milestones**
