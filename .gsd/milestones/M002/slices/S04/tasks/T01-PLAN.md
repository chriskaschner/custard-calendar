# T01: 33-performance 01

**Slice:** S04 — **Milestone:** M002

## Description

Eliminate the Worker API dependency from the homepage critical rendering path so returning users see today's flavor instantly from cache, with background refresh.

Purpose: LCP P90 is currently ~10s because the hero card waits for 3+ sequential API round-trips. By reading cached flavor data from localStorage synchronously and serving API responses from the service worker cache, the hero card renders in <1s on return visits.

Output: Modified sw.js with API response caching, modified today-page.js with localStorage hero cache, Playwright tests verifying cached render behavior.

## Must-Haves

- [ ] "Returning user with a saved store sees yesterday's cached hero card data instantly on page load, before any network request completes"
- [ ] "Service worker caches flavor API GET responses and serves them on subsequent visits via stale-while-revalidate"
- [ ] "Stale cache from a previous day shows skeleton instead of yesterday's flavor -- no misleading stale data"
- [ ] "First-visit user experience is unchanged -- skeleton shows while API loads"

## Files

- `docs/sw.js`
- `docs/today-page.js`
- `worker/test/browser/perf-cached-render.spec.mjs`
