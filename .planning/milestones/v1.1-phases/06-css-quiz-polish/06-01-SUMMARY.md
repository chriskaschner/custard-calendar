---
phase: 06-css-quiz-polish
plan: 01
subsystem: ui
tags: [css-custom-properties, design-tokens, static-analysis, pytest]

# Dependency graph
requires:
  - phase: 05-quality-gates
    provides: "Initial 17 design tokens in :root and partial adoption in style.css"
provides:
  - "37-token :root vocabulary (13 new gap-filling tokens)"
  - "Zero hardcoded hex colors in style.css outside allowed-list"
  - "Zero hardcoded standard spacing values in style.css"
  - "test_design_tokens.py static analysis scaffold for TOKN-01, TOKN-02, TOKN-03"
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Selector-context-aware CSS static analysis", "Design token coverage testing via regex-based CSS parsing"]

key-files:
  created:
    - "custard-calendar/tests/test_design_tokens.py"
  modified:
    - "custard-calendar/docs/style.css"

key-decisions:
  - "Selector-context-aware test: test parses CSS into selector-block pairs rather than checking property lines in isolation, enabling accurate detection of domain-specific allowed sections"
  - "In-between spacing values (0.375rem, 0.125rem, 0.625rem, 1.25rem) intentionally left hardcoded per research recommendation -- standard 6-step scale kept clean"
  - "Shadow patterns tokenized: 3 shadow tokens (sm/md/lg) replace repeated box-shadow declarations"
  - "Domain-specific colors (fronts dark theme, signal cards, drive buckets, rarity badges, Google Calendar UI) explicitly excluded from token requirement via allowed-list"

patterns-established:
  - "CSS token compliance test: _parse_css_blocks() returns (selector, properties) tuples for context-aware analysis"
  - "Allowed-list approach: ALLOWED_SELECTOR_PATTERNS for domain-specific components, ALLOWED_LINE_PATTERNS for inline exceptions"

requirements-completed: [TOKN-01, TOKN-02]

# Metrics
duration: 7min
completed: 2026-03-09
---

# Phase 6 Plan 01: Design Token Extension and CSS Tokenization Summary

**37-token :root vocabulary with 419 systematic replacements across style.css -- zero hardcoded colors or spacing outside domain-specific allowed-list**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-09T01:35:17Z
- **Completed:** 2026-03-09T01:42:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended :root from 24 to 37 tokens with 13 new gap-filling tokens (brand-hover, bg-surface, bg-muted, border-light, border-input, text-secondary, text-dim, text-faint, shadow-sm/md/lg, radius-lg, radius-full)
- Replaced 184 lines of hardcoded hex colors, 220 lines of hardcoded spacing, 6 shadow patterns, and 9 border-radius values with token references
- Created test_design_tokens.py with 4 static analysis tests using selector-context-aware CSS parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend :root tokens and create test scaffold** - `20951f3` (test)
2. **Task 2: Replace all hardcoded colors and spacing in style.css** - `e44ab98` (feat)

## Files Created/Modified
- `custard-calendar/tests/test_design_tokens.py` - Static analysis tests for TOKN-01/02/03 compliance with selector-context-aware CSS parsing
- `custard-calendar/docs/style.css` - Extended :root block (37 tokens) and all hardcoded values replaced with token vars

## Decisions Made
- Used selector-context-aware test parsing instead of line-only pattern matching, enabling accurate detection of domain-specific sections (fronts dark theme, signal cards, etc.)
- In-between spacing values (0.375rem, 0.125rem, etc.) left hardcoded per research recommendation to keep the 6-step scale clean
- Created shadow-sm/md/lg tokens to standardize 3 recurring box-shadow patterns (previously hardcoded rgba values)
- Mapped close-enough colors to single tokens: #444 and #555 both map to --text-secondary, #e0e0e0 maps to --border, #f5f5f5 and #fafafa both map to --bg

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Selector-context-aware test checking**
- **Found during:** Task 2 (running color tests after replacements)
- **Issue:** Original test checked property lines in isolation but CSS selectors appear on separate lines from properties. 148 false-positive violations reported because the test couldn't associate a property like `color: #005696` on line 1468 with its selector `.first-visit-guide h3` on a different line.
- **Fix:** Rewrote test to use `_parse_css_blocks()` which parses CSS into (selector, properties) tuples, then checks the selector against `ALLOWED_SELECTOR_PATTERNS` before examining properties.
- **Files modified:** tests/test_design_tokens.py
- **Verification:** All 3 target tests pass green
- **Committed in:** e44ab98 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The test restructuring was necessary for the test to correctly identify violations vs allowed exceptions. No scope creep.

## Issues Encountered
None beyond the test structure issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can proceed: test_no_inline_hardcoded_values test exists and correctly identifies 8 inline style violations across fun.html and updates.html
- The token vocabulary is complete for the remaining plans in Phase 6
- Quiz mode differentiation (QUIZ-01) can build on the extended token system

## Self-Check: PASSED

- FOUND: tests/test_design_tokens.py
- FOUND: docs/style.css
- FOUND: 06-01-SUMMARY.md
- FOUND: commit 20951f3
- FOUND: commit e44ab98

---
*Phase: 06-css-quiz-polish*
*Completed: 2026-03-09*
