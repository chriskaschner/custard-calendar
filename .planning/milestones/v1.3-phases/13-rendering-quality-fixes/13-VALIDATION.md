---
phase: 13
slug: rendering-quality-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 13 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `worker/vitest.config.js` |
| **Quick run command** | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js` |
| **Full suite command** | `cd custard-calendar/worker && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js`
- **After every plan wave:** Run `cd custard-calendar/worker && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | RNDQ-03 | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "color sync"` | Wave 0 | pending |
| 13-01-02 | 01 | 1 | RNDQ-03 | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "color sync"` | Wave 0 | pending |
| 13-02-01 | 02 | 1 | RNDQ-01 | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "hero"` | Partial | pending |
| 13-02-02 | 02 | 1 | RNDQ-02 | integration | `node custard-calendar/scripts/generate-hero-cones.mjs && identify -verbose output/*.png` | No | pending |
| 13-02-03 | 02 | 2 | RNDQ-04 | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "HD"` | Partial | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/flavor-colors.test.js` -- add color-sync assertions comparing canonical exports against hardcoded values from cone-renderer.js, culvers_fotd.star, and flavor-audit.html (verifies RNDQ-03)
- [ ] Update golden hashes after geometry and color changes (`npm run bless:cones`)
- [ ] No new test file needed -- existing test file covers the right modules

*Existing infrastructure covers most phase requirements. Wave 0 adds color-sync assertions only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PNG visual crispness at 300 DPI | RNDQ-02 | Visual quality comparison requires human judgment | 1. Run `generate-hero-cones.mjs` 2. Compare old vs new PNGs side-by-side 3. Verify waffle cone pattern has no alternating-width artifacts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
