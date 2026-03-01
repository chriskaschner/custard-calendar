"""Tests for scripts/check_backfill_coverage.py.

Verifies that coverage gaps between local SQLite and D1 are detected and
result in a nonzero exit code, which is the gate that would have surfaced
the original mt-horeb Caramel Cashew undercounting issue.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.check_backfill_coverage import local_count, d1_query, d1_count, main


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _block_subprocess(monkeypatch):
    """Prevent accidental live D1 calls during unit tests."""
    monkeypatch.setattr(
        "subprocess.run",
        MagicMock(side_effect=RuntimeError("subprocess blocked in tests")),
    )


@pytest.fixture()
def local_db(tmp_path):
    """A minimal local SQLite DB with priority-store rows."""
    db_path = tmp_path / "flavors.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE flavors (store_slug TEXT, flavor_date TEXT, title TEXT, "
        "description TEXT, source TEXT, fetched_at TEXT)"
    )
    conn.executemany(
        "INSERT INTO flavors VALUES (?, ?, ?, ?, ?, ?)",
        [
            ("mt-horeb", f"2026-01-{i:02d}", "Turtle", "", "live", "2026-01-01T00:00:00Z")
            for i in range(1, 54)  # 53 rows -- the real mt-horeb count
        ],
    )
    conn.commit()
    conn.close()
    return db_path


# ---------------------------------------------------------------------------
# local_count
# ---------------------------------------------------------------------------

class TestLocalCount:
    def test_counts_rows_for_slug(self, tmp_path, monkeypatch):
        db = tmp_path / "flavors.sqlite"
        conn = sqlite3.connect(str(db))
        conn.execute("CREATE TABLE flavors (store_slug TEXT, flavor_date TEXT, title TEXT, "
                     "description TEXT, source TEXT, fetched_at TEXT)")
        conn.executemany("INSERT INTO flavors VALUES (?, ?, ?, ?, ?, ?)", [
            ("mt-horeb", "2026-01-01", "Turtle", "", "live", "2026-01-01"),
            ("mt-horeb", "2026-01-02", "Mint", "", "live", "2026-01-02"),
            ("verona",   "2026-01-01", "Caramel", "", "live", "2026-01-01"),
        ])
        conn.commit()
        conn.close()
        monkeypatch.setattr("scripts.check_backfill_coverage.BACKFILL_DB", db)
        monkeypatch.setattr("scripts.check_backfill_coverage.WAYBACK_DB", Path("/nonexistent"))
        assert local_count("mt-horeb") == 2
        assert local_count("verona") == 1

    def test_returns_zero_for_missing_db(self, tmp_path, monkeypatch):
        monkeypatch.setattr("scripts.check_backfill_coverage.BACKFILL_DB", Path("/nonexistent/a.sqlite"))
        monkeypatch.setattr("scripts.check_backfill_coverage.WAYBACK_DB", Path("/nonexistent/b.sqlite"))
        assert local_count("mt-horeb") == 0

    def test_sums_across_both_dbs(self, tmp_path, monkeypatch):
        def make_db(path, count):
            conn = sqlite3.connect(str(path))
            conn.execute("CREATE TABLE flavors (store_slug TEXT, flavor_date TEXT, title TEXT, "
                         "description TEXT, source TEXT, fetched_at TEXT)")
            for i in range(count):
                conn.execute("INSERT INTO flavors VALUES (?, ?, ?, ?, ?, ?)",
                             ("mt-horeb", f"2026-01-{i+1:02d}", "Turtle", "", "live", ""))
            conn.commit()
            conn.close()

        backfill = tmp_path / "backfill.sqlite"
        wayback = tmp_path / "wayback.sqlite"
        make_db(backfill, 10)
        make_db(wayback, 5)
        monkeypatch.setattr("scripts.check_backfill_coverage.BACKFILL_DB", backfill)
        monkeypatch.setattr("scripts.check_backfill_coverage.WAYBACK_DB", wayback)
        assert local_count("mt-horeb") == 15


# ---------------------------------------------------------------------------
# d1_query
# ---------------------------------------------------------------------------

class TestD1Query:
    def test_returns_none_on_subprocess_error(self, monkeypatch):
        mock = MagicMock()
        mock.returncode = 1
        mock.stderr = "D1 connection refused"
        monkeypatch.setattr("subprocess.run", MagicMock(return_value=mock))
        assert d1_query("SELECT 1") is None

    def test_returns_rows_on_success(self, monkeypatch):
        mock = MagicMock()
        mock.returncode = 0
        mock.stdout = '[{"results": [{"n": 53}]}]'
        monkeypatch.setattr("subprocess.run", MagicMock(return_value=mock))
        result = d1_query("SELECT COUNT(*) AS n FROM snapshots WHERE slug = 'mt-horeb'")
        assert result == [{"n": 53}]

    def test_returns_none_on_malformed_json(self, monkeypatch):
        mock = MagicMock()
        mock.returncode = 0
        mock.stdout = "not json at all"
        monkeypatch.setattr("subprocess.run", MagicMock(return_value=mock))
        assert d1_query("SELECT 1") is None


# ---------------------------------------------------------------------------
# main — gap detection
# ---------------------------------------------------------------------------

class TestMain:
    @pytest.fixture(autouse=True)
    def _clear_github_actions(self, monkeypatch):
        """Default test path is local-mode behavior, not CI-mode guardrails."""
        monkeypatch.delenv("GITHUB_ACTIONS", raising=False)

    def _make_env(self, local_rows, d1_rows, monkeypatch, tmp_path):
        """Wire local DB and mock D1 to return specific counts."""
        db = tmp_path / "flavors.sqlite"
        conn = sqlite3.connect(str(db))
        conn.execute("CREATE TABLE flavors (store_slug TEXT, flavor_date TEXT, title TEXT, "
                     "description TEXT, source TEXT, fetched_at TEXT)")
        for i in range(local_rows):
            conn.execute("INSERT INTO flavors VALUES (?, ?, ?, ?, ?, ?)",
                         ("mt-horeb", f"2020-01-{(i % 28) + 1:02d}", "Turtle", "", "live", ""))
        conn.commit()
        conn.close()
        monkeypatch.setattr("scripts.check_backfill_coverage.BACKFILL_DB", db)
        monkeypatch.setattr("scripts.check_backfill_coverage.WAYBACK_DB", Path("/nonexistent"))

        def fake_d1_count(slug):
            return d1_rows

        monkeypatch.setattr("scripts.check_backfill_coverage.d1_count", fake_d1_count)

    def test_passes_when_d1_matches_local(self, monkeypatch, tmp_path):
        """53 local rows, 53 D1 rows -> coverage 100% -> exit 0."""
        self._make_env(53, 53, monkeypatch, tmp_path)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb"])
        assert main() == 0

    def test_fails_when_d1_is_sparse(self, monkeypatch, tmp_path):
        """53 local rows, 10 D1 rows -> coverage 19% -> exit 1.

        This is the exact scenario that caused misleading rarity badges for
        mt-horeb Caramel Cashew (D1 showed 10 appearances, local had 53).
        """
        self._make_env(53, 10, monkeypatch, tmp_path)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb"])
        assert main() == 1

    def test_fails_when_d1_count_is_zero(self, monkeypatch, tmp_path):
        """Local rows present but D1 has none -> exit 1."""
        self._make_env(100, 0, monkeypatch, tmp_path)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb"])
        assert main() == 1

    def test_passes_at_custom_min_pct(self, monkeypatch, tmp_path):
        """50 local rows, 40 D1 rows = 80% coverage; passes at --min-pct 80."""
        self._make_env(50, 40, monkeypatch, tmp_path)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb", "--min-pct", "80"])
        assert main() == 0

    def test_fails_just_below_custom_min_pct(self, monkeypatch, tmp_path):
        """50 local rows, 39 D1 rows = 78% coverage; fails at --min-pct 80."""
        self._make_env(50, 39, monkeypatch, tmp_path)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb", "--min-pct", "80"])
        assert main() == 1

    def test_fails_when_d1_query_errors(self, monkeypatch, tmp_path):
        """D1 connectivity error should hard-fail the gate."""
        self._make_env(53, 53, monkeypatch, tmp_path)  # local is fine
        monkeypatch.setattr("scripts.check_backfill_coverage.d1_count", lambda slug: None)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb"])
        assert main() == 1

    def test_skips_store_with_no_local_data(self, monkeypatch, tmp_path):
        """A store with no local rows should be skipped, not failed."""
        monkeypatch.setattr("scripts.check_backfill_coverage.BACKFILL_DB", Path("/nonexistent"))
        monkeypatch.setattr("scripts.check_backfill_coverage.WAYBACK_DB", Path("/nonexistent"))
        monkeypatch.setattr("scripts.check_backfill_coverage.d1_count", lambda slug: 0)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb"])
        assert main() == 0  # no local data -> nothing to compare -> pass

    def test_fails_fast_in_github_actions_when_cloudflare_secrets_missing(self, monkeypatch, tmp_path):
        """In CI, missing Cloudflare secrets is an infra/config failure, not a coverage failure."""
        monkeypatch.setenv("GITHUB_ACTIONS", "true")
        monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
        monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
        monkeypatch.setattr("sys.argv", ["check", "--stores", "mt-horeb"])
        assert main() == 2
