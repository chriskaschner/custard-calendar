---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 1 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (browser smoke tests) + pytest |
| **Config file** | `worker/package.json` (npm run test:browser) |
| **Quick run command** | `cd /Users/chriskaschner/Documents/GitHub/custard/worker && npm run test:browser -- --workers=1` |
| **Full suite command** | `cd /Users/chriskaschner/Documents/GitHub/custard/worker && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd worker && npm run test:browser -- --workers=1`
- **After every plan wave:** Run `cd worker && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | STOR-01 | smoke (browser) | Playwright: load page with no localStorage, verify store indicator appears | Wave 0 | pending |
| 01-01-02 | 01 | 0 | STOR-02 | smoke (browser) | Playwright: verify confirmation prompt visible | Wave 0 | pending |
| 01-01-03 | 01 | 0 | STOR-03 | smoke (browser) | Playwright: verify `#shared-nav` contains store name element | Wave 0 | pending |
| 01-01-04 | 01 | 0 | STOR-04 | smoke (browser) | Playwright: click change button, verify picker visible | Wave 0 | pending |
| 01-01-05 | 01 | 0 | STOR-05 | smoke (browser) | Playwright: set store on index.html, navigate to calendar.html, verify same store | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_shared_nav.spec.js` or equivalent Playwright spec -- covers STOR-01 through STOR-05 browser behavior
- [ ] Verify existing Playwright config supports testing GitHub Pages files locally (may need a local HTTP server)
- [ ] Ensure ip-api.com calls can be mocked/stubbed in test environment

*Wave 0 creates test stubs before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser geolocation permission prompt | STOR-01 | Real permission prompts cannot be fully simulated in headless mode | 1. Open site in browser 2. Allow location permission 3. Verify nearest store appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
