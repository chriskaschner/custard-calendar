"""Load and clean the backfill SQLite dataset into pandas DataFrames.

Schema: flavors(store_slug TEXT, flavor_date TEXT, title TEXT, description TEXT,
                source TEXT, fetched_at TEXT)
- Primary key: (store_slug, flavor_date)
- Closed days appear as title = 'z *Restaurant Closed Today'
"""

import sqlite3
from pathlib import Path

import pandas as pd

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "backfill" / "flavors.sqlite"

# Sentinel values in the dataset for closed stores
CLOSED_MARKERS = {
    "z *Restaurant Closed Today",
    "z *Closed Today for Remodel!",
}


def load_raw(db_path: Path | str = DEFAULT_DB) -> pd.DataFrame:
    """Load entire flavors table as-is."""
    con = sqlite3.connect(str(db_path))
    df = pd.read_sql_query("SELECT * FROM flavors", con)
    con.close()
    df["flavor_date"] = pd.to_datetime(df["flavor_date"])
    return df


def load_clean(db_path: Path | str = DEFAULT_DB) -> pd.DataFrame:
    """Load flavors, drop closed-day rows, add convenience columns.

    Returns DataFrame with columns:
        store_slug, flavor_date, title, description, source, fetched_at,
        dow (0=Mon..6=Sun), month, year
    """
    df = load_raw(db_path)
    df = df[~df["title"].isin(CLOSED_MARKERS)].copy()
    df["dow"] = df["flavor_date"].dt.dayofweek  # 0=Mon, 6=Sun
    df["month"] = df["flavor_date"].dt.month
    df["year"] = df["flavor_date"].dt.year
    return df.reset_index(drop=True)


def flavor_list(df: pd.DataFrame) -> list[str]:
    """Sorted list of unique flavor titles in the dataset."""
    return sorted(df["title"].unique().tolist())


def store_list(df: pd.DataFrame) -> list[str]:
    """Sorted list of unique store slugs in the dataset."""
    return sorted(df["store_slug"].unique().tolist())
