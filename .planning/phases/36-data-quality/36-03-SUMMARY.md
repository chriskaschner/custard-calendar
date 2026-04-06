---
phase: 36-data-quality
plan: 03
subsystem: scripts
tags: [d1-audit, data-purge, data-quality, closure-sentinels]
dependency_graph:
  requires: [36-02]
  provides: [clean-d1-data, audit-scripts, purge-scripts]
  affects: []
tech_stack:
  added: []
  patterns: [wrangler-d1-remote, mandatory-dry-run, audit-trail-json]
key_files:
  created:
    - scripts/audit_stores.py
    - scripts/purge_bad_records.py
    - scripts/audit-logs/purge-2026-04-06.json
    - scripts/audit-logs/purge-2026-04-06-2.json
  modified: []
decisions:
  - "Fixed wrangler --file to --command: --file uses batch upload API returning metadata, not query results"
  - "Purged 106 closure sentinel records across 16 stores (holidays: Thanksgiving, Christmas, New Year, Easter)"
  - "Check 2 (corrupted text) came back clean -- 0 records with unsafe characters"
  - "Check 4 (unknown flavors) shows many unrecognized names -- these are historical flavors not yet in FLAVOR_PROFILES/FLAVOR_ALIASES catalog"
metrics:
  duration: 300s
  completed: 2026-04-06T12:25:00Z
  tasks: 2/2
  files: 4
  records_purged: 106
  records_remaining: 19405
---

# Phase 36 Plan 03: Store Audit and Purge Scripts Summary

## What was built

Two Python scripts for auditing and purging D1 flavor data across 17 Madison-area Culver's stores.

### scripts/audit_stores.py
Queries D1 via `wrangler d1 execute --remote --command` and runs five cleanliness checks:
1. Closure sentinels (PASS after purge)
2. Corrupted/garbled text (PASS -- 0 found)
3. Coverage gaps (informational -- expected gaps for holidays)
4. Unknown flavors (informational -- historical names not in catalog)
5. Rarity label verification (769 flavor/store combos meet data quality gate)

### scripts/purge_bad_records.py
Scans D1 for bad records and deletes them with safety controls:
- Mandatory `--dry-run`/`--execute` flag
- JSON audit log written before any deletion
- Batched deletes at 100 IDs per batch

## Execution results

- **Initial audit:** 106 closure sentinels found, 0 corrupted text
- **Dry run:** Confirmed 106 records are "Restaurant Closed Today" variants
- **Purge:** 106 records deleted in 2 batches
- **Post-purge audit:** CLEAN -- 0 closure sentinels in 19,405 remaining records
- **Worker tests:** 1189/1189 passing (55 files)

## Deviations

1. **wrangler --file vs --command:** Original scripts used `--file` which triggers wrangler's batch upload API, returning metadata instead of query results. Fixed to use `--command` for direct query execution.
2. **Removed unused tempfile import** after switching from file-based to command-based queries.

## Self-Check: PASSED
- [x] audit_stores.py created (517 lines > 100 min)
- [x] purge_bad_records.py created (337 lines > 120 min)
- [x] scripts/audit-logs/ directory with purge logs
- [x] Audit ran against all 17 stores
- [x] Purge executed with audit trail
- [x] Post-purge audit shows clean closure sentinel check
