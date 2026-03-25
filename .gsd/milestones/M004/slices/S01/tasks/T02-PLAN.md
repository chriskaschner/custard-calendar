---
estimated_steps: 4
estimated_files: 3
skills_used:
  - review
---

# T02: Add self-update version check to widget script

**Slice:** S01 — Widget Bootstrap Flow
**Milestone:** M004

## Description

Add a `WIDGET_VERSION` constant and a non-blocking version-check function to the widget script. When the widget runs, it fetches `/api/v1/widget/version` (created in T01), compares versions, and shows a Scriptable Alert if a newer version is available. The alert directs users to widget.html to re-run the bootstrap snippet. This implements R013 (self-update from API) using the alert-and-redirect approach — simpler and safer than auto-overwrite because it avoids the config-preservation problem.

Both `widgets/custard-today.js` and `docs/assets/custard-today.js` must be modified identically. The embedded `WIDGET_SCRIPT` constant in `worker/src/widget-routes.js` must then be updated to match.

## Steps

1. **Add `WIDGET_VERSION` to `widgets/custard-today.js`**: Insert `var WIDGET_VERSION = "1.0";` after line 20 (after the `var slug = ...` line). This is a top-level var that self-update and the version endpoint both reference.

2. **Add `checkForUpdate()` function** to `widgets/custard-today.js`: Insert it before the entry point section (before the `// --- Entry point ---` comment, currently around line 597). The function should:
   - Fetch `API_BASE + "/widget/version"` (note: `API_BASE` is already defined as `"https://custard.chriskaschner.com/api/v1"` on line 18)
   - Parse the JSON response and compare `data.version` to `WIDGET_VERSION`
   - If versions differ, show a Scriptable `Alert` with title "Update Available", message "A new version of Custard Today is available. Visit the widget page to update.", and an "Open Widget Page" action button that calls `Safari.open("https://custard.chriskaschner.com/widget.html")`
   - Wrap everything in try/catch — on any error, silently continue (version check must never break rendering)

3. **Call `checkForUpdate()`** in the entry point: Add `checkForUpdate();` (no `await` — fire-and-forget so it doesn't block rendering) right before the final `Script.complete();` call. The widget renders immediately; the update check happens in the background.

4. **Sync both files and update Worker embed**:
   - Copy the exact content of `widgets/custard-today.js` to `docs/assets/custard-today.js` (they must be byte-identical)
   - Update the `WIDGET_SCRIPT` string constant in `worker/src/widget-routes.js` to contain the updated widget source (with `WIDGET_VERSION` and `checkForUpdate`)
   - Run `cd worker && npm test` to verify all tests still pass (the `widget-routes.test.js` tests from T01 should still match since the embedded content still contains "Custard Today" and is > 1000 chars)

## Must-Haves

- [ ] `var WIDGET_VERSION = "1.0";` exists near top of `widgets/custard-today.js`
- [ ] `checkForUpdate()` function exists with try/catch wrapping, Alert display on version mismatch, and Safari.open for the update link
- [ ] `checkForUpdate()` is called non-blocking (fire-and-forget, no `await`) before `Script.complete()`
- [ ] `widgets/custard-today.js` and `docs/assets/custard-today.js` are byte-identical after changes
- [ ] `WIDGET_SCRIPT` in `worker/src/widget-routes.js` matches the updated widget source
- [ ] All Worker tests pass

## Verification

- `grep -q 'WIDGET_VERSION' widgets/custard-today.js` — version constant present
- `grep -q 'checkForUpdate' widgets/custard-today.js` — update function present
- `diff widgets/custard-today.js docs/assets/custard-today.js` — files are identical (no output = success)
- `cd worker && npm test` — all tests pass

## Inputs

- `widgets/custard-today.js` — canonical widget script to modify (628 lines, `var slug` on line 20, entry point at ~line 597)
- `docs/assets/custard-today.js` — deployed copy that must mirror changes
- `worker/src/widget-routes.js` — T01 output containing `WIDGET_SCRIPT` constant to update

## Expected Output

- `widgets/custard-today.js` — modified with WIDGET_VERSION constant and checkForUpdate function
- `docs/assets/custard-today.js` — identical copy of the modified widget script
- `worker/src/widget-routes.js` — updated WIDGET_SCRIPT constant matching the new widget source
