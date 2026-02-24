"""Tests for Tidbyt orchestration helpers in main.py."""

from datetime import datetime
from unittest.mock import patch

from main import cache_age_hours, cache_is_stale, step_tidbyt_render_push


def _cache_with_primary(flavors, timestamp="2026-02-24T00:00:00"):
    return {
        "timestamp": timestamp,
        "locations": {
            "mt-horeb": {
                "name": "Mt. Horeb",
                "role": "primary",
                "flavors": flavors,
            },
        },
    }


def test_cache_age_hours_returns_none_for_invalid_timestamp():
    cache_data = {"timestamp": "not-a-date"}
    assert cache_age_hours(cache_data) is None


def test_cache_age_hours_treats_naive_timestamp_as_local_time():
    now_local = datetime.now().replace(microsecond=0).isoformat()
    cache_data = {"timestamp": now_local}
    age = cache_age_hours(cache_data)
    assert age is not None
    assert age < 0.1


def test_cache_is_stale_when_timestamp_missing():
    cache_data = {"locations": {}}
    assert cache_is_stale(cache_data, 24) is True


@patch("main.subprocess.run")
def test_tidbyt_dry_run_renders_without_push(mock_run):
    cache_data = _cache_with_primary(
        [
            {"date": "2099-01-03", "name": "Third Flavor"},
            {"date": "2099-01-01", "name": "First Flavor"},
            {"date": "2099-01-02", "name": "Second Flavor"},
        ]
    )
    config = {
        "tidbyt": {
            "view_mode": "three_day",
            "brand": "culvers",
        },
    }

    ok = step_tidbyt_render_push(cache_data, config, dry_run=True)
    assert ok is True
    assert mock_run.call_count == 1

    render_cmd = mock_run.call_args[0][0]
    assert render_cmd[:2] == ["pixlet", "render"]
    # Ensure deterministic ordering by date even if cache flavor order is unsorted.
    assert "flavor_0=First Flavor" in render_cmd
    assert "flavor_date_0=2099-01-01" in render_cmd
    assert "flavor_1=Second Flavor" in render_cmd
    assert "flavor_date_1=2099-01-02" in render_cmd


@patch("main.subprocess.run")
def test_tidbyt_push_requires_device_id_when_not_dry_run(mock_run):
    cache_data = _cache_with_primary(
        [{"date": "2099-01-01", "name": "First Flavor"}]
    )
    config = {"tidbyt": {"view_mode": "single", "brand": "culvers"}}

    ok = step_tidbyt_render_push(cache_data, config, dry_run=False)
    assert ok is False
    mock_run.assert_not_called()
