---
phase: 15
slug: palette-expansion-aliases
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 15 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `worker/vitest.config.js` |
| **Quick run command** | `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js test/contrast-check.test.js` |
| **Full suite command** | `cd custard-calendar/worker && npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js test/contrast-check.test.js -x`
- **After every plan wave:** Run `cd custard-calendar/worker && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | PROF-04 | unit | `cd custard-calendar/worker && npx vitest run test/alias-validation.test.js -x` | No -- W0 | pending |
| 15-01-02 | 01 | 1 | PROF-01 | unit | `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js -x` | Yes | pending |
| 15-01-03 | 01 | 1 | PROF-02 | unit | `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js test/contrast-check.test.js -x` | Yes | pending |
| 15-02-01 | 02 | 1 | PROF-04 | unit | `cd custard-calendar/worker && npx vitest run test/alias-validation.test.js -x` | No -- W0 | pending |
| 15-02-02 | 02 | 1 | PROF-04 | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -x` | Yes (needs new cases) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/alias-validation.test.js` -- stubs for PROF-04 (validates FLAVOR_ALIASES targets exist in FLAVOR_PROFILES)
- [ ] New test cases in `worker/test/flavor-colors.test.js` -- test getFlavorProfile alias resolution

*Existing infrastructure covers PROF-01 and PROF-02 (palette-sync.test.js + contrast-check.test.js).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New colors visually distinct | PROF-01, PROF-02 | Subjective visual judgment | Review hex values in flavor-audit.html color grid |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
