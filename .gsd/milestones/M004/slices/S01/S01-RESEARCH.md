# S01 Research: Widget Bootstrap Flow

**Slice:** M004/S01 — Widget Bootstrap Flow
**Requirements:** R011 (one-paste install), R012 (multi-store no code editing), R013 (self-update), R017 (Worker endpoint)
**Depth:** Deep research — Scriptable FileManager API is unfamiliar; self-update and multi-store config have real integration risk.

---

## Summary

The bootstrap flow requires three coordinated pieces: (1) a new Worker endpoint serving the canonical widget JS, (2) a short bootstrap snippet users paste into Scriptable that downloads and saves the full script using FileManager, and (3) UI changes to `docs/widget.html` to generate personalized snippets. The Scriptable FileManager API is a proven community pattern — `FileManager.iCloud().writeString(path, content)` is the right primitive. The multi-store mode requires pre-configuring `MODE` and `slugs` variables at the top of the saved script, not via `args.widgetParameter`. Self-update adds a version check on each run.

**Recommendation:** Implement in this order: (1) Worker endpoint → (2) bootstrap snippet template → (3) widget.html UI → (4) self-update mechanism. The Worker endpoint is the critical dependency that must exist before the bootstrap can be tested end-to-end.

---

## Implementation Landscape

### What Exists

**`widgets/custard-today.js`** (628 lines) — canonical widget script. Key facts:
- Single-store: reads store from `args.widgetParameter || "mt-horeb"` (line 21)
- Multi-store: reads `MODE` and `slugs` variables defined at the top of the script — `var isMultiMode = typeof MODE !== "undefined" && MODE === "multi"` (line 602). These are NOT configurable via widget Parameter — they must be literals in the script source.
- No version constant exists anywhere. Self-update requires adding one.
- `widgets/custard-today.js` and `docs/assets/custard-today.js` are currently identical (verified via diff).

**`docs/widget.html`** (427 lines) — existing setup page. Has:
- Store slug search that loads `stores.json` and filters by city/state/name
- Step-by-step instructions telling users to paste 628 lines manually
- No snippet generator, no multi-store picker
- Multi-store mode described as "requires adding `MODE="multi"` and a `slugs` array to the script" — explicitly developer-only today

**Worker `src/index.js`** — no widget endpoint exists. Route dispatcher handles `/og/`, `/api/today`, `/api/flavors`, `/calendar.ics`, etc. A new `canonical === '/api/widget/script'` branch must be added. The route string follows established naming: `/api/widget/script` for versioned access as `/api/v1/widget/script`.

**Worker `src/social-card.js`** — existing PNG card pattern using `workers-og` (ImageResponse). Confirms WASM mock in `worker/test/setup.js` is already in place and working.

**`.github/workflows/ci.yml`** — runs `npm test` in `worker/`. S04 will add a widget file sync check here (S01 boundary: S01 produces the updated widget JS; S04 enforces sync).

### Scriptable FileManager API (confirmed working pattern)

```javascript
// Standard bootstrap pattern used across the Scriptable community
let fm = FileManager.iCloud();         // Use iCloud so scripts sync across devices
let dir = fm.documentsDirectory();     // = iCloud Drive/Scriptable/
let path = fm.joinPath(dir, "Custard Today.js");
let req = new Request("https://custard.chriskaschner.com/api/v1/widget/script");
let code = await req.loadString();
fm.writeString(path, code);
// Script is now visible in Scriptable and runs as a widget
```

Key API facts:
- `FileManager.iCloud()` — creates manager for `iCloud Drive/Scriptable/` (requires iCloud enabled)
- `FileManager.local()` — fallback for users without iCloud; files won't appear in Files app
- `fm.documentsDirectory()` — returns path to the Scriptable scripts directory
- `fm.writeString(path, content)` — creates or overwrites the file
- `downloadFileFromiCloud(path)` — must be called before reading, safe to call always
- Scripts saved here appear immediately in Scriptable's script list with no restart required
- iCloud restriction: `FileManager.iCloud()` throws if iCloud is not enabled; bootstrap must handle this gracefully with a `FileManager.local()` fallback

### Multi-Store Configuration Strategy

The current widget reads `MODE` and `slugs` as top-level variables. For the bootstrap to pre-configure multi-store mode, the downloaded script must have these variables injected. **Two approaches:**

**Option A — Server-side injection** (`/api/v1/widget/script?slug=mt-horeb&mode=single`): Worker reads the JS file (or has it embedded), does string replacement to inject config vars at the top, returns customized JS.
- Risk: JS file changes must be kept in sync with the injection logic. String replacement is fragile.
- Benefit: Simpler bootstrap snippet (no config in snippet itself).

**Option B — Config block at top of downloaded script** (recommended): Worker serves the canonical generic JS. The bootstrap snippet writes a small config header (`var slug = "mt-horeb"; var MODE = "multi"; var slugs = ["mt-horeb","madison-todd-drive"];`) prepended to the downloaded content before saving.
- Risk: Config variables must match what the main script expects (`slug`, `MODE`, `slugs`).
- Benefit: Worker serves one static file; config injection is in the bootstrap snippet where it's visible to the user; no server-side string manipulation.

**Option B is recommended.** The bootstrap snippet becomes:
```javascript
// Single-store bootstrap (generated by widget.html for slug="mt-horeb")
let fm = FileManager.iCloud();
let dir = fm.documentsDirectory();
let path = fm.joinPath(dir, "Custard Today.js");
let req = new Request("https://custard.chriskaschner.com/api/v1/widget/script");
let code = await req.loadString();
let config = 'var slug = "mt-horeb"; // your store\n';
fm.writeString(path, config + code);
```

For multi-store:
```javascript
let config = 'var MODE = "multi";\nvar slugs = ["mt-horeb","madison-todd-drive"];\n';
```

### Self-Update Mechanism

The widget currently has no version constant and no update logic. Implementation:
1. Add `var WIDGET_VERSION = "2.1"` near top of `custard-today.js`
2. Add `/api/v1/widget/version` endpoint returning `{"version":"2.1"}` (lightweight JSON, no WASM)  
3. On each widget run, fetch `/api/v1/widget/version` and compare to `WIDGET_VERSION`
4. If mismatch: download fresh script from `/api/v1/widget/script`, write to same path (preserving the config header — **this is the key risk**)

**Self-update config preservation risk**: If the bootstrap writes `config + code` into one file and self-update rewrites the whole file from the fresh download, the user's slug config is lost. 

**Resolution**: Store config in a separate file alongside the script:
- `Custard Today.js` — the pure downloaded widget script (no injected config)
- `Custard Today Config.js` — `var slug = "mt-horeb";` (written by bootstrap, never overwritten by self-update)
- The widget script starts with: `if (typeof slug === "undefined") { /* load from config file or use default */ }`

OR simpler: self-update preserves the config by extracting it from the first N lines before overwriting. The config comment is distinctive enough (`// your store` marker).

**Simplest viable approach for S01**: Self-update rewrites only the non-config portion. The bootstrap writes config as the very first line(s), each tagged with `// CUSTARD_CONFIG`. Self-update strips lines tagged `// CUSTARD_CONFIG` from the existing file, prepends fresh config lines, writes fresh body.

**Alternative** (lower risk, defer complexity): Widget checks version, but self-update requires user to re-run the bootstrap snippet. Show an alert: "New version available — tap here to update." This is a viable MVP that avoids config-preservation complexity.

**Recommendation for S01**: Implement version-check-and-alert (not auto-overwrite). User taps alert → opens `widget.html` → runs bootstrap snippet again. Clean, no config loss risk, testable without device.

### Worker Endpoint Design

**`GET /api/v1/widget/script`** (normalized from `/api/widget/script`):
- Returns the full `custard-today.js` source as `text/javascript`
- Cache-Control: `public, max-age=86400` (24h; forces effective daily self-update check)
- The JS source must be bundled into the Worker (not fetched from GitHub Pages at runtime) — embed as a string constant or read from a bound static asset
- Rate limiting: use existing expensive-read pattern (`rl:widget:script`, limit 60/hour — same as `/og/` routes)
- No slug/mode injection (per Option B above)

**`GET /api/v1/widget/version`** (for self-update check):
- Returns `{"version":"X.Y","updated":"2026-03-25"}`  
- Cache-Control: `public, max-age=3600` (1h)
- Lightweight — no WASM, no D1 query
- Version must be hardcoded and kept in sync with `WIDGET_VERSION` in the JS file

**Bundling strategy**: The Worker cannot read from the filesystem at runtime (no `fs`). The widget JS must be embedded. Two options:
- Hardcode as a template literal `const WIDGET_SCRIPT = \`...\`` in a new `src/widget-routes.js`
- Use wrangler's `[assets]` binding — but `wrangler.toml` has no assets binding configured currently

**Recommendation**: Embed as a string constant in `src/widget-routes.js`. The CI sync check (S04) enforces that this constant matches `widgets/custard-today.js`. For S01, embed manually and add a TODO comment pointing to S04.

---

## Natural Seams (Task Decomposition)

The work divides cleanly into 4 tasks:

**T01 — Worker endpoint** (`worker/src/widget-routes.js` + `worker/src/index.js`)
- New file `src/widget-routes.js` with `handleWidgetScript()` and `handleWidgetVersion()`  
- Embed widget JS as string constant with `WIDGET_VERSION` matching the constant in the JS
- Wire into `index.js` route dispatch for `/api/widget/script` and `/api/widget/version`
- Rate-limit config added to `getExpensiveReadLimitConfig()`
- Tests: `worker/test/widget-routes.test.js` — status 200, content-type text/javascript, cache headers, version JSON shape

**T02 — Self-update in widget script** (`widgets/custard-today.js` + `docs/assets/custard-today.js`)
- Add `var WIDGET_VERSION = "X.Y"` constant near top
- Add version-check function that fetches `/api/v1/widget/version`, compares, alerts user if update available
- Call on each run (non-blocking: wrap in try/catch, don't slow widget render)
- Both files must be updated identically (S04 will enforce this going forward)

**T03 — Bootstrap snippet generator** (`docs/widget.html`)
- Add single-store snippet generator: store picker (reuse existing slug search) → copy button → snippet textarea
- Add multi-store picker: up to 3 stores, generates snippet with `MODE`/`slugs` pre-configured
- Snippet includes iCloud/local fallback logic
- Snippet named per convention: `Custard Today.js`
- Replace Step 2-5 instructions with new flow; keep slug finder as Step 1

**T04 — Integration verification** (manual, on real iOS device)
- Verify bootstrap snippet runs without errors in Scriptable
- Verify `Custard Today.js` appears in Scriptable script list after running
- Verify widget shows correct store data when added to home screen
- Verify version check alert appears when `WIDGET_VERSION` is bumped

---

## Verification Commands

```bash
# Worker tests (must pass before and after)
cd worker && npm test

# Verify widget endpoint responds correctly (requires: cd worker && npx wrangler dev)
curl http://localhost:8787/api/v1/widget/script | head -5
curl http://localhost:8787/api/v1/widget/version

# Verify files are identical (pre-S04 manual check)
diff widgets/custard-today.js docs/assets/custard-today.js && echo "IN SYNC"

# Confirm WIDGET_VERSION is consistent
grep "WIDGET_VERSION" widgets/custard-today.js worker/src/widget-routes.js
```

---

## Risks and Constraints

1. **iCloud not enabled**: `FileManager.iCloud()` throws. Bootstrap must catch and fall back to `FileManager.local()`. Local files work but don't appear in Files app — user still sees script in Scriptable.

2. **Script name conflicts**: If user already has a script named "Custard Today", the bootstrap overwrites it silently. Acceptable — this is the update path.

3. **Widget JS size**: At 628 lines / ~22KB, the JS is well within Cloudflare Worker script size limits and Scriptable's request limits.

4. **`args.widgetParameter` vs injected config**: The current script reads slug from `args.widgetParameter`. After bootstrap, slug is a hardcoded var in the script. The `|| "mt-horeb"` fallback on line 21 means the widget still works correctly if widgetParameter is set — it takes precedence. For bootstrap-installed scripts, widgetParameter should be left empty.

5. **Self-update config preservation**: Addressed above — use alert-and-redirect approach for S01 to avoid overwrite complexity.

6. **Worker bundling**: No `[assets]` binding in `wrangler.toml`. Widget JS must be embedded as a string constant. This is the correct approach for now.

---

## Files to Create/Modify

| File | Action | Notes |
|------|---------|-------|
| `worker/src/widget-routes.js` | CREATE | New file: `handleWidgetScript()`, `handleWidgetVersion()`, embedded JS constant |
| `worker/src/index.js` | MODIFY | Add `/api/widget/script` and `/api/widget/version` routes; add rate-limit configs |
| `worker/test/widget-routes.test.js` | CREATE | Tests for both endpoints |
| `widgets/custard-today.js` | MODIFY | Add `WIDGET_VERSION` constant + version check function |
| `docs/assets/custard-today.js` | MODIFY | Mirror identical changes from `widgets/custard-today.js` |
| `docs/widget.html` | MODIFY | Add snippet generator UI (store picker → single/multi mode → snippet textarea with copy) |

No new dependencies required. No wrangler.toml changes needed.
