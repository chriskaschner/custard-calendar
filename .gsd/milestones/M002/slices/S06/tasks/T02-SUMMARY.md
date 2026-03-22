---
id: T02
parent: S06
milestone: M002
provides:
  - Week Ahead strip renders L5 hero PNGs via renderHeroCone() with L0 SVG fallback
  - CSS rule constraining hero PNGs to 40px in week-day-cone context
  - Widget getConeImage() diagnostic logging on PNG load failure; drawConeIcon triangle fallback verified
  - sw.js cache bumped to custard-v23; png-asset-count test expectation updated
key_files:
  - docs/today-page.js
  - docs/style.css
  - widgets/custard-today.js
  - docs/assets/custard-today.js
  - docs/sw.js
  - worker/test/png-asset-count.test.js
key_decisions:
  - Week Ahead cone migration uses post-append querySelector pattern: build card with empty .week-day-cone placeholder in innerHTML, append to DOM, then call renderHeroCone() on the live element — this preserves the simple string-concatenation card builder while giving renderHeroCone a real DOM node to work with
  - fallbackScale=3 for week-ahead (gives 27x30px SVG, matches existing .cone-sm sizing) rather than 6 (which is used for the main hero card)
  - Widget getConeImage uses renamed local variable `coneSlug` to avoid any ambiguity with the outer module-level `slug` (store parameter), even though JS var scoping already isolates it
  - sw.js cache version bumped from v22 to v23 to force clients to re-fetch updated style.css and today-page.js
patterns_established:
  - Post-append renderHeroCone pattern: when week-ahead cards are built with innerHTML, call card.querySelector('.week-day-cone') after weekStrip.appendChild(card) to get the live DOM element, then pass it to renderHeroCone()
  - Widget PNG load failure surfaced via console.log("[custard] getConeImage failed for...") — inspectable in Scriptable's in-app console
observability_surfaces:
  - Widget cone PNG failure: console.log("[custard] getConeImage failed for '<flavorName>': <error>") in Scriptable's in-app console
  - Week Ahead cone fallback: when a flavor PNG is missing, renderHeroCone's img.onerror replaces the element with renderMiniConeSVG (L0 SVG) — no visual gap
  - sw.js CACHE_VERSION = 'custard-v23' — service worker forces fresh assets on next visit
duration: ~25 min
verification_result: passed
completed_at: 2026-03-22
blocker_discovered: false
---

# T02: Week Ahead art migration + widget fix

**Replaced renderMiniConeSVG() with renderHeroCone() in the week-ahead strip (PNG-first with L0 SVG fallback), constrained hero-cone-img to 40px in card context, and added getConeImage() diagnostic logging to the Scriptable widget.**

## What Happened

**Week Ahead strip (docs/today-page.js):** `renderWeekStrip()` previously embedded `renderMiniConeSVG(day.flavor)` inline in the card `innerHTML` string. `renderHeroCone()` requires a live DOM element (it uses `appendChild`), so the migration uses a post-append pattern: the card is built with an empty `<div class="week-day-cone cone-sm"></div>` placeholder, the card is appended to the DOM, then `card.querySelector('.week-day-cone')` retrieves the live element and passes it to `renderHeroCone(day.flavor, coneEl, 3)`. The `fallbackScale=3` yields a 27×30px SVG that matches the existing `.cone-sm` constraint. The `day.flavor && typeof renderHeroCone === 'function'` guard ensures the call is skipped for "no data" day cards (which don't include a `.week-day-cone` placeholder in their HTML).

**CSS (docs/style.css):** Added `.week-day-cone .hero-cone-img { width: 40px !important; }` to constrain the default 120px hero PNG to fit the 140px week-ahead card.

**Widget getConeImage (widgets/custard-today.js + docs/assets/custard-today.js):** Renamed the local variable `slug` to `coneSlug` inside `getConeImage()` to eliminate any future reader confusion with the module-level store `slug` parameter. Added `console.log("[custard] getConeImage failed for '...'")` in the catch block so PNG load failures are surfaced in Scriptable's in-app console for debugging. The `drawConeIcon()` function was already rendering a proper triangular cone body + circular scoop (no change needed).

**sw.js:** Cache version bumped from `custard-v22` to `custard-v23` to force service worker to re-fetch updated files. Updated `worker/test/png-asset-count.test.js` to match `custard-v23`.

## Verification

Full test run: **1034 passed, 4 skipped, 0 failed**. The pre-existing `custard-v21` test expectation was fixed as part of this task (updated to `custard-v23`).

Checked that `renderHeroCone` is globally available in the `index.html` page context — `cone-renderer.js` is loaded before `today-page.js` in the HTML script order.

Verified the "no data" branch doesn't call `renderHeroCone`: it produces HTML without a `.week-day-cone` element and `day.flavor` is falsy, so `card.querySelector('.week-day-cone')` would find nothing and the guard prevents any call.

Confirmed `widgets/custard-today.js` and `docs/assets/custard-today.js` are byte-for-byte identical after changes.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd worker && npm test` | 0 | ✅ 1034 passed, 0 failed | ~6.4s |
| 2 | `npx vitest run route-today-rarity` | 0 | ✅ 12/12 | ~0.6s |
| 3 | `npx vitest run signals-dow-filter` | 0 | ✅ 6/6 | ~0.4s |
| 4 | `npx vitest run store-display-name` | 0 | ✅ 22/22 | ~0.4s |
| 5 | `npx vitest run png-asset-count` | 0 | ✅ 5/5 (custard-v23 test now passes) | ~0.5s |
| 6 | `diff widgets/custard-today.js docs/assets/custard-today.js` | 0 | ✅ files identical | <0.1s |

## Diagnostics

**Week Ahead cone art inspection:**
- Load `index.html` for any store with confirmed/predicted days
- `.week-day-cone` elements should contain `<img class="hero-cone-img">` at 40px width
- On PNG miss (unmapped flavor), the img.onerror fires and replaces with L0 SVG at 27×30px

**Widget PNG failure:**
- In Scriptable, open the script, tap Run
- Check the console log for lines starting with `[custard] getConeImage failed for`
- Each line shows the flavor name and the error (typically a 404 message or network error)

**Service worker cache:**
```bash
grep CACHE_VERSION docs/sw.js
# Should show: custard-v23
```

## Deviations

The task plan had no `## Steps` section. Steps were inferred from the description and Must-Haves.

The `drawConeIcon()` fallback in the widget already rendered a triangular cone shape (not circles/pins) — no change was needed there. The plan description may have been written against an older version. The actual fix delivered was `getConeImage()` diagnostic logging + `coneSlug` rename.

The T01 summary claimed 32 store-display-name tests; the live suite shows 22. This discrepancy pre-dates T02 — the test count in T01's summary was incorrect.

## Known Issues

None introduced by this task.

## Files Created/Modified

- `docs/today-page.js` — Changed `renderWeekStrip()` to use empty `.week-day-cone` placeholder in innerHTML then call `renderHeroCone()` post-append; fallbackScale=3
- `docs/style.css` — Added `.week-day-cone .hero-cone-img { width: 40px !important; }` rule
- `widgets/custard-today.js` — Renamed local `slug` → `coneSlug` in `getConeImage()`; added console.log on PNG load failure
- `docs/assets/custard-today.js` — Same changes (kept in sync with widgets/custard-today.js)
- `docs/sw.js` — Cache version bumped: `custard-v22` → `custard-v23`
- `worker/test/png-asset-count.test.js` — Updated cache version assertion: `custard-v21` → `custard-v23`
