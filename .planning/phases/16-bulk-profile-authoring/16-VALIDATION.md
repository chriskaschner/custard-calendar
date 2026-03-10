---
phase: 16
slug: bulk-profile-authoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 16 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (latest, via worker/package.json) |
| **Config file** | `worker/vitest.config.js` |
| **Quick run command** | `cd custard-calendar/worker && npx vitest run contrast-check.test.js palette-sync.test.js golden-baselines.test.js -x` |
| **Full suite command** | `cd custard-calendar/worker && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar/worker && npx vitest run contrast-check.test.js palette-sync.test.js golden-baselines.test.js -x`
- **After every plan wave:** Run `cd custard-calendar/worker && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-XX | 01 | 1 | PROF-03 | unit | `npx vitest run contrast-check.test.js -x` | Yes | pending |
| 16-01-XX | 01 | 1 | PROF-03 | unit | `npx vitest run palette-sync.test.js -x` | Yes (colors only) | pending |
| 16-01-XX | 01 | 1 | PROF-03 | unit | `npx vitest run golden-baselines.test.js -x` | Yes | pending |
| 16-XX-XX | XX | X | PROF-03 | integration | `npx vitest run profile-sync.test.js -x` | No -- Wave 0 gap | pending |
| 16-XX-XX | XX | X | PROF-03 | manual | Open flavor-audit.html, verify zero unprofiled | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/profile-sync.test.js` -- validate SEED_PROFILES matches FLAVOR_PROFILES (optional -- manual review via flavor-audit.html is the established pattern)
- [ ] `worker/test/alias-sync.test.js` -- validate FALLBACK_FLAVOR_ALIASES matches FLAVOR_ALIASES and SEED_ALIASES (optional -- low priority)

*Note: These gaps are LOW priority. The established workflow (manual review via flavor-audit.html + existing color-sync CI) has worked for 3 phases. The planner may choose to skip these.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero unprofiled flavors in audit | PROF-03 | Visual review of HTML report | Open `docs/flavor-audit.html`, filter "no profile", verify count = 0 |
| SEED_PROFILES matches FLAVOR_PROFILES | PROF-03 | No CI test for this sync yet | Compare SEED_PROFILES in flavor-audit.html with FLAVOR_PROFILES in flavor-colors.js |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
