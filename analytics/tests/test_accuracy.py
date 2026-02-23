"""Tests for analytics.accuracy -- forecast vs actual evaluation."""

import math

from analytics.accuracy import (
    evaluate_forecast_day,
    evaluate_store_forecasts,
    generate_accuracy_report,
    normalize_for_match,
)


# --- normalize_for_match ---

class TestNormalize:
    def test_lowercase_and_strip(self):
        assert normalize_for_match("  Turtle  ") == "turtle"

    def test_already_normalized(self):
        assert normalize_for_match("mint explosion") == "mint explosion"


# --- evaluate_forecast_day ---

class TestEvaluateForecastDay:
    PREDICTIONS = [
        {"flavor": "Turtle", "probability": 0.25},
        {"flavor": "Mint Explosion", "probability": 0.18},
        {"flavor": "Butter Pecan", "probability": 0.12},
        {"flavor": "Caramel Cashew", "probability": 0.10},
        {"flavor": "Chocolate Fudge", "probability": 0.08},
        {"flavor": "Vanilla", "probability": 0.05},
    ]

    def test_top_1_hit(self):
        result = evaluate_forecast_day(self.PREDICTIONS, "Turtle")
        assert result["top_1_hit"] is True
        assert result["top_5_hit"] is True
        assert result["rank"] == 1
        assert result["log_loss"] is not None
        assert abs(result["log_loss"] - (-math.log(0.25))) < 1e-10

    def test_top_5_hit(self):
        result = evaluate_forecast_day(self.PREDICTIONS, "Caramel Cashew")
        assert result["top_1_hit"] is False
        assert result["top_5_hit"] is True
        assert result["rank"] == 4

    def test_total_miss(self):
        result = evaluate_forecast_day(self.PREDICTIONS, "Pumpkin Pecan")
        assert result["top_1_hit"] is False
        assert result["top_5_hit"] is False
        assert result["rank"] is None
        assert result["log_loss"] is None

    def test_case_insensitive_match(self):
        result = evaluate_forecast_day(self.PREDICTIONS, "turtle")
        assert result["top_1_hit"] is True
        assert result["rank"] == 1

    def test_whitespace_insensitive_match(self):
        result = evaluate_forecast_day(self.PREDICTIONS, "  Turtle  ")
        assert result["top_1_hit"] is True


# --- evaluate_store_forecasts ---

class TestEvaluateStoreForecasts:
    def test_normal_aggregation(self):
        forecast = {
            "days": [
                {"date": "2026-02-20", "predictions": [
                    {"flavor": "Turtle", "probability": 0.3},
                    {"flavor": "Mint", "probability": 0.2},
                ]},
                {"date": "2026-02-21", "predictions": [
                    {"flavor": "Mint", "probability": 0.3},
                    {"flavor": "Turtle", "probability": 0.2},
                ]},
            ],
        }
        actuals = {
            "2026-02-20": "Turtle",
            "2026-02-21": "Butter Pecan",
        }
        result = evaluate_store_forecasts(forecast, actuals, window_days=365)
        assert result["n_samples"] == 2
        assert result["top_1_hit_rate"] == 0.5  # 1 of 2
        assert result["top_5_hit_rate"] == 0.5  # same 1 of 2
        assert result["avg_log_loss"] is not None

    def test_empty_actuals(self):
        forecast = {
            "days": [
                {"date": "2026-02-20", "predictions": [
                    {"flavor": "Turtle", "probability": 0.3},
                ]},
            ],
        }
        result = evaluate_store_forecasts(forecast, {}, window_days=365)
        assert result["n_samples"] == 0
        assert result["top_1_hit_rate"] == 0.0

    def test_single_day_format_fallback(self):
        forecast = {
            "target_date": "2026-02-20",
            "predictions": [
                {"flavor": "Turtle", "probability": 0.3},
            ],
        }
        actuals = {"2026-02-20": "Turtle"}
        result = evaluate_store_forecasts(forecast, actuals, window_days=365)
        assert result["n_samples"] == 1
        assert result["top_1_hit_rate"] == 1.0


# --- generate_accuracy_report ---

class TestGenerateReport:
    def test_output_format(self):
        results = {
            "mt-horeb": {
                "top_1_hit_rate": 0.25,
                "top_5_hit_rate": 0.60,
                "avg_log_loss": 2.345,
                "n_samples": 10,
            },
            "madison-todd-drive": {
                "top_1_hit_rate": 0.0,
                "top_5_hit_rate": 0.0,
                "avg_log_loss": None,
                "n_samples": 0,
            },
        }
        report = generate_accuracy_report(results)
        assert "mt-horeb" in report
        assert "madison-todd-drive" in report
        assert "25.0%" in report
        assert "60.0%" in report
        assert "2.345" in report
        # Zero-sample store shows dashes
        assert "--" in report
