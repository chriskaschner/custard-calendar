"""Tests for prediction models and evaluation framework."""

import numpy as np
import pandas as pd
import pytest

from analytics.data_loader import DEFAULT_DB, load_clean
from analytics.evaluate import compare_models, evaluate_model, time_split
from analytics.predict import FrequencyRecencyModel, MarkovRecencyModel

pytestmark = pytest.mark.skipif(
    not DEFAULT_DB.exists(), reason=f"Backfill database not found at {DEFAULT_DB}",
)

@pytest.fixture(scope="module")
def df():
    return load_clean()

@pytest.fixture(scope="module")
def train_test(df):
    return time_split(df, split_date="2026-01-01")

@pytest.fixture(scope="module")
def freq_model(train_test):
    train, _ = train_test
    return FrequencyRecencyModel().fit(train)

@pytest.fixture(scope="module")
def markov_model(train_test):
    train, _ = train_test
    return MarkovRecencyModel().fit(train)


class TestTimeSplit:
    def test_no_leakage(self, train_test):
        train, test = train_test
        assert train["flavor_date"].max() < pd.Timestamp("2026-01-01")
        assert test["flavor_date"].min() >= pd.Timestamp("2026-01-01")

    def test_both_non_empty(self, train_test):
        train, test = train_test
        assert len(train) > 1000 and len(test) > 100


class TestFrequencyRecencyModel:
    def test_predict_proba_sums_to_one(self, freq_model):
        assert abs(freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).sum() - 1.0) < 1e-10

    def test_predict_proba_non_negative(self, freq_model):
        assert (freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")) >= 0).all()

    def test_predict_proba_has_all_flavors(self, freq_model):
        assert len(freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15"))) == len(freq_model.all_flavors)

    def test_top_prediction_is_plausible(self, freq_model, df):
        top = freq_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).idxmax()
        assert top in df[df["store_slug"] == "mt-horeb"]["title"].unique()


class TestMarkovRecencyModel:
    def test_predict_proba_sums_to_one(self, markov_model):
        assert abs(markov_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")).sum() - 1.0) < 1e-10

    def test_predict_proba_non_negative(self, markov_model):
        assert (markov_model.predict_proba("mt-horeb", pd.Timestamp("2026-02-15")) >= 0).all()


class TestEvaluation:
    def test_evaluate_frequency_model(self, freq_model, train_test):
        _, test = train_test
        m = evaluate_model(freq_model, test, max_samples=100)
        assert 0 <= m["top_1_accuracy"] <= 1 and 0 <= m["top_5_recall"] <= 1
        assert m["mean_log_loss"] >= 0 and m["n_samples"] == 100

    def test_top_1_beats_random(self, freq_model, train_test):
        _, test = train_test
        assert evaluate_model(freq_model, test, max_samples=500)["top_1_accuracy"] >= 0.02

    def test_top_5_recall_reasonable(self, freq_model, train_test):
        _, test = train_test
        assert evaluate_model(freq_model, test, max_samples=500)["top_5_recall"] > 0.08

    def test_compare_models(self, freq_model, markov_model, train_test):
        _, test = train_test
        comp = compare_models({"freq": freq_model, "markov": markov_model}, test, max_samples=50)
        assert len(comp) == 2 and "top_1_accuracy" in comp.columns


# ---------------------------------------------------------------------------
# DoW and Seasonal bonus tests (synthetic data, no database required)
# ---------------------------------------------------------------------------

def _make_synthetic_df(store_slug: str, entries: list[tuple]) -> pd.DataFrame:
    """Build a minimal DataFrame matching the shape load_clean() produces.

    entries: list of (title, date_str) tuples.
    """
    rows = [{"store_slug": store_slug, "flavor_date": pd.Timestamp(d), "title": t}
            for t, d in entries]
    df = pd.DataFrame(rows)
    df["dow"] = df["flavor_date"].dt.dayofweek
    df["month"] = df["flavor_date"].dt.month
    df["year"] = df["flavor_date"].dt.year
    return df


class TestDowSeasonalBonuses:
    """Synthetic-data tests for DoW and seasonal bonus helpers.

    These do not require the backfill database.
    """

    def _build_saturday_model(self):
        """SaturdaySpecial appears only on Saturdays (5), other flavors are uniform."""
        entries = []
        # SaturdaySpecial: 6 Saturday appearances (>= MIN_BONUS_APPEARANCES)
        base = pd.Timestamp("2025-01-04")  # 2025-01-04 is a Saturday
        for i in range(6):
            entries.append(("SaturdaySpecial", str((base + pd.Timedelta(weeks=i)).date())))
        # OtherFlavor: 10 uniform appearances across all days of week
        for i in range(10):
            entries.append(("OtherFlavor", str((pd.Timestamp("2025-01-01") + pd.Timedelta(days=i)).date())))
        df = _make_synthetic_df("test-store", entries)
        model = FrequencyRecencyModel()
        model.fit(df)
        model.all_flavors = sorted(df["title"].unique())
        return model, df

    def test_dow_bonus_favors_peak_day(self):
        """SaturdaySpecial should score higher on Saturday than on a Monday."""
        model, df = self._build_saturday_model()
        historical = df[df["store_slug"] == "test-store"]

        saturday_dow = 5
        monday_dow = 0
        sat_bonuses = model._compute_dow_bonus(historical, saturday_dow)
        mon_bonuses = model._compute_dow_bonus(historical, monday_dow)

        sat_score = sat_bonuses.get("SaturdaySpecial", 0.0)
        mon_score = mon_bonuses.get("SaturdaySpecial", 0.0)
        assert sat_score > mon_score, (
            f"Expected SaturdaySpecial to score higher on Saturday ({sat_score}) "
            f"than Monday ({mon_score})"
        )

    def test_dow_bonus_insufficient_data(self):
        """A flavor with fewer than MIN_BONUS_APPEARANCES gets 0 DoW bonus."""
        # Only 4 appearances — below the threshold of 5
        entries = [("RareFlavor", f"2025-01-{i+1:02d}") for i in range(4)]
        df = _make_synthetic_df("test-store", entries)
        model = FrequencyRecencyModel()
        model.fit(df)

        historical = df[df["store_slug"] == "test-store"]
        bonuses = model._compute_dow_bonus(historical, 0)  # any dow
        assert bonuses.get("RareFlavor", 0.0) == 0.0

    def test_seasonal_bonus_favors_peak_month(self):
        """SummerFlavor concentrated in June/July should score higher for July than January."""
        entries = []
        # SummerFlavor: 6 appearances in June-July (summer peak)
        for day in range(1, 7):
            entries.append(("SummerFlavor", f"2025-07-{day:02d}"))
        # OtherFlavor: 10 appearances spread across all months
        for month in range(1, 11):
            entries.append(("OtherFlavor", f"2025-{month:02d}-15"))
        df = _make_synthetic_df("test-store", entries)
        model = FrequencyRecencyModel()
        model.fit(df)

        historical = df[df["store_slug"] == "test-store"]
        july_bonuses = model._compute_seasonal_bonus(historical, 7)   # July
        jan_bonuses = model._compute_seasonal_bonus(historical, 1)    # January

        july_score = july_bonuses.get("SummerFlavor", 0.0)
        jan_score = jan_bonuses.get("SummerFlavor", 0.0)
        assert july_score > jan_score, (
            f"Expected SummerFlavor to score higher in July ({july_score}) "
            f"than January ({jan_score})"
        )

    def test_weights_sum_to_one(self):
        """predict_proba() output must sum to 1.0 with DoW + seasonal bonuses active."""
        model, _ = self._build_saturday_model()
        # Predict for a Saturday in July (both DoW and seasonal bonuses may fire)
        proba = model.predict_proba("test-store", pd.Timestamp("2025-07-05"))
        assert abs(proba.sum() - 1.0) < 1e-10, f"Probabilities sum to {proba.sum()}, expected 1.0"
