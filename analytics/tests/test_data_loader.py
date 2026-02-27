"""Tests for data_loader schema validation and freshness checks.

These tests use temporary SQLite databases — no backfill DB required.
"""

import sqlite3
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from analytics.data_loader import load_clean


def _create_db(tmpdir: str, columns: list[str], rows: list[tuple]) -> Path:
    """Create a minimal SQLite DB with a flavors table."""
    db_path = Path(tmpdir) / "test.sqlite"
    con = sqlite3.connect(str(db_path))
    col_defs = ", ".join(f"{c} TEXT" for c in columns)
    con.execute(f"CREATE TABLE flavors ({col_defs})")
    if rows:
        placeholders = ", ".join("?" for _ in columns)
        con.executemany(f"INSERT INTO flavors VALUES ({placeholders})", rows)
    con.commit()
    con.close()
    return db_path


def test_missing_column_raises_value_error():
    """DB without 'title' column should raise ValueError, not silently produce garbage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = _create_db(
            tmpdir,
            columns=["store_slug", "flavor_date", "description"],
            rows=[("mt-horeb", "2026-01-01", "A desc")],
        )
        with pytest.raises(ValueError, match="missing required columns"):
            load_clean(db_path)


def test_empty_db_warns():
    """Empty flavors table should emit a UserWarning, not raise or return silently."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = _create_db(
            tmpdir,
            columns=["store_slug", "flavor_date", "title", "description", "source", "fetched_at"],
            rows=[],
        )
        with pytest.warns(UserWarning, match="empty"):
            load_clean(db_path)


def test_freshness_warning_for_old_data():
    """Newest record more than 7 days old should emit a UserWarning about staleness."""
    old_date = (pd.Timestamp.now() - pd.Timedelta(days=30)).strftime("%Y-%m-%d")
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = _create_db(
            tmpdir,
            columns=["store_slug", "flavor_date", "title", "description", "source", "fetched_at"],
            rows=[("mt-horeb", old_date, "Butter Pecan", "", "", "")],
        )
        with pytest.warns(UserWarning, match="stale"):
            load_clean(db_path)
