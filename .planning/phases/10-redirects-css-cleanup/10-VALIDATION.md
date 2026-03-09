---
phase: 10
slug: redirects-css-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 10 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Python static analysis) + Playwright (browser) |
| **Config file** | `worker/playwright.config.mjs` (browser), `pyproject.toml` (pytest) |
| **Quick run command** | `cd custard-calendar && uv run pytest tests/test_redirects.py tests/test_design_tokens.py tests/test_sw_precache.py tests/test_sw_registration.py -x -v` |
| **Full suite command** | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |
| **Estimated runtime** | ~15 seconds (pytest), ~60 seconds (Playwright) |

---

## Sampling Rate

- **After every task commit:** Run `cd custard-calendar && uv run pytest tests/test_redirects.py tests/test_design_tokens.py tests/test_sw_precache.py tests/test_sw_registration.py -x -v`
- **After every plan wave:** Run `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds (pytest), 60 seconds (Playwright)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | RDIR-01 | static | `uv run pytest tests/test_redirects.py::TestRedirectStubs -x` | No -- W0 | pending |
| 10-01-02 | 01 | 0 | RDIR-02 | static | `uv run pytest tests/test_redirects.py::TestRedirectQueryParams -x` | No -- W0 | pending |
| 10-01-03 | 01 | 0 | RDIR-01 | static | `uv run pytest tests/test_redirects.py::TestRedirectStubMinimal -x` | No -- W0 | pending |
| 10-01-04 | 01 | 0 | RDIR-02 | static | `uv run pytest tests/test_redirects.py::TestRedirectHashFragments -x` | No -- W0 | pending |
| 10-02-01 | 02 | 0 | DSGN-01 | static | `uv run pytest tests/test_design_tokens.py::TestMadlibChipNoInlineStyles -x` | No -- W0 | pending |
| 10-02-02 | 02 | 0 | DSGN-01 | static | `uv run pytest tests/test_design_tokens.py::TestMadlibChipCSS -x` | No -- W0 | pending |
| 10-02-03 | 02 | 0 | DSGN-01 | static | `uv run pytest tests/test_design_tokens.py::TestMadlibChipGroupCSS -x` | No -- W0 | pending |
| 10-ALL-01 | ALL | 1 | ALL | static | `uv run pytest tests/test_sw_precache.py -x` | Yes (update) | pending |
| 10-ALL-02 | ALL | 1 | ALL | browser | `cd worker && npm run test:browser -- --workers=1` | Yes (update) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_redirects.py` -- stubs for RDIR-01, RDIR-02 (redirect destination correctness, query param preservation, hash fragment preservation, stub minimality)
- [ ] Additional test cases in `tests/test_design_tokens.py` -- stubs for DSGN-01 (madlib-chip CSS class existence, no inline styles in engine.js, madlib-chip-group class)
- [ ] Update `tests/test_sw_precache.py` -- bump expected version, verify calendar.html/widget.html not in STATIC_ASSETS
- [ ] Update `tests/test_sw_registration.py` -- remove calendar.html and widget.html from USER_FACING_PAGES

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual chip appearance matches design | DSGN-01 | Visual regression | Open quiz.html, play Mad Libs mode, verify chip styling matches existing brand-chip look |
| Redirect experience from old bookmark | RDIR-01 | UX verification | Navigate to /scoop.html?store=1234, verify smooth redirect to index.html?store=1234 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
