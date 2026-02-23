#!/usr/bin/env python3
"""CI coverage gate: verify snapshot coverage for all forecast slugs.

For each slug with a stored forecast in D1, checks that at least one
snapshot exists with:
  - date IN (today, yesterday)
  - fetched_at >= datetime('now', '-48 hours')

Exits non-zero if any forecast slug fails both checks.

Usage:
    uv run python scripts/check_forecast_coverage.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

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
        if isinstance(payload, list) and payload:
            return payload[0].get("results", [])
        return []
    except (json.JSONDecodeError, IndexError):
        return []


def main() -> int:
    # Get all forecast slugs
    forecast_rows = d1_query("SELECT DISTINCT slug FROM forecasts")
    if not forecast_rows:
        print("No forecast slugs found in D1.")
        return 0

    slugs = sorted(r["slug"] for r in forecast_rows)
    print(f"Checking snapshot coverage for {len(slugs)} forecast slug(s)...")

    # For each slug, check for recent snapshots
    failed = []
    for slug in slugs:
        sql = (
            f"SELECT COUNT(*) as cnt FROM snapshots "
            f"WHERE slug = '{slug}' "
            f"AND date IN (date('now'), date('now', '-1 day')) "
            f"AND fetched_at >= datetime('now', '-48 hours')"
        )
        rows = d1_query(sql)
        count = rows[0]["cnt"] if rows else 0

        if count > 0:
            print(f"  {slug}: OK ({count} recent snapshot(s))")
        else:
            print(f"  {slug}: MISSING -- no fresh snapshot in last 48h")
            failed.append(slug)

    if failed:
        print(f"\nFAILED: {len(failed)} slug(s) missing snapshot coverage:")
        for slug in failed:
            print(f"  - {slug}")
        return 1

    print(f"\nAll {len(slugs)} forecast slug(s) have recent snapshot coverage.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
