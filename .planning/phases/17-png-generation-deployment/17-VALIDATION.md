---
phase: 17
slug: png-generation-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 17 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed via worker/devDependencies) |
| **Config file** | `worker/vitest.config.js` |
| **Quick run command** | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js` |
| **Full suite command** | `cd custard-calendar/worker && npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx vitest run png-asset-count.test.js`
- **After every plan wave:** Run `cd custard-calendar/worker && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | PNGS-01 | unit | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js -t "PNG asset count"` | No -- W0 | pending |
| 17-01-02 | 01 | 0 | PNGS-01 | unit | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js -t "alias resolution"` | No -- W0 | pending |
| 17-01-03 | 01 | 1 | PNGS-01 | regression | `cd custard-calendar/worker && npx vitest run golden-baselines.test.js` | Yes | pending |
| 17-01-04 | 01 | 1 | PNGS-02 | unit | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js -t "CACHE_VERSION"` | No -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/png-asset-count.test.js` -- stubs for PNGS-01 (file count, alias resolution) and PNGS-02 (cache version)
- [ ] No new framework install needed -- vitest already installed

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Today page shows consistent Hero PNG rendering | PNGS-01 | Visual rendering quality requires browser inspection | Open Today page, verify all profiled flavors show PNG cones (no SVG fallback mixing) |
| flavor-audit.html visual review | PNGS-01 | Aggregate visual quality check | Open flavor-audit.html, verify all 94 profiled flavors render correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
