# S04: Performance

**Goal:** Eliminate the Worker API dependency from the homepage critical rendering path so returning users see today's flavor instantly from cache, with background refresh.
**Demo:** Eliminate the Worker API dependency from the homepage critical rendering path so returning users see today's flavor instantly from cache, with background refresh.

## Must-Haves


## Tasks

- [x] **T01: 33-performance 01** `est:16min`
  - Eliminate the Worker API dependency from the homepage critical rendering path so returning users see today's flavor instantly from cache, with background refresh.

Purpose: LCP P90 is currently ~10s because the hero card waits for 3+ sequential API round-trips. By reading cached flavor data from localStorage synchronously and serving API responses from the service worker cache, the hero card renders in <1s on return visits.

Output: Modified sw.js with API response caching, modified today-page.js with localStorage hero cache, Playwright tests verifying cached render behavior.

## Files Likely Touched

- `docs/sw.js`
- `docs/today-page.js`
- `worker/test/browser/perf-cached-render.spec.mjs`
