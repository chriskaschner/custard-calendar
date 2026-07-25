#!/usr/bin/env python3
"""Check that trivia-metrics-seed.js is built from recent DATA.

The gate asserts on `data_max_date` -- the newest flavor date in the corpus the
seed was built from -- not on `generated_at`.

Why: `generated_at` measures when someone last ran the generator, which is not
the same thing as whether the data is current. The generator originally read
only the frozen `data/backfill*/` sqlite files, so re-running it stamped a fresh
`generated_at` over byte-identical February aggregates and reset the clock
without adding a single row. That is exactly what happened in Apr 2026: the gate
was "fixed" by regenerating, then failed again 97 days later with the same data.

`data_max_date` cannot be gamed that way -- it only advances when the underlying
corpus does, which now means pulling live rows from D1.

Seeds generated before this field existed have no `data_max_date`; those fail
with an explicit regenerate instruction rather than silently passing.

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
    data_max_date = extract_field(text, "data_max_date")

    if not data_max_date:
        print("FAIL: seed has no 'data_max_date' field.")
        print("It predates the D1-backed generator and its age cannot be verified.")
        print(REGENERATE_HINT)
        return 1

    try:
        data_dt = datetime.fromisoformat(data_max_date).replace(tzinfo=timezone.utc)
    except ValueError:
        print(f"ERROR: could not parse data_max_date: {data_max_date!r}")
        return 1

    now = datetime.now(timezone.utc)
    age_days = (now - data_dt).days

    generated_at = extract_field(text, "generated_at")
    print(f"Seed generated_at:  {generated_at}")
    print(f"Seed data_max_date: {data_max_date}")
    print(f"Data age: {age_days} days (max allowed: {args.max_days})")

    if age_days > args.max_days:
        print(f"FAIL: newest data row is {age_days} days old, exceeds {args.max_days}-day threshold.")
        print("Regenerating alone will NOT fix this -- the corpus itself must advance.")
        print(REGENERATE_HINT)
        return 1

    print(f"OK: data is within the {args.max_days}-day freshness window.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
