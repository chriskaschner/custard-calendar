#!/usr/bin/env python3
"""Upload batch forecasts to D1.

Reads the output of `analytics.batch_forecast` and writes each store's
forecast to Cloudflare D1 (`forecasts` table). Uses the Wrangler CLI
for remote D1 execution (no API token management needed -- wrangler handles auth).

Usage:
    uv run python scripts/upload_forecasts.py
    uv run python scripts/upload_forecasts.py --input data/forecasts/latest.json
    uv run python scripts/upload_forecasts.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

# D1 database name from worker/wrangler.toml
D1_DATABASE_NAME = "custard-snapshots"
DEFAULT_INPUT = Path("data/forecasts/latest.json")
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"


def sql_quote(value: str) -> str:
    """SQL-quote a string for inline VALUES clauses."""
    return "'" + value.replace("'", "''") + "'"


def build_batch_sql(rows: list[tuple[str, str, str]]) -> str:
    """Build transactional upsert SQL for a batch of forecast rows."""
    lines = ["BEGIN TRANSACTION;"]
    for slug, data_json, generated_at in rows:
        lines.append(
            "INSERT INTO forecasts (slug, data, generated_at, updated_at) "
            f"VALUES ({sql_quote(slug)}, {sql_quote(data_json)}, {sql_quote(generated_at)}, CURRENT_TIMESTAMP) "
            "ON CONFLICT(slug) DO UPDATE SET "
            "data = excluded.data, "
            "generated_at = excluded.generated_at, "
            "updated_at = CURRENT_TIMESTAMP;"
        )
    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def upload_batch_to_d1(rows: list[tuple[str, str, str]]) -> bool:
    """Upsert a batch of forecasts into D1 using a temporary SQL file."""
    sql = build_batch_sql(rows)
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
    parser = argparse.ArgumentParser(description="Upload forecasts to D1 forecasts table")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="Path to batch forecast JSON")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be uploaded without writing")
    parser.add_argument("--batch-size", type=int, default=200,
                        help="Rows per D1 execute batch (default: 200)")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Forecast file not found: {args.input}", file=sys.stderr)
        print("Run `uv run python -m analytics.batch_forecast` first.", file=sys.stderr)
        return 1

    data = json.loads(args.input.read_text())
    forecasts = data.get("forecasts", {})
    generated_at = data.get("generated_at") or data.get("target_date") or "unknown"
    print(f"Forecast file: {args.input}")
    print(f"Generated: {generated_at}")
    print(f"Target date: {data.get('target_date', '?')}")
    print(f"Stores: {len(forecasts)}")

    if args.dry_run:
        for slug in list(forecasts)[:5]:
            f = forecasts[slug]
            if "days" in f:
                n_days = len(f["days"])
                first_day = f["days"][0] if f["days"] else {}
                top = first_day.get("predictions", [{}])[0] if first_day.get("predictions") else {}
                print(f"  forecasts.{slug} -> {n_days} days, day 1 top: {top.get('flavor', '?')} ({top.get('probability', 0):.1%})")
            else:
                top = f["predictions"][0] if f.get("predictions") else {}
                print(f"  forecasts.{slug} -> top: {top.get('flavor', '?')} ({top.get('probability', 0):.1%})")
        if len(forecasts) > 5:
            print(f"  ... and {len(forecasts) - 5} more")
        return 0

    success = 0
    failures = 0
    rows = [
        (slug, json.dumps(forecast, separators=(",", ":")), generated_at)
        for slug, forecast in forecasts.items()
    ]

    for i in range(0, len(rows), args.batch_size):
        batch = rows[i:i + args.batch_size]
        if upload_batch_to_d1(batch):
            success += len(batch)
            print(f"  [{min(i + len(batch), len(rows))}/{len(rows)}] uploaded", flush=True)
        else:
            failures += len(batch)
            first_slug = batch[0][0] if batch else "unknown"
            print(f"  FAILED batch starting at slug={first_slug}", file=sys.stderr)

    print(f"\nDone: {success} uploaded, {failures} failed")
    return 1 if failures > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
