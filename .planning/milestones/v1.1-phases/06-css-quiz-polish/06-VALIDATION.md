---
phase: 6
slug: css-quiz-polish
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-08
updated: 2026-03-09
---

# Phase 6 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing) |
| **Config file** | pyproject.toml (existing) |
| **Quick run command** | `cd /Users/chriskaschner/Documents/GitHub/custard/custard-calendar && uv run pytest tests/test_design_tokens.py -x` |
| **Full suite command** | `cd /Users/chriskaschner/Documents/GitHub/custard/custard-calendar && uv run pytest tests/ -v` |
| **Estimated runtime** | ~0.03 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest tests/test_design_tokens.py -x`
- **After every plan wave:** Run `uv run pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** <1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 06-01-T1 | 01 | 1 | TOKN-01, TOKN-02 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_token_count -x` | green |
| 06-01-T2 | 01 | 1 | TOKN-01, TOKN-02 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_colors tests/test_design_tokens.py::test_no_hardcoded_spacing -x` | green |
| 06-02-T1 | 02 | 2 | TOKN-03 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_inline_hardcoded_values -x` | green |
| 06-02-T2 | 02 | 2 | QUIZ-01 | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_quiz_mode_visual_differentiation -x` | green |

---

## Requirement-to-Test Coverage

| Requirement | Test Function | File | Status |
|-------------|---------------|------|--------|
| TOKN-01 | test_no_hardcoded_colors | tests/test_design_tokens.py | COVERED |
| TOKN-02 | test_no_hardcoded_spacing | tests/test_design_tokens.py | COVERED |
| TOKN-03 | test_no_inline_hardcoded_values | tests/test_design_tokens.py | COVERED |
| QUIZ-01 | test_quiz_mode_visual_differentiation | tests/test_design_tokens.py | COVERED |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each quiz mode shows distinct visual treatment | QUIZ-01 | Visual appearance requires human evaluation | Open quiz.html, cycle through Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility, Mad Libs modes. Verify each has a unique accent color on hero, submit button, and option highlight. |
| Token replacement preserves visual fidelity | TOKN-01, TOKN-02, TOKN-03 | Visual regression detection requires human eyes | Compare current page appearance against pre-token state. No visible change expected. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s (actual: <1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-03-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 4 requirements (TOKN-01, TOKN-02, TOKN-03, QUIZ-01) have automated test coverage via test_design_tokens.py. All 5 tests pass green.
