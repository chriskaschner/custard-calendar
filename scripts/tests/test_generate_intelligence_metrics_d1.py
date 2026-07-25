"""Tests for the D1 snapshot loader in scripts/generate_intelligence_metrics.py.

The loader shells out to wrangler, so the subprocess boundary is mocked. What
these cover is the part that actually breaks: parsing wrangler's output (which
wraps the JSON payload in human-readable banners), pagination, and mapping the
D1 `snapshots` column names onto the backfill schema the rest of the generator
expects.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

pd = pytest.importorskip("pandas")

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.generate_intelligence_metrics import _d1_query, load_flavors_d1


def _wrangler_output(rows: list[dict]) -> str:
    """Mimic wrangler's stdout: banner text, then the JSON array."""
    return (
        "\n ⛅️ wrangler 4.0.0\n"
        "-------------------\n"
        "🌀 Executing on remote database custard-snapshots\n"
        + json.dumps([{"success": True, "results": rows}])
    )


def _row(slug: str, date: str, flavor: str) -> dict:
    return {
        "store_slug": slug,
        "flavor_date": date,
        "title": flavor,
        "description": "desc",
        "source": "d1",
        "fetched_at": "2026-07-25T00:00:00Z",
    }


# ---------------------------------------------------------------------------
# _d1_query
# ---------------------------------------------------------------------------

def test_d1_query_strips_wrangler_banner():
    rows = [_row("mt-horeb", "2026-07-25", "Turtle")]
    proc = SimpleNamespace(returncode=0, stdout=_wrangler_output(rows), stderr="")

    with patch("scripts.generate_intelligence_metrics.subprocess.run", return_value=proc):
        out = _d1_query("custard-snapshots", "SELECT 1")

    assert out == rows


def test_d1_query_raises_with_auth_hint_on_failure():
    proc = SimpleNamespace(returncode=1, stdout="", stderr="Failed to fetch auth token: 400")

    with patch("scripts.generate_intelligence_metrics.subprocess.run", return_value=proc):
        with pytest.raises(RuntimeError) as exc:
            _d1_query("custard-snapshots", "SELECT 1")

    assert "wrangler login" in str(exc.value)


def test_d1_query_raises_when_no_json_array():
    proc = SimpleNamespace(returncode=0, stdout="totally not json", stderr="")

    with patch("scripts.generate_intelligence_metrics.subprocess.run", return_value=proc):
        with pytest.raises(RuntimeError, match="No JSON array"):
            _d1_query("custard-snapshots", "SELECT 1")


# ---------------------------------------------------------------------------
# load_flavors_d1
# ---------------------------------------------------------------------------

def test_load_flavors_d1_maps_columns_and_labels_dataset():
    rows = [_row("mt-horeb", "2026-07-25", "Turtle")]

    with patch("scripts.generate_intelligence_metrics._d1_query", return_value=rows):
        df = load_flavors_d1("custard-snapshots", batch_size=10000)

    assert list(df["store_slug"]) == ["mt-horeb"]
    assert list(df["title"]) == ["Turtle"]
    assert set(df["dataset"]) == {"d1"}
    # flavor_date must be datetime so it concats cleanly with the sqlite frames
    assert pd.api.types.is_datetime64_any_dtype(df["flavor_date"])


def test_load_flavors_d1_paginates_until_short_batch():
    first = [_row(f"s{i}", "2026-07-01", "A") for i in range(2)]
    second = [_row("s2", "2026-07-02", "B")]  # short -> terminates

    with patch(
        "scripts.generate_intelligence_metrics._d1_query",
        side_effect=[first, second],
    ) as q:
        df = load_flavors_d1("custard-snapshots", batch_size=2)

    assert len(df) == 3
    assert q.call_count == 2
    assert "OFFSET 0" in q.call_args_list[0].args[1]
    assert "OFFSET 2" in q.call_args_list[1].args[1]


def test_load_flavors_d1_stops_on_empty_first_page():
    with patch("scripts.generate_intelligence_metrics._d1_query", return_value=[]) as q:
        df = load_flavors_d1("custard-snapshots", batch_size=100)

    assert df.empty
    assert list(df["dataset"]) == []
    assert q.call_count == 1


def test_load_flavors_d1_drops_rows_with_unusable_dates():
    rows = [
        _row("mt-horeb", "2026-07-25", "Turtle"),
        _row("verona", "not-a-date", "Ghost"),
    ]

    with patch("scripts.generate_intelligence_metrics._d1_query", return_value=rows):
        df = load_flavors_d1("custard-snapshots", batch_size=10000)

    assert list(df["store_slug"]) == ["mt-horeb"]
