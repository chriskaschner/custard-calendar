# Knowledge Base

## Slug-derived store disambiguation (S06)

The 1012-store manifest uses slugs like `madison-wi-mineral-point-rd` for multi-store cities and bare `verona` for single-store cities. To extract the street segment: strip the city-state prefix, title-case the remainder. This is more reliable than parsing address fields because slugs are always present and consistently formatted.

`getDisplayName()` in `planner-domain.js` counts stores sharing a city+state to decide whether disambiguation is needed. For ≤1 store, it returns the bare city name.

## Mock D1 test maintenance

When adding new D1 queries to Worker route handlers, the mock D1 objects in integration tests need corresponding method stubs. The gate 2 network count query required `.first()` on the result of `.bind()`. Missing these stubs causes silent null returns that look like production bugs but are just incomplete mocks. Always check integration test mocks when adding D1 queries.

## Post-append DOM pattern for renderHeroCone

`renderHeroCone()` requires a live DOM element (it calls `appendChild`). When building cards with innerHTML string concatenation, you must: (1) include an empty placeholder div, (2) append the card to the DOM, (3) then querySelector the placeholder on the live element. Trying to call renderHeroCone before append produces no output and no error.

## Service worker cache version discipline

Every change to files cached by sw.js (style.css, JS files, PNGs) needs a CACHE_VERSION bump. The `png-asset-count.test.js` test validates the version string — update the test expectation when bumping. Current version: custard-v27.

## Rarity gate ordering matters for diagnostics

The three-gate rarity system always returns `appearances` and `avg_gap_days` in the response even when `label` is null. This makes it possible to diagnose which gate rejected a flavor by inspecting the numeric fields. If a future gate is added, maintain this pattern of exposing intermediate values.

## workers-og WASM mock pattern (S05)

workers-og uses WASM (resvg-wasm) that cannot load in standard Node/Vitest environments. The fix is a global `vi.mock('workers-og', ...)` in `worker/test/setup.js`, registered via `setupFiles` in `vitest.config.js`. The mock returns a minimal 4-byte fake PNG (`[0x89, 0x50, 0x4e, 0x47]`). Any future test that imports workers-og (directly or transitively) will use this mock automatically. If you need to test actual PNG rendering, you'd need wrangler's test environment.

## SVG og:image is universally unsupported (S05)

No social platform (Twitter, Facebook, iMessage, WhatsApp, Discord, Slack, Telegram) supports SVG as an og:image format. SVG cards render as blank placeholders. Always use PNG or JPEG for OG card endpoints. The existing `/og/*.svg` endpoints still serve SVG and are effectively broken for social sharing.

## Rarity threshold alignment (resolved in M004/S02)

All three rarity files (`route-today.js`, `social-card.js`, `planner-domain.js`) now use identical thresholds: `> 150` days = Ultra Rare, `> 90` days = Rare. The divergence where `social-card.js` used `> 120` / `> 60` has been fixed. `worker/test/rarity-threshold-consistency.test.js` (13 boundary-value assertions) prevents future drift — it runs in every `npm test` invocation. If thresholds need to change, update all three files and the test.

## radar.html as canonical share entry point (S05)

Share URLs use `radar.html?flavor=X` rather than `index.html?flavor=X` because radar.html is a redirect stub that forwards to index.html preserving query params. This indirection allows the share URL path to stay stable even if the homepage filename changes. Crawler interception in index.js handles both `radar.html` and `index.html` patterns. If a future slice removes radar.html, share URLs will break — the redirect must be preserved or share URL generation updated.

## Page deletion checklist (S03)

When consolidating/redirecting a page, audit these files for stale references: `tests/test_redirects.py` (add redirect entry), `tests/test_static_assets.py` (remove asset tests), `tests/test_inline_style_elimination.py` (remove style tests), `worker/test/browser/*.spec.mjs` (delete or update page-specific specs), `docs/sw.js` (remove from STATIC_ASSETS + bump CACHE_VERSION), and any page that links to the deleted page (e.g. fun.html linked to forecast-map.html via Fronts section).

## Python test deps require --all-extras

`uv sync` alone does not install `pytest` or `icalendar` because they live in `[project.optional-dependencies].dev`. Run `uv sync --all-extras` (or `uv sync --extra dev --extra analytics`) in worktree environments before running `uv run pytest`. The standard `uv sync` only installs production dependencies.

## test_browser_clickthrough.py requires live environment

`tests/test_browser_clickthrough.py` spawns `wrangler dev` and drives a Chrome/Chromium browser against it. It will timeout/fail in any environment without a Chrome binary and available port. Skip with `SKIP_BROWSER_TESTS=1` env var or `--ignore=tests/test_browser_clickthrough.py`. The test is guarded by a `pytest.mark.skipif` that checks for this env var.

## Widget JS dual-file sync discipline (M003)

`widgets/custard-today.js` is the canonical source; `docs/assets/custard-today.js` must be a byte-identical copy. There is no automated sync — it's a manual copy step. Any edit to one file without copying to the other causes widget behavior divergence between the GitHub Pages-served version (docs/assets/) and the canonical source (widgets/). Verify with `diff widgets/custard-today.js docs/assets/custard-today.js` — exit 0 means sync is intact.

## DrawContext layered rendering technique (M003)

Scriptable's DrawContext API only supports basic primitives (no gradients, no compositing modes). To create depth and richness: (1) layer multiple semi-transparent shapes at slight offsets for shadows, (2) use `darkenHex()` to compute shadow colors from base colors, (3) draw crosshatch patterns with loops over diagonal lines, (4) add specular highlights as small white ellipses with low alpha (0.12–0.45). The key insight is that 5–7 layered primitives with varying alpha values produce surprisingly good results.

## WIDGET_SCRIPT embedding requires script-based regeneration (M004/S01)

`worker/src/widget-routes.js` embeds the full `widgets/custard-today.js` source as a template literal (`WIDGET_SCRIPT`). The source is ~650 lines. Editing this template literal by hand is error-prone — backtick or `${}` escaping issues are invisible until runtime. Instead, regenerate the file from the canonical source using a script that reads `widgets/custard-today.js` and reconstructs `widget-routes.js` (header + template literal + handler functions). Always verify with `cd worker && npx vitest run test/widget-routes.test.js` after regeneration.

## Three-file sync for widget updates (M004/S01)

When updating the widget script, three files must stay in sync: (1) `widgets/custard-today.js` (canonical), (2) `docs/assets/custard-today.js` (byte-identical copy), (3) `worker/src/widget-routes.js` (WIDGET_SCRIPT embedded copy). Edit the canonical file first, `cp` to docs/assets, then regenerate widget-routes.js. Verify: `diff widgets/custard-today.js docs/assets/custard-today.js && cd worker && npm test`.

## Planning assumptions about existing page state may be stale (M003)

S02 assumed widget.html was a redirect stub needing replacement, but it was already a complete 427-line page. The slice correctly verified before building, avoiding wasted effort. Lesson: always run a quick file inspection (`wc -l`, `head -20`) to verify the actual state of a target file before implementing changes. This is especially important when planning documents reference an older state of the codebase.
