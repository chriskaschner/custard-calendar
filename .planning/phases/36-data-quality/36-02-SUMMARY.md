---
phase: 36-data-quality
plan: 02
subsystem: worker-ingest-pipeline
tags: [quality-gate, data-validation, operator-alerts, ingest-pipeline]
dependency_graph:
  requires: [36-01]
  provides: [isKnownFlavor, detectDuplicateDays, isStaleStore, quality-gate-alerts]
  affects: [worker/src/kv-cache.js, worker/src/operator-alerts.js]
tech_stack:
  added: []
  patterns: [KV-counter-based-alerting, D1-staleness-query, catalog-lookup-normalization]
key_files:
  created: []
  modified:
    - worker/src/kv-cache.js
    - worker/src/operator-alerts.js
    - worker/test/operator-alerts.test.js
decisions:
  - "Unknown flavors are detected and counted but NOT dropped from serving -- catalog gaps must not break user experience"
  - "Stale store detection uses D1 MAX(date) query scoped to priority slugs only -- bounded query, no full-table scan"
  - "Quality gate counters reuse existing incrementDailyCounter/readDailyCounter infrastructure -- no new storage primitives"
metrics:
  duration: 4m
  completed: 2026-04-06T12:05:06Z
  tasks: 2/2
  files_modified: 3
  tests_added: 6
  tests_total: 1185
---

# Phase 36 Plan 02: Quality Gate Detection + Operator Alert Integration Summary

Three quality gate detection functions (isKnownFlavor, detectDuplicateDays, isStaleStore) added to the Worker ingest pipeline with KV counter telemetry, wired into the operator email digest via unknown flavor, duplicate day, and stale store alert checks.

## What Changed

### Task 1: Quality Gate Detection Functions (kv-cache.js)

Added three exported detection functions to `worker/src/kv-cache.js`:

- **isKnownFlavor(title)** -- Normalizes flavor name (strips TM/R symbols, curly quotes, lowercases) and checks against both `FLAVOR_PROFILES` (94 entries) and `FLAVOR_ALIASES` (37 entries). Returns boolean. Unknown flavors are counted but NOT dropped from serving.
- **detectDuplicateDays(flavors)** -- Scans an array of `{date}` entries for duplicate dates. Returns sorted array of duplicated date strings. Catches upstream payload dupes before D1's UNIQUE constraint.
- **isStaleStore(lastFlavorDate, now, thresholdDays)** -- Compares last flavor date against a configurable threshold (default 7 days). Returns true if stale or if no data exists.

Wired counters into `getFlavorsCached()`:
- `meta:unknown-flavor-count` incremented when any flavor in a payload is unrecognized
- `meta:duplicate-day-count` incremented when duplicate dates detected in upstream payload

All 16 `quality-gate.test.js` tests from Plan 01 now pass GREEN.

### Task 2: Operator Alert Integration (operator-alerts.js)

Extended `maybeSendOperatorAlert()` with three new quality gate checks:

- **Unknown flavors** -- Reads `meta:unknown-flavor-count` KV counter, alerts when > 5 (configurable via `OPERATOR_UNKNOWN_FLAVOR_THRESHOLD`)
- **Duplicate same-day entries** -- Reads `meta:duplicate-day-count` KV counter, alerts when > 1 (configurable via `OPERATOR_DUPLICATE_DAY_THRESHOLD`)
- **Stale stores** -- Queries D1 `MAX(date) FROM snapshots` for priority slugs, alerts when any store has no new data in 7+ days (configurable via `OPERATOR_STALE_STORE_THRESHOLD_DAYS`). Uses parameterized SQL scoped to priority slugs array (3-17 stores max).

Added `findStaleStores()` internal function with D1 query and diff calculation.

Added 6 new test cases to `operator-alerts.test.js`:
1. Unknown flavor count above threshold fires alert
2. Unknown flavor count at threshold does NOT fire
3. Duplicate day count above threshold fires alert
4. Stale store (10 days old) fires alert with slug detail
5. Fresh store (3 days old) does NOT fire alert
6. Store with no snapshots fires alert with "never" in detail

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Unknown flavors counted but not dropped | Catalog gaps must not break user-facing data; counting enables awareness without data loss |
| 7-day stale threshold default | Matches Culver's weekly flavor rotation cadence; avoids false positives from normal schedules |
| Stale query scoped to priority slugs | Prevents unbounded D1 queries; T-36-03 mitigation |
| Reuse existing counter infrastructure | incrementDailyCounter/readDailyCounter already proven; no new storage patterns needed |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c2f3f22 | Quality gate detection functions in kv-cache.js |
| 2 | 3392a77 | Operator alert quality gate integration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock DB missing coverage rows for "no threshold" tests**
- **Found during:** Task 2
- **Issue:** Existing "skips when no thresholds are crossed" test and new "unknown at threshold" test failed because mock DB returned empty coverageRows, causing all 3 default priority slugs to appear stale (never seen)
- **Fix:** Added recent max_date coverage rows for all 3 priority slugs in affected test mocks
- **Files modified:** worker/test/operator-alerts.test.js
- **Commit:** 3392a77

## Verification

- `quality-gate.test.js`: 16/16 GREEN (was 0/16 RED before this plan)
- `operator-alerts.test.js`: 11/11 pass (5 existing + 6 new)
- Full worker suite: 1185 pass, 4 skipped, 0 failures

## Self-Check: PASSED

All files exist, all commits verified.
