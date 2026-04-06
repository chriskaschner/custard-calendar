---
phase: 36
slug: data-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 36 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing, configured in worker/vitest.config.js) |
| **Config file** | worker/vitest.config.js |
| **Quick run command** | `cd worker && npm test` |
| **Full suite command** | `cd worker && npm test` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm test`
- **After every plan wave:** Run `cd worker && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | DATA-03 | -- | N/A | unit | `cd worker && npx vitest run test/quality-gate.test.js` | No -- W0 | pending |
| 36-01-02 | 01 | 1 | DATA-02 | -- | N/A | unit | `cd worker && npx vitest run test/reconciliation.test.js` | No -- W0 | pending |
| 36-02-01 | 02 | 2 | DATA-03 | T-36-01 | Parameterized D1 queries, no raw string interpolation | unit | `cd worker && npm test` | Partial | pending |
| 36-02-02 | 02 | 2 | DATA-03 | -- | N/A | unit | `cd worker && npx vitest run test/operator-alerts.test.js` | Partial (5 tests exist) | pending |
| 36-03-01 | 03 | 3 | DATA-01, DATA-04 | T-36-02 | Mandatory dry-run before DELETE; audit log of every deletion | manual + script | `uv run python scripts/audit_stores.py --dry-run` | No -- W0 | pending |
| 36-03-02 | 03 | 3 | DATA-02, DATA-04 | T-36-02 | Audit log JSON written before any DELETE executes | manual + script | `uv run python scripts/purge_bad_records.py --dry-run --stores mt-horeb` | No -- W0 | pending |

---

## Wave 0 Requirements

- [ ] `worker/test/quality-gate.test.js` -- stubs for DATA-03 (3 new detection patterns)
- [ ] `worker/test/reconciliation.test.js` -- stubs for DATA-02 (rarity/stats parity)
- [ ] `scripts/audit_stores.py` -- covers DATA-01 (audit script skeleton)
- [ ] `scripts/purge_bad_records.py` -- covers DATA-04 (purge script skeleton)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human-reviewed audit of 17 stores | DATA-01 | Requires human judgment on data quality | Run `uv run python scripts/audit_stores.py`, review output for each store, confirm zero bad records |
| Purge execution against live D1 | DATA-04 | Destructive operation requires human confirmation | Run `uv run python scripts/purge_bad_records.py --dry-run` first, review deletions, then `--execute` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 6s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
