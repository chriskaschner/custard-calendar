---
phase: 11
slug: monolith-refactoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via @playwright/test) |
| **Config file** | `worker/playwright.config.mjs` |
| **Quick run command** | `cd worker && npx playwright test --grep "API surface" --workers=1` |
| **Full suite command** | `cd worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm run test:browser -- --workers=1`
- **After every plan wave:** Run `cd worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | ARCH-01 | smoke | `cd worker && npx playwright test test/browser/api-surface.spec.mjs --workers=1` | Wave 0 | pending |
| 11-01-02 | 01 | 1 | ARCH-01, ARCH-02 | regression | `cd worker && npm run test:browser -- --workers=1` | Yes (31 files) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/api-surface.spec.mjs` — API surface completeness test for ARCH-01 (verifies all 60 exports exist on window.CustardPlanner)
- No framework install needed (Playwright already configured)
- No shared fixtures needed beyond what exists

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| N/A | N/A | N/A | N/A |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
