---
phase: 2
slug: today-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via worker/node_modules) |
| **Config file** | worker/playwright.config.mjs |
| **Quick run command** | `cd custard-calendar/worker && npx playwright test test/browser/today-hero.spec.mjs test/browser/today-multistore.spec.mjs test/browser/today-week-ahead.spec.mjs --workers=1` |
| **Full suite command** | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (3 test files)
- **After every plan wave:** Run `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green + `cd custard-calendar/worker && npm test` (574 worker tests)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | TDAY-01, TDAY-02, TDAY-05, TDAY-06, TDAY-07 | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs --workers=1` | No -- W0 | pending |
| 02-01-02 | 01 | 0 | TDAY-04 | browser/e2e | `npx playwright test test/browser/today-multistore.spec.mjs --workers=1` | No -- W0 | pending |
| 02-01-03 | 01 | 0 | TDAY-03 | browser/e2e | `npx playwright test test/browser/today-week-ahead.spec.mjs --workers=1` | No -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/today-hero.spec.mjs` -- stubs for TDAY-01, TDAY-02, TDAY-05, TDAY-06, TDAY-07
- [ ] `worker/test/browser/today-multistore.spec.mjs` -- stubs for TDAY-04
- [ ] `worker/test/browser/today-week-ahead.spec.mjs` -- stubs for TDAY-03
- [ ] Framework install: none needed -- Playwright already installed in worker/node_modules

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero card fits above fold at 375x667 | TDAY-01 | Visual layout measurement depends on browser chrome height | Open Chrome DevTools, set viewport to 375x667, verify hero card fully visible without scrolling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
