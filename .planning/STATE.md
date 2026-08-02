---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Find Real Users
status: executing
stopped_at: Completed 37-02-PLAN.md
last_updated: "2026-04-20T02:34:39Z"
last_activity: 2026-04-20
progress:
  total_phases: 16
  completed_phases: 10
  total_plans: 21
  completed_plans: 20
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** A family can instantly see what flavors are at their nearby stores and decide where to go
**Current focus:** Phase 38 — OG Share Cards

## Current Position

Phase: 38
Plan: Not started
Status: Planning Phase 38
Last activity: 2026-04-20

Progress: [####______] 40% (2/5 v4.0 phases complete)

## Performance Metrics

**Velocity:**

- v1.0: 15 plans in ~2 hours (~8 min/plan)
- v1.1: 4 plans in ~28 min (~7 min/plan)
- v1.2: 9 plans in ~1 day (~11 min avg)
- v1.3: 11 plans in ~82 min (~7.5 min/plan)
- v1.4: 4 plans in ~34 min (~8.5 min/plan)
- v1.5: 10 plans in ~69 min (~6.9 min/plan)
- v2.0: 8 plans across 4 phases
- v3.0: 6 plans across 5 phases
- Total: 67 plans across 8 milestones

**Recent Trend:**

- Last 5 plans: 6 min, 7 min, 3 min, 6 min, 16 min
- Trend: Variable

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent decisions affecting current work:

- v4.0: Distribution before features -- find real users before adding anything new
- v4.0: Data validation must precede SEO pages (bad data on public pages = bad first impression)
- v4.0: SEO-04 (OG cards) split into own phase -- design requires user input
- v4.0: SOCL-01 independent -- can execute in parallel with any phase
- v4.0: Start with 15 Madison-area stores, prove indexing, then scale
- Phase 35: Security + MCP shipped -- Worker hardened, MCP server live
- Phase 37-01: URL pattern /store/{state}/{city}/{slug}/ with triple validation for defense-in-depth
- Phase 37-01: JSON-LD uses FastFoodRestaurant with hasMenu for today's flavor as MenuItem
- Phase 37-01: Handler exported but not wired into router -- plan 02 handles dispatch
- Phase 37-02: Sitemap lastmod uses today's date (daily changefreq reflects fresh flavor data)
- Phase 37-02: Store page route regex validates only lowercase alpha-numeric-hyphen segments
- Phase 37-02: Robots.txt blocks /api/ and /health paths from crawlers

### Roadmap Evolution

- Phase 36.1 inserted after Phase 36: Hierarchical Rarity Fallback (URGENT)

### Pending Todos

None.

### Blockers/Concerns

- **P0: Phase 37 is functionally unshipped.** `/sitemap.xml` and `/store/*` 404 on
  `custard.chriskaschner.com` (verified 2026-08-02); they resolve only on
  `*.workers.dev`. `/robots.txt` returns Cloudflare's *managed* file, not the
  Worker's. Needs three Cloudflare routes added additively in the dashboard.
  See TODO.md "P0 -- Dormancy recovery".
- SEO-04 (Phase 38) requires design discussion with user before execution
- Browser suite is **21 specs red**, not one. The `browser-tests` CI job is
  deliberately `continue-on-error: true` until the backlog is repaired. Most
  failures are specs rotted against shipped refactors (Today's Drive removed in
  Phase 31; `.store-change-btn` consolidated in Phase 21), not live regressions.
  Earlier revisions of this file listed only `map-pan-stability` — that
  undercounted. See TODO.md for the per-cause breakdown.

## Session Continuity

Last session: 2026-04-20T02:34:39Z
Stopped at: Completed 37-02-PLAN.md (Phase 37 complete)
Resume file: None (Phase 37 complete, Phase 38 next)
