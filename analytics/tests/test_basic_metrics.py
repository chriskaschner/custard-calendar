"""Tests for data_loader and basic_metrics against the real backfill dataset."""

import math
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from analytics.data_loader import (
    CLOSED_MARKERS, DEFAULT_DB, flavor_list, load_clean, load_raw, store_list,
)
from analytics.basic_metrics import (
    days_since_last, flavor_frequency, flavor_probability, overdue_flavors,
    pielou_evenness, shannon_entropy, store_summary, surprise_score,
)

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)


@pytest.fixture(scope="module")
def raw_df():
    return load_raw()

@pytest.fixture(scope="module")
def df():
    return load_clean()


class TestDataLoader:
    def test_raw_has_expected_columns(self, raw_df):
        assert set(raw_df.columns) >= {"store_slug", "flavor_date", "title", "description", "source", "fetched_at"}

    def test_raw_row_count(self, raw_df):
        assert len(raw_df) > 30_000

    def test_clean_excludes_closed_days(self, df, raw_df):
        for marker in CLOSED_MARKERS:
            assert marker not in df["title"].values
        assert len(df) < len(raw_df)

    def test_clean_has_convenience_columns(self, df):
        assert "dow" in df.columns and "month" in df.columns and "year" in df.columns

    def test_dow_range(self, df):
        assert df["dow"].min() >= 0 and df["dow"].max() <= 6

    def test_flavor_list_returns_sorted(self, df):
        flavors = flavor_list(df)
        assert flavors == sorted(flavors) and len(flavors) > 30

    def test_store_list_includes_mt_horeb(self, df):
        assert "mt-horeb" in store_list(df)

    def test_date_range(self, df):
        assert df["flavor_date"].min().year == 2024 and df["flavor_date"].max().year >= 2026


class TestFrequency:
    def test_global_frequency_sums_to_total(self, df):
        assert flavor_frequency(df).sum() == len(df)

    def test_store_frequency_sums_to_store_total(self, df):
        assert flavor_frequency(df, "mt-horeb").sum() == len(df[df["store_slug"] == "mt-horeb"])

    def test_probability_sums_to_one(self, df):
        assert abs(flavor_probability(df).sum() - 1.0) < 1e-10

    def test_store_probability_sums_to_one(self, df):
        assert abs(flavor_probability(df, "mt-horeb").sum() - 1.0) < 1e-10


class TestRecency:
    def test_days_since_last_all_nonnegative(self, df):
        assert (days_since_last(df, "mt-horeb") >= 0).all()

    def test_days_since_last_has_entries(self, df):
        assert len(days_since_last(df, "mt-horeb")) > 20

    def test_overdue_flavors_has_expected_columns(self, df):
        overdue = overdue_flavors(df, "mt-horeb")
        if len(overdue) > 0:
            assert set(overdue.columns) >= {"title", "days_since", "avg_gap", "ratio"}
            assert (overdue["ratio"] >= 1.5).all()


class TestDiversity:
    def test_entropy_positive(self, df):
        assert shannon_entropy(df, "mt-horeb") > 0

    def test_entropy_bounded(self, df):
        n = df[df["store_slug"] == "mt-horeb"]["title"].nunique()
        assert shannon_entropy(df, "mt-horeb") <= np.log2(n) + 1e-10

    def test_evenness_bounded(self, df):
        j = pielou_evenness(df, "mt-horeb")
        assert 0 <= j <= 1.0

    def test_global_entropy_higher_than_store(self, df):
        assert shannon_entropy(df) >= shannon_entropy(df, "mt-horeb") - 0.5


class TestSurprise:
    def test_common_flavor_low_surprise(self, df):
        most_common = flavor_frequency(df, "mt-horeb").index[0]
        assert surprise_score(df, "mt-horeb", most_common) < 7.0

    def test_rare_flavor_high_surprise(self, df):
        freq = flavor_frequency(df, "mt-horeb")
        assert surprise_score(df, "mt-horeb", freq.index[-1]) > surprise_score(df, "mt-horeb", freq.index[0])

    def test_unseen_flavor_infinite(self, df):
        assert math.isinf(surprise_score(df, "mt-horeb", "Nonexistent Flavor XYZ"))


class TestStoreSummary:
    def test_summary_keys(self, df):
        s = store_summary(df, "mt-horeb")
        assert set(s.keys()) == {"store_slug", "unique_flavors", "total_days", "entropy", "evenness", "top_5_flavors", "overdue_count"}

    def test_summary_reasonable_values(self, df):
        s = store_summary(df, "mt-horeb")
        assert s["unique_flavors"] > 20 and s["total_days"] > 100
        assert s["entropy"] > 3.0 and 0 < s["evenness"] <= 1.0
        assert len(s["top_5_flavors"]) == 5
