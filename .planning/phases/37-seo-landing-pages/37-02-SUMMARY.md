---
phase: 37-seo-landing-pages
plan: 02
subsystem: api
tags: [seo, sitemap, robots-txt, cloudflare-worker, routing]

requires:
  - phase: 37-seo-landing-pages
    plan: 01
    provides: handleStorePage handler and LAUNCH_SLUGS set for route wiring

provides:
  - Sitemap XML endpoint at /sitemap.xml listing all 17 launch store URLs
  - Robots.txt endpoint at /robots.txt allowing /store/ crawling
  - Worker router dispatch for /store/{state}/{city}/{slug}/ pages
  - Full integration of store pages, sitemap, and robots into production router

affects: [38-og-share-cards]

tech-stack:
  added: []
  patterns: [xml-sitemap-generation, robots-txt-static-response, regex-route-matching]

key-files:
  created:
    - worker/src/sitemap.js
    - worker/test/sitemap.test.js
  modified:
    - worker/src/index.js

key-decisions:
  - "Sitemap lastmod set to today's date (daily changefreq reflects fresh flavor data)"
  - "Store page route uses regex /^\\/store\\/[a-z]{2}\\/[a-z0-9-]+\\/[a-z0-9-]+\\/?$/ matching only valid path patterns"
  - "Robots.txt blocks /api/ and /health paths from crawlers to keep index focused on store pages"

patterns-established:
  - "Static content endpoints: handleSitemap/handleRobotsTxt follow widget-routes pattern (no KV/D1 reads)"
  - "Route regex validation: only lowercase alpha-numeric-hyphen segments accepted, preventing path traversal"

requirements-completed: [SEO-03]

duration: 2min
completed: 2026-04-19
---

# Phase 37 Plan 02: Sitemap, Robots, and Route Wiring Summary

**XML sitemap with 17 store URLs, robots.txt crawl directives, and Worker router dispatch for /store/, /sitemap.xml, and /robots.txt endpoints**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-20T02:31:56Z
- **Completed:** 2026-04-20T02:34:39Z
- **Tasks:** 3 (1 TDD, 1 auto, 1 checkpoint auto-approved)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- handleSitemap generates valid XML sitemap with all 17 Madison-metro launch store URLs, daily lastmod dates, and 24h edge cache
- handleRobotsTxt allows /store/ crawling, blocks /api/ and /health, and points to sitemap URL
- Worker router wired with three new routes: /sitemap.xml, /robots.txt, and /store/{state}/{city}/{slug}/
- All 1226 Worker tests pass with zero regressions (11 new sitemap tests + 1215 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing sitemap/robots tests** - `9ed9088` (test)
2. **Task 1 GREEN: Sitemap and robots.txt handlers** - `118dad9` (feat)
3. **Task 2: Route wiring into Worker router** - `62032f7` (feat)
4. **Task 3: Mobile verification** - auto-approved (no commit needed)

_TDD Task 1 has two commits: test (RED) then feat (GREEN)_

## Files Created/Modified

- `worker/src/sitemap.js` - Sitemap XML and robots.txt generators importing LAUNCH_SLUGS
- `worker/test/sitemap.test.js` - 11 tests covering response status, headers, XML structure, URL patterns
- `worker/src/index.js` - Added imports and route dispatch for store pages, sitemap, and robots.txt

## Decisions Made

- Sitemap uses today's date for lastmod since flavor data changes daily
- Store page route regex only accepts lowercase alpha-numeric-hyphen segments (defense in depth)
- Robots.txt blocks /api/ and /health from crawlers to keep Google's index focused on store pages

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: `9ed9088` (test commit with 11 failing tests -- module not found)
- GREEN gate: `118dad9` (feat commit making all 11 tests pass)
- REFACTOR gate: Not needed -- implementation is clean

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-37-05 | Store page route regex `/^\/store\/[a-z]{2}\/[a-z0-9-]+\/[a-z0-9-]+\/?$/` only matches lowercase alpha-numeric-hyphen segments |
| T-37-06 | Sitemap intentionally lists all store URLs (accepted: public data by design) |
| T-37-07 | Existing global per-IP rate limiting (300 req/hr) applies to all routes including /store/ |

## Next Phase Readiness

- All SEO landing page infrastructure is complete and routable
- Store pages serve HTML with JSON-LD, sitemap tells Google they exist, robots.txt allows crawling
- Ready for Phase 38: OG share cards (requires design discussion)

## Self-Check: PASSED

---
*Phase: 37-seo-landing-pages*
*Completed: 2026-04-19*
