---
estimated_steps: 5
estimated_files: 3
skills_used:
  - test
---

# T01: Add Worker endpoints for widget script and version

**Slice:** S01 — Widget Bootstrap Flow
**Milestone:** M004

## Description

Create two new Worker API endpoints that serve the widget bootstrap infrastructure. `GET /api/v1/widget/script` returns the full `custard-today.js` source as `text/javascript` so the bootstrap snippet can download it programmatically. `GET /api/v1/widget/version` returns a lightweight JSON payload with the current widget version number so the installed widget can check for updates.

These endpoints are the foundation for all other S01 work — the bootstrap snippet (T03) downloads from `/api/v1/widget/script`, and the version check (T02) queries `/api/v1/widget/version`.

## Steps

1. **Read `widgets/custard-today.js`** (628 lines) and create `worker/src/widget-routes.js`. Define a string constant `WIDGET_SCRIPT` containing the full widget JS source (use a template literal). Define `WIDGET_VERSION = "1.0"` and `WIDGET_UPDATED = "2026-03-25"` constants. Export `handleWidgetScript(corsHeaders)` that returns a `Response` with the JS content, `Content-Type: text/javascript; charset=utf-8`, and `Cache-Control: public, max-age=86400`. Export `handleWidgetVersion(corsHeaders)` that returns a JSON `Response` with `{"version":"1.0","updated":"2026-03-25"}`, `Content-Type: application/json`, and `Cache-Control: public, max-age=3600`.

2. **Wire into `worker/src/index.js`**: Add `import { handleWidgetScript, handleWidgetVersion } from './widget-routes.js';` at the top. In the route dispatcher (the `if/else if` chain starting around line 578), add two new branches: `canonical === '/api/widget/script'` → `handleWidgetScript(corsHeaders)` and `canonical === '/api/widget/version'` → `handleWidgetVersion(corsHeaders)`. Place them before the `/og/` catch-all since these are exact matches.

3. **Add rate-limit config** in `getExpensiveReadLimitConfig()` (starts at line 121 in index.js). Add two entries: one for `/api/widget/script` (prefix `rl:widget:script`, limit 60/hour) and one for `/api/widget/version` (prefix `rl:widget:version`, limit 120/hour).

4. **Write `worker/test/widget-routes.test.js`** using the project's vitest pattern (see `worker/test/drive.test.js` for import style). Test cases:
   - `handleWidgetScript` returns status 200
   - `handleWidgetScript` returns `Content-Type: text/javascript; charset=utf-8`
   - `handleWidgetScript` returns `Cache-Control: public, max-age=86400`
   - `handleWidgetScript` response body contains `Custard Today` (from the script header comment)
   - `handleWidgetScript` response body is non-trivial (length > 1000)
   - `handleWidgetVersion` returns status 200
   - `handleWidgetVersion` returns `Content-Type: application/json`
   - `handleWidgetVersion` returns `Cache-Control: public, max-age=3600`
   - `handleWidgetVersion` response body parses as JSON with `version` string field
   - Rate-limit config exists for `/api/widget/script` path
   - Rate-limit config exists for `/api/widget/version` path

5. **Run `cd worker && npm test`** and verify all tests pass, including existing tests and new widget-routes tests.

## Must-Haves

- [ ] `worker/src/widget-routes.js` exists with `handleWidgetScript` and `handleWidgetVersion` exports
- [ ] Both routes wired into `worker/src/index.js` route dispatcher
- [ ] Rate-limit configs added for both endpoints
- [ ] `worker/test/widget-routes.test.js` has ≥10 test cases covering status, headers, body, and rate limits
- [ ] All Worker tests pass (`cd worker && npm test`)

## Verification

- `cd worker && npm test` — all tests pass (0 failures)
- `grep -q "handleWidgetScript" worker/src/index.js` — route is wired
- `grep -q "handleWidgetVersion" worker/src/index.js` — route is wired
- `grep -q "rl:widget:script" worker/src/index.js` — rate limit configured
- `test -f worker/test/widget-routes.test.js` — test file exists

## Observability Impact

- Signals added/changed: Rate-limit prefixes `rl:widget:script` (60/hour) and `rl:widget:version` (120/hour) — same pattern as existing `/og/` routes
- How a future agent inspects this: `curl /api/v1/widget/script | head -3` shows script content; `curl /api/v1/widget/version` returns version JSON
- Failure state exposed: Rate-limit returns 429 with descriptive error message matching existing pattern

## Inputs

- `widgets/custard-today.js` — canonical widget source (628 lines) to embed as string constant in the Worker
- `worker/src/index.js` — existing route dispatcher to extend with new routes and rate-limit configs
- `worker/test/drive.test.js` — reference for vitest import pattern and test structure

## Expected Output

- `worker/src/widget-routes.js` — new file with handleWidgetScript and handleWidgetVersion exports
- `worker/src/index.js` — modified with new route branches and rate-limit configs
- `worker/test/widget-routes.test.js` — new test file with ≥10 test cases
