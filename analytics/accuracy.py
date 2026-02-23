"""Forecast accuracy evaluation -- compare ML predictions against actual flavors.

Pure functions, no D1 dependency. Testable in isolation.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta


def normalize_for_match(flavor: str) -> str:
    """Lowercase and strip whitespace for fuzzy flavor matching."""
    return flavor.strip().lower()


def evaluate_forecast_day(
    predictions: list[dict],
    actual_flavor: str,
) -> dict:
    """Score a single day's forecast against the actual flavor.

    Args:
        predictions: Sorted desc by probability, each ``{flavor, probability}``.
        actual_flavor: The flavor that was actually served.

    Returns:
        ``{top_1_hit, top_5_hit, rank, log_loss}``
    """
    actual_norm = normalize_for_match(actual_flavor)
    rank = None

    for i, pred in enumerate(predictions):
        if normalize_for_match(pred["flavor"]) == actual_norm:
            rank = i + 1
            break

    top_1_hit = rank == 1
    top_5_hit = rank is not None and rank <= 5

    # Log loss: -log(p) for the actual flavor's predicted probability
    log_loss = None
    if rank is not None:
        p = predictions[rank - 1].get("probability", 0.0)
        p = max(p, 1e-15)
        log_loss = -math.log(p)

    return {
        "top_1_hit": top_1_hit,
        "top_5_hit": top_5_hit,
        "rank": rank,
        "log_loss": log_loss,
    }


def evaluate_store_forecasts(
    forecast_data: dict,
    actuals: dict[str, str],
    window_days: int = 30,
) -> dict:
    """Evaluate a store's multi-day forecast against actual snapshots.

    Args:
        forecast_data: The stored forecast JSON for one store.
            Expected shape: ``{days: [{date, predictions: [{flavor, probability}]}]}``.
        actuals: ``{date_str: actual_flavor}`` from D1 snapshots.
        window_days: Only evaluate days within this window from today.

    Returns:
        ``{top_1_hit_rate, top_5_hit_rate, avg_log_loss, n_samples, details}``
    """
    cutoff = (datetime.now() - timedelta(days=window_days)).strftime("%Y-%m-%d")
    details = []

    days = forecast_data.get("days", [])
    if not days:
        # Fall back to single-day format
        preds = forecast_data.get("predictions", [])
        date = forecast_data.get("target_date", "")
        if preds and date:
            days = [{"date": date, "predictions": preds}]

    for day in days:
        date = day.get("date", "")
        if date < cutoff:
            continue
        if date not in actuals:
            continue

        predictions = day.get("predictions", [])
        if not predictions:
            continue

        result = evaluate_forecast_day(predictions, actuals[date])
        result["date"] = date
        details.append(result)

    n = len(details)
    if n == 0:
        return {
            "top_1_hit_rate": 0.0,
            "top_5_hit_rate": 0.0,
            "avg_log_loss": None,
            "n_samples": 0,
            "details": [],
        }

    top_1_hits = sum(1 for d in details if d["top_1_hit"])
    top_5_hits = sum(1 for d in details if d["top_5_hit"])
    log_losses = [d["log_loss"] for d in details if d["log_loss"] is not None]

    return {
        "top_1_hit_rate": top_1_hits / n,
        "top_5_hit_rate": top_5_hits / n,
        "avg_log_loss": sum(log_losses) / len(log_losses) if log_losses else None,
        "n_samples": n,
        "details": details,
    }


def generate_accuracy_report(results: dict[str, dict]) -> str:
    """Format accuracy results as a human-readable table.

    Args:
        results: ``{slug: evaluate_store_forecasts() output}``

    Returns:
        Formatted string table.
    """
    lines = []
    header = f"{'Store':<30} {'Top-1':>7} {'Top-5':>7} {'LogLoss':>8} {'N':>5}"
    lines.append(header)
    lines.append("-" * len(header))

    for slug, metrics in sorted(results.items()):
        n = metrics["n_samples"]
        if n == 0:
            lines.append(f"{slug:<30} {'--':>7} {'--':>7} {'--':>8} {0:>5}")
            continue

        t1 = f"{metrics['top_1_hit_rate']:.1%}"
        t5 = f"{metrics['top_5_hit_rate']:.1%}"
        ll = f"{metrics['avg_log_loss']:.3f}" if metrics["avg_log_loss"] is not None else "--"
        lines.append(f"{slug:<30} {t1:>7} {t5:>7} {ll:>8} {n:>5}")

    return "\n".join(lines)
