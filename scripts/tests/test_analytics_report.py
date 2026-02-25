"""Tests for scripts/analytics_report.py."""

from __future__ import annotations

import sys
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pytest

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.analytics_report import (
    fetch_json,
    fmt_row,
    pct,
    report_events,
    report_quiz,
    write_baseline,
)


class TestPct:
    def test_zero_total_returns_na(self):
        assert pct(0, 0) == "n/a"

    def test_half(self):
        assert pct(1, 2) == "50.0%"

    def test_full(self):
        assert pct(10, 10) == "100.0%"

    def test_zero_count(self):
        assert pct(0, 100) == "0.0%"


class TestFmtRow:
    def test_basic_format(self):
        row = fmt_row("CTA clicks", 42)
        assert "CTA clicks:" in row
        assert "42" in row

    def test_label_padded(self):
        row = fmt_row("x", "y", width=10)
        assert row.startswith("  ")


class TestReportEvents:
    def _make_data(self, **overrides):
        base = {
            "window_days": 7,
            "totals": {
                "events": 100,
                "cta_clicks": 20,
                "popup_opens": 30,
                "signal_views": 10,
                "quiz_completions": 5,
                "onboarding_views": 15,
                "onboarding_clicks": 8,
            },
            "by_action": [{"action": "directions", "count": 15}],
            "by_page": [{"page": "map", "count": 40}],
            "top_stores": [{"store_slug": "mt-horeb", "count": 25}],
            "top_flavors": [{"flavor": "Turtle", "count": 18}],
        }
        base.update(overrides)
        return base

    def test_runs_without_error(self, capsys):
        report_events(self._make_data())
        out = capsys.readouterr().out
        assert "100" in out
        assert "CTA" in out

    def test_empty_totals_graceful(self, capsys):
        report_events({"window_days": 7, "totals": {}})
        out = capsys.readouterr().out
        assert "Events" in out

    def test_shows_cta_percentage(self, capsys):
        report_events(self._make_data())
        out = capsys.readouterr().out
        assert "20.0%" in out


class TestReportQuiz:
    def _make_data(self):
        return {
            "window_days": 7,
            "totals": {
                "completions": 50,
                "matched_in_radius": 30,
                "matched_outside_radius": 10,
                "no_match": 10,
                "trivia_correct": 8,
                "trivia_total": 10,
            },
            "top_archetypes": [{"archetype": "chocolate-devotee", "count": 12}],
            "top_quizzes": [{"quiz_id": "weather-v1", "count": 25}],
        }

    def test_runs_without_error(self, capsys):
        report_quiz(self._make_data())
        out = capsys.readouterr().out
        assert "50" in out
        assert "Quiz" in out

    def test_trivia_accuracy_shown(self, capsys):
        report_quiz(self._make_data())
        out = capsys.readouterr().out
        assert "8/10" in out

    def test_match_rate_shown(self, capsys):
        report_quiz(self._make_data())
        out = capsys.readouterr().out
        assert "60.0%" in out


class TestWriteBaseline:
    def test_writes_to_worklog(self, tmp_path):
        worklog = tmp_path / "WORKLOG.md"
        worklog.write_text("# Worklog\n\nExisting content.\n", encoding="utf-8")

        events_data = {
            "window_days": 7,
            "totals": {
                "events": 200,
                "cta_clicks": 40,
                "popup_opens": 60,
                "signal_views": 20,
                "quiz_completions": 10,
                "onboarding_views": 30,
                "onboarding_clicks": 15,
            },
        }
        quiz_data = {
            "totals": {"completions": 10, "matched_in_radius": 6},
        }

        import scripts.analytics_report as mod
        original_path = mod.WORKLOG_PATH
        mod.WORKLOG_PATH = worklog
        try:
            write_baseline(events_data, quiz_data, 7)
        finally:
            mod.WORKLOG_PATH = original_path

        content = worklog.read_text(encoding="utf-8")
        assert "Measurement Baseline" in content
        assert "200" in content
        assert "Existing content" in content

    def test_creates_worklog_if_missing(self, tmp_path):
        worklog = tmp_path / "WORKLOG.md"

        import scripts.analytics_report as mod
        original_path = mod.WORKLOG_PATH
        mod.WORKLOG_PATH = worklog
        try:
            write_baseline({"totals": {}}, {"totals": {}}, 7)
        finally:
            mod.WORKLOG_PATH = original_path

        assert worklog.exists()
        assert "Measurement Baseline" in worklog.read_text(encoding="utf-8")
