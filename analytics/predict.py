"""Prediction models: frequency+recency baseline, Markov+recency, XGBoost.

Each model takes historical data and produces a probability distribution over
all flavors for a given store on a given date.
"""

from datetime import timedelta

import numpy as np
import pandas as pd

from analytics.basic_metrics import flavor_probability
from analytics.markov import transition_matrix


# ---------------------------------------------------------------------------
# Base interface
# ---------------------------------------------------------------------------

class FlavorPredictor:
    """Base class for flavor prediction models."""

    def fit(self, df: pd.DataFrame) -> "FlavorPredictor":
        raise NotImplementedError

    def predict_proba(self, store_slug: str, date: pd.Timestamp) -> pd.Series:
        """Return probability distribution over all flavors.

        Returns Series indexed by flavor title, values sum to ~1.0.
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Model 1: Frequency + Recency baseline
# ---------------------------------------------------------------------------

class FrequencyRecencyModel(FlavorPredictor):
    """Predict from per-store frequency, penalized by recency.

    Recency is scored as "overdue ratio": days_since_last / expected_interval.
    Flavors past their typical interval get boosted; recently-served ones get suppressed.
    This avoids the failure mode where raw days-since amplifies rare flavors.

    Weight blend: freq=0.60, recency=0.20, dow=0.10, seasonal=0.10.
    DoW and seasonal bonuses require a minimum of 5 appearances per flavor to fire;
    below that threshold they contribute 0 so sparse-store predictions degrade
    gracefully to pure freq+recency.
    """

    # Minimum appearances required for a flavor to receive a DoW or seasonal bonus.
    MIN_BONUS_APPEARANCES = 5

    def __init__(self, frequency_weight: float = 0.6, recency_weight: float = 0.2,
                 dow_weight: float = 0.1, seasonal_weight: float = 0.1):
        self.frequency_weight = frequency_weight
        self.recency_weight = recency_weight
        self.dow_weight = dow_weight
        self.seasonal_weight = seasonal_weight
        self.df: pd.DataFrame | None = None
        self.all_flavors: list[str] = []

    def fit(self, df: pd.DataFrame) -> "FrequencyRecencyModel":
        self.df = df
        self.all_flavors = sorted(df["title"].unique())
        return self

    def _compute_dow_bonus(self, df_store: pd.DataFrame, target_dow: int) -> dict:
        """Return per-flavor DoW bonus scores (0..1), normalized to sum to 1.

        Only flavors with >= MIN_BONUS_APPEARANCES total appearances at this store
        are eligible; others get 0. target_dow is 0=Mon..6=Sun, matching
        pandas dt.dayofweek convention.
        """
        counts = df_store["title"].value_counts()
        eligible = counts[counts >= self.MIN_BONUS_APPEARANCES].index

        if len(eligible) == 0:
            return {}

        dow_counts = (
            df_store[df_store["title"].isin(eligible)]
            .groupby("title")["dow"]
            .apply(lambda s: (s == target_dow).sum())
        )

        total = dow_counts.sum()
        if total == 0:
            return {}

        normalized = dow_counts / total
        return normalized.to_dict()

    def _compute_seasonal_bonus(self, df_store: pd.DataFrame, target_month: int) -> dict:
        """Return per-flavor seasonal bonus scores (0..1), normalized to sum to 1.

        Uses a 3-month sliding window (target_month +/- 1, wrapping Dec->Jan),
        mirroring the detectSeasonal() logic in signals.js. Only flavors with
        >= MIN_BONUS_APPEARANCES total appearances are eligible.
        """
        counts = df_store["title"].value_counts()
        eligible = counts[counts >= self.MIN_BONUS_APPEARANCES].index

        if len(eligible) == 0:
            return {}

        # Build 3-month window with wrap-around
        months_in_window = {
            ((target_month - 2) % 12) + 1,
            ((target_month - 1) % 12) + 1,
            target_month,
        }

        seasonal_counts = (
            df_store[df_store["title"].isin(eligible)]
            .groupby("title")["month"]
            .apply(lambda s: s.isin(months_in_window).sum())
        )

        total = seasonal_counts.sum()
        if total == 0:
            return {}

        normalized = seasonal_counts / total
        return normalized.to_dict()

    def predict_proba(self, store_slug: str, date: pd.Timestamp) -> pd.Series:
        df = self.df
        date = pd.Timestamp(date)

        # Only use data before the target date
        historical = df[(df["store_slug"] == store_slug) & (df["flavor_date"] < date)]
        if len(historical) == 0:
            n = len(self.all_flavors)
            return pd.Series(1.0 / n, index=self.all_flavors)

        # Frequency component
        freq = historical["title"].value_counts()
        freq_probs = freq / freq.sum()
        freq_probs = freq_probs.reindex(self.all_flavors, fill_value=0.0)

        # Recency component: overdue ratio = days_since / expected_interval
        # Expected interval ≈ total_days / (appearances - 1), or fallback to median
        # Flavors never served at this store get 0 (not candidates)
        store_dates = historical["flavor_date"]
        total_span = (store_dates.max() - store_dates.min()).days
        if total_span <= 0:
            total_span = 1

        last_seen = historical.groupby("title")["flavor_date"].max()
        days_since = (date - last_seen).dt.days
        counts = historical["title"].value_counts()

        # Expected interval per flavor: span / (count - 1), clipped
        expected = total_span / counts.clip(lower=2).sub(1)
        expected = expected.clip(lower=7)  # minimum 7-day expected interval

        overdue_ratio = days_since / expected
        # Clip to [0, 3] — beyond 3x overdue is equally "overdue"
        overdue_ratio = overdue_ratio.clip(upper=3.0) / 3.0
        overdue_ratio = overdue_ratio.reindex(self.all_flavors, fill_value=0.0)

        # DoW bonus
        dow_bonus_dict = self._compute_dow_bonus(historical, date.dayofweek)
        dow_bonus = pd.Series(dow_bonus_dict, dtype=float).reindex(self.all_flavors, fill_value=0.0)

        # Seasonal bonus
        seasonal_bonus_dict = self._compute_seasonal_bonus(historical, date.month)
        seasonal_bonus = pd.Series(seasonal_bonus_dict, dtype=float).reindex(self.all_flavors, fill_value=0.0)

        # Combined score
        scores = (self.frequency_weight * freq_probs +
                  self.recency_weight * overdue_ratio +
                  self.dow_weight * dow_bonus +
                  self.seasonal_weight * seasonal_bonus)
        total = scores.sum()
        if total > 0:
            scores = scores / total
        return scores


# ---------------------------------------------------------------------------
# Model 2: Markov + Recency
# ---------------------------------------------------------------------------

class MarkovRecencyModel(FlavorPredictor):
    """Global transition matrix weighted by per-store recency gaps.

    Score = markov_weight * P(flavor | yesterday_flavor) + recency_weight * recency_score
    """

    def __init__(self, markov_weight: float = 0.6, recency_weight: float = 0.4):
        self.markov_weight = markov_weight
        self.recency_weight = recency_weight
        self.tm: pd.DataFrame | None = None
        self.df: pd.DataFrame | None = None
        self.all_flavors: list[str] = []

    def fit(self, df: pd.DataFrame) -> "MarkovRecencyModel":
        self.df = df
        self.all_flavors = sorted(df["title"].unique())
        self.tm = transition_matrix(df)
        return self

    def predict_proba(self, store_slug: str, date: pd.Timestamp) -> pd.Series:
        df = self.df
        date = pd.Timestamp(date)

        historical = df[(df["store_slug"] == store_slug) & (df["flavor_date"] < date)]

        # Find yesterday's flavor
        yesterday = date - timedelta(days=1)
        yesterday_row = historical[historical["flavor_date"] == yesterday]

        # Markov component
        if len(yesterday_row) > 0 and yesterday_row.iloc[0]["title"] in self.tm.index:
            yesterday_flavor = yesterday_row.iloc[0]["title"]
            markov_probs = self.tm.loc[yesterday_flavor].reindex(self.all_flavors, fill_value=0.0)
        else:
            # Fallback to global frequency
            markov_probs = flavor_probability(df).reindex(self.all_flavors, fill_value=0.0)

        # Recency component — overdue ratio (same approach as FrequencyRecencyModel)
        if len(historical) > 0:
            store_dates = historical["flavor_date"]
            total_span = max((store_dates.max() - store_dates.min()).days, 1)
            last_seen = historical.groupby("title")["flavor_date"].max()
            days_since = (date - last_seen).dt.days
            counts = historical["title"].value_counts()
            expected = (total_span / counts.clip(lower=2).sub(1)).clip(lower=7)
            recency_scores = (days_since / expected).clip(upper=3.0) / 3.0
            recency_scores = recency_scores.reindex(self.all_flavors, fill_value=0.0)
        else:
            recency_scores = pd.Series(0.0, index=self.all_flavors)

        scores = (self.markov_weight * markov_probs +
                  self.recency_weight * recency_scores)
        total = scores.sum()
        if total > 0:
            scores = scores / total
        return scores


# ---------------------------------------------------------------------------
# Model 3: XGBoost (feature-rich)
# ---------------------------------------------------------------------------

class XGBoostFlavorModel(FlavorPredictor):
    """XGBoost multi-class classifier with engineered features.

    Features per (store, date) pair:
    - days_since_last for each flavor (N features)
    - day_of_week (one-hot, 7 features)
    - month (one-hot, 12 features)
    """

    def __init__(self, n_estimators: int = 100, max_depth: int = 6):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.model = None
        self.all_flavors: list[str] = []
        self.flavor_to_idx: dict[str, int] = {}
        self.df: pd.DataFrame | None = None

    def _build_features(self, store_slug: str, date: pd.Timestamp,
                        historical: pd.DataFrame) -> np.ndarray:
        """Build feature vector for a single (store, date) prediction."""
        n_flavors = len(self.all_flavors)
        features = []

        # Days since last for each flavor
        if len(historical) > 0:
            last_seen = historical.groupby("title")["flavor_date"].max()
            for flavor in self.all_flavors:
                if flavor in last_seen.index:
                    days = (date - last_seen[flavor]).days
                else:
                    days = 999  # never seen
                features.append(days)
        else:
            features.extend([999] * n_flavors)

        # Day of week (one-hot)
        dow = [0] * 7
        dow[date.dayofweek] = 1
        features.extend(dow)

        # Month (one-hot)
        month = [0] * 12
        month[date.month - 1] = 1
        features.extend(month)

        return np.array(features, dtype=np.float32)

    def fit(self, df: pd.DataFrame) -> "XGBoostFlavorModel":
        from sklearn.ensemble import GradientBoostingClassifier

        self.df = df
        self.all_flavors = sorted(df["title"].unique())
        self.flavor_to_idx = {f: i for i, f in enumerate(self.all_flavors)}

        X_rows = []
        y_labels = []

        for store_slug, store_df in df.groupby("store_slug"):
            store_df = store_df.sort_values("flavor_date")
            dates = store_df["flavor_date"].values
            titles = store_df["title"].values

            for i in range(30, len(dates)):
                date = pd.Timestamp(dates[i])
                label = self.flavor_to_idx[titles[i]]
                historical = store_df[store_df["flavor_date"] < date]
                features = self._build_features(store_slug, date, historical)
                X_rows.append(features)
                y_labels.append(label)

        X = np.array(X_rows)
        y = np.array(y_labels)

        self.model = GradientBoostingClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            random_state=42,
            subsample=0.8,
        )
        self.model.fit(X, y)
        return self

    def predict_proba(self, store_slug: str, date: pd.Timestamp) -> pd.Series:
        date = pd.Timestamp(date)
        historical = self.df[
            (self.df["store_slug"] == store_slug) & (self.df["flavor_date"] < date)
        ]
        features = self._build_features(store_slug, date, historical).reshape(1, -1)
        proba = self.model.predict_proba(features)[0]

        result = pd.Series(0.0, index=self.all_flavors)
        for cls_idx, cls_label in enumerate(self.model.classes_):
            result.iloc[cls_label] = proba[cls_idx]

        return result
