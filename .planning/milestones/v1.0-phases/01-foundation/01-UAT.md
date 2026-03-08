---
status: diagnosed
phase: 01-foundation
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-03-07T17:30:00Z
updated: 2026-03-07T17:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. First Visit Geolocation
expected: Clear localStorage, reload. See compact store prompt or fallback text prompt. No dimmed overlay, no browser permission popup.
result: issue
reported: "I see a failure message, I see a non geoip (should this work, I'm in wisconsin and this is showing me AL stores), I don't see 'showing flavors'. Store indicator shows 'Albertville, AL, Albertville, AL change' which looks like legacy format, not the new SharedNav blue bar. Flavor data error visible."
severity: major

### 2. Confirm/Select Store
expected: From the first-visit prompt, tap confirm (if store shown) or "Find your store" then select one. Store indicator in the header shows store name and city compactly with a "change" link.
result: pass

### 3. Change Store via Picker
expected: Tap "change" on the store indicator. A store picker opens with a search input. Type a store name (e.g., "Mt. Horeb"). Matching stores filter in real-time. Select one. Picker closes, indicator updates to show the new store.
result: pass
note: "Core behavior works but store list shows only 'Madison, WI' for all Madison stores -- no street address to differentiate them (e.g., 'Mineral Point', 'Todd Dr'). Tracked as separate gap."

### 4. Forecast Loads After Store Change
expected: On index.html, after changing store via the picker, flavor data loads for the new store. No "Something went wrong loading the flavor data" error.
result: issue
reported: "fail, there's a red error and it says 'Something went wrong loading the flavor data'"
severity: blocker

### 5. Cross-Page Store Persistence
expected: With a store selected on index.html, navigate to calendar.html (or any other page). The same store name appears in the header store indicator.
result: pass

### 6. Nav Bar on All Pages
expected: Visit at least 3 different pages (index, calendar, map). Each page shows the same 11 nav links. The current page's link is highlighted/bold.
result: pass

### 7. Mobile Layout (375px)
expected: In DevTools, switch to 375px viewport width (e.g., iPhone SE). Store indicator text does not overflow or break layout. Nav links are usable (wrap or scroll).
result: issue
reported: "nav links function, but the overflow is weird and makes the page wider at 375px"
severity: minor

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "First-time visitor is geolocated and sees nearest store name in header without manual selection, with 'Showing flavors for [Store] -- change?' prompt"
  status: failed
  reason: "User reported: I see a non geoip result (AL stores instead of WI), no 'showing flavors' prompt, legacy store indicator format, and flavor data error"
  severity: major
  test: 1
  root_cause: "Race condition: todays-drive.js defaults to culversStores.slice(0,2) (Albertville, AL first alphabetically) and saves to localStorage via selectStore() before SharedNav DOMContentLoaded fires. SharedNav then finds existing localStorage and skips IP geolocation. Also buildStoreIndicatorHTML() duplicates city/state when store.name already contains them."
  artifacts:
    - path: "custard-calendar/docs/todays-drive.js"
      issue: "Lines 232-237, 1059-1077: defaults to alphabetical first stores and saves to localStorage before SharedNav can initialize"
    - path: "custard-calendar/docs/shared-nav.js"
      issue: "Lines 503-541: renderNav() trusts localStorage without distinguishing user-chosen vs auto-defaulted stores"
    - path: "custard-calendar/docs/shared-nav.js"
      issue: "Lines 175-196: buildStoreIndicatorHTML() duplicates city/state when store.name already contains them"
  missing:
    - "Gate todays-drive.js onPrimaryStoreChange on _hadSavedPrefs check so auto-defaults don't write to custard-primary"
    - "Fix buildStoreIndicatorHTML() to not duplicate city/state from store.name"
  debug_session: ".planning/debug/first-visit-geolocation.md"

- truth: "Store picker list items distinguish stores in same city by street address"
  status: failed
  reason: "User reported: All Madison WI stores show identically as 'Madison, WI' with no street address (Mineral Point, Todd Dr, etc.) to tell them apart"
  severity: major
  test: 3
  root_cause: "buildStorePickerHTML() in shared-nav.js (lines 368-378) uses only s.name and s.city+s.state for labels, never reads s.address field. stores.json has address on every store but it is omitted from rendering and data attributes."
  artifacts:
    - path: "custard-calendar/docs/shared-nav.js"
      issue: "Lines 368-378: buildStorePickerHTML() omits s.address from label and data-* attributes"
    - path: "custard-calendar/docs/shared-nav.js"
      issue: "Lines 386-403: filterStoreList() does not match against address"
  missing:
    - "Append s.address to picker list item labels"
    - "Add data-address attribute to each li"
    - "Include address in filterStoreList() search matching"
  debug_session: ".planning/debug/store-picker-addresses.md"

- truth: "Flavor data loads for the selected store after changing store via SharedNav picker"
  status: failed
  reason: "User reported: fail, there's a red error and it says 'Something went wrong loading the flavor data'"
  severity: blocker
  test: 4
  root_cause: "selectStore() in index.html sets currentSlug BEFORE allStores.find() check. If find fails, returns without calling loadForecast() and currentSlug is poisoned preventing retry. CustardDrive.mount() not wrapped in try/catch so listener registration can fail. loadForecast catch block too broad, obscures actual error source."
  artifacts:
    - path: "custard-calendar/docs/index.html"
      issue: "Line 513-516: selectStore guard sets currentSlug before check, preventing retry"
    - path: "custard-calendar/docs/index.html"
      issue: "Line 1031-1048: CustardDrive.mount() not in try/catch; listener registration depends on it"
    - path: "custard-calendar/docs/index.html"
      issue: "Line 605-668: loadForecast catch too broad, obscures actual throw"
  missing:
    - "Move currentSlug assignment after allStores.find() check"
    - "Wrap CustardDrive.mount() in try/catch"
    - "Call loadForecast(slug) even when store object not found in allStores"
    - "Clear error state at start of selectStore()"
  debug_session: ".planning/debug/flavor-data-error.md"

- truth: "Nav links are usable at 375px mobile viewport width"
  status: failed
  reason: "User reported: nav links function, but the overflow is weird and makes the page wider at 375px"
  severity: minor
  test: 7
  root_cause: ".nav-links has no flex/grid layout and no overflow containment. 11 inline <a> elements with margin 0 0.5rem each overflow at 375px. No @media breakpoint targets .nav-links at any width."
  artifacts:
    - path: "custard-calendar/docs/style.css"
      issue: "Lines 399-411: Missing flex layout, flex-wrap, and overflow rules on .nav-links"
    - path: "custard-calendar/docs/shared-nav.js"
      issue: "Line 160: buildNavLinksHTML() renders plain inline links with no scroll wrapper"
  missing:
    - "Add display:flex; flex-wrap:wrap; gap:0.25rem 0.5rem to .nav-links"
    - "Add max-width:100% to .nav-links"
    - "Remove per-link margin, use gap instead"
  debug_session: ".planning/debug/mobile-nav-overflow.md"
