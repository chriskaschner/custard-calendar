#!/usr/bin/env python3
"""Evaluate forecast accuracy against actual D1 snapshots.

Queries D1 for stored forecasts and snapshot history, computes hit-rate
metrics using ``analytics.accuracy``, and optionally uploads results back
to the ``accuracy_metrics`` table.

Usage:
    uv run python scripts/evaluate_forecasts.py                    # All WI stores
    uv run python scripts/evaluate_forecasts.py --store mt-horeb   # Single store
    uv run python scripts/evaluate_forecasts.py --upload           # Write to D1
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# Ensure project root is on sys.path when run as a script
_project_root = str(Path(__file__).resolve().parents[1])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from analytics.accuracy import (
    evaluate_store_forecasts,
    generate_accuracy_report,
)

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"


def d1_query(sql: str) -> list[dict]:
    """Execute a SQL query against remote D1 and return rows."""
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--json",
            "--command", sql,
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    if result.returncode != 0:
        print(f"D1 query failed: {result.stderr}", file=sys.stderr)
        return []
    try:
        payload = json.loads(result.stdout)
        # wrangler returns [{success, results}] for each statement
        if isinstance(payload, list) and payload:
            return payload[0].get("results", [])
        return []
    except (json.JSONDecodeError, IndexError):
        return []


def fetch_forecasts(store: str | None = None) -> dict[str, dict]:
    """Fetch forecast JSON from D1 forecasts table."""
    if store:
        sql = f"SELECT slug, data FROM forecasts WHERE slug = '{store}'"
    else:
        sql = "SELECT slug, data FROM forecasts"

    rows = d1_query(sql)
    result = {}
    for row in rows:
        slug = row["slug"]
        data = json.loads(row["data"]) if isinstance(row["data"], str) else row["data"]
        result[slug] = data
    return result


def fetch_snapshots(store: str | None = None, days: int = 30) -> dict[str, dict[str, str]]:
    """Fetch actual flavor snapshots from D1, keyed by slug then date."""
    if store:
        where = f"WHERE slug = '{store}' AND date >= date('now', '-{days} days') AND date <= date('now')"
    else:
        where = f"WHERE date >= date('now', '-{days} days') AND date <= date('now')"
    sql = (
        f"SELECT slug, date, flavor FROM snapshots {where} "
        f"ORDER BY date DESC"
    )
    rows = d1_query(sql)
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        slug = row["slug"]
        result.setdefault(slug, {})[row["date"]] = row["flavor"]
    return result


def sql_quote(value: str) -> str:
    """SQL-quote a string for inline VALUES clauses."""
    return "'" + value.replace("'", "''") + "'"


def upload_accuracy(results: dict[str, dict], window: str) -> bool:
    """Upload accuracy metrics to D1 accuracy_metrics table."""
    computed_at = datetime.utcnow().isoformat() + "Z"
    lines = []

    for slug, metrics in results.items():
        if metrics["n_samples"] == 0:
            continue
        ll = metrics["avg_log_loss"]
        ll_sql = f"{ll}" if ll is not None else "NULL"
        lines.append(
            "INSERT INTO accuracy_metrics (slug, window, top_1_hit_rate, top_5_hit_rate, avg_log_loss, n_samples, computed_at) "
            f"VALUES ({sql_quote(slug)}, {sql_quote(window)}, {metrics['top_1_hit_rate']}, "
            f"{metrics['top_5_hit_rate']}, {ll_sql}, {metrics['n_samples']}, {sql_quote(computed_at)}) "
            "ON CONFLICT(slug, window) DO UPDATE SET "
            "top_1_hit_rate = excluded.top_1_hit_rate, "
            "top_5_hit_rate = excluded.top_5_hit_rate, "
            "avg_log_loss = excluded.avg_log_loss, "
            "n_samples = excluded.n_samples, "
            "computed_at = excluded.computed_at;"
        )
    sql = "\n".join(lines) + "\n"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql)
        tmp_path = Path(tmp.name)

    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--file", str(tmp_path),
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    tmp_path.unlink(missing_ok=True)
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate forecast accuracy against D1 snapshots")
    parser.add_argument("--store", type=str, default=None,
                        help="Evaluate a single store slug")
    parser.add_argument("--window", type=int, default=30,
                        help="Window in days for evaluation (default: 30)")
    parser.add_argument("--upload", action="store_true",
                        help="Upload results to D1 accuracy_metrics table")
    args = parser.parse_args()

    print("Fetching forecasts from D1...")
    forecasts = fetch_forecasts(args.store)
    if not forecasts:
        print("No forecasts found in D1.", file=sys.stderr)
        return 1

    print(f"Found forecasts for {len(forecasts)} store(s)")

    print("Fetching snapshots from D1...")
    snapshots = fetch_snapshots(args.store, days=args.window)
    if not snapshots:
        print("No snapshots found in D1.", file=sys.stderr)
        return 1

    print(f"Found snapshots for {len(snapshots)} store(s)")

    # Evaluate each store
    results = {}
    for slug, forecast_data in forecasts.items():
        actuals = snapshots.get(slug, {})
        results[slug] = evaluate_store_forecasts(
            forecast_data, actuals, window_days=args.window,
        )

    # Print report
    print()
    report = generate_accuracy_report(results)
    print(report)

    # Warn about orphaned forecasts (no matching snapshot)
    for slug, metrics in sorted(results.items()):
        orphaned = metrics.get("n_orphaned", 0)
        if orphaned > 0:
            print(
                f"WARNING: {slug} has {orphaned} forecast date(s) with no snapshot match",
                file=sys.stderr,
            )

    # Upload if requested
    if args.upload:
        window_label = f"{args.window}d"
        print(f"\nUploading to D1 (window={window_label})...")
        if upload_accuracy(results, window_label):
            print("Upload successful.")
        else:
            print("Upload failed.", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
