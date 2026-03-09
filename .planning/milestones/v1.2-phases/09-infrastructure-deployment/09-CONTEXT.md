# Phase 9: Infrastructure & Deployment - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

CI pipeline is green, all code is deployed, and service worker covers every user-facing page with offline store data. Requirements: INFR-01, INFR-02, INFR-03, INFR-04.

</domain>

<decisions>
## Implementation Decisions

### Deployment verification
- Curl-based smoke tests, same pattern as v1.1
- Check 6 pages: index.html, compare.html, map.html, fun.html, updates.html, quiz.html (main nav + pages with recent changes)
- Each test checks for shared nav presence AND a page-specific content marker (e.g., quiz.html checks for data-quiz-mode, fun.html checks for quiz mode cards)
- Reusable shell script at scripts/smoke_test_deploy.sh for future deploys

### Cache-bust cleanup
- Remove all 9 stores.json ?v= cache-bust params in one sweep (shared-nav.js, today-page.js, compare-page.js, map.html, widget.html, calendar.html, scoop.html, radar.html, alerts.html)
- Legacy pages (scoop, radar, alerts) will become redirect stubs in Phase 10 anyway
- Stale-while-revalidate is the caching strategy for stores.json -- same as all other static assets
- No network-first exception needed; store location data changes rarely

### Offline page coverage
- Add SW registration to ALL user-facing pages: index.html, compare.html, quiz.html, map.html, fun.html, updates.html (6 pages added to existing widget.html + calendar.html = 8 total)
- Skip legacy pages that Phase 10 will replace with redirect stubs
- Inline 2-line snippet per page (matches existing widget.html/calendar.html pattern) -- no centralization
- No offline indicator UI -- silent caching, pages look the same online and offline

### Claude's Discretion
- CACHE_VERSION bump strategy and numbering
- CI fix implementation details (adding .planning to ALLOWED_DIRS)
- Git push sequencing and any merge conflict resolution
- Smoke test script structure and exact content markers per page

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- decisions were clear-cut across all three areas discussed.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/sw.js`: Service worker at custard-v15, stale-while-revalidate pattern, STATIC_ASSETS array ready for stores.json addition
- `scripts/check_repo_structure.py`: ALLOWED_DIRS set needs `.planning` added (line 18-32)
- `docs/widget.html` line 965-966: SW registration pattern to replicate (`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(function() {}); }`)

### Established Patterns
- SW registration: inline 2-line snippet at end of page's `<script>` block
- Cache-bust: `?v=` + date string on fetch URLs (being removed in this phase)
- Deploy verification: curl-based smoke tests (used in v1.1 Phase 7)

### Integration Points
- `docs/sw.js` STATIC_ASSETS array: add `./stores.json`
- 9 files with `stores.json?v=` fetches: remove query params
- 6 HTML pages: add inline SW registration snippet
- `scripts/check_repo_structure.py` ALLOWED_DIRS: add `.planning`
- Git remote: origin/main at github.com/chriskaschner/custard-calendar.git (3 unpushed commits)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 09-infrastructure-deployment*
*Context gathered: 2026-03-09*
