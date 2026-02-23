"""Tests for scripts/upload_forecasts.py per-store and global validation guards."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Ensure project root is on sys.path
_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.upload_forecasts import main


def _make_valid_forecast():
    """Return a minimal valid forecast with 3 days and predictions."""
    return {
        "days": [
            {"date": f"2026-02-2{i}", "predictions": [{"flavor": "Turtle", "probability": 0.2}]}
            for i in range(3)
        ]
    }


def _make_forecast_file(tmp_path, forecasts, generated_at="2026-02-22T00:00:00Z"):
    """Write a forecast JSON file and return its path."""
    path = tmp_path / "latest.json"
    path.write_text(json.dumps({
        "generated_at": generated_at,
        "target_date": "2026-02-22",
        "forecasts": forecasts,
    }))
    return path


class TestPerStoreGuard:
    def test_fewer_than_3_days_skipped(self, tmp_path, monkeypatch):
        """Forecasts with < 3 days should be skipped."""
        forecasts = {
            "good-store": _make_valid_forecast(),
            "bad-store": {
                "days": [
                    {"date": "2026-02-20", "predictions": [{"flavor": "Turtle", "probability": 0.2}]},
                ]
            },
        }
        path = _make_forecast_file(tmp_path, forecasts)
        monkeypatch.setattr("sys.argv", ["upload", "--input", str(path), "--dry-run"])
        monkeypatch.setattr("subprocess.run", MagicMock(side_effect=RuntimeError("blocked")))

        result = main()
        assert result == 0  # good-store passes, dry-run succeeds

    def test_empty_predictions_skipped(self, tmp_path, monkeypatch):
        """Forecasts with days that have empty predictions should be skipped."""
        forecasts = {
            "good-store": _make_valid_forecast(),
            "empty-preds": {
                "days": [
                    {"date": "2026-02-20", "predictions": [{"flavor": "Turtle", "probability": 0.2}]},
                    {"date": "2026-02-21", "predictions": []},
                    {"date": "2026-02-22", "predictions": [{"flavor": "Mint", "probability": 0.1}]},
                ]
            },
        }
        path = _make_forecast_file(tmp_path, forecasts)
        monkeypatch.setattr("sys.argv", ["upload", "--input", str(path), "--dry-run"])
        monkeypatch.setattr("subprocess.run", MagicMock(side_effect=RuntimeError("blocked")))

        result = main()
        assert result == 0  # good-store passes


class TestGlobalGuard:
    def test_all_stores_invalid_exits_nonzero(self, tmp_path, monkeypatch):
        """When all stores fail validation, upload should exit non-zero."""
        forecasts = {
            "bad-a": {"days": [{"date": "2026-02-20", "predictions": [{"flavor": "X", "probability": 0.1}]}]},
            "bad-b": {"days": []},
            "bad-c": {
                "days": [
                    {"date": "2026-02-20", "predictions": []},
                    {"date": "2026-02-21", "predictions": []},
                    {"date": "2026-02-22", "predictions": []},
                ]
            },
        }
        path = _make_forecast_file(tmp_path, forecasts)
        monkeypatch.setattr("sys.argv", ["upload", "--input", str(path)])
        monkeypatch.setattr("subprocess.run", MagicMock(side_effect=RuntimeError("blocked")))

        result = main()
        assert result == 1
