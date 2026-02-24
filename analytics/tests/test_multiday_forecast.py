"""Tests for multi-day forecast generation."""

import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.forecast_writer import (
    generate_forecast_json,
    generate_multiday_forecast_json,
)
from analytics.predict import FrequencyRecencyModel

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)


@pytest.fixture(scope="module")
def df():
    return load_clean()


@pytest.fixture(scope="module")
def model(df):
    return FrequencyRecencyModel().fit(df)


class TestMultidayForecast:
    def test_generates_correct_number_of_days(self, model, df):
        result = generate_multiday_forecast_json(
            model, df, "mt-horeb", pd.Timestamp("2026-02-23"), n_days=7
        )
        assert len(result["days"]) == 7
        # Dates should be consecutive
        dates = [d["date"] for d in result["days"]]
        assert dates[0] == "2026-02-23"
        assert dates[6] == "2026-03-01"

    def test_certainty_tier(self, model, df):
        result = generate_multiday_forecast_json(
            model, df, "mt-horeb", pd.Timestamp("2026-02-23"), n_days=1
        )
        for pred in result["days"][0]["predictions"]:
            assert "certainty_tier" in pred
            assert pred["certainty_tier"] == "estimated"

    def test_history_depth_correct(self, model, df):
        result = generate_multiday_forecast_json(
            model, df, "mt-horeb", pd.Timestamp("2026-02-23"), n_days=1
        )
        expected = len(df[df["store_slug"] == "mt-horeb"])
        assert result["history_depth"] == expected

    def test_has_required_fields(self, model, df):
        result = generate_multiday_forecast_json(
            model, df, "mt-horeb", pd.Timestamp("2026-02-23"), n_days=3
        )
        assert "store_slug" in result
        assert "generated_at" in result
        assert "history_depth" in result
        assert "days" in result
        for day in result["days"]:
            assert "date" in day
            assert "predictions" in day
            assert "overdue_flavors" in day
            assert "prose" in day

    def test_backward_compat_single_day(self, model, df):
        """Existing generate_forecast_json still works unchanged."""
        result = generate_forecast_json(
            model, df, "mt-horeb", pd.Timestamp("2026-02-23"), n_predictions=5
        )
        assert "date" in result
        assert "predictions" in result
        assert "prose" in result
        assert len(result["predictions"]) <= 5
        # Single-day format should NOT have "days" key
        assert "days" not in result
        # Should NOT have certainty_tier (that's a multiday addition)
        for pred in result["predictions"]:
            assert "certainty_tier" not in pred
