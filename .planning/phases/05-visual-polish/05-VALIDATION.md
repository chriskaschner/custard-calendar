---
phase: 5
slug: visual-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 5 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (via worker/node_modules) |
| **Config file** | worker/playwright.config.mjs |
| **Quick run command** | `cd worker && npx playwright test test/browser/vizp-*.spec.mjs --workers=1` |
| **Full suite command** | `uv run pytest tests/test_browser_clickthrough.py -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npx playwright test test/browser/vizp-*.spec.mjs --workers=1`
- **After every plan wave:** Run `uv run pytest tests/test_browser_clickthrough.py -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | VIZP-02 | browser | `npx playwright test test/browser/vizp-card-system.spec.mjs` | No -- W0 | pending |
| 05-01-02 | 01 | 1 | VIZP-02 | browser | `npx playwright test test/browser/vizp-card-system.spec.mjs` | No -- W0 | pending |
| 05-02-01 | 02 | 2 | VIZP-03 | browser | `npx playwright test test/browser/vizp-seasonal-rarity.spec.mjs` | No -- W0 | pending |
| 05-02-02 | 02 | 2 | VIZP-03 | browser | `npx playwright test test/browser/vizp-seasonal-rarity.spec.mjs` | No -- W0 | pending |
| 05-03-01 | 03 | 2 | VIZP-01, VIZP-04 | browser | `npx playwright test test/browser/vizp-cone-tiers.spec.mjs` | No -- W0 | pending |
| 05-03-02 | 03 | 2 | VIZP-04 | browser | `npx playwright test test/browser/vizp-cone-tiers.spec.mjs` | No -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `worker/test/browser/vizp-card-system.spec.mjs` -- stubs for VIZP-02
- [ ] `worker/test/browser/vizp-seasonal-rarity.spec.mjs` -- stubs for VIZP-03
- [ ] `worker/test/browser/vizp-cone-tiers.spec.mjs` -- stubs for VIZP-01, VIZP-04

*Existing infrastructure covers framework and config -- no install gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero cone PNG visual quality matches "detailed pixel art" aesthetic | VIZP-01 | Subjective visual quality assessment | Open Today page, compare hero cone rendering to existing compact SVG -- should be visually distinct and detailed |
| Map popup brand-colored left borders preserved | VIZP-02 | Visual verification of brand colors per chain | Open Map page, click store markers for Culver's (blue), Kopp's (black), Oscar's (red) -- brand borders visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
