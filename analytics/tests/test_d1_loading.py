"""Tests for loading the training corpus from D1 instead of the frozen sqlite.

The models must not see different filtering depending on where rows came from,
so the important property here is that both sources run through the same
cleaning path. The wrangler subprocess boundary is mocked -- the D1 query
mechanics themselves are covered by scripts/tests/test_generate_intelligence_metrics_d1.py.
"""

from __future__ import annotations

import warnings

import pandas as pd
import pytest

from analytics.data_loader import CLOSED_MARKERS, clean_frame, load_clean_d1


def _frame(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    df["flavor_date"] = pd.to_datetime(df["flavor_date"])
    return df


def _row(slug="mt-horeb", date=None, title="Turtle"):
    return {
        "store_slug": slug,
        "flavor_date": date or pd.Timestamp.now().strftime("%Y-%m-%d"),
        "title": title,
        "description": "",
        "source": "d1",
        "fetched_at": "2026-08-02T12:00:00Z",
    }


class TestCleanFrame:
    def test_adds_convenience_columns(self):
        out = clean_frame(_frame([_row(date="2026-08-03")]))  # a Monday
        assert out.loc[0, "dow"] == 0
        assert out.loc[0, "month"] == 8
        assert out.loc[0, "year"] == 2026

    def test_drops_closed_day_sentinels(self):
        marker = next(iter(CLOSED_MARKERS))
        out = clean_frame(_frame([_row(title="Turtle"), _row(title=marker)]))
        assert len(out) == 1
        assert out.loc[0, "title"] == "Turtle"

    def test_raises_on_missing_required_columns(self):
        df = pd.DataFrame({"store_slug": ["a"], "flavor_date": [pd.Timestamp.now()]})
        with pytest.raises(ValueError, match="missing required columns"):
            clean_frame(df, label="D1 snapshots")

    def test_label_appears_in_diagnostics(self):
        # A stale-corpus warning that says "Backfill DB" while reading D1 would
        # send someone to fix the wrong thing.
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            clean_frame(_frame([_row(date="2020-01-01")]), label="D1 snapshots")
        assert any("D1 snapshots may be stale" in str(w.message) for w in caught)

    def test_warns_on_empty_dataset(self):
        empty = pd.DataFrame(
            {"store_slug": [], "flavor_date": pd.Series([], dtype="datetime64[ns]"), "title": []}
        )
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            clean_frame(empty, label="D1 snapshots")
        assert any("is empty" in str(w.message) for w in caught)

    def test_fresh_data_warns_about_nothing(self):
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            clean_frame(_frame([_row()]), label="D1 snapshots")
        assert [str(w.message) for w in caught] == []


class TestLoadCleanD1:
    def test_cleans_rows_pulled_from_d1(self, monkeypatch):
        marker = next(iter(CLOSED_MARKERS))
        raw = _frame([_row(title="Turtle"), _row(title=marker), _row(title="Butter Pecan")])

        monkeypatch.setattr("analytics.d1_source.load_flavors_d1", lambda *a, **k: raw)
        out = load_clean_d1()

        assert sorted(out["title"]) == ["Butter Pecan", "Turtle"]
        assert {"dow", "month", "year"}.issubset(out.columns)

    def test_surfaces_auth_failures_to_the_caller(self, monkeypatch):
        # batch_forecast turns this into an actionable message rather than a
        # stack trace, so it must propagate rather than return an empty frame.
        def boom(*a, **k):
            raise RuntimeError("wrangler d1 execute failed (1)")

        monkeypatch.setattr("analytics.d1_source.load_flavors_d1", boom)
        with pytest.raises(RuntimeError, match="wrangler"):
            load_clean_d1()
