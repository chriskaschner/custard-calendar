---
phase: 9
slug: infrastructure-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Python) + Vitest (Worker) + Playwright (browser) |
| **Config file** | `pyproject.toml` (pytest), `worker/vitest.config.js`, `worker/playwright.config.mjs` |
| **Quick run command** | `uv run pytest tests/test_static_assets.py tests/test_sw_registration.py tests/test_sw_precache.py -x` |
| **Full suite command** | `uv run pytest tests/ scripts/tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest tests/test_static_assets.py tests/test_sw_registration.py tests/test_sw_precache.py -x`
- **After every plan wave:** Run `uv run pytest tests/ scripts/tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | INFR-03 | unit | `uv run pytest tests/test_sw_registration.py -x` | No -- W0 | pending |
| 09-01-02 | 01 | 0 | INFR-04 | unit | `uv run pytest tests/test_sw_precache.py -x` | No -- W0 | pending |
| 09-01-03 | 01 | 0 | INFR-02 | smoke | `bash scripts/smoke_test_deploy.sh` | No -- W0 | pending |
| 09-01-04 | 01 | 1 | INFR-01 | unit | `uv run python scripts/check_repo_structure.py` | Yes | pending |
| 09-02-01 | 02 | 1 | INFR-04 | unit | `uv run pytest tests/test_sw_precache.py -x` | No -- W0 | pending |
| 09-02-02 | 02 | 1 | INFR-03 | unit | `uv run pytest tests/test_sw_registration.py -x` | No -- W0 | pending |
| 09-02-03 | 02 | 2 | INFR-02 | smoke | `bash scripts/smoke_test_deploy.sh` | No -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_sw_registration.py` -- stubs for INFR-03: verify all user-facing pages have serviceWorker registration
- [ ] `tests/test_sw_precache.py` -- stubs for INFR-04: verify stores.json in STATIC_ASSETS, no ?v= cache-bust params remain
- [ ] `scripts/smoke_test_deploy.sh` -- stubs for INFR-02: curl-based deployment verification (6 pages)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SW installs and activates in browser | INFR-03 | Requires real browser SW lifecycle | Open DevTools > Application > Service Workers, verify status "activated and running" on fun.html and updates.html |
| stores.json available offline | INFR-04 | Requires real browser offline mode | DevTools > Network > Offline checkbox, reload page, verify stores still load |
| GitHub Pages serves latest code | INFR-02 | Depends on external deployment | Run `scripts/smoke_test_deploy.sh` after push, verify all 6 pages pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
