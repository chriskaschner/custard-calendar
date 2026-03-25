# S01: Widget Bootstrap Flow

**Goal:** User picks a store on widget.html, copies one short snippet, pastes into Scriptable, runs it → full widget installed and working with their store's flavor data. Multi-store mode works the same way — pick stores, get snippet, paste and run.

**Demo:** widget.html generates a personalized ~10-line bootstrap snippet for both single-store and multi-store modes. The snippet downloads the full widget script from `/api/v1/widget/script`, prepends the user's store configuration, and saves it to Scriptable's directory using `FileManager.iCloud()` with `FileManager.local()` fallback. The installed widget checks for updates via `/api/v1/widget/version` on each run and alerts the user when a new version is available.

## Must-Haves

- Worker endpoint `GET /api/v1/widget/script` serves canonical widget JS as `text/javascript` with 24h cache
- Worker endpoint `GET /api/v1/widget/version` returns `{"version":"X.Y"}` JSON with 1h cache
- Both endpoints are rate-limited (60/hour for script, 120/hour for version)
- `widgets/custard-today.js` and `docs/assets/custard-today.js` contain `WIDGET_VERSION` constant + non-blocking version-check-and-alert logic
- `docs/widget.html` has a snippet generator UI: store picker → mode toggle → copy-ready bootstrap snippet
- Multi-store snippet includes `MODE="multi"` and `slugs` array pre-configured
- Bootstrap snippet uses `FileManager.iCloud()` with `FileManager.local()` fallback
- All existing Worker tests continue to pass

## Proof Level

- This slice proves: contract + integration (Worker endpoints return correct content/headers; widget.html generates correct snippets; widget script contains working version-check logic)
- Real runtime required: yes (Worker tests exercise endpoints; browser tests could exercise widget.html)
- Human/UAT required: yes (final verification requires pasting snippet into Scriptable on a real iOS device)

## Verification

- `cd worker && npm test` — all existing tests pass + new `widget-routes.test.js` tests pass
- `grep -q "WIDGET_VERSION" widgets/custard-today.js` — version constant exists in widget script
- `diff widgets/custard-today.js docs/assets/custard-today.js` — both widget files are identical
- `grep -q "snippet" docs/widget.html` — snippet generator UI exists in widget page
- `curl -s -o /dev/null -w "%{http_code}" -X GET -H "CF-Connecting-IP: 1.2.3.4" "https://custard.chriskaschner.com/api/v1/widget/version" | grep -q "200\|429"` — version endpoint is reachable and returns expected status (200 ok or 429 rate-limit on throttle)

## Observability / Diagnostics

- Runtime signals: Rate-limit prefix `rl:widget:script` and `rl:widget:version` logged on throttle; version JSON includes `updated` timestamp for cache freshness debugging
- Inspection surfaces: `curl /api/v1/widget/script | head -3` shows version constant; `curl /api/v1/widget/version` returns current version JSON
- Failure visibility: Widget version-check wrapped in try/catch — failure is silent (no user-facing error), widget continues rendering normally
- Redaction constraints: none — no secrets or PII in widget endpoints

## Integration Closure

- Upstream surfaces consumed: `widgets/custard-today.js` (canonical widget source, embedded in Worker endpoint)
- New wiring introduced in this slice: `widget-routes.js` imported and routed in `index.js`; `WIDGET_VERSION` constant added to widget script; `docs/widget.html` rewritten with snippet generator
- What remains before the milestone is truly usable end-to-end: S04 enforces widget JS file sync (CI gate); real iOS device verification (UAT)

## Tasks

- [x] **T01: Add Worker endpoints for widget script and version** `est:1h`
  - Why: The bootstrap snippet needs a stable URL to download the full widget script. R017 requires a Worker endpoint; R013 requires a version endpoint for self-update checks.
  - Files: `worker/src/widget-routes.js`, `worker/src/index.js`, `worker/test/widget-routes.test.js`
  - Do: Create `widget-routes.js` with `handleWidgetScript()` (embeds `widgets/custard-today.js` content as a string constant, returns as `text/javascript` with 24h cache) and `handleWidgetVersion()` (returns `{"version":"1.0","updated":"..."}` with 1h cache). Wire both into `index.js` route dispatcher at `/api/widget/script` and `/api/widget/version`. Add rate-limit configs to `getExpensiveReadLimitConfig()`. Write comprehensive vitest tests covering status codes, content-type headers, cache headers, response bodies, and rate-limit config presence.
  - Verify: `cd worker && npm test` — all tests pass including new widget-routes tests
  - Done when: `GET /api/v1/widget/script` returns JS content with correct headers; `GET /api/v1/widget/version` returns version JSON; all Worker tests green

- [ ] **T02: Add self-update version check to widget script** `est:45m`
  - Why: R013 requires the widget to detect when a newer version is available. The version-check-and-alert approach (not auto-overwrite) avoids config-preservation complexity while still notifying users.
  - Files: `widgets/custard-today.js`, `docs/assets/custard-today.js`
  - Do: Add `var WIDGET_VERSION = "1.0";` near the top of `custard-today.js` (after the existing config vars around line 20). Add a `checkForUpdate()` async function that fetches `/api/v1/widget/version`, compares to `WIDGET_VERSION`, and shows a Scriptable `Alert` if a newer version is available (with "Update" button linking to widget.html). Call `checkForUpdate()` in a non-blocking try/catch near the entry point — failures must not break widget rendering. Copy the identical changes to `docs/assets/custard-today.js`. Update the embedded string constant in `worker/src/widget-routes.js` from T01 to match.
  - Verify: `grep -q 'WIDGET_VERSION' widgets/custard-today.js && diff widgets/custard-today.js docs/assets/custard-today.js && cd worker && npm test`
  - Done when: Both widget JS files contain identical `WIDGET_VERSION` constant and `checkForUpdate()` function; Worker embedded constant matches; all tests pass

- [ ] **T03: Build bootstrap snippet generator on widget.html** `est:1h`
  - Why: R011 requires a one-paste install flow; R012 requires multi-store setup without code editing. The current 5-step manual process with 628 lines of copy-paste is the biggest friction point in the widget funnel.
  - Files: `docs/widget.html`
  - Do: Replace the existing Steps 2-5 with a snippet generator section. Keep Step 1 (store finder) as-is — it's the input for the generator. Add: (1) a mode toggle (Single Store / Multi-Store), (2) for multi-store, allow selecting up to 3 stores from the finder, (3) a generated snippet `<textarea>` showing the personalized bootstrap code, (4) a "Copy Snippet" button. The snippet template: `let fm; try { fm = FileManager.iCloud(); } catch(e) { fm = FileManager.local(); } let dir = fm.documentsDirectory(); let path = fm.joinPath(dir, "Custard Today.js"); let req = new Request("https://custard.chriskaschner.com/api/v1/widget/script"); let code = await req.loadString(); let config = 'var slug = "SLUG_HERE";\n'; fm.writeString(path, config + code);`. For multi-store, config includes `MODE` and `slugs`. Update the remaining setup instructions to: (1) Find store, (2) Copy snippet, (3) Paste into Scriptable and run, (4) Add widget to home screen. Keep widget modes section and the existing store finder JS functional.
  - Verify: `grep -q 'FileManager' docs/widget.html && grep -q 'MODE.*multi' docs/widget.html`
  - Done when: widget.html shows a snippet generator that produces single-store and multi-store bootstrap snippets with the selected store slug(s) pre-configured; copy button works; instructions are 4 steps instead of 5

## Files Likely Touched

- `worker/src/widget-routes.js` (new)
- `worker/src/index.js`
- `worker/test/widget-routes.test.js` (new)
- `widgets/custard-today.js`
- `docs/assets/custard-today.js`
- `docs/widget.html`
