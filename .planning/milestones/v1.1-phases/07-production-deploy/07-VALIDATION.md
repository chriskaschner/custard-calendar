---
phase: 7
slug: production-deploy
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-08
validated: 2026-03-09
---

# Phase 7 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 (browser), vitest 3.0 (worker unit), pytest (Python) |
| **Config file** | worker/playwright.config.mjs, worker/vitest.config.js |
| **Quick run command** | `cd worker && npm test` |
| **Full suite command** | `cd worker && npm test && npm run test:browser -- --workers=1` |
| **Live smoke command** | `uv run pytest tests/test_live_api.py -v` |
| **Estimated runtime** | ~65 seconds (3.4s unit + ~60s browser) + ~15s live API |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm test`
- **After every plan wave:** Run `cd worker && npm test && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 65 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DEPL-01 | smoke | `uv run pytest tests/test_live_api.py -v` | tests/test_live_api.py | green |
| 07-01-02 | 01 | 1 | DEPL-02 | smoke | `uv run pytest tests/test_live_api.py -v` | tests/test_live_api.py | green |
| 07-01-03 | 01 | 1 | DEPL-03 | smoke + browser | `npm run test:browser -- --workers=1` + `uv run pytest tests/test_live_api.py -v` | worker/test/browser/nav-clickthrough.spec.mjs + 27 more | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

- **DEPL-01:** `tests/test_live_api.py` verifies the live domain responds with HTTP 200 and valid content
- **DEPL-02:** `tests/test_live_api.py` tests `/api/v1/flavors`, `/api/v1/stores`, `/api/v1/today` endpoints against the live domain
- **DEPL-03:** 28 Playwright browser tests cover all 5 nav pages; `tests/test_live_api.py` covers API smoke tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full user navigation flow | DEPL-03 | Browser interaction + visual verification on live site | Navigate Today, Compare, Map, Fun, Get Updates pages on custard.chriskaschner.com in a browser |

Human verification was performed during Phase 7 execution (Task 3: checkpoint:human-verify) and approved by user.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 65s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 3 requirements (DEPL-01, DEPL-02, DEPL-03) are covered by existing automated tests:
- `tests/test_live_api.py` covers live domain HTTP checks and API endpoint verification
- 28 Playwright browser tests in `worker/test/browser/` cover all 5 navigation pages
- Human verification completed and approved during execution
