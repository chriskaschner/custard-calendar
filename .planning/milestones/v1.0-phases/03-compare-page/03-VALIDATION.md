---
phase: 3
slug: compare-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 3 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via `npm run test:browser` in worker/) |
| **Config file** | `worker/playwright.config.mjs` |
| **Quick run command** | `cd custard-calendar/worker && npx playwright test test/browser/compare-*.spec.mjs --workers=1` |
| **Full suite command** | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx playwright test test/browser/compare-*.spec.mjs --workers=1`
- **After every plan wave:** Run `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | COMP-01,02,04,07 | integration | `npx playwright test test/browser/compare-grid.spec.mjs -x` | Wave 0 | pending |
| 03-01-02 | 01 | 0 | COMP-03 | integration | `npx playwright test test/browser/compare-expand.spec.mjs -x` | Wave 0 | pending |
| 03-01-03 | 01 | 0 | COMP-05,06 | integration | `npx playwright test test/browser/compare-filter.spec.mjs -x` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/compare-grid.spec.mjs` -- stubs for COMP-01, COMP-02, COMP-04, COMP-07
- [ ] `worker/test/browser/compare-expand.spec.mjs` -- stubs for COMP-03
- [ ] `worker/test/browser/compare-filter.spec.mjs` -- stubs for COMP-05, COMP-06
- No framework install needed -- Playwright already configured in `worker/playwright.config.mjs`
- Test pattern follows `today-hero.spec.mjs`: mock stores.json, mock API responses via `context.route()`, set localStorage, verify DOM state

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| COMP-08 compliance | COMP-08 | Verified by test mock setup -- only mock existing endpoints | Confirm test mocks only use `/api/v1/drive`, `/api/v1/flavors`, `/api/v1/today` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
