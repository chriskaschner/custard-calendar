# Knowledge Base

## Slug-derived store disambiguation (S06)

The 1012-store manifest uses slugs like `madison-wi-mineral-point-rd` for multi-store cities and bare `verona` for single-store cities. To extract the street segment: strip the city-state prefix, title-case the remainder. This is more reliable than parsing address fields because slugs are always present and consistently formatted.

`getDisplayName()` in `planner-domain.js` counts stores sharing a city+state to decide whether disambiguation is needed. For ≤1 store, it returns the bare city name.

## Mock D1 test maintenance

When adding new D1 queries to Worker route handlers, the mock D1 objects in integration tests need corresponding method stubs. The gate 2 network count query required `.first()` on the result of `.bind()`. Missing these stubs causes silent null returns that look like production bugs but are just incomplete mocks. Always check integration test mocks when adding D1 queries.

## Post-append DOM pattern for renderHeroCone

`renderHeroCone()` requires a live DOM element (it calls `appendChild`). When building cards with innerHTML string concatenation, you must: (1) include an empty placeholder div, (2) append the card to the DOM, (3) then querySelector the placeholder on the live element. Trying to call renderHeroCone before append produces no output and no error.

## Service worker cache version discipline

Every change to files cached by sw.js (style.css, JS files, PNGs) needs a CACHE_VERSION bump. The `png-asset-count.test.js` test validates the version string — update the test expectation when bumping. Current version: custard-v23.

## Rarity gate ordering matters for diagnostics

The three-gate rarity system always returns `appearances` and `avg_gap_days` in the response even when `label` is null. This makes it possible to diagnose which gate rejected a flavor by inspecting the numeric fields. If a future gate is added, maintain this pattern of exposing intermediate values.
