# Codebase Concerns

**Analysis Date:** 2026-03-07

## Tech Debt

**Credentials still live in the repo tree:**
- Issue: `credentials/credentials.json` and `credentials/token.json` exist in the working tree under a gitignored `credentials/` directory. This violates the repo's own `REPO_CONTRACT.md` rule: "No plaintext credential files, even if gitignored (use `~/.config/` or a secret manager)."
- Files: `custard-calendar/credentials/credentials.json`, `custard-calendar/credentials/token.json`
- Impact: Any accidental `.gitignore` modification, or a `git add -f`, leaks Google OAuth credentials. The `calendar_sync.py` migration path is already coded (prefer `~/.config/custard-calendar/`) but the legacy fallback remains the active path.
- Fix approach: Move credentials to `~/.config/custard-calendar/`, delete the `credentials/` directory from the working tree, and remove the legacy fallback from `custard-calendar/src/calendar_sync.py` lines 33-42.

**Monolithic index.html with 1,080 lines of inline JavaScript:**
- Issue: `docs/index.html` embeds ~700 lines of inline `<script>` containing store search, forecast rendering, calendar preview, geolocation, Drive integration, near-me cards, and service worker registration. No build step, no module boundaries.
- Files: `custard-calendar/docs/index.html`
- Impact: Any change to the homepage risks breaking unrelated functionality. The restructuring plan (`custard-restructuring-plan.md`) explicitly calls this page a "junk drawer." Adding or modifying features requires reading the entire file.
- Fix approach: The restructuring plan (T1.2) prescribes radical simplification. In the interim, extract reusable logic (store picker, calendar preview) into `planner-shared.js` or new dedicated modules.

**Massive generated data files embedded in Worker source:**
- Issue: Four JS files in `worker/src/` are auto-generated data dumps totaling ~492KB: `store-index.js` (92KB, 1079 stores), `store-coords.js` (108KB), `valid-slugs.js` (28KB), `trivia-metrics-seed.js` (264KB, 9564 lines). These are committed to git and bundled into the Worker deploy.
- Files: `custard-calendar/worker/src/store-index.js`, `custard-calendar/worker/src/store-coords.js`, `custard-calendar/worker/src/valid-slugs.js`, `custard-calendar/worker/src/trivia-metrics-seed.js`
- Impact: Worker cold-start latency increases with bundle size. Git history bloats on each regeneration. The `trivia-metrics-seed.js` alone is larger than all other Worker source files combined.
- Fix approach: Move store data and metrics to KV or D1 (queried at runtime or cached in memory on first request). This is a known trade-off -- Cloudflare Workers have no filesystem, so static data must be embedded or fetched. Consider Cloudflare Worker module bindings or KV pre-seeding.

**Store data duplicated across three sources:**
- Issue: Store information exists in `docs/stores.json` (9121 lines, served to frontend), `worker/src/store-index.js` (auto-generated from `stores.json`), and `worker/src/store-coords.js`. The frontend loads `stores.json` at page load, and the Worker embeds the same data as JS modules. A regeneration step (`worker/scripts/generate-store-index.js`) keeps them in sync, but they can drift.
- Files: `custard-calendar/docs/stores.json`, `custard-calendar/worker/src/store-index.js`, `custard-calendar/worker/src/store-coords.js`
- Impact: If regeneration is skipped after a `stores.json` update, the Worker serves stale store data while the frontend has the correct version. The ARCHITECTURE.md risk register (Risk #2) notes this as a "Partial" mitigation.
- Fix approach: Make `stores.json` the single source. Worker could fetch from KV or the frontend JSON at startup and cache. Alternatively, enforce regeneration via CI gate.

**Alexa skill archived without clear revival path:**
- Issue: `archive/alexa/` contains a Lambda-based Alexa skill that queries a deprecated Worker URL (`custard-calendar.chris-kaschner.workers.dev` instead of `custard.chriskaschner.com`). It has no CI, no tests, and no deploy pipeline.
- Files: `custard-calendar/archive/alexa/lambda/lambda_function.py` (line 27: hardcoded `API_BASE`)
- Impact: If someone revives the skill, it will fail at the API call level. The archived code also uses `ask-sdk-core` dependencies from a `requirements.txt` with no version pins.
- Fix approach: Either update the API base URL and add a test, or document clearly that the archive is non-functional. `REPO_CONTRACT.md` has revival criteria but the code does not meet any of them.

**Dual dependency declaration for dev tools:**
- Issue: `pyproject.toml` declares `dev` dependencies in both `[project.optional-dependencies]` and `[dependency-groups]`. `pytest` and `icalendar` live in `optional-dependencies.dev`, while `pillow` lives in `dependency-groups.dev`. This is confusing -- a `uv sync` may not install all dev tools depending on which flag is used.
- Files: `custard-calendar/pyproject.toml` (lines 15-19, 27-30)
- Impact: Contributors may miss dependencies. `uv sync --all-extras` installs optional deps but not dependency groups, and `uv sync --group dev` installs the group but not optional deps.
- Fix approach: Consolidate all dev dependencies into either `[project.optional-dependencies]` or `[dependency-groups]`, not both.

**Repo restructuring plan not yet executed:**
- Issue: `REPO_CLEANUP_PLAN.md` prescribes a 5-phase repo restructuring (security hardening, path migration, dedup, enforcement) but status says "Planning only (no structural moves executed yet)." The plan calls for `apps/worker`, `apps/pipeline`, `apps/web`, `apps/display`, `research/analytics`, and `ops/` directories.
- Files: `custard-calendar/REPO_CLEANUP_PLAN.md`, `custard-calendar/REPO_CONTRACT.md`
- Impact: The current flat structure means `main.py`, `src/`, `analytics/`, `scripts/`, `tools/`, `worker/`, `docs/`, and `tidbyt/` all coexist at the repo root. The REPO_CONTRACT.md partially addresses this but the planned structural migration has not happened.
- Fix approach: Execute the restructuring plan incrementally per the PR sequence in the cleanup plan, or explicitly downgrade the plan to "deferred" and update REPO_CONTRACT.md to reflect the chosen permanent structure.

## Known Bugs

**Service worker caches stale pages:**
- Symptoms: `docs/sw.js` uses a stale-while-revalidate strategy for static assets but lists specific pages in `STATIC_ASSETS`. When pages are updated (e.g., nav changes from the restructuring plan), users with the old service worker cache continue seeing the old version until the background revalidation completes. The `CACHE_VERSION` must be manually bumped.
- Files: `custard-calendar/docs/sw.js` (line 1: `CACHE_VERSION = 'custard-v7'`)
- Trigger: Deploy any HTML page change without bumping `CACHE_VERSION`.
- Workaround: Bump `CACHE_VERSION` on every deploy that changes HTML/JS/CSS.

**Inline JavaScript incompatible with strict CSP:**
- Symptoms: All HTML pages use `Content-Security-Policy` with `script-src 'unsafe-inline'` to allow inline `<script>` blocks. This effectively nullifies XSS protection from CSP for script injection.
- Files: All `custard-calendar/docs/*.html` files (CSP meta tag in `<head>`)
- Trigger: If an attacker finds a DOM-based injection point (e.g., via URL params rendered to page), inline script execution is allowed by CSP.
- Workaround: The current mitigation is `escapeHtml()` in `planner-shared.js` (line 41) for dynamic content. A proper fix requires extracting inline JS to separate `.js` files and using CSP nonces or removing `'unsafe-inline'`.

## Security Considerations

**Rate limiter has a read-then-write race condition:**
- Risk: `rate-limit.js` reads the current count from KV, increments it locally, and writes back. Under concurrent requests from the same IP in the same hourly bucket, two requests can read the same count and both pass, allowing `limit + N` requests in a burst window.
- Files: `custard-calendar/worker/src/rate-limit.js` (lines 39-48)
- Current mitigation: KV's eventual consistency means this is inherent. The rate limits are generous enough (60-120/hr) that a small overrun is acceptable.
- Recommendations: Accept as known limitation. For stricter enforcement, use Cloudflare Durable Objects (paid) or atomic counters. Document the race condition for anyone tightening limits.

**Legacy admin token in wrangler.toml:**
- Risk: `wrangler.toml` sets `ACCESS_TOKEN = ""` as a public `[vars]` entry. The comment says "deprecated" and `ADMIN_ACCESS_TOKEN` is the real secret (stored as a Cloudflare secret, not in toml). But the code in `worker/src/index.js` line 180 has `env.ADMIN_ACCESS_TOKEN || env.ACCESS_TOKEN` -- if `ADMIN_ACCESS_TOKEN` is ever unset/deleted, the fallback to an empty string would make admin routes return 503 (not 200 open access), which is safe but confusing.
- Files: `custard-calendar/worker/wrangler.toml` (line 7), `custard-calendar/worker/src/index.js` (line 180)
- Current mitigation: The fallback returns 503 when token is empty, not 200. The SECURITY_AND_OBSERVABILITY.md review covers this.
- Recommendations: Remove the `ACCESS_TOKEN` var from `wrangler.toml` and the fallback from `index.js` to reduce confusion.

**Upstream data parsing depends on Culver's HTML structure:**
- Risk: `flavor-fetcher.js` parses `__NEXT_DATA__` from Culver's website HTML via regex. If Culver's changes their Next.js data structure or moves to a different framework, all flavor fetching breaks silently (empty flavors array).
- Files: `custard-calendar/worker/src/flavor-fetcher.js` (lines 37-42)
- Current mitigation: Parse failure counters tracked per brand in KV (`meta:parse-fail-count:brand:*`), surfaced via `/health` endpoint. Operator alerts (`worker/src/operator-alerts.js`) fire when parse failures exceed thresholds.
- Recommendations: The existing monitoring is good. Consider adding a structured contract test that validates a fixture against `parseNextData()` and runs in CI. The fixture capture tool exists at `custard-calendar/tools/capture_fixture.py`.

**Alert unsubscribe tokens are in URL query params:**
- Risk: Alert management URLs (`/api/alerts/status?token=X`, `/api/alerts/unsubscribe?token=X`) pass the subscriber's unsubscribe token as a query parameter. These can leak via browser history, HTTP referrer headers, and server logs.
- Files: `custard-calendar/worker/src/alert-checker.js` (lines 115-116), `custard-calendar/worker/src/alert-routes.js`
- Current mitigation: `Referrer-Policy: strict-origin-when-cross-origin` header reduces leakage to third parties. Per-IP rate limiting on alert routes (120/hr).
- Recommendations: For higher security, use POST with token in body for destructive actions (unsubscribe). The status page could use a short-lived session cookie instead.

## Performance Bottlenecks

**Sequential snapshot recording in cron handler:**
- Problem: `recordSnapshots()` in `snapshot-writer.js` calls `recordSnapshot()` for each flavor entry sequentially (`for...of` with `await`). During cron's snapshot harvest phase, this processes up to 50 stores with ~7 flavors each = ~350 sequential D1 writes.
- Files: `custard-calendar/worker/src/snapshot-writer.js` (lines 76-78), `custard-calendar/worker/src/index.js` (lines 776-784)
- Cause: Each `await db.prepare(...).run()` is a round-trip to D1. No batching or parallelism.
- Improvement path: Use D1's batch API (`db.batch([...statements])`) to group writes per store. This could reduce 350 round-trips to 50.

**Homepage makes multiple sequential API calls:**
- Problem: `docs/index.html` loads stores JSON, flavor colors, then per-store flavor data, Drive rankings, and signals sequentially. On first visit with geolocation, it also calls `/api/v1/geolocate` and `/api/v1/nearby-flavors`.
- Files: `custard-calendar/docs/index.html` (inline script, init function around line 1035)
- Cause: No parallel fetch strategy. Each API call waits for the previous to complete.
- Improvement path: Use `Promise.all()` for independent fetches (stores + flavor-colors can load in parallel). The `todays-drive.js` module already has its own fetch orchestration that could be better integrated.

## Fragile Areas

**Culver's HTML parsing (single point of failure):**
- Files: `custard-calendar/worker/src/flavor-fetcher.js`
- Why fragile: The regex `/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/` depends on Culver's continuing to use Next.js with that exact script tag format. The path `props.pageProps.page.customData.restaurantCalendar.flavors` is deeply nested and any restructuring breaks it.
- Safe modification: Do not change the parsing logic without updating the fixture at `custard-calendar/tools/capture_fixture.py` and running the e2e tests at `custard-calendar/tools/test_e2e.py`.
- Test coverage: Worker test suite has fixture-based tests for parsing. Live API tests exist at `custard-calendar/tests/test_live_api.py` (skipped in CI via `SKIP_LIVE_API=1`).

**MKE brand fetchers (HTML scraping):**
- Files: `custard-calendar/worker/src/kopp-fetcher.js`, `custard-calendar/worker/src/gilles-fetcher.js`, `custard-calendar/worker/src/hefners-fetcher.js`, `custard-calendar/worker/src/kraverz-fetcher.js`, `custard-calendar/worker/src/oscars-fetcher.js`
- Why fragile: Each fetcher scrapes HTML from independent custard shop websites. These sites have no API contract and can change layout at any time. Unlike Culver's (which uses a structured `__NEXT_DATA__` blob), MKE brands require regex/DOM parsing of freeform HTML.
- Safe modification: Always capture a fresh fixture before modifying a fetcher. Check the `PARSE_FAILURE_BRAND_KEYS` health counters after deploy.
- Test coverage: Each fetcher has fixture-based unit tests in `custard-calendar/worker/test/`.

**planner-shared.js is a 1,624-line utility module loaded by every page:**
- Files: `custard-calendar/docs/planner-shared.js`
- Why fragile: This file is the shared client-side hub for store persistence, API calls, haversine math, escapeHtml, signal rendering, reliability banners, share buttons, and more. Every HTML page depends on `window.CustardPlanner`. A breaking change here affects all 15+ HTML pages.
- Safe modification: Any change to the public API of `CustardPlanner` requires testing across all pages. The browser click-through tests at `custard-calendar/tests/test_browser_clickthrough.py` cover basic navigation but not deep planner-shared functionality.
- Test coverage: No unit tests for `planner-shared.js`. Only integration-level coverage via Playwright browser tests in `custard-calendar/worker/test/browser/`.

**config.yaml is gitignored and required for the Python pipeline:**
- Files: `custard-calendar/config.yaml` (gitignored), `custard-calendar/config.example.yaml` (tracked)
- Why fragile: `main.py` calls `load_config('config.yaml')` and exits with `sys.exit(1)` if the file is missing. New contributors must manually create this file. The example file exists but is easy to miss.
- Safe modification: Always check that `config.example.yaml` reflects any new config keys.
- Test coverage: Tests mock config values and do not depend on the actual config.yaml file.

## Scaling Limits

**Cloudflare Workers free tier:**
- Current capacity: 100,000 requests/day, 10ms CPU time per request.
- Limit: A single viral link or API abuse could exhaust the daily request quota. The cron handler (alerts + snapshot harvest + reliability refresh) consumes quota too.
- Scaling path: Upgrade to Workers Paid ($5/month) for 10M requests/month and 50ms CPU time. The codebase is already structured for this (rate limiting, KV caching, edge cache for calendar.ics).

**KV-backed rate limiting:**
- Current capacity: Rate limit counters use KV reads/writes. Each rate-limited request costs 1 KV read + 1 KV write.
- Limit: At scale, rate limit checks alone could consume a significant portion of the free-tier KV operations (100,000 reads/day).
- Scaling path: Cloudflare Rate Limiting product (paid) or Durable Objects for atomic counters.

## Dependencies at Risk

**Culver's website upstream contract:**
- Risk: No formal API contract with Culver's. The entire platform depends on scraping their `__NEXT_DATA__` JSON from restaurant pages. A Next.js upgrade, CDN change, or rate-limiting policy could break the data pipeline.
- Impact: All flavor data stops updating. Stale KV cache (24h TTL) provides a grace period, but beyond that, the platform serves no data.
- Migration plan: None available. Culver's does not offer a public API. The operator alert system (`worker/src/operator-alerts.js`) provides early warning.

**Resend email API:**
- Risk: Email alerts depend on Resend.com as the sole email provider. No fallback.
- Impact: If Resend is down or the API key is revoked, all alert and digest emails fail. The error is tracked (`meta:email-errors:{date}`) but not retried.
- Migration plan: The `email-sender.js` module is a thin wrapper. Swapping to another provider (SendGrid, Postmark) requires changing only one file.

## Missing Critical Features

**No automated deployment pipeline for the Worker:**
- Problem: The `ci.yml` workflow runs tests but does not deploy. Worker deployment requires manual `npx wrangler deploy` from a developer machine. There is no staging environment.
- Blocks: Continuous delivery, automated rollbacks, deploy audit trail.

**No end-to-end monitoring/alerting for data freshness:**
- Problem: While the `/health` endpoint reports parse failures and cron status, there is no external uptime monitor that alerts when flavor data stops updating across all stores. The `monitoring.healthcheck_url` config field is empty.
- Blocks: Automated incident response for upstream changes.

## Test Coverage Gaps

**No unit tests for frontend JavaScript:**
- What's not tested: `planner-shared.js` (1,624 lines), `todays-drive.js` (1,117 lines), `cone-renderer.js` (324 lines), and all inline `<script>` blocks in HTML pages have zero unit test coverage.
- Files: `custard-calendar/docs/planner-shared.js`, `custard-calendar/docs/todays-drive.js`, `custard-calendar/docs/cone-renderer.js`
- Risk: Regressions in store persistence, API call construction, escapeHtml, haversine, or cone rendering go undetected until manual testing or user reports.
- Priority: High -- `planner-shared.js` is the most-imported module across all frontend pages.

**Browser tests skipped in CI:**
- What's not tested: Both Playwright browser tests (`worker/test/browser/*.spec.mjs`, 16 files) and Python browser click-through tests (`tests/test_browser_clickthrough.py`) are skipped in CI via `SKIP_BROWSER_TESTS=1`.
- Files: `custard-calendar/.github/workflows/ci.yml` (line 59), `custard-calendar/tests/test_browser_clickthrough.py`
- Risk: Navigation regressions, broken page loads, and cross-page integration issues are only caught locally.
- Priority: Medium -- the Worker unit tests (810+) cover API behavior, but the presentation layer has no CI gate.

**Live API tests skipped in CI:**
- What's not tested: `tests/test_live_api.py` hits the production Worker API to verify response shapes. It is skipped in CI via `SKIP_LIVE_API=1`.
- Files: `custard-calendar/tests/test_live_api.py`
- Risk: API contract changes (field renames, missing keys) are not caught until a downstream consumer breaks.
- Priority: Medium -- the schema endpoint (`/api/v1/schema`) partially mitigates this, but no consumer validates against it automatically.

**No tests for the Tidbyt Starlark app in the calendar repo:**
- What's not tested: `tidbyt/culvers_fotd.star` (991 lines) has no test suite in this repo. The separate `custard-tidbyt` repo has a `test_api_contract.py` but it only validates the API response shape, not the rendering logic.
- Files: `custard-calendar/tidbyt/culvers_fotd.star`, `custard-tidbyt/tests/test_api_contract.py`
- Risk: Flavor display formatting bugs (name truncation, color mapping, layout overflow on 64x32 pixel display) are only caught by visual inspection via `tools/test_tidbyt.py`.
- Priority: Low -- the Starlark app is stable and changes rarely.

**Analytics pipeline tests do not validate ML model outputs:**
- What's not tested: The `analytics/tests/` directory (10 files) tests data loading and metric computation but does not validate that forecast outputs are reasonable (e.g., probability sums to ~1, no NaN predictions, forecast dates are in the future).
- Files: `custard-calendar/analytics/tests/test_predict.py`, `custard-calendar/analytics/predict.py`
- Risk: A model regression could produce nonsensical forecasts that propagate to the `/api/v1/forecast/{slug}` endpoint and weekly digest emails.
- Priority: Low -- forecasts are supplementary ("Estimated" tier) and clearly labeled as predictions.

---

*Concerns audit: 2026-03-07*
