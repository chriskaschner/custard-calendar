#!/usr/bin/env python3
"""Generate flavor-intelligence metrics from local backfill datasets.

Produces a metrics pack (JSON + CSV artifacts) from:
  - data/backfill/flavors.sqlite
  - data/backfill-national/flavors.sqlite
  - data/backfill-wayback/flavors.sqlite

Usage:
  .venv/bin/python scripts/generate_intelligence_metrics.py
  .venv/bin/python scripts/generate_intelligence_metrics.py --output-dir analytics/status
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import time
from calendar import month_name
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SCRIPT_PATH = Path(__file__).resolve()
WORKTREE_MARKER = Path(".claude") / "worktrees"

# In Codex worktrees, script path is:
#   <repo>/.claude/worktrees/<branch>/scripts/generate_intelligence_metrics.py
# In normal repo checkouts:
#   <repo>/scripts/generate_intelligence_metrics.py
if WORKTREE_MARKER.as_posix() in SCRIPT_PATH.as_posix():
    SHARED_ROOT = SCRIPT_PATH.parents[4]
    LOCAL_ROOT = SCRIPT_PATH.parents[1]
else:
    SHARED_ROOT = SCRIPT_PATH.parents[1]
    LOCAL_ROOT = SHARED_ROOT

DEFAULT_BACKFILL_DB = SHARED_ROOT / "data" / "backfill" / "flavors.sqlite"
DEFAULT_NATIONAL_DB = SHARED_ROOT / "data" / "backfill-national" / "flavors.sqlite"
DEFAULT_WAYBACK_DB = SHARED_ROOT / "data" / "backfill-wayback" / "flavors.sqlite"
DEFAULT_MANIFEST = SHARED_ROOT / "docs" / "stores.json"
DEFAULT_CHECKPOINT = SHARED_ROOT / "data" / "backfill-wayback" / "checkpoint.json"
DEFAULT_OUTPUT_DIR = LOCAL_ROOT / "analytics" / "status"
DEFAULT_TRIVIA_SEED_JS = LOCAL_ROOT / "worker" / "src" / "trivia-metrics-seed.js"

NON_CULVERS_PATTERNS = [
    re.compile(r"^kopps-"),
    re.compile(r"^gilles$"),
    re.compile(r"^hefners$"),
    re.compile(r"^kraverz$"),
    re.compile(r"^oscars"),
]


def is_culvers_slug(slug: str) -> bool:
    return not any(pattern.search(slug) for pattern in NON_CULVERS_PATTERNS)


def normalize_title_key(title: str) -> str:
    lowered = re.sub(r"[^a-z0-9]+", " ", str(title).lower()).strip()
    return re.sub(r"\s+", " ", lowered)


def load_flavors(db_path: Path, dataset_label: str) -> pd.DataFrame:
    con = sqlite3.connect(str(db_path))
    df = pd.read_sql_query(
        """
        SELECT
          store_slug, flavor_date, title, description, source, fetched_at
        FROM flavors
        """,
        con,
    )
    con.close()
    if df.empty:
        df["dataset"] = dataset_label
        return df

    df["dataset"] = dataset_label
    df["flavor_date"] = pd.to_datetime(df["flavor_date"], errors="coerce")
    df = df.dropna(subset=["store_slug", "flavor_date", "title"]).copy()
    return df.reset_index(drop=True)


def load_manifest(manifest_path: Path) -> tuple[dict[str, dict], set[str], set[str]]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    stores = payload.get("stores", [])
    by_slug: dict[str, dict] = {}
    wi_slugs: set[str] = set()
    for store in stores:
        slug = str(store.get("slug", "")).strip()
        if not slug or not is_culvers_slug(slug):
            continue
        by_slug[slug] = store
        if str(store.get("state", "")).upper() == "WI":
            wi_slugs.add(slug)

    all_slugs = set(by_slug)
    return by_slug, all_slugs, wi_slugs


def summarize_dataset(df: pd.DataFrame) -> dict[str, object]:
    if df.empty:
        return {
            "rows": 0,
            "stores": 0,
            "flavors": 0,
            "min_date": None,
            "max_date": None,
        }

    return {
        "rows": int(len(df)),
        "stores": int(df["store_slug"].nunique()),
        "flavors": int(df["title"].nunique()),
        "min_date": str(df["flavor_date"].min().date()),
        "max_date": str(df["flavor_date"].max().date()),
    }


def build_clean_dedup(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    # Covers both legacy and modern "closed" sentinels.
    closed_mask = raw_df["title"].str.contains(
        r"closed today|closed for remodel",
        case=False,
        na=False,
    )
    closed_count = int(closed_mask.sum())
    clean_df = raw_df.loc[~closed_mask].copy()

    # De-dupe per store/date in case source datasets overlap.
    clean_df = clean_df.sort_values(["store_slug", "flavor_date", "dataset"]).reset_index(drop=True)
    dedup_df = clean_df.drop_duplicates(subset=["store_slug", "flavor_date"], keep="last").copy()
    dedup_df["month"] = dedup_df["flavor_date"].dt.month
    dedup_df["year"] = dedup_df["flavor_date"].dt.year
    return dedup_df.reset_index(drop=True), closed_count


def get_top_flavors(df: pd.DataFrame, limit: int = 15) -> list[dict[str, object]]:
    top = df["title"].value_counts().head(limit)
    return [{"title": title, "appearances": int(count)} for title, count in top.items()]


def build_flavor_metrics(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    base = (
        df.groupby("title")
        .agg(
            appearances=("title", "size"),
            store_count=("store_slug", "nunique"),
            first_seen=("flavor_date", "min"),
            last_seen=("flavor_date", "max"),
        )
        .reset_index()
    )

    month_counts = (
        df.groupby(["title", "month"]).size().unstack(fill_value=0).sort_index(axis=1)
    )
    month_total = month_counts.sum(axis=1)
    seasonal_concentration = month_counts.max(axis=1) / month_total
    peak_month = month_counts.idxmax(axis=1)

    season_df = pd.DataFrame(
        {
            "title": seasonal_concentration.index,
            "seasonal_concentration": seasonal_concentration.values,
            "peak_month": peak_month.values,
        }
    )
    flavor_df = base.merge(season_df, on="title", how="left")
    flavor_df["first_seen"] = flavor_df["first_seen"].dt.date.astype(str)
    flavor_df["last_seen"] = flavor_df["last_seen"].dt.date.astype(str)
    flavor_df = flavor_df.sort_values(["appearances", "title"], ascending=[False, True]).reset_index(drop=True)

    spotlights = flavor_df[
        (flavor_df["appearances"] >= 50) & (flavor_df["seasonal_concentration"] >= 0.50)
    ].copy()
    spotlights = spotlights.sort_values(
        ["seasonal_concentration", "appearances", "title"],
        ascending=[False, False, True],
    ).reset_index(drop=True)
    return flavor_df, spotlights


def build_store_metrics(df: pd.DataFrame, manifest_by_slug: dict[str, dict]) -> pd.DataFrame:
    summary = (
        df.groupby("store_slug")
        .agg(
            observations=("store_slug", "size"),
            distinct_flavors=("title", "nunique"),
            first_seen=("flavor_date", "min"),
            last_seen=("flavor_date", "max"),
        )
        .reset_index()
    )
    summary["span_days"] = (
        summary["last_seen"] - summary["first_seen"]
    ).dt.days + 1

    sorted_df = df.sort_values(["store_slug", "flavor_date"])
    sorted_df["gap_days"] = sorted_df.groupby("store_slug")["flavor_date"].diff().dt.days
    gap_stats = (
        sorted_df.dropna(subset=["gap_days"])
        .groupby("store_slug")["gap_days"]
        .agg(
            median_gap_days="median",
            p95_gap_days=lambda s: float(s.quantile(0.95)),
        )
        .reset_index()
    )

    top_flavor = (
        df.groupby(["store_slug", "title"])
        .size()
        .reset_index(name="count")
        .sort_values(["store_slug", "count", "title"], ascending=[True, False, True])
        .drop_duplicates(subset=["store_slug"], keep="first")
        .rename(columns={"title": "top_flavor", "count": "top_flavor_count"})
    )

    result = summary.merge(gap_stats, on="store_slug", how="left").merge(top_flavor, on="store_slug", how="left")
    result["first_seen"] = result["first_seen"].dt.date.astype(str)
    result["last_seen"] = result["last_seen"].dt.date.astype(str)

    result["state"] = result["store_slug"].map(
        lambda slug: str(manifest_by_slug.get(slug, {}).get("state", "")).upper()
    )
    result["city"] = result["store_slug"].map(
        lambda slug: str(manifest_by_slug.get(slug, {}).get("city", ""))
    )
    result = result.sort_values(["observations", "store_slug"], ascending=[False, True]).reset_index(drop=True)
    return result


def load_checkpoint_pending(
    checkpoint_path: Path,
    manifest_slugs: set[str],
    wi_slugs: set[str],
) -> list[str]:
    if not checkpoint_path.exists():
        return []
    payload = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    completed = {
        str(slug)
        for slug in payload.get("completed_slugs", [])
        if isinstance(slug, str) and slug
    }
    non_wi = manifest_slugs - wi_slugs
    return sorted(non_wi - completed)


def probe_pending_stores(
    pending_slugs: list[str],
    manifest_by_slug: dict[str, dict],
    sample_size: int,
    timeout_s: int,
    sleep_s: float,
) -> tuple[pd.DataFrame, dict[str, int]]:
    if sample_size <= 0:
        return pd.DataFrame(
            columns=["slug", "state", "city", "status", "captures", "error"]
        ), {}

    targets = pending_slugs[:sample_size]
    rows: list[dict[str, object]] = []
    counts: Counter[str] = Counter()
    year_to = datetime.now(timezone.utc).year

    for slug in targets:
        info = manifest_by_slug.get(slug, {})
        status = "error_other"
        captures = 0
        err_text = ""

        cdx_url = (
            "https://web.archive.org/cdx/search/cdx?"
            + urllib.parse.urlencode(
                {
                    "url": f"https://www.culvers.com/restaurants/{slug}",
                    "from": "2010",
                    "to": str(year_to),
                    "output": "json",
                    "fl": "timestamp,original,statuscode,mimetype,digest",
                    "filter": "statuscode:200",
                    "limit": "3",
                }
            )
        )

        try:
            req = urllib.request.Request(
                cdx_url,
                headers={"User-Agent": "custard-wayback-backfill/1.0"},
            )
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))

            if isinstance(payload, list) and len(payload) > 1:
                captures = len(payload) - 1
                status = "ok_has_captures"
            elif isinstance(payload, list):
                status = "ok_no_captures"
            else:
                status = "error_unexpected_payload"
        except Exception as err:  # noqa: BLE001
            err_text = repr(err)
            text = err_text.lower()
            if "gaierror" in text or "nodename nor servname" in text:
                status = "error_dns"
            elif "timed out" in text or "timeouterror" in text:
                status = "error_timeout"
            elif "connection refused" in text:
                status = "error_connection_refused"
            else:
                status = "error_other"

        rows.append(
            {
                "slug": slug,
                "state": info.get("state", ""),
                "city": info.get("city", ""),
                "status": status,
                "captures": captures,
                "error": err_text[:300],
            }
        )
        counts[status] += 1
        time.sleep(max(0.0, sleep_s))

    return pd.DataFrame(rows), dict(counts)


def build_trivia_metrics_seed(
    summary: dict[str, object],
    flavor_metrics: pd.DataFrame,
    store_metrics: pd.DataFrame,
    seasonal_spotlights: pd.DataFrame,
) -> dict[str, object]:
    top_flavors = []
    for _, row in flavor_metrics.head(12).iterrows():
        top_flavors.append(
            {
                "title": str(row["title"]),
                "appearances": int(row["appearances"]),
                "store_count": int(row["store_count"]),
                "peak_month": int(row["peak_month"]),
                "peak_month_name": month_name[int(row["peak_month"])],
                "seasonal_concentration": float(row["seasonal_concentration"]),
            }
        )

    top_stores = []
    for _, row in store_metrics.head(12).iterrows():
        top_stores.append(
            {
                "store_slug": str(row["store_slug"]),
                "city": str(row["city"] or ""),
                "state": str(row["state"] or ""),
                "observations": int(row["observations"]),
                "distinct_flavors": int(row["distinct_flavors"]),
                "top_flavor": str(row["top_flavor"] or ""),
                "top_flavor_count": int(row["top_flavor_count"]),
            }
        )

    seasonal = []
    for _, row in seasonal_spotlights.head(10).iterrows():
        seasonal.append(
            {
                "title": str(row["title"]),
                "appearances": int(row["appearances"]),
                "store_count": int(row["store_count"]),
                "peak_month": int(row["peak_month"]),
                "peak_month_name": month_name[int(row["peak_month"])],
                "seasonal_concentration": float(row["seasonal_concentration"]),
            }
        )

    hnbc = summary["content_spotlights"]["how_now_brown_cow"]
    coverage = summary["coverage"]

    flavor_lookup: dict[str, dict[str, object]] = {}
    for _, row in flavor_metrics.iterrows():
        key = normalize_title_key(row["title"])
        if not key:
            continue
        flavor_lookup[key] = {
            "title": str(row["title"]),
            "appearances": int(row["appearances"]),
            "store_count": int(row["store_count"]),
            "peak_month": int(row["peak_month"]),
            "seasonal_concentration": float(row["seasonal_concentration"]),
        }

    store_lookup: dict[str, dict[str, object]] = {}
    for _, row in store_metrics.iterrows():
        slug = str(row["store_slug"]).strip()
        if not slug:
            continue
        store_lookup[slug] = {
            "observations": int(row["observations"]),
            "distinct_flavors": int(row["distinct_flavors"]),
            "state": str(row["state"] or ""),
            "city": str(row["city"] or ""),
            "top_flavor": str(row["top_flavor"] or ""),
            "top_flavor_count": int(row["top_flavor_count"]),
        }

    return {
        "version": 1,
        "generated_at": summary["generated_at"],
        "as_of": summary["as_of"],
        "dataset_summary": summary["dataset_summary"]["combined_clean_dedup"],
        "coverage": {
            "manifest_total": int(coverage["manifest_total"]),
            "current_covered": int(coverage["current_covered"]),
            "wayback_covered": int(coverage["wayback_covered"]),
            "overall_covered": int(coverage["overall_covered"]),
            "missing_overall_count": int(coverage["missing_overall_count"]),
            "pending_non_wi_count": int(coverage["pending_non_wi_count"]),
            "top_state_coverage": coverage.get("top_state_coverage", [])[:12],
        },
        "hnbc": {
            "count": int(hnbc["count"]),
            "by_month": hnbc.get("by_month", {}),
            "by_year": hnbc.get("by_year", {}),
        },
        "top_flavors": top_flavors,
        "top_stores": top_stores,
        "seasonal_spotlights": seasonal,
        "planner_features": {
            "max_store_observations": int(store_metrics["observations"].max()) if len(store_metrics) else 0,
            "flavor_lookup": flavor_lookup,
            "store_lookup": store_lookup,
        },
    }


def write_trivia_metrics_seed_js(out_path: Path, payload: dict[str, object]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        "// Auto-generated by scripts/generate_intelligence_metrics.py. Do not edit manually.\n"
        f"export const TRIVIA_METRICS_SEED = {json.dumps(payload, indent=2)};\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate flavor-intelligence metrics pack")
    parser.add_argument("--backfill-db", type=Path, default=DEFAULT_BACKFILL_DB)
    parser.add_argument("--national-db", type=Path, default=DEFAULT_NATIONAL_DB)
    parser.add_argument("--wayback-db", type=Path, default=DEFAULT_WAYBACK_DB)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--trivia-seed-js",
        type=Path,
        default=DEFAULT_TRIVIA_SEED_JS,
        help="Output JS module consumed by worker trivia route.",
    )
    parser.add_argument(
        "--as-of",
        type=str,
        default=datetime.now(timezone.utc).date().isoformat(),
        help="Stamp string for output filenames (default YYYY-MM-DD UTC).",
    )
    parser.add_argument(
        "--probe-pending",
        type=int,
        default=0,
        help="Probe first N pending non-WI stores against CDX for capture health (default 0).",
    )
    parser.add_argument(
        "--probe-timeout",
        type=int,
        default=8,
        help="Timeout seconds per probe request (default 8).",
    )
    parser.add_argument(
        "--probe-sleep",
        type=float,
        default=0.6,
        help="Sleep seconds between probe requests (default 0.6).",
    )
    args = parser.parse_args()

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    by_slug, manifest_slugs, wi_slugs = load_manifest(args.manifest)

    backfill_df = load_flavors(args.backfill_db, "backfill")
    national_df = load_flavors(args.national_db, "backfill-national")
    wayback_df = load_flavors(args.wayback_db, "backfill-wayback")

    raw_df = pd.concat([backfill_df, national_df, wayback_df], ignore_index=True)
    clean_df, closed_removed = build_clean_dedup(raw_df)

    current_slugs = set(backfill_df["store_slug"].unique()) | set(national_df["store_slug"].unique())
    wayback_slugs = set(wayback_df["store_slug"].unique())
    overall_slugs = current_slugs | wayback_slugs

    pending_non_wi = load_checkpoint_pending(args.checkpoint, manifest_slugs, wi_slugs)
    missing_overall = sorted(manifest_slugs - overall_slugs)

    flavor_metrics, seasonal_spotlights = build_flavor_metrics(clean_df)
    store_metrics = build_store_metrics(clean_df, by_slug)

    hnbc = clean_df[clean_df["title"].str.lower() == "how now brown cow"].copy()
    hnbc_months = {
        int(month): int(count)
        for month, count in hnbc["month"].value_counts().sort_index().items()
    }
    hnbc_years = {
        int(year): int(count)
        for year, count in hnbc["year"].value_counts().sort_index().items()
    }

    manifest_state_counts = Counter(
        str(by_slug[slug].get("state", "")).upper()
        for slug in manifest_slugs
    )
    overall_state_counts = Counter(
        str(by_slug[slug].get("state", "")).upper()
        for slug in overall_slugs
        if slug in by_slug
    )
    top_state_coverage = []
    for state, total in manifest_state_counts.most_common(15):
        covered = int(overall_state_counts.get(state, 0))
        top_state_coverage.append(
            {
                "state": state,
                "covered": covered,
                "total": int(total),
                "coverage_pct": (covered / total * 100.0) if total else 0.0,
            }
        )

    stamp = args.as_of
    summary_path = output_dir / f"flavor_intelligence_summary_{stamp}.json"
    flavor_csv = output_dir / f"flavor_intelligence_flavors_{stamp}.csv"
    store_csv = output_dir / f"flavor_intelligence_stores_{stamp}.csv"
    seasonal_csv = output_dir / f"flavor_intelligence_seasonal_spotlights_{stamp}.csv"
    pending_csv = output_dir / f"backfill_wayback_pending_non_wi_{stamp}.csv"
    missing_csv = output_dir / f"backfill_missing_overall_{stamp}.csv"
    probe_csv = output_dir / f"backfill_wayback_pending_probe_{stamp}.csv"

    flavor_metrics.to_csv(flavor_csv, index=False)
    store_metrics.to_csv(store_csv, index=False)
    seasonal_spotlights.to_csv(seasonal_csv, index=False)

    with pending_csv.open("w", encoding="utf-8", newline="") as f:
        writer = pd.DataFrame(
            [
                {
                    "slug": slug,
                    "state": by_slug.get(slug, {}).get("state", ""),
                    "city": by_slug.get(slug, {}).get("city", ""),
                    "name": by_slug.get(slug, {}).get("name", ""),
                }
                for slug in pending_non_wi
            ]
        )
        writer.to_csv(f, index=False)

    with missing_csv.open("w", encoding="utf-8", newline="") as f:
        writer = pd.DataFrame(
            [
                {
                    "slug": slug,
                    "state": by_slug.get(slug, {}).get("state", ""),
                    "city": by_slug.get(slug, {}).get("city", ""),
                    "name": by_slug.get(slug, {}).get("name", ""),
                }
                for slug in missing_overall
            ]
        )
        writer.to_csv(f, index=False)

    probe_df, probe_counts = probe_pending_stores(
        pending_slugs=pending_non_wi,
        manifest_by_slug=by_slug,
        sample_size=args.probe_pending,
        timeout_s=args.probe_timeout,
        sleep_s=args.probe_sleep,
    )
    if not probe_df.empty:
        probe_df.to_csv(probe_csv, index=False)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of": stamp,
        "inputs": {
            "backfill_db": str(args.backfill_db),
            "national_db": str(args.national_db),
            "wayback_db": str(args.wayback_db),
            "manifest": str(args.manifest),
            "checkpoint": str(args.checkpoint),
        },
        "dataset_summary": {
            "backfill": summarize_dataset(backfill_df),
            "backfill_national": summarize_dataset(national_df),
            "backfill_wayback": summarize_dataset(wayback_df),
            "combined_raw": summarize_dataset(raw_df),
            "combined_clean_dedup": summarize_dataset(clean_df),
            "closed_rows_removed": closed_removed,
        },
        "coverage": {
            "manifest_total": len(manifest_slugs),
            "current_covered": len(current_slugs & manifest_slugs),
            "wayback_covered": len(wayback_slugs & manifest_slugs),
            "overall_covered": len(overall_slugs & manifest_slugs),
            "missing_overall_count": len(missing_overall),
            "pending_non_wi_count": len(pending_non_wi),
            "top_state_coverage": top_state_coverage,
            "pending_probe": {
                "sample_size": int(args.probe_pending),
                "timeout_seconds": int(args.probe_timeout),
                "sleep_seconds": float(args.probe_sleep),
                "status_counts": probe_counts,
                "artifact_csv": str(probe_csv) if not probe_df.empty else None,
            },
        },
        "content_spotlights": {
            "how_now_brown_cow": {
                "count": int(len(hnbc)),
                "by_month": hnbc_months,
                "by_year": hnbc_years,
            },
            "top_flavors": get_top_flavors(clean_df, limit=15),
            "seasonal_spotlights_count": int(len(seasonal_spotlights)),
        },
        "artifacts": {
            "flavor_metrics_csv": str(flavor_csv),
            "store_metrics_csv": str(store_csv),
            "seasonal_spotlights_csv": str(seasonal_csv),
            "pending_non_wi_csv": str(pending_csv),
            "missing_overall_csv": str(missing_csv),
            "pending_probe_csv": str(probe_csv) if not probe_df.empty else None,
            "trivia_metrics_seed_js": str(args.trivia_seed_js),
        },
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    trivia_seed = build_trivia_metrics_seed(summary, flavor_metrics, store_metrics, seasonal_spotlights)
    write_trivia_metrics_seed_js(args.trivia_seed_js, trivia_seed)

    print(f"wrote {summary_path}")
    print(f"wrote {flavor_csv} ({len(flavor_metrics)} rows)")
    print(f"wrote {store_csv} ({len(store_metrics)} rows)")
    print(f"wrote {seasonal_csv} ({len(seasonal_spotlights)} rows)")
    print(f"wrote {args.trivia_seed_js}")
    print(
        "coverage "
        f"overall={summary['coverage']['overall_covered']}/{summary['coverage']['manifest_total']} "
        f"pending_non_wi={summary['coverage']['pending_non_wi_count']} "
        f"missing_overall={summary['coverage']['missing_overall_count']}"
    )
    if probe_counts:
        print(f"probe sample={args.probe_pending} status_counts={probe_counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
