#!/usr/bin/env python3
"""Audit D1 flavor data for 17 Madison-area Culver's stores.

Runs five cleanliness checks per D-02:
1. No closure sentinels in flavor text
2. No garbled/corrupted text
3. No missing days in coverage (expected gap analysis)
4. Flavor names resolve to FLAVOR_PROFILES or FLAVOR_ALIASES
5. Computed rarity labels match actual appearance frequency

Usage:
    uv run python scripts/audit_stores.py              # Full audit, all 17 stores
    uv run python scripts/audit_stores.py --store mt-horeb  # Single store
    uv run python scripts/audit_stores.py --check closures  # Single check type
    uv run python scripts/audit_stores.py --dry-run        # Quick count only
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"

# D-01: 17 Madison-area Culver's stores
AUDIT_SLUGS = [
    "madison-cottage-grove",
    "madison-east-towne",
    "madison-northport",
    "madison-todd-drive",
    "madison-wi-mineral-point-rd",
    "verona",
    "mt-horeb",
    "sauk-city",
    "sun-prairie",
    "sun-prairie-oxford-place",
    "middleton",
    "mcfarland",
    "cottage-grove-wi-landmark-dr",
    "cross-plains",
    "deforest",
    "waunakee",
    "oregon-park-st",
]

# D-02 check 1: Closure sentinels -- Python translation of JS regex
# JS: /\bclosed\b|^z[_ ]*(store|restaurant)?closed/i
CLOSED_TITLE_RE = re.compile(
    r"\bclosed\b|^z[_ ]*(store|restaurant)?closed", re.IGNORECASE
)

# D-02 check 2: Garbled/corrupted text
# JS: /[<>`{}]/
UNSAFE_TEXT_RE = re.compile(r"[<>`{}]")

# Valid check names for --check flag
CHECK_NAMES = {
    "closures": "Check 1: Closure sentinels",
    "corrupted": "Check 2: Corrupted text",
    "gaps": "Check 3: Coverage gaps",
    "unknown": "Check 4: Unknown flavors",
    "rarity": "Check 5: Rarity label verification",
}


def sql_quote(value: str) -> str:
    """SQL-quote a string value for inline queries."""
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def execute_query_via_wrangler(sql: str) -> list[dict] | None:
    """Execute a SELECT query via wrangler d1 execute --remote --json.

    Returns parsed result rows or None on error.
    Uses --command instead of --file to avoid wrangler's batch upload API
    which returns metadata instead of query results.
    """
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

    if result.returncode != 0:
        print(f"  wrangler error: {result.stderr.strip()}", file=sys.stderr)
        return None

    try:
        data = json.loads(result.stdout)
        # Wrangler JSON output: list of result sets, each has results list
        for item in data:
            results = item.get("results", [])
            if results is not None:
                return results
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        print(f"  JSON parse error: {exc}", file=sys.stderr)

    return None


def load_known_flavors() -> set[str]:
    """Load known flavor names from worker/src/flavor-colors.js.

    Reads FLAVOR_PROFILES keys and FLAVOR_ALIASES keys to build
    the complete set of recognized flavor names.
    """
    flavor_colors_path = WORKER_DIR / "src" / "flavor-colors.js"
    content = flavor_colors_path.read_text()

    known = set()

    # Extract FLAVOR_PROFILES keys: 'key name': { ... }
    # Match single-quoted keys followed by colon and opening brace
    profiles = re.findall(r"'([^']+)':\s*\{", content)
    # Filter to only keys within the FLAVOR_PROFILES block
    in_profiles = False
    for line in content.split("\n"):
        if "export const FLAVOR_PROFILES" in line:
            in_profiles = True
            continue
        if in_profiles and line.strip().startswith("};"):
            in_profiles = False
            break
        if in_profiles:
            match = re.search(r"['\"]([^'\"]+)['\"]:\s*\{", line)
            if match:
                known.add(match.group(1).lower())

    # Extract FLAVOR_ALIASES keys: 'key name': 'canonical name'
    in_aliases = False
    for line in content.split("\n"):
        if "export const FLAVOR_ALIASES" in line:
            in_aliases = True
            continue
        if in_aliases and line.strip().startswith("};"):
            in_aliases = False
            break
        if in_aliases:
            match = re.search(r"['\"]([^'\"]+)['\"]:\s*['\"]", line)
            if match:
                known.add(match.group(1).lower())

    return known


def normalize_flavor_key(name: str) -> str:
    """Normalize a flavor name for catalog lookup.

    Mirrors normalizeFlavorKey() in worker/src/flavor-colors.js:
    lowercase, strip TM/R symbols, normalize curly quotes, collapse whitespace.
    """
    if not name:
        return ""
    s = name.lower()
    s = re.sub(r"[\u00ae\u2122]", "", s)
    s = re.sub(r"[\u2018\u2019]", "'", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def check_closures(rows: list[dict]) -> list[dict]:
    """Check 1: Find rows with closure sentinel in flavor text."""
    bad = []
    for row in rows:
        flavor = row.get("flavor", "")
        if CLOSED_TITLE_RE.search(flavor):
            bad.append({
                "id": row["id"],
                "slug": row["slug"],
                "date": row["date"],
                "flavor": flavor,
                "reason": "closure_sentinel",
            })
    return bad


def check_corrupted(rows: list[dict]) -> list[dict]:
    """Check 2: Find rows with garbled/corrupted text."""
    bad = []
    for row in rows:
        flavor = row.get("flavor", "")
        desc = row.get("description", "") or ""
        if UNSAFE_TEXT_RE.search(flavor) or UNSAFE_TEXT_RE.search(desc):
            bad.append({
                "id": row["id"],
                "slug": row["slug"],
                "date": row["date"],
                "flavor": flavor,
                "reason": "corrupted_text",
            })
    return bad


def check_coverage_gaps(rows: list[dict]) -> dict[str, list[str]]:
    """Check 3: Find coverage gaps (missing days) per store.

    Returns dict of slug -> list of gap descriptions (start_date to end_date, N days).
    """
    # Group rows by slug
    by_store: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        by_store[row["slug"]].append(row["date"])

    gaps: dict[str, list[str]] = {}
    for slug, dates in sorted(by_store.items()):
        sorted_dates = sorted(set(dates))
        store_gaps = []
        for i in range(1, len(sorted_dates)):
            d1 = datetime.strptime(sorted_dates[i - 1], "%Y-%m-%d")
            d2 = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            delta = (d2 - d1).days
            # Gaps > 7 days are noteworthy (weekends and holidays cause 1-2 day gaps)
            if delta > 7:
                store_gaps.append(
                    f"  {sorted_dates[i-1]} to {sorted_dates[i]} ({delta} days)"
                )
        if store_gaps:
            gaps[slug] = store_gaps

    return gaps


def check_unknown_flavors(rows: list[dict], known: set[str]) -> dict[str, set[str]]:
    """Check 4: Find flavors not in FLAVOR_PROFILES or FLAVOR_ALIASES.

    Returns dict of slug -> set of unknown flavor names.
    """
    unknown: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        flavor = row.get("flavor", "")
        key = normalize_flavor_key(flavor)
        if key and key not in known:
            unknown[row["slug"]].add(flavor)
    return dict(unknown)


def check_rarity_labels(rows: list[dict]) -> list[dict]:
    """Check 5: Independently compute rarity and verify against 3-gate logic.

    Computes avg_gap_days from dates for each flavor at each store.
    Applies the 3-gate logic:
        Gate 1: appearances >= 10 AND span >= 90 days
        Gate 2: (network gate skipped in offline audit -- would need cross-store query)
        Gate 3: avgGapDays > 150 = 'Ultra Rare', > 90 = 'Rare', else null

    Returns list of flavor/store combos that would be labeled Rare or Ultra Rare.
    """
    # Group by (slug, normalized_flavor) -> sorted dates
    by_flavor: dict[tuple[str, str], list[str]] = defaultdict(list)
    for row in rows:
        nf = row.get("normalized_flavor", "") or normalize_flavor_key(row.get("flavor", ""))
        key = (row["slug"], nf)
        by_flavor[key].append(row["date"])

    results = []
    for (slug, nf), dates in sorted(by_flavor.items()):
        sorted_dates = sorted(set(dates))
        appearances = len(sorted_dates)

        if appearances < 2:
            continue

        # Compute span
        first = datetime.strptime(sorted_dates[0], "%Y-%m-%d")
        last = datetime.strptime(sorted_dates[-1], "%Y-%m-%d")
        span_days = (last - first).days

        # Compute avg_gap_days
        total_gap = 0
        for i in range(1, len(sorted_dates)):
            d1 = datetime.strptime(sorted_dates[i - 1], "%Y-%m-%d")
            d2 = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            total_gap += (d2 - d1).days
        avg_gap_days = round(total_gap / (len(sorted_dates) - 1))

        # Gate 1: data quality
        meets_data_quality = appearances >= 10 and span_days >= 90

        # Gate 3: rarity label
        label = None
        if meets_data_quality and avg_gap_days is not None:
            if avg_gap_days > 150:
                label = "Ultra Rare"
            elif avg_gap_days > 90:
                label = "Rare"

        results.append({
            "slug": slug,
            "flavor": nf,
            "appearances": appearances,
            "span_days": span_days,
            "avg_gap_days": avg_gap_days,
            "meets_data_quality": meets_data_quality,
            "label": label,
        })

    return results


def run_audit(
    slugs: list[str],
    checks: list[str] | None = None,
    dry_run: bool = False,
) -> int:
    """Run audit across specified stores and checks.

    Returns 0 if clean, 1 if issues found.
    """
    # Build WHERE clause for slugs
    slug_list = ", ".join(sql_quote(s) for s in slugs)
    sql = (
        f"SELECT id, slug, date, flavor, normalized_flavor, description, fetched_at "
        f"FROM snapshots WHERE slug IN ({slug_list}) ORDER BY slug, date"
    )

    print(f"Querying D1 for {len(slugs)} stores...")
    rows = execute_query_via_wrangler(sql)

    if rows is None:
        print("ERROR: Failed to query D1. Check wrangler authentication.", file=sys.stderr)
        return 1

    print(f"Total records: {len(rows)}")
    print()

    if dry_run:
        # Quick count per store
        per_store: dict[str, int] = defaultdict(int)
        for row in rows:
            per_store[row["slug"]] += 1
        print("Record counts per store:")
        for slug in sorted(per_store):
            print(f"  {slug}: {per_store[slug]}")
        print(f"\nTotal: {len(rows)} records across {len(per_store)} stores")
        return 0

    run_checks = checks or list(CHECK_NAMES.keys())
    issues_found = False

    # Check 1: Closure sentinels
    if "closures" in run_checks:
        print("=" * 60)
        print("CHECK 1: Closure sentinels")
        print("=" * 60)
        bad = check_closures(rows)
        if bad:
            issues_found = True
            print(f"FAIL: {len(bad)} closure sentinel(s) found:")
            for item in bad:
                print(f"  id={item['id']} slug={item['slug']} "
                      f"date={item['date']} flavor={item['flavor']!r}")
        else:
            print("PASS: No closure sentinels found")
        print()

    # Check 2: Corrupted text
    if "corrupted" in run_checks:
        print("=" * 60)
        print("CHECK 2: Corrupted text")
        print("=" * 60)
        bad = check_corrupted(rows)
        if bad:
            issues_found = True
            print(f"FAIL: {len(bad)} corrupted text record(s) found:")
            for item in bad:
                print(f"  id={item['id']} slug={item['slug']} "
                      f"date={item['date']} flavor={item['flavor']!r}")
        else:
            print("PASS: No corrupted text found")
        print()

    # Check 3: Coverage gaps
    if "gaps" in run_checks:
        print("=" * 60)
        print("CHECK 3: Coverage gaps (>7 days)")
        print("=" * 60)
        gaps = check_coverage_gaps(rows)
        if gaps:
            print(f"INFO: {len(gaps)} store(s) with coverage gaps:")
            for slug, gap_list in sorted(gaps.items()):
                print(f"  {slug}: {len(gap_list)} gap(s)")
                for gap in gap_list[:5]:  # Show first 5 per store
                    print(f"    {gap}")
                if len(gap_list) > 5:
                    print(f"    ... and {len(gap_list) - 5} more")
        else:
            print("PASS: No significant coverage gaps")
        print()

    # Check 4: Unknown flavors
    if "unknown" in run_checks:
        print("=" * 60)
        print("CHECK 4: Unknown flavors (not in FLAVOR_PROFILES/FLAVOR_ALIASES)")
        print("=" * 60)
        known = load_known_flavors()
        print(f"Loaded {len(known)} known flavor names from flavor-colors.js")
        unknown = check_unknown_flavors(rows, known)
        if unknown:
            total_unknown = sum(len(v) for v in unknown.values())
            print(f"WARNING: {total_unknown} unknown flavor name(s) across "
                  f"{len(unknown)} store(s):")
            for slug, names in sorted(unknown.items()):
                print(f"  {slug}:")
                for name in sorted(names):
                    print(f"    - {name!r}")
        else:
            print("PASS: All flavors resolve to known catalog entries")
        print()

    # Check 5: Rarity label verification
    if "rarity" in run_checks:
        print("=" * 60)
        print("CHECK 5: Rarity label verification")
        print("=" * 60)
        rarity_results = check_rarity_labels(rows)
        rare_flavors = [r for r in rarity_results if r["label"]]
        common_with_data = [r for r in rarity_results if r["meets_data_quality"] and not r["label"]]
        insufficient_data = [r for r in rarity_results if not r["meets_data_quality"]]

        print(f"Total flavor/store combos analyzed: {len(rarity_results)}")
        print(f"  Meeting data quality gate (>=10 appearances, >=90 day span): "
              f"{len(rare_flavors) + len(common_with_data)}")
        print(f"  Insufficient data: {len(insufficient_data)}")
        print()

        if rare_flavors:
            print(f"Rare/Ultra Rare flavors ({len(rare_flavors)}):")
            for r in sorted(rare_flavors, key=lambda x: -x["avg_gap_days"]):
                print(f"  [{r['label']}] {r['slug']}/{r['flavor']} "
                      f"-- {r['appearances']} appearances, "
                      f"avg gap {r['avg_gap_days']}d, "
                      f"span {r['span_days']}d")
        else:
            print("No flavors meet rarity thresholds")
        print()

    # Summary
    print("=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)
    print(f"Stores audited: {len(slugs)}")
    print(f"Total records: {len(rows)}")
    if issues_found:
        print("Result: ISSUES FOUND (exit code 1)")
    else:
        print("Result: CLEAN (exit code 0)")

    return 1 if issues_found else 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit D1 flavor data for 17 Madison-area Culver's stores"
    )
    parser.add_argument(
        "--store",
        metavar="SLUG",
        help="Audit a single store slug (default: all 17 stores)",
    )
    parser.add_argument(
        "--check",
        choices=list(CHECK_NAMES.keys()),
        help="Run a single check type (default: all checks)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Quick count of records per store without full analysis",
    )
    args = parser.parse_args()

    # Determine target slugs
    if args.store:
        if args.store not in AUDIT_SLUGS:
            print(f"WARNING: {args.store!r} is not in the 17 audit stores. "
                  "Proceeding anyway.", file=sys.stderr)
        slugs = [args.store]
    else:
        slugs = AUDIT_SLUGS

    # Determine checks to run
    checks = [args.check] if args.check else None

    print(f"Custard Calendar D1 Audit")
    print(f"Stores: {len(slugs)}")
    if checks:
        print(f"Check: {CHECK_NAMES[checks[0]]}")
    else:
        print("Checks: all 5")
    if args.dry_run:
        print("Mode: dry-run (count only)")
    print()

    return run_audit(slugs, checks, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
