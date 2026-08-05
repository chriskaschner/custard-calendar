"""Tests for scripts/check_brand_freshness.py.

The gate asserts on MAX(fetched_at) -- when we last successfully recorded
anything -- not MAX(date), which is how far ahead a brand's published schedule
runs and stays in the future long after the fetch has stopped working. See the
module docstring in check_brand_freshness.py.
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

from scripts.check_brand_freshness import BRAND_WATCH_SLUGS, main, parse_ts


# ---------------------------------------------------------------------------
# parse_ts
# ---------------------------------------------------------------------------

def test_parse_ts_handles_z_suffix():
    parsed = parse_ts("2026-08-04T21:51:03.607Z")
    assert parsed is not None
    assert parsed.tzinfo is not None
    assert parsed.date().isoformat() == "2026-08-04"


def test_parse_ts_handles_explicit_offset():
    parsed = parse_ts("2026-02-22T19:12:41.088079+00:00")
    assert parsed is not None
    assert parsed.date().isoformat() == "2026-02-22"


def test_parse_ts_assumes_utc_when_naive():
    parsed = parse_ts("2026-08-04T21:51:03")
    assert parsed is not None
    assert parsed.tzinfo is timezone.utc


@pytest.mark.parametrize("bad", ["", None, "not a timestamp"])
def test_parse_ts_rejects_garbage(bad):
    assert parse_ts(bad) is None


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def _rows(ages_by_slug: dict[str, int | None]) -> list[dict]:
    """Build D1-shaped rows, ages given in days before now."""
    now = datetime.now(timezone.utc)
    rows = []
    for slug, age in ages_by_slug.items():
        if age is None:
            continue  # slug absent from D1 entirely
        rows.append({"slug": slug, "last_fetch": (now - timedelta(days=age)).isoformat()})
    return rows


def _run(rows, argv):
    with patch("scripts.check_brand_freshness.execute_query_via_wrangler", return_value=rows):
        with patch.object(sys, "argv", ["check_brand_freshness.py", *argv]):
            return main()


def test_passes_when_all_brands_fetched_recently():
    rows = _rows({slug: 0 for slug in BRAND_WATCH_SLUGS})
    assert _run(rows, []) == 0


def test_fails_when_a_brand_has_gone_dark():
    # The Oscar's shape: bot-blocked upstream, last successful fetch months back.
    ages = {slug: 0 for slug in BRAND_WATCH_SLUGS}
    ages["oscars-new-berlin"] = 163
    assert _run(_rows(ages), []) == 1


def test_fails_when_a_brand_has_no_rows_at_all():
    ages = {slug: 0 for slug in BRAND_WATCH_SLUGS}
    ages["gilles"] = None
    assert _run(_rows(ages), []) == 1


def test_a_brand_publishing_far_ahead_is_still_judged_on_fetch_time():
    # Kraverz publishes four weeks out. A MAX(date) check would call this
    # healthy for another month; this gate must not.
    ages = {slug: 0 for slug in BRAND_WATCH_SLUGS}
    ages["kraverz"] = 30
    assert _run(_rows(ages), []) == 1


def test_threshold_is_configurable():
    ages = {slug: 0 for slug in BRAND_WATCH_SLUGS}
    ages["hefners"] = 6
    assert _run(_rows(ages), []) == 1
    assert _run(_rows(ages), ["--max-age-days", "7"]) == 0


def test_slugs_flag_narrows_the_check():
    # gilles is stale but excluded, so the run passes.
    rows = _rows({"gilles": 99, "kopps-glendale": 0})
    assert _run(rows, ["--slugs", "kopps-glendale"]) == 0


def test_returns_2_when_d1_is_unreachable():
    assert _run(None, []) == 2
