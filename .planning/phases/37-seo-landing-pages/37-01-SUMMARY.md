---
phase: 37-seo-landing-pages
plan: 01
subsystem: api
tags: [seo, json-ld, html, cloudflare-worker, structured-data, schema-org]

requires:
  - phase: 36-data-quality
    provides: Clean flavor data for public-facing store pages

provides:
  - handleStorePage handler rendering full HTML store pages with JSON-LD
  - LAUNCH_SLUGS set defining 17 Madison-metro stores for SEO rollout
  - FastFoodRestaurant JSON-LD structured data for Google rich results
  - Mobile-responsive store page CSS with Culver's brand styling
  - escapeHtml, slugifyCity, flavorToSlug, formatWeekday helper functions

affects: [37-02-sitemap-routes, 38-og-share-cards]

tech-stack:
  added: []
  patterns: [server-rendered-html-from-worker, json-ld-structured-data, url-path-routing-with-regex]

key-files:
  created:
    - worker/src/route-store-page.js
    - worker/test/route-store-page.test.js
  modified: []

key-decisions:
  - "URL pattern /store/{state}/{city}/{slug}/ with triple validation (launch set, city match, state match)"
  - "JSON-LD uses FastFoodRestaurant type with hasMenu.hasMenuSection.hasMenuItem for today's flavor"
  - "Handler not wired into router yet -- plan 02 handles route dispatch wiring"

patterns-established:
  - "Store page HTML handler: full SSR from Worker with inline CSS, JSON-LD, OG meta tags"
  - "LAUNCH_SLUGS gating: only Madison-metro stores served, expandable later"
  - "Triple URL validation: regex match, launch set membership, city/state cross-check"

requirements-completed: [SEO-01, SEO-02]

duration: 3min
completed: 2026-04-19
---

# Phase 37 Plan 01: Store Page Handler Summary

**Server-rendered store landing pages with FastFoodRestaurant JSON-LD, per-store URL routing, and mobile-responsive HTML for 17 Madison-metro Culver's stores**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-20T02:25:10Z
- **Completed:** 2026-04-20T02:28:01Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files created:** 2

## Accomplishments

- handleStorePage renders complete HTML pages with today's flavor, cone art, week-ahead schedule, and store address
- FastFoodRestaurant JSON-LD structured data with PostalAddress, GeoCoordinates, and MenuItem for Google indexing
- LAUNCH_SLUGS defines 17 Madison-metro stores gating which slugs get landing pages
- Mobile-responsive CSS (max-width: 600px) with Culver's #005696 brand blue hero section
- Triple URL validation: regex path match, LAUNCH_SLUGS membership, city slugification cross-check
- Error pages (404/502) show user-friendly messages without exposing internals
- escapeHtml on all dynamic content prevents XSS from upstream flavor data

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing test suite** - `bd138ff` (test)
2. **Task 1 GREEN: Store page handler implementation** - `f0dcffe` (feat)

_TDD task with two commits: test (RED) then feat (GREEN)_

## Files Created/Modified

- `worker/src/route-store-page.js` - Store page handler with JSON-LD, HTML rendering, helpers
- `worker/test/route-store-page.test.js` - 16 test cases covering happy path, 404, 502, JSON-LD validation

## Decisions Made

- URL pattern uses `/store/{state}/{city}/{slug}/` with triple validation for defense-in-depth
- JSON-LD uses `FastFoodRestaurant` schema type with `hasMenu` containing today's flavor as a `MenuItem`
- Handler is exported but not yet wired into the Worker router -- plan 02 handles route dispatch and sitemap
- Cone art image URLs point to existing `docs/assets/cones/{flavorSlug}.png` pipeline

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: `bd138ff` (test commit with failing tests)
- GREEN gate: `f0dcffe` (feat commit making all 16 tests pass)
- REFACTOR gate: Not needed -- implementation is clean

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-37-01 | Slug validated against LAUNCH_SLUGS Set; city cross-checked via slugifyCity comparison |
| T-37-02 | escapeHtml() applied to all dynamic content: flavor names, descriptions, store names, addresses |
| T-37-03 | 502 error page shows generic message, never stack traces or internal details |

## Next Phase Readiness

- Handler is complete and tested; plan 02 will wire it into `index.js` router dispatch
- Plan 02 will also add sitemap.xml and robots.txt handlers
- LAUNCH_SLUGS is importable from `route-store-page.js` for sitemap generation

## Self-Check: PASSED

- FOUND: worker/src/route-store-page.js
- FOUND: worker/test/route-store-page.test.js
- FOUND: .planning/phases/37-seo-landing-pages/37-01-SUMMARY.md
- FOUND: bd138ff (RED commit)
- FOUND: f0dcffe (GREEN commit)

---
*Phase: 37-seo-landing-pages*
*Completed: 2026-04-19*
