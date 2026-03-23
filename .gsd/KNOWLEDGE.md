# Knowledge Base

## Slug-derived store disambiguation (S06)

The 1012-store manifest uses slugs like `madison-wi-mineral-point-rd` for multi-store cities and bare `verona` for single-store cities. To extract the street segment: strip the city-state prefix, title-case the remainder. This is more reliable than parsing address fields because slugs are always present and consistently formatted.

`getDisplayName()` in `planner-domain.js` counts stores sharing a city+state to decide whether disambiguation is needed. For ≤1 store, it returns the bare city name.

## Mock D1 test maintenance

When adding new D1 queries to Worker route handlers, the mock D1 objects in integration tests need corresponding method stubs. The gate 2 network count query required `.first()` on the result of `.bind()`. Missing these stubs causes silent null returns that look like production bugs but are just incomplete mocks. Always check integration test mocks when adding D1 queries.

## Post-append DOM pattern for renderHeroCone

`renderHeroCone()` requires a live DOM element (it calls `appendChild`). When building cards with innerHTML string concatenation, you must: (1) include an empty placeholder div, (2) append the card to the DOM, (3) then querySelector the placeholder on the live element. Trying to call renderHeroCone before append produces no output and no error.

## Service worker cache version discipline

Every change to files cached by sw.js (style.css, JS files, PNGs) needs a CACHE_VERSION bump. The `png-asset-count.test.js` test validates the version string — update the test expectation when bumping. Current version: custard-v25.

## Rarity gate ordering matters for diagnostics

The three-gate rarity system always returns `appearances` and `avg_gap_days` in the response even when `label` is null. This makes it possible to diagnose which gate rejected a flavor by inspecting the numeric fields. If a future gate is added, maintain this pattern of exposing intermediate values.

## workers-og WASM mock pattern (S05)

workers-og uses WASM (resvg-wasm) that cannot load in standard Node/Vitest environments. The fix is a global `vi.mock('workers-og', ...)` in `worker/test/setup.js`, registered via `setupFiles` in `vitest.config.js`. The mock returns a minimal 4-byte fake PNG (`[0x89, 0x50, 0x4e, 0x47]`). Any future test that imports workers-og (directly or transitively) will use this mock automatically. If you need to test actual PNG rendering, you'd need wrangler's test environment.

## SVG og:image is universally unsupported (S05)

No social platform (Twitter, Facebook, iMessage, WhatsApp, Discord, Slack, Telegram) supports SVG as an og:image format. SVG cards render as blank placeholders. Always use PNG or JPEG for OG card endpoints. The existing `/og/*.svg` endpoints still serve SVG and are effectively broken for social sharing.

## Rarity threshold divergence across files

Two sets of rarity thresholds exist in the codebase: `planner-domain.js` and `social-card.js` use >120 days = Ultra Rare, >60 days = Rare. `route-today.js` uses >150 days = Ultra Rare, >90 days = Rare. A flavor at 130 days shows "Ultra Rare" on OG cards but "Rare" on the homepage. This needs alignment to a single source of truth.

## radar.html as canonical share entry point (S05)

Share URLs use `radar.html?flavor=X` rather than `index.html?flavor=X` because radar.html is a redirect stub that forwards to index.html preserving query params. This indirection allows the share URL path to stay stable even if the homepage filename changes. Crawler interception in index.js handles both `radar.html` and `index.html` patterns. If S03 (page consolidation) removes radar.html, share URLs will break — the redirect must be preserved or share URL generation updated.
