"""Tests for scripts/check_metrics_seed_freshness.py.

The gate asserts on `data_max_fetched_at` (when rows were last collected), not
`generated_at` (when the generator last ran) and not `data_max_date` (how far
the published schedule runs, routinely a future date). See the module docstring
in check_metrics_seed_freshness.py for why.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.check_metrics_seed_freshness import extract_field, main, SEED_FILE


# ---------------------------------------------------------------------------
# Unit tests for extract_field
# ---------------------------------------------------------------------------

def test_extract_field_data_max_fetched_at():
    text = 'export const SEED = {\n  "data_max_fetched_at": "2026-07-20",\n};'
    assert extract_field(text, "data_max_fetched_at") == "2026-07-20"


def test_extract_field_generated_at():
    text = 'export const SEED = {\n  "generated_at": "2026-02-25T21:50:51.871824+00:00",\n};'
    assert extract_field(text, "generated_at") == "2026-02-25T21:50:51.871824+00:00"


def test_extract_field_missing():
    text = 'export const SEED = { "version": 1 };'
    assert extract_field(text, "data_max_date") is None


# ---------------------------------------------------------------------------
# Integration tests for main() using a temp seed file
# ---------------------------------------------------------------------------

def _make_seed_text(
    fetched: datetime,
    generated: datetime | None = None,
    max_date: datetime | None = None,
) -> str:
    """Build a seed stub. `max_date` defaults to the schedule horizon Culver's
    actually publishes -- roughly two months out from collection."""
    gen = (generated or datetime.now(timezone.utc)).isoformat()
    horizon = max_date or (fetched + timedelta(days=60))
    return (
        "export const TRIVIA_METRICS_SEED = {\n"
        f'  "generated_at": "{gen}",\n'
        f'  "data_max_fetched_at": "{fetched.strftime("%Y-%m-%d")}",\n'
        f'  "data_max_date": "{horizon.strftime("%Y-%m-%d")}",\n'
        '  "version": 1\n};\n'
    )


def test_fresh_collection_passes(tmp_path):
    """Collection 1 day ago should exit 0."""
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(now - timedelta(days=1)))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=[]) == 0


def test_stale_collection_fails(tmp_path):
    """Nothing collected for 50 days should exit 1."""
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(now - timedelta(days=50)))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=[]) == 1


def test_fresh_generated_at_cannot_mask_stale_data(tmp_path):
    """The regression this gate exists to catch.

    A seed regenerated *today* over a corpus whose newest row is 97 days old
    must still fail. Under the old generated_at-based gate this passed.
    """
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(
        _make_seed_text(now - timedelta(days=97), generated=now)
    )

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=[]) == 1


def test_future_schedule_horizon_cannot_mask_dead_ingestion(tmp_path):
    """The trap the first D1-backed run walked into.

    Culver's publishes calendars ~2 months ahead, so data_max_date is routinely
    a future date -- the first real run produced one 37 days out. If collection
    stops, that value sits unchanged and would keep a data_max_date-based gate
    green for months. Gating on collection time must still fail here.
    """
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(
        fetched=now - timedelta(days=90),      # ingestion dead for 3 months
        generated=now,                          # but regenerated today
        max_date=now + timedelta(days=37),      # and the schedule runs into the future
    ))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=[]) == 1


def test_missing_data_max_fetched_at_fails(tmp_path):
    """A pre-D1 seed with only generated_at cannot be verified, so it fails."""
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(
        'export const TRIVIA_METRICS_SEED = {\n'
        f'  "generated_at": "{datetime.now(timezone.utc).isoformat()}",\n'
        '  "version": 1\n};\n'
    )

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=[]) == 1


def test_missing_seed_file_fails(tmp_path):
    missing = tmp_path / "does-not-exist.js"

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", missing):
        assert main(argv=[]) == 1


def test_unparseable_data_max_fetched_at_fails(tmp_path):
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(
        'export const TRIVIA_METRICS_SEED = {\n'
        '  "data_max_fetched_at": "not-a-date",\n'
        '  "version": 1\n};\n'
    )

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=[]) == 1


def test_custom_max_days_passes(tmp_path):
    """--max-days 30: 20-day-old data should pass."""
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(now - timedelta(days=20)))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=["--max-days", "30"]) == 0


def test_custom_max_days_fails(tmp_path):
    """--max-days 30: 35-day-old data should fail."""
    now = datetime.now(timezone.utc)
    seed_file = tmp_path / "trivia-metrics-seed.js"
    seed_file.write_text(_make_seed_text(now - timedelta(days=35)))

    with patch("scripts.check_metrics_seed_freshness.SEED_FILE", seed_file):
        assert main(argv=["--max-days", "30"]) == 1


def test_real_seed_file_passes():
    """The committed trivia-metrics-seed.js should be built from recent data."""
    if not SEED_FILE.exists():
        pytest.skip("trivia-metrics-seed.js not present in this environment")
    exit_code = main(argv=[])
    assert exit_code == 0, (
        "Real seed is stale. Regenerate with a live D1 pull:\n"
        "  uv run python scripts/generate_intelligence_metrics.py\n"
        "(requires `npx wrangler login` from worker/)"
    )
