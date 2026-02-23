"""Tests for scripts/evaluate_forecasts.py -- script-level correctness."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure project root is on sys.path
_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.evaluate_forecasts import fetch_snapshots


class TestFetchSnapshotsQuery:
    def test_all_store_query_not_truncated(self):
        """D1 returning >200 rows should not be truncated by a LIMIT clause."""
        # Build 300 rows -- more than the old LIMIT days*200 would have allowed
        rows = [
            {"slug": f"store-{i}", "date": f"2026-02-{(i % 28) + 1:02d}", "flavor": "Turtle"}
            for i in range(300)
        ]

        def mock_d1_query(sql):
            # The query should NOT contain a LIMIT clause
            assert "LIMIT" not in sql, f"Query should be unbounded, but got: {sql}"
            # Verify date bounds are present
            assert "date <= date('now')" in sql
            assert "date >= date('now'" in sql
            return rows

        with patch("scripts.evaluate_forecasts.d1_query", side_effect=mock_d1_query):
            result = fetch_snapshots(store=None, days=30)

        # All 300 rows should be present (no truncation)
        total_rows = sum(len(dates) for dates in result.values())
        assert total_rows == 300
