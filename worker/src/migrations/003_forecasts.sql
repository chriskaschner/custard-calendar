-- Durable per-store forecast payloads.
-- Replaces high-volume KV forecast:{slug} writes with D1 as source of truth.

CREATE TABLE IF NOT EXISTS forecasts (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forecasts_generated_at ON forecasts(generated_at);
