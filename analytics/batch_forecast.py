"""Batch forecast generation — pre-compute predictions for all stores.

Usage:
    uv run python -m analytics.batch_forecast
    uv run python -m analytics.batch_forecast --store mt-horeb
    uv run python -m analytics.batch_forecast --output data/forecasts/latest.json
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from analytics.data_loader import load_clean, store_list
from analytics.forecast_writer import generate_forecast_json, generate_multiday_forecast_json
from analytics.predict import FrequencyRecencyModel


def generate_all_forecasts(
    df: pd.DataFrame,
    target_date: pd.Timestamp | None = None,
    stores: list[str] | None = None,
    n_predictions: int = 10,
    n_days: int = 7,
) -> dict:
    """Generate forecasts for all (or specified) stores.

    When n_days > 1, produces multi-day forecasts with confidence metadata.
    When n_days == 1, falls back to single-day format for backward compat.
    """
    if target_date is None:
        target_date = pd.Timestamp(datetime.now().date() + timedelta(days=1))

    if stores is None:
        stores = store_list(df)

    model = FrequencyRecencyModel().fit(df)

    forecasts = {}
    skipped = []
    for slug in stores:
        store_df = df[df["store_slug"] == slug]
        if len(store_df) < 10:
            skipped.append(slug)
            print(
                f"WARNING: skipping {slug} — only {len(store_df)} observations",
                file=sys.stderr,
            )
            continue
        if n_days > 1:
            forecast = generate_multiday_forecast_json(
                model, df, slug, target_date, n_days, n_predictions
            )
        else:
            forecast = generate_forecast_json(model, df, slug, target_date, n_predictions)
        forecasts[slug] = forecast

    if skipped:
        print(f"Skipped {len(skipped)} stores: {', '.join(skipped)}", file=sys.stderr)

    return {
        "generated_at": datetime.now().isoformat(),
        "target_date": str(target_date.date()),
        "n_days": n_days,
        "n_stores": len(forecasts),
        "model": "frequency_recency_v1",
        "forecasts": forecasts,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate batch flavor forecasts")
    parser.add_argument("--store", help="Generate for a single store slug")
    parser.add_argument("--date", help="Target date (YYYY-MM-DD), default=tomorrow")
    parser.add_argument("--output", default="data/forecasts/latest.json",
                        help="Output JSON path")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    parser.add_argument("--days", type=int, default=7,
                        help="Number of days to forecast (default=7)")
    args = parser.parse_args()

    print("Loading data...", file=sys.stderr)
    df = load_clean()
    print(f"Loaded {len(df)} observations across {df['store_slug'].nunique()} stores",
          file=sys.stderr)

    target_date = pd.Timestamp(args.date) if args.date else None
    stores = [args.store] if args.store else None

    print(f"Generating {args.days}-day forecasts...", file=sys.stderr)
    result = generate_all_forecasts(
        df, target_date=target_date, stores=stores, n_days=args.days
    )
    print(f"Generated {result['n_stores']} forecasts for {result['target_date']}",
          file=sys.stderr)

    if not result["forecasts"]:
        print("ERROR: no forecasts generated — check data and store list", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    indent = 2 if args.pretty else None
    output_path.write_text(json.dumps(result, indent=indent))
    print(f"Written to {output_path}", file=sys.stderr)

    if result["forecasts"]:
        sample_slug = next(iter(result["forecasts"]))
        sample = result["forecasts"][sample_slug]
        print(f"\n--- Sample: {sample_slug} ---", file=sys.stderr)
        if "days" in sample:
            print(f"{len(sample['days'])} days, {sample['history_depth']} observations",
                  file=sys.stderr)
            print(sample["days"][0]["prose"], file=sys.stderr)
        else:
            print(sample["prose"], file=sys.stderr)


if __name__ == "__main__":
    main()
