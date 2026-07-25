#!/usr/bin/env python3
"""Check that trivia-metrics-seed.js is built from recently COLLECTED data.

The gate asserts on `data_max_fetched_at` -- when a row in the corpus was last
actually fetched.

Why not `generated_at`: it measures when someone last ran the generator, not
whether the data is current. The generator originally read only the frozen
`data/backfill*/` sqlite files, so re-running it stamped a fresh `generated_at`
over byte-identical February aggregates and reset the clock without adding a
single row. That is what happened in Apr 2026: the gate was "fixed" by
regenerating, then failed again 97 days later on the same data.

Why not `data_max_date`: that is the newest *flavor* date, which is a schedule
horizon, not a freshness signal. Culver's publishes calendars roughly two months
ahead, so it is routinely a future date -- the first D1-backed run produced
2026-08-31, 37 days out. If collection stopped dead, that value would sit
unchanged and keep this gate green for months.

`data_max_fetched_at` only advances when something is actually collected.

Seeds predating this field fail with an explicit regenerate instruction rather
than silently passing.

Usage:
    uv run python scripts/check_metrics_seed_freshness.py
    uv run python scripts/check_metrics_seed_freshness.py --max-days 30
"""

from __future__ import annotations
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SEED_FILE = Path(__file__).resolve().parents[1] / "worker" / "src" / "trivia-metrics-seed.js"
DEFAULT_MAX_DAYS = 45
REGENERATE_HINT = (
    "Run: uv run python scripts/generate_intelligence_metrics.py\n"
    "(requires wrangler auth for the D1 pull -- `npx wrangler login` from worker/)"
)


def extract_field(text: str, field: str) -> str | None:
    m = re.search(rf'"{re.escape(field)}"\s*:\s*"([^"]+)"', text)
    return m.group(1) if m else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check trivia-metrics-seed.js data freshness")
    parser.add_argument("--max-days", type=int, default=DEFAULT_MAX_DAYS,
                        help=f"Maximum allowed data age in days (default: {DEFAULT_MAX_DAYS})")
    args = parser.parse_args(argv)

    if not SEED_FILE.exists():
        print(f"ERROR: seed file not found: {SEED_FILE}")
        return 1

    text = SEED_FILE.read_text()
    fetched_at = extract_field(text, "data_max_fetched_at")

    if not fetched_at:
        print("FAIL: seed has no 'data_max_fetched_at' field.")
        print("It predates the D1-backed generator and its age cannot be verified.")
        print(REGENERATE_HINT)
        return 1

    try:
        fetched_dt = datetime.fromisoformat(fetched_at).replace(tzinfo=timezone.utc)
    except ValueError:
        print(f"ERROR: could not parse data_max_fetched_at: {fetched_at!r}")
        return 1

    now = datetime.now(timezone.utc)
    age_days = (now - fetched_dt).days

    print(f"Seed generated_at:        {extract_field(text, 'generated_at')}")
    print(f"Seed data_max_fetched_at: {fetched_at}")
    print(f"Seed data_max_date:       {extract_field(text, 'data_max_date')} (schedule horizon, not checked)")
    print(f"Collection age: {age_days} days (max allowed: {args.max_days})")

    if age_days > args.max_days:
        print(f"FAIL: nothing has been collected for {age_days} days, exceeds {args.max_days}-day threshold.")
        print("Regenerating alone will NOT fix this -- ingestion itself must be running.")
        print(REGENERATE_HINT)
        return 1

    print(f"OK: collection is within the {args.max_days}-day freshness window.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
