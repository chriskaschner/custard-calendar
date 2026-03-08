---
phase: 4
slug: supporting-pages-nav-activation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 4 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 |
| **Config file** | worker/playwright.config.mjs |
| **Quick run command** | `cd custard-calendar/worker && npx playwright test --config playwright.config.mjs test/browser/nav-clickthrough.spec.mjs` |
| **Full suite command** | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx playwright test --config playwright.config.mjs test/browser/nav-clickthrough.spec.mjs --workers=1`
- **After every plan wave:** Run `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | NAV-01, NAV-02 | browser/e2e | `npx playwright test test/browser/nav-clickthrough.spec.mjs` | Exists -- needs update | pending |
| 04-00-02 | 00 | 0 | NAV-03 | browser/e2e | `npx playwright test test/browser/nav-footer.spec.mjs` | Wave 0 | pending |
| 04-00-03 | 00 | 0 | NAV-04 | browser/e2e | `npx playwright test test/browser/nav-375px.spec.mjs` | Wave 0 | pending |
| 04-00-04 | 00 | 0 | FUN-01, FUN-02, FUN-04, FUN-05 | browser/e2e | `npx playwright test test/browser/fun-page.spec.mjs` | Wave 0 | pending |
| 04-00-05 | 00 | 0 | UPDT-01, UPDT-02, UPDT-03, UPDT-04 | browser/e2e | `npx playwright test test/browser/updates-page.spec.mjs` | Wave 0 | pending |
| 04-01-xx | 01 | 1 | NAV-01, NAV-02 | browser/e2e | `npx playwright test test/browser/nav-clickthrough.spec.mjs` | Exists -- needs update | pending |
| 04-02-xx | 02 | 1 | FUN-01, FUN-02, FUN-04, FUN-05 | browser/e2e | `npx playwright test test/browser/fun-page.spec.mjs` | Wave 0 | pending |
| 04-03-xx | 03 | 1 | UPDT-01, UPDT-02, UPDT-03, UPDT-04 | browser/e2e | `npx playwright test test/browser/updates-page.spec.mjs` | Wave 0 | pending |
| 04-04-xx | 04 | 2 | NAV-03, NAV-04, UPDT-05 | browser/e2e | `npx playwright test test/browser/nav-footer.spec.mjs test/browser/nav-375px.spec.mjs` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Update `test/browser/nav-clickthrough.spec.mjs` -- NAV_LINKS from 11 to 4, ALL_PAGES includes fun.html + updates.html
- [ ] `test/browser/fun-page.spec.mjs` -- stubs for FUN-01, FUN-02, FUN-04, FUN-05
- [ ] `test/browser/updates-page.spec.mjs` -- stubs for UPDT-01, UPDT-02, UPDT-03, UPDT-04
- [ ] `test/browser/nav-footer.spec.mjs` -- stubs for NAV-03 (footer has Get Updates link)
- [ ] `test/browser/nav-375px.spec.mjs` -- stubs for NAV-04 (no overflow at 375px viewport)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Quiz mode card images render correctly | FUN-01 | Visual design check | Open fun.html, verify each card has image, title, description |
| Mad Libs chip tap feedback | FUN-02 | Interaction feel | Tap each chip, verify visual feedback and selection state |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
