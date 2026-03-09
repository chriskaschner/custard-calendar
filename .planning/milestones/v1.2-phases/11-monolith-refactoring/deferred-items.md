# Phase 11: Deferred Items

## Pre-existing Browser Test Failures (14 tests)

Discovered during Plan 02 regression testing. All 14 verified as failing identically against Phase 10 commit (1e15c28, before monolith split).

### Drive tests (11 failures)
- `drive-preferences.spec.mjs` (6 tests) -- `.drive-card` not found on index.html
- `index-drive-minimap-sync.spec.mjs` (4 tests) -- `.drive-card` not found on index.html
- `index-todays-drive.spec.mjs` (1 test) -- "Today's Drive" heading not found

**Root cause:** `todays-drive.js` is not loaded from index.html via a script tag. The drive section UI never renders.

### Quiz tests (2 failures)
- `quiz-personality.spec.mjs` -- `#quiz-result` stays hidden after submit
- `quiz-trivia-dynamic.spec.mjs` -- trivia questions don't hydrate from mocked API

**Root cause:** Quiz engine API mocking may not intercept the right endpoints or the engine's fetch order differs from test expectations.

### Map test (1 failure)
- `map-pan-stability.spec.mjs` -- map markers not retained after coordinate-based search

**Root cause:** Unknown, likely map page interaction timing issue.
