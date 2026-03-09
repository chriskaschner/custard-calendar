# Roadmap: Custard Calendar Site Restructuring

## Milestones

- Shipped **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-08)
- In progress **v1.1 Production Launch + Polish** -- Phases 6-7

## Phases

<details>
<summary>Shipped v1.0 MVP (Phases 1-5) -- SHIPPED 2026-03-08</summary>

- [x] Phase 1: Foundation (4/4 plans) -- shared nav, store indicator, geolocation
- [x] Phase 2: Today Page (3/3 plans) -- flavor above fold, rarity, multi-store row
- [x] Phase 3: Compare Page (3/3 plans) -- store-by-day grid, filters, accordion
- [x] Phase 4: Supporting Pages + Nav (3/3 plans) -- Fun page, Get Updates, 4-item nav
- [x] Phase 5: Visual Polish (2/2 plans) -- card system, design tokens, hero cone PNGs

</details>

### v1.1 Production Launch + Polish (In Progress)

**Milestone Goal:** Ship the v1.0 build to production and close out remaining active requirements (design token consumption, quiz visual differentiation).

- [ ] **Phase 6: CSS + Quiz Polish** - Consume design tokens across all CSS and add visual differentiation to quiz modes
- [ ] **Phase 7: Production Deploy** - Push site and Worker to production, verify everything works end-to-end

## Phase Details

### Phase 6: CSS + Quiz Polish
**Goal**: Every CSS rule uses the design token system and quiz modes are visually distinct
**Depends on**: Phase 5 (design tokens defined in v1.0)
**Requirements**: TOKN-01, TOKN-02, TOKN-03, QUIZ-01
**Success Criteria** (what must be TRUE):
  1. No hardcoded color hex values remain in any CSS file -- all colors reference token variables
  2. No hardcoded spacing magic numbers remain in any CSS file -- all spacing uses token variables
  3. fun.html and updates.html contain zero inline style attributes with hardcoded values
  4. A user opening each quiz mode (Classic, Timed, Streak, Challenge) sees distinct visual treatment that makes the current mode obvious
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Production Deploy
**Goal**: The site is live at custard.chriskaschner.com and verified working
**Depends on**: Phase 6
**Requirements**: DEPL-01, DEPL-02, DEPL-03
**Success Criteria** (what must be TRUE):
  1. custard.chriskaschner.com serves the current site with all v1.0 and v1.1 changes
  2. Cloudflare Worker responds to API requests from the live site
  3. A user can navigate Today, Compare, Map, Fun, and Get Updates on the live site without errors
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-07 |
| 2. Today Page | v1.0 | 3/3 | Complete | 2026-03-07 |
| 3. Compare Page | v1.0 | 3/3 | Complete | 2026-03-08 |
| 4. Supporting Pages + Nav | v1.0 | 3/3 | Complete | 2026-03-08 |
| 5. Visual Polish | v1.0 | 2/2 | Complete | 2026-03-08 |
| 6. CSS + Quiz Polish | v1.1 | 0/0 | Not started | - |
| 7. Production Deploy | v1.1 | 0/0 | Not started | - |

Full v1.0 phase details archived: `.planning/milestones/v1.0-ROADMAP.md`
