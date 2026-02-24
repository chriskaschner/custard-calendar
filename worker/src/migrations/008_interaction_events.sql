-- Anonymous interaction telemetry for CTA conversion and signal engagement.
-- No cookies, no user IDs, no raw coordinates.

CREATE TABLE IF NOT EXISTS interaction_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  page TEXT NOT NULL,
  action TEXT,
  store_slug TEXT,
  flavor TEXT,
  certainty_tier TEXT,
  page_load_id TEXT,
  cf_city TEXT,
  cf_region TEXT,
  cf_country TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interaction_events_created_at ON interaction_events(created_at);
CREATE INDEX IF NOT EXISTS idx_interaction_events_event_type ON interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_events_page ON interaction_events(page);
CREATE INDEX IF NOT EXISTS idx_interaction_events_action ON interaction_events(action);
CREATE INDEX IF NOT EXISTS idx_interaction_events_store_slug ON interaction_events(store_slug);
