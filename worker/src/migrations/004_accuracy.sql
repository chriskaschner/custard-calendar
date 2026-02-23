-- Forecast accuracy metrics: computed by analytics pipeline, served by Worker.
CREATE TABLE IF NOT EXISTS accuracy_metrics (
  slug TEXT NOT NULL,
  window TEXT NOT NULL,        -- '7d' or '30d'
  top_1_hit_rate REAL NOT NULL,
  top_5_hit_rate REAL NOT NULL,
  avg_log_loss REAL,
  n_samples INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (slug, window)
);
