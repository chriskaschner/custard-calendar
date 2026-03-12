---
phase: 13-rendering-quality-fixes
plan: 02
subsystem: assets
tags: [sharp, png, dpi, rasterization, pixel-art, svg]

# Dependency graph
requires:
  - phase: none
    provides: "standalone -- uses existing renderConeHeroSVG from flavor-colors.js"
provides:
  - "144x168px hero cone PNGs at 300 DPI for all 40 profiled flavors"
  - "sharp-only pipeline with fail-fast behavior"
  - "dimension/DPI verification built into generate script"
affects: [17-cache-service-worker, docs-assets]

# Tech tracking
tech-stack:
  added: []
  patterns: ["300 DPI supersampled rasterization with nearest-neighbor downscale for pixel-art"]

key-files:
  created: []
  modified:
    - "custard-calendar/scripts/generate-hero-cones.mjs"
    - "custard-calendar/docs/assets/cones/*.png (40 files)"

key-decisions:
  - "300 DPI supersample then resize to 144x168 with nearest-neighbor -- density:300 causes sharp to rasterize SVG at 600x700, so resize step is needed but uses integer-ratio-friendly nearest-neighbor kernel"
  - "Kept createRequire for sharp resolution from worker/node_modules -- ESM import('sharp') fails when no local node_modules exists at script level"
  - "CSS display width (120px) unchanged per user decision -- 144px native gives 1.2x retina oversampling"

patterns-established:
  - "sharp density:300 + resize nearest-neighbor for pixel-art SVG rasterization"
  - "Dimension/DPI verification step at end of asset generation scripts"

requirements-completed: [RNDQ-01, RNDQ-02]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 13 Plan 02: Hero Cone PNG Pipeline Summary

**Hero cone PNGs regenerated at 144x168px with 300 DPI supersampled rasterization, eliminating 3px/4px checkerboard artifacts from the 1.2:1 non-integer resize**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-10T01:14:21Z
- **Completed:** 2026-03-10T01:17:54Z
- **Tasks:** 2
- **Files modified:** 41 (1 script + 40 PNGs)

## Accomplishments
- Eliminated pixel artifacts caused by 144px-to-120px non-integer ratio resize
- All 40 profiled flavor PNGs regenerated at native 144x168px with 300 DPI metadata
- Removed sips fallback code -- pipeline now fails fast if sharp unavailable
- Added built-in dimension/DPI verification at end of generate script

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PNG pipeline -- remove resize, add 300 DPI, remove sips fallback** - `ff56c9f` (fix)
2. **Task 2: Verify PNG output dimensions and check for hardcoded 120px references** - verification only, no code changes

## Files Created/Modified
- `custard-calendar/scripts/generate-hero-cones.mjs` - Fixed rasterization pipeline: 300 DPI density, nearest-neighbor resize to 144x168, removed sips fallback, added dimension verification
- `custard-calendar/docs/assets/cones/*.png` (40 files) - Regenerated hero cone PNGs at 144x168px, 300 DPI

## Decisions Made
- **300 DPI supersample + resize:** sharp's density:300 rasterizes a 144px-wide SVG at 600x700 pixels. A nearest-neighbor resize back to 144x168 preserves the pixel grid while benefiting from the higher-quality initial rasterization. The plan specified "no resize" but the DPI interaction makes this necessary for correct dimensions.
- **Kept createRequire for sharp resolution:** The ESM `import('sharp')` fails when the script runs from a directory without local node_modules. Retained createRequire pointed at worker/package.json as a resolution path (still fails fast if sharp is not installed anywhere).
- **CSS 120px display width unchanged:** Two CSS rules (`.hero-cone-img` and `.today-flavor-cone.cone-lg`) constrain display to 120px. Per user decision, CSS handles display sizing. The 144px native images provide 1.2x oversampling for retina clarity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 600x700 output dimensions from 300 DPI rasterization**
- **Found during:** Task 1 (initial script run)
- **Issue:** sharp density:300 rasterizes 144x168 SVG at 600x700px (300/72 * 144 = 600). Plan specified "no resize" but this produced oversized PNGs.
- **Fix:** Added `.resize({ width: 144, height: 168, kernel: 'nearest' })` after density:300 rasterization. Nearest-neighbor kernel preserves pixel-art grid alignment.
- **Files modified:** custard-calendar/scripts/generate-hero-cones.mjs
- **Verification:** Output PNGs confirmed 144x168 @ 300 DPI
- **Committed in:** ff56c9f (Task 1 commit)

**2. [Rule 3 - Blocking] Restored createRequire for sharp resolution**
- **Found during:** Task 1 (sharp import failed)
- **Issue:** ESM `import('sharp')` cannot resolve sharp from worker/node_modules when running from custard-calendar root. Plan specified removing createRequire, but it is needed for module resolution.
- **Fix:** Kept createRequire import and added worker/package.json-based resolution as fallback after ESM import attempt. Still fails fast with process.exit(1) if both paths fail.
- **Files modified:** custard-calendar/scripts/generate-hero-cones.mjs
- **Verification:** Script runs successfully, resolves sharp from worker/node_modules
- **Committed in:** ff56c9f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct operation. The resize deviation produces identical intended output (144x168) via a different path. The createRequire deviation preserves the existing module resolution behavior. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hero cone PNGs are ready at correct dimensions/DPI
- CSS display constraints work correctly with the larger native images (1.2x oversampling)
- Service worker cache version bump will be needed in Phase 17 after all asset regeneration is complete
- Two CSS rules reference 120px for cone display width -- these are intentional display constraints, not pipeline artifacts

## Self-Check: PASSED

- FOUND: 13-02-SUMMARY.md
- FOUND: commit ff56c9f
- FOUND: generate-hero-cones.mjs

---
*Phase: 13-rendering-quality-fixes*
*Completed: 2026-03-10*
