---
phase: 12
slug: feature-development
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via worker/node_modules) |
| **Config file** | `worker/playwright.config.mjs` |
| **Quick run command** | `cd worker && npx playwright test test/browser/{spec_file} --workers=1` |
| **Full suite command** | `cd worker && npx playwright test --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npx playwright test test/browser/{changed_spec} --workers=1`
- **After every plan wave:** Run `cd worker && npx playwright test --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | MAP-01 | browser/e2e | `cd worker && npx playwright test test/browser/map-exclusion-chips.spec.mjs --workers=1` | No - W0 | pending |
| 12-01-02 | 01 | 0 | MAP-02 | browser/e2e | `cd worker && npx playwright test test/browser/map-exclusion-persist.spec.mjs --workers=1` | No - W0 | pending |
| 12-02-01 | 02 | 0 | QUIZ-01 | browser/e2e | `cd worker && npx playwright test test/browser/quiz-image-grid.spec.mjs --workers=1` | No - W0 | pending |
| 12-03-01 | 03 | 0 | CMPR-01 | browser/e2e | `cd worker && npx playwright test test/browser/compare-storage-isolation.spec.mjs --workers=1` | No - W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/map-exclusion-chips.spec.mjs` -- stubs for MAP-01 (exclusion chip toggle dims markers)
- [ ] `worker/test/browser/map-exclusion-persist.spec.mjs` -- stubs for MAP-02 (localStorage persistence across reload)
- [ ] `worker/test/browser/quiz-image-grid.spec.mjs` -- stubs for QUIZ-01 (2x2 image grid at mobile viewport)
- [ ] `worker/test/browser/compare-storage-isolation.spec.mjs` -- stubs for CMPR-01 (dedicated localStorage key, no leak)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual chip styling matches design | MAP-01 | CSS visual appearance | Inspect exclusion chips on map page at 375px and 1024px viewport |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
