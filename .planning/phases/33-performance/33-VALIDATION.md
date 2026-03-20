---
phase: 33
slug: performance
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-19
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via worker/test/browser/) |
| **Config file** | `worker/playwright.config.mjs` |
| **Quick run command** | `cd worker && npx playwright test test/browser/perf-cached-render.spec.mjs --workers=1` |
| **Full suite command** | `cd worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npx playwright test test/browser/perf-cached-render.spec.mjs --workers=1`
- **After every plan wave:** Run `cd worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green + Lighthouse LCP < 3000ms on deployed site
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | PERF-01a | browser/e2e | `cd worker && npx playwright test test/browser/perf-cached-render.spec.mjs --workers=1` | No -- Wave 0 | pending |
| 33-01-01 | 01 | 1 | PERF-01c | browser/e2e | `cd worker && npx playwright test test/browser/perf-cached-render.spec.mjs --workers=1` | No -- Wave 0 | pending |
| 33-01-02 | 01 | 1 | PERF-01a | browser/e2e | `cd worker && npx playwright test test/browser/perf-cached-render.spec.mjs --workers=1` | No -- Wave 0 | pending |
| 33-01-02 | 01 | 1 | PERF-01b | browser/e2e | `cd worker && npx playwright test test/browser/homepage-redesign.spec.mjs --workers=1` | Yes | pending |
| 33-01-02 | 01 | 1 | PERF-01d | manual | `lighthouse https://custard.chriskaschner.com/ --only-categories=performance --preset=perf` | No -- manual | pending |

*Status: pending -- all tests created in Task 1 (Wave 0), verified green in Task 2*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/perf-cached-render.spec.mjs` -- stubs for PERF-01a (cached hero render), PERF-01c (stale guard), first-visit baseline
- [ ] No new framework install needed -- Playwright already configured in `worker/playwright.config.mjs`

*Task 1 of plan 33-01 IS the Wave 0 task -- it creates all test files before implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LCP P90 under 3s on mobile throttling | PERF-01d | Lighthouse requires deployed site with simulated network throttling; local dev server results are not representative | Run `lighthouse https://custard.chriskaschner.com/ --only-categories=performance --preset=perf --throttling-method=simulate --output=json` and verify `audits['largest-contentful-paint'].numericValue < 3000` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
