-- Durable historical flavor snapshots.
-- Append-only: one row per store per date. No updates, no deletes.
-- Enables SQL queries that KV cannot: "all Turtle appearances in February",
-- "rarest flavors this month", "which stores have the most variety".

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  slug TEXT NOT NULL,
  date TEXT NOT NULL,
  flavor TEXT NOT NULL,
  normalized_flavor TEXT NOT NULL,
  description TEXT,
  fetched_at TEXT NOT NULL,
  UNIQUE(slug, date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_flavor ON snapshots(normalized_flavor);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
CREATE INDEX IF NOT EXISTS idx_snapshots_slug ON snapshots(slug);
CREATE INDEX IF NOT EXISTS idx_snapshots_brand ON snapshots(brand);
