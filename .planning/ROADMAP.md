# Roadmap: Custard Calendar Site Restructuring

## Overview

This project restructures the Custard Calendar presentation layer from 11 loosely connected pages to a focused product organized around 4 use cases (Today, Compare, Map, Fun). The backend/API layer is feature-complete -- all work is in the `docs/` directory (static HTML/CSS/JS on GitHub Pages). The roadmap starts with shared infrastructure (nav component, store indicator), builds the two primary pages (Today and Compare), then delivers supporting pages and activates the consolidated navigation, finishing with visual polish across all views.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Shared nav component, persistent store indicator, and service worker update discipline
- [ ] **Phase 2: Today Page** - Radical simplification of the today view to answer "what's the flavor?" above the fold
- [ ] **Phase 3: Compare Page** - Store-by-day comparison grid for families deciding where to go
- [ ] **Phase 4: Supporting Pages + Nav Activation** - Fun page, Get Updates page, and 4-item nav goes live across all pages
- [ ] **Phase 5: Visual Polish** - Unified card system, cone rendering consistency, and cross-page coherence

## Phase Details

### Phase 1: Foundation
**Goal**: Every page has a shared navigation bar and persistent store indicator, and the service worker is configured to handle page changes without serving stale content
**Depends on**: Nothing (first phase)
**Requirements**: STOR-01, STOR-02, STOR-03, STOR-04, STOR-05
**Success Criteria** (what must be TRUE):
  1. First-time visitor is geolocated and sees their nearest store name in the header without manual selection
  2. Returning visitor sees their previously selected store name in the header on every page load
  3. User can tap "change" on the store indicator and select a different store
  4. Store selection made on one page persists when navigating to another page
  5. After a deployment with page changes, returning users receive updated content within one page load cycle (no permanently stale pages)
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md -- Build shared-nav.js IIFE module (nav rendering, store indicator, geolocation, store picker) with Playwright tests
- [x] 01-02-PLAN.md -- Deploy shared-nav.js across all 12 HTML pages, update service worker, visual verification
- [ ] 01-03-PLAN.md -- Fix first-visit geolocation race condition and flavor data loading error (gap closure)
- [x] 01-04-PLAN.md -- Add street addresses to store picker and fix mobile nav overflow (gap closure)

### Phase 2: Today Page
**Goal**: User can see today's flavor at their store instantly -- cone, name, description above the fold at 375px with progressive disclosure for deeper data
**Depends on**: Phase 1
**Requirements**: TDAY-01, TDAY-02, TDAY-03, TDAY-04, TDAY-05, TDAY-06, TDAY-07
**Success Criteria** (what must be TRUE):
  1. User sees today's flavor (cone image, flavor name, description) above the fold at 375px without scrolling
  2. When a flavor is rare, user sees a rarity tag on the flavor card (e.g., "only every 400 days!")
  3. Week-ahead schedule is hidden by default and expandable via a disclosure element
  4. User with multiple saved stores sees a compact row showing today's flavor at each of their stores
  5. The page does not contain Drive ranking cards, hero card duplication, calendar preview, mini-map, or score badges
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

Note: Phase 2 and Phase 3 can be built in parallel -- both depend only on Phase 1.

### Phase 3: Compare Page
**Goal**: A family can compare flavors across their saved stores and upcoming days to decide where to go, with exclusion filters for dietary needs
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08
**Success Criteria** (what must be TRUE):
  1. User sees a grid of their saved stores (2-4) across the next 2-3 days, each cell showing cone image, flavor name, and rarity tag
  2. User can tap any grid cell to see the full flavor description, a directions link, and historical pattern data
  3. User can toggle exclusion filter chips (No Nuts, No Mint, etc.) to hide cells with matching flavors
  4. The grid is usable at 375px width (day-first card stack, scroll-snap, or equivalent mobile pattern -- not a literal 4-column table)
  5. All data comes from the existing `/api/v1/drive` endpoint with no new API endpoints
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

Research flag: The mobile layout needs an HTML/CSS prototype tested at 375px with real flavor name lengths before committing to a pattern. Two candidate approaches (day-first card stack vs horizontal scroll-snap) should be evaluated.

### Phase 4: Supporting Pages + Nav Activation
**Goal**: Fun page and Get Updates page are live, and users see exactly 4 clear nav items (Today, Compare, Map, Fun) on every page
**Depends on**: Phase 2, Phase 3
**Requirements**: FUN-01, FUN-02, FUN-03, FUN-04, FUN-05, UPDT-01, UPDT-02, UPDT-03, UPDT-04, UPDT-05, NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. User sees exactly 4 nav items (Today, Compare, Map, Fun) on every page, fitting at 375px without overflow or hamburger menu
  2. Nav labels are functional words, not weather metaphor names; "Get Updates" is accessible via footer or contextual CTA only
  3. Fun page displays quiz modes as visual cards (not a dropdown), with Group Vote and Fronts accessible as sections
  4. Mad Libs mode offers 3 pre-populated word choices plus 1 write-in option per blank
  5. Get Updates page consolidates Calendar, Widget, Siri, and Alerts setup flows on a single page with inline alert signup
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD
- [ ] 04-04: TBD

Research flag: Quiz image assets are undefined. Mode card design needs mockups. Mad Libs word selection UI is a new interaction pattern.

### Phase 5: Visual Polish
**Goal**: All pages share a consistent visual language -- unified card system, cone rendering tiers, and rarity copy that accounts for seasonality
**Depends on**: Phase 4
**Requirements**: VIZP-01, VIZP-02, VIZP-03, VIZP-04
**Success Criteria** (what must be TRUE):
  1. All card-like elements across pages use a shared card system with consistent border, background, spacing, and typography
  2. Cone images render at appropriate quality tiers per context (hero-level on Today, compact in Compare cells, small on Map markers)
  3. Rarity and overdue copy does not make misleading cadence claims for seasonal flavors (e.g., does not say "overdue!" for a summer-only flavor in winter)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5
(Phases 2 and 3 may execute in parallel -- both depend only on Phase 1.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/4 | Gap closure (01-03 remaining) | - |
| 2. Today Page | 0/3 | Not started | - |
| 3. Compare Page | 0/3 | Not started | - |
| 4. Supporting Pages + Nav Activation | 0/4 | Not started | - |
| 5. Visual Polish | 0/2 | Not started | - |
