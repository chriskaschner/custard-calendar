#!/usr/bin/env python3
"""Check that every tracked brand has recorded flavor data recently.

Queries D1 for MAX(fetched_at) per watched slug and fails if any brand has
gone quiet for longer than the threshold.

Why MAX(fetched_at) and not MAX(date): the date column is how far ahead a
brand's published schedule runs, which says nothing about whether we can still
reach it. Oscar's kept a max date a month in the future for months after its
upstream started blocking us, and Kraverz routinely publishes four weeks out.
MAX(fetched_at) answers the question actually being asked -- when did we last
successfully record anything from this brand.

Why this runs in CI as well as in the Worker's daily operator alert: the Worker
alert cannot report its own cron failing, an unset RESEND_API_KEY, or a
Cloudflare outage. A watcher outside the system it watches is the whole point
(see the UptimeRobot heartbeat reasoning in CLAUDE.md).

This gate exists because Oscar's was bot-blocked from 2026-02-22 and Gille's
broke on a Wix migration around 2026-07-18, and nothing noticed either until a
user reported the map looked wrong in August.

Usage:
    uv run python scripts/check_brand_freshness.py
    uv run python scripts/check_brand_freshness.py --max-age-days 7
    uv run python scripts/check_brand_freshness.py --slugs gilles,hefners
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"

# One representative slug per non-Culver's brand. Mirrors the watchSlug entries
# in worker/src/brand-registry.js -- keep the two in step when adding a brand.
BRAND_WATCH_SLUGS = [
    "kopps-glendale",
    "gilles",
    "hefners",
    "kraverz",
    "oscars-new-berlin",
]

DEFAULT_MAX_AGE_DAYS = 4


def execute_query_via_wrangler(sql: str, attempts: int = 3, backoff: float = 5.0) -> list[dict] | None:
    """Execute a SELECT via wrangler d1 execute --remote --json.

    Retried because wrangler fails transiently -- observed exiting non-zero with
    an empty stderr. This gate pages a human when it fails, so a network blip
    must not look like a brand going dark; that is how a monitor teaches people
    to ignore it.
    """
    for attempt in range(1, attempts + 1):
        result = subprocess.run(
            [
                "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
                "--remote",
                "--command", sql,
                "--json",
            ],
            capture_output=True,
            text=True,
            cwd=WORKER_DIR,
        )

        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                for item in data:
                    results = item.get("results", [])
                    if results is not None:
                        return results
            except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
                print(f"could not parse wrangler output: {exc}", file=sys.stderr)
        else:
            detail = result.stderr.strip() or "(no stderr)"
            print(f"wrangler attempt {attempt}/{attempts} failed: {detail}", file=sys.stderr)

        if attempt < attempts:
            time.sleep(backoff * attempt)

    return None


def parse_ts(raw: str) -> datetime | None:
    """Parse a stored fetched_at value, which may or may not carry an offset."""
    if not raw:
        return None
    text = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slugs", help="Comma-separated slugs (default: all brand watch slugs)")
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    args = parser.parse_args()

    slugs = [s.strip() for s in args.slugs.split(",") if s.strip()] if args.slugs else BRAND_WATCH_SLUGS
    if not slugs:
        print("no slugs to check", file=sys.stderr)
        return 2

    quoted = ", ".join("'" + s.replace("'", "''") + "'" for s in slugs)
    rows = execute_query_via_wrangler(
        f"SELECT slug, MAX(fetched_at) AS last_fetch FROM snapshots "
        f"WHERE slug IN ({quoted}) GROUP BY slug"
    )
    if rows is None:
        print("FAIL: could not query D1", file=sys.stderr)
        return 2

    last_by_slug = {r["slug"]: r.get("last_fetch") for r in rows if r.get("slug")}
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=args.max_age_days)

    stale: list[str] = []
    for slug in slugs:
        raw = last_by_slug.get(slug)
        parsed = parse_ts(raw) if raw else None
        if parsed is None:
            print(f"  STALE  {slug:<20} last fetch: never")
            stale.append(slug)
            continue
        age = (now - parsed).days
        status = "STALE " if parsed < cutoff else "ok    "
        print(f"  {status} {slug:<20} last fetch: {parsed.date()} ({age}d ago)")
        if parsed < cutoff:
            stale.append(slug)

    if stale:
        print(
            f"\nFAIL: {len(stale)} brand(s) recorded nothing in "
            f"{args.max_age_days}+ days: {', '.join(stale)}",
            file=sys.stderr,
        )
        return 1

    print(f"\nOK: all {len(slugs)} brands fetched within {args.max_age_days} days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
