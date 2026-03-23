# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | M002/S05 | library | PNG generation library for OG cards in Cloudflare Workers | workers-og (satori + resvg-wasm) v0.0.27 | Only library that runs natively in CF Workers environment. Uses satori for JSX-to-SVG and resvg-wasm for SVG-to-PNG. WASM requires global vitest mock (test/setup.js) since it can't load in Node. | Yes | agent |
| D002 | M002/S05 | architecture | Image format for social sharing OG cards | PNG endpoints exclusively — no SVG og:image | Research confirmed SVG og:image is unsupported by all social platforms (Twitter, Facebook, iMessage, WhatsApp, Discord, Slack). SVG would render as blank placeholders, making the feature non-functional. | Yes | agent |
| D003 | M002/S05 | architecture | Social crawler interception strategy in Worker | UA regex check in fetch handler before handleRequest() — returns null for non-crawlers (zero-cost pass-through) | Cheapest possible check in the hot path. isSocialCrawler() is a single regex test against UA string. Only crawler UAs get the HTML response with og:image meta tags. Human browsers pass through to normal handleRequest() with no overhead. | Yes | agent |
| D004 | M002/S03 | architecture | Page consolidation strategy for S03 — which pages to redirect vs keep | Redirect forecast-map.html → index.html only. Keep compare.html and fun.html as live pages in nav. Nav stays at 4 items (Today, Compare, Map, Fun). | forecast-map.html is the only page meeting all three criteria: (1) zero nav presence, (2) only entry point is fun.html Fronts card, (3) ML-dependent feature aligned with SIMP-03 Won't Do scope. compare.html has 7 dedicated Playwright browser test suites (2121 lines) and meaningful feature value — redirecting would gut significant test infrastructure. fun.html is the quiz discovery hub for 6 quiz modes — removing it makes quiz modes undiscoverable. Keeping both means nav stays at 4 items, satisfying SIMP-02 trivially. | Yes | agent |
