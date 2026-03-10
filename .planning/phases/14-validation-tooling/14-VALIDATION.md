---
phase: 14
slug: validation-tooling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 14 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `worker/vitest.config.js` |
| **Quick run command** | `cd worker && npx vitest run --reporter=verbose palette-sync contrast-check golden-baselines` |
| **Full suite command** | `cd worker && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npx vitest run --reporter=verbose palette-sync contrast-check golden-baselines`
- **After every plan wave:** Run `cd worker && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | VALD-01 | unit | `cd worker && npx vitest run palette-sync.test.js -x` | W0 | pending |
| 14-01-02 | 01 | 0 | VALD-02 | unit | `cd worker && npx vitest run contrast-check.test.js -x` | W0 | pending |
| 14-01-03 | 01 | 0 | VALD-03 | unit | `cd worker && npx vitest run golden-baselines.test.js -x` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/palette-sync.test.js` -- stub for VALD-01
- [ ] `worker/test/contrast-check.test.js` -- stub for VALD-02
- [ ] `worker/test/golden-baselines.test.js` -- stub for VALD-03
- [ ] `worker/test/fixtures/goldens/` directory -- 160 baseline PNGs
- [ ] Install pixelmatch and pngjs: `cd worker && npm install --save-dev pixelmatch pngjs`
- [ ] Extract `renderToPixels()` to shared test utility

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
