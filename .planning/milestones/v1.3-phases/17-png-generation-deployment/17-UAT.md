---
status: complete
phase: 17-png-generation-deployment
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md]
started: 2026-03-11T00:00:00Z
updated: 2026-03-12T12:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 94 Hero cone PNGs exist
expected: In docs/assets/cones/, there should be exactly 94 PNG files -- one per entry in FLAVOR_PROFILES. Run: ls docs/assets/cones/*.png | wc -l and confirm the output is 94.
result: pass

### 2. Alias resolution works in heroConeSrc()
expected: Flavors that are aliases (e.g., a flavor name covered by FALLBACK_FLAVOR_ALIASES) should successfully resolve to their canonical PNG when displayed. On flavor-audit.html, all flavor cards should show a cone image -- no broken/missing images for aliased flavors.
result: pass

### 3. CI test suite passes
expected: Running the test suite (npm test or equivalent in worker/) should show all tests passing -- including the PNG count test (94 files), alias structure test, slug consistency test, and CACHE_VERSION test (custard-v19). Full suite should be 1351/1351 (or equivalent green).
result: pass

### 4. CACHE_VERSION is custard-v19 in sw.js
expected: Open docs/sw.js and confirm the CACHE_VERSION constant is set to "custard-v19". Returning visitors will get fresh PNGs because the service worker cache key changed from v18.
result: pass

### 5. Hero cones render correctly on flavor-audit.html
expected: Open custard-calendar/docs/flavor-audit.html in a browser. The Hero tier section should show cone images for all 94 flavors. Images should be crisp (300 DPI supersample), correctly colored per each flavor's profile, and visually consistent across the grid.
result: pass

### 6. Hero cones render correctly on Today page
expected: Open the Today page in the app. The cone image shown for today's flavor should use the correct Hero PNG -- matching the flavor's color profile established in Phase 16. The image should be sharp and well-rendered.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
