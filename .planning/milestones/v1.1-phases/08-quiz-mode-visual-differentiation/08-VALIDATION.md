---
phase: 8
slug: quiz-mode-visual-differentiation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
validated: 2026-03-09
---

# Phase 8 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing) |
| **Config file** | pyproject.toml (existing) |
| **Quick run command** | `cd custard-calendar && uv run pytest tests/test_design_tokens.py::test_quiz_mode_visual_differentiation -xvs` |
| **Full suite command** | `cd custard-calendar && uv run pytest tests/test_design_tokens.py -xvs` |
| **Estimated runtime** | ~0.01 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest tests/test_design_tokens.py::test_quiz_mode_visual_differentiation -xvs`
- **After every plan wave:** Run `uv run pytest tests/test_design_tokens.py -xvs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** <1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 01 | 1 | QUIZ-01 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_quiz_mode_visual_differentiation -xvs` | tests/test_design_tokens.py | green |
| 08-01-T2 | 01 | 1 | QUIZ-01 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py -xvs` | tests/test_design_tokens.py | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

- **QUIZ-01:** `test_quiz_mode_visual_differentiation` in `tests/test_design_tokens.py` performs static analysis verifying:
  - engine.js contains >= 2 occurrences of "data-quiz-mode" (init + variant change)
  - quiz.html contains >= 5 [data-quiz-mode] CSS selectors (7 actual)
  - quiz.html contains var(--quiz-tint) fallback
  - fun.html contains >= 6 border-left declarations with solid (7 actual)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual mode differentiation in browser | QUIZ-01 | CSS color rendering and "visually distinct" are subjective | Open quiz.html, switch between all 7 quiz modes. Verify each has distinct accent colors on hero, panel, submit button, and selected option. |
| Fun page quiz card accent borders | QUIZ-01 | Color-coded border visibility is visual | Open fun.html, verify 7 quiz cards have distinct colored left borders. |
| Mode persistence via URL parameter | QUIZ-01 | Requires browser JS execution | Navigate to quiz.html?mode=weather-v1, verify amber/gold styling on load. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 1s (actual: <0.01s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

QUIZ-01 has automated test coverage via `test_quiz_mode_visual_differentiation` in `tests/test_design_tokens.py`. Test verifies the complete wiring chain: engine.js data-quiz-mode attribute management, quiz.html per-mode CSS selectors, quiz.html fallback pattern, and fun.html per-mode card accents. Test passes green.
