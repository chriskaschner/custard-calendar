ALTER TABLE quiz_events ADD COLUMN page_load_id TEXT;
CREATE INDEX IF NOT EXISTS idx_quiz_events_page_load_id ON quiz_events(page_load_id);
