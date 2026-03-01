#!/usr/bin/env python3
"""Check that D1 row counts for priority stores match local SQLite.

Compares local backfill SQLite counts against D1 for each priority store.
Exits nonzero if any store's D1 count is < MIN_COVERAGE_PCT of its local count,
making this suitable as a CI gate or periodic health check.

Usage:
    uv run python scripts/check_backfill_coverage.py
    uv run python scripts/check_backfill_coverage.py --stores mt-horeb,verona
    uv run python scripts/check_backfill_coverage.py --min-pct 80
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

BACKFILL_DB = DATA_DIR / "backfill" / "flavors.sqlite"
WAYBACK_DB = DATA_DIR / "backfill-wayback" / "flavors.sqlite"

# Priority stores that must have good D1 coverage.
PRIORITY_STORES = ["mt-horeb", "verona", "madison-todd-drive"]

# D1 count must be >= this fraction of local SQLite count to pass.
DEFAULT_MIN_COVERAGE_PCT = 90


def local_count(slug: str) -> int:
    """Count rows for a slug across both local SQLite databases."""
    total = 0
    for db_path in (BACKFILL_DB, WAYBACK_DB):
        if not db_path.exists():
            continue
        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute(
                "SELECT COUNT(*) FROM flavors WHERE store_slug = ?", (slug,)
            ).fetchone()
            total += row[0] if row else 0
        finally:
            conn.close()
    return total


def d1_query(sql: str) -> list[dict] | None:
    """Execute a SQL query against D1 via wrangler. Returns rows or None on error.

    Uses --command (not --file) for SELECT queries: wrangler --file returns
    execution stats in the results array, not row data, for SELECT statements.
    """
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote", "--command", sql, "--json",
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )

    if result.returncode != 0:
        if result.stderr:
            print(f"D1 query failed: {result.stderr.strip()}", file=sys.stderr)
        return None
    try:
        data = json.loads(result.stdout)
        for item in data:
            results = item.get("results")
            if results is not None:
                return results
        return []
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


def d1_count(slug: str) -> int | None:
    """Return the D1 snapshot count for a slug, or None on error."""
    rows = d1_query(
        f"SELECT COUNT(*) AS n FROM snapshots WHERE slug = '{slug.replace(chr(39), chr(39)*2)}';"
    )
    if rows is None:
        return None
    return int(rows[0].get("n", 0)) if rows else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check D1 vs local SQLite coverage for priority stores"
    )
    parser.add_argument(
        "--stores",
        metavar="SLUGS",
        default=",".join(PRIORITY_STORES),
        help=f"Comma-separated slugs to check (default: {','.join(PRIORITY_STORES)})",
    )
    parser.add_argument(
        "--min-pct",
        type=float,
        default=DEFAULT_MIN_COVERAGE_PCT,
        help=f"Minimum D1/local coverage percentage to pass (default: {DEFAULT_MIN_COVERAGE_PCT})",
    )
    args = parser.parse_args()

    # In GitHub Actions, coverage checks require explicit Cloudflare secrets.
    # Local runs can rely on existing Wrangler auth and should not be blocked.
    if os.getenv("GITHUB_ACTIONS") == "true":
        missing = []
        if not os.getenv("CLOUDFLARE_API_TOKEN"):
            missing.append("CLOUDFLARE_API_TOKEN")
        if not os.getenv("CLOUDFLARE_ACCOUNT_ID"):
            missing.append("CLOUDFLARE_ACCOUNT_ID")
        if missing:
            print(
                "ERROR: Missing required GitHub Actions secrets for D1 coverage check: "
                + ", ".join(missing)
            )
            print(
                "Set repository secrets and re-run Data Quality Gate; this is an infra/config failure, "
                "not a backfill coverage gap."
            )
            return 2

    slugs = [s.strip() for s in args.stores.split(",") if s.strip()]
    failures = []

    print(f"Checking D1 coverage for {len(slugs)} store(s) (min {args.min_pct:.0f}%)...")
    print()

    for slug in slugs:
        local = local_count(slug)
        d1 = d1_count(slug)

        if d1 is None:
            print(f"  ERROR  {slug}: D1 query failed")
            failures.append(slug)
            continue

        if local == 0:
            print(f"  SKIP   {slug}: no local rows (DB missing or store not in backfill)")
            continue

        pct = (d1 / local) * 100
        gap = local - d1
        status = "OK" if pct >= args.min_pct else "FAIL"

        print(f"  {status:<6} {slug}: D1={d1:,}  local={local:,}  coverage={pct:.1f}%"
              + (f"  gap={gap:,}" if gap > 0 else ""))

        if status == "FAIL":
            failures.append(slug)

    print()
    if failures:
        print(f"FAILED: {len(failures)} store(s) below coverage threshold: {', '.join(failures)}")
        print("Run: uv run python scripts/upload_backfill.py --stores " + ",".join(failures))
        return 1

    print(f"All {len(slugs)} store(s) passed coverage check.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
