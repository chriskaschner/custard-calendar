---
phase: 12
slug: feature-development
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via @playwright/test) |
| **Config file** | `custard-calendar/worker/playwright.config.mjs` |
| **Quick run command** | `cd custard-calendar/worker && npx playwright test test/browser/{file} --workers=1` |
| **Full suite command** | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific test file for the feature being implemented
- **After every plan wave:** Run `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | MAP-01 | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/map-exclusion-filter.spec.mjs --workers=1` | Wave 0 | pending |
| 12-01-02 | 01 | 0 | MAP-02 | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/map-exclusion-persist.spec.mjs --workers=1` | Wave 0 | pending |
| 12-01-03 | 01 | 0 | QUIZ-01 | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/quiz-image-grid.spec.mjs --workers=1` | Wave 0 | pending |
| 12-01-04 | 01 | 0 | CMPR-01 | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/compare-localstorage-isolation.spec.mjs --workers=1` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `test/browser/map-exclusion-filter.spec.mjs` — stubs for MAP-01 (exclusion chips toggle, markers dim)
- [ ] `test/browser/map-exclusion-persist.spec.mjs` — stubs for MAP-02 (localStorage persistence across reload)
- [ ] `test/browser/quiz-image-grid.spec.mjs` — stubs for QUIZ-01 (image grid layout on mobile viewport)
- [ ] `test/browser/compare-localstorage-isolation.spec.mjs` — stubs for CMPR-01 (separate key, no Today leaking)

Test patterns should follow existing conventions from `compare-filter.spec.mjs` and `compare-picker.spec.mjs`:
- Mock all API routes (stores.json, flavors, today, geolocate, flavor-config, flavor-colors)
- Set localStorage via `page.evaluate()` before reload
- Use `page.locator()` with CSS selectors and data attributes
- Check computed styles for opacity/display changes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map chip visual styling matches design | MAP-01 | Visual design judgment | Open map page, verify chip colors and hover states look correct |
| Quiz image grid looks correct on real mobile | QUIZ-01 | Device-specific rendering | Open quiz on phone, verify 2x2 grid layout and image sizing |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
