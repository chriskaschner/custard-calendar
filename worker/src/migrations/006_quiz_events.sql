-- Anonymous quiz telemetry for Custard Personality Engine.
-- Stores coarse-grained event data only (no email/IP/raw coordinates).

CREATE TABLE IF NOT EXISTS quiz_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  archetype TEXT,
  result_flavor TEXT,
  matched_flavor TEXT,
  matched_store_slug TEXT,
  matched_distance_miles REAL,
  radius_miles INTEGER,
  has_radius_match INTEGER NOT NULL DEFAULT 0,
  trait_scores_json TEXT,
  cf_city TEXT,
  cf_region TEXT,
  cf_country TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_events_created_at ON quiz_events(created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_events_quiz_id ON quiz_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_events_archetype ON quiz_events(archetype);
CREATE INDEX IF NOT EXISTS idx_quiz_events_result_flavor ON quiz_events(result_flavor);
