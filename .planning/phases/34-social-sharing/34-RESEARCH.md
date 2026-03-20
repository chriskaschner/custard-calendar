# Phase 34: Social Sharing - Research

**Researched:** 2026-03-20
**Domain:** OG social cards, social crawler compatibility, Cloudflare Worker SVG/PNG rendering, quiz result sharing UX
**Confidence:** MEDIUM

## Summary

Phase 34 adds shareable URLs with rich OG card previews for quiz results and flavor rarity stats. The existing codebase has a strong foundation: `social-card.js` already generates 3 card types (per-store/date, per-page, trivia) as 1200x630 SVG, the quiz engine already writes `?archetype=X&flavor=Y` URL params via `history.replaceState`, and `#result-share` mount point exists with Web Share API + clipboard fallback.

However, research surfaced a critical compatibility issue: **Twitter, Facebook, and iMessage do not render SVG og:image URLs.** All existing OG cards (`.svg` endpoints) likely display as blank placeholders on social platforms today. Additionally, **social crawlers do not execute JavaScript**, so the CONTEXT.md plan to "dynamically set og:image and og:title meta tags via JS" will not work for generating rich previews on Twitter/Facebook/iMessage. The Worker must serve correct OG meta tags in the initial HTML response for crawler user agents.

The recommended approach is: (1) convert OG card output from SVG to PNG using `workers-og` (wraps satori + resvg-wasm for Cloudflare Workers), and (2) add a Worker route that intercepts shared quiz/radar URLs for social crawlers and returns a minimal HTML page with the correct `og:image`, `og:title`, and `og:description` meta tags, then redirects human browsers to the actual GitHub Pages-hosted page.

**Primary recommendation:** Use `workers-og` for PNG card generation and add crawler-targeted HTML responses at the Worker level for shared URLs. Keep existing SVG rendering as internal, convert to PNG at the response boundary.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Quiz result OG cards show archetype name, matched flavor name, and cone art PNG with "Take the quiz" CTA. Endpoint keyed by archetype + flavor combo: `/og/quiz/{archetype}/{flavor}.svg`. Extends existing `social-card.js`.
- Flavor rarity OG cards show appearance count + rarity classification using existing `rarityLabelFromGapDays()`. Endpoint keyed by flavor name only: `/og/flavor/{flavor-name}.svg`. Network-wide stats, not per-store.
- Standalone quiz result pages use same `quiz.html` in skip-to-result mode when `?archetype=X&flavor=Y` params detected. Engine.js already reads these params; needs presentation-only rendering path. Prominent "Take the quiz yourself" CTA button. No sharer attribution. Dynamic og:image and og:title meta tags set via JS to point to result-specific OG card.
- Flavor rarity landing pages share from Radar page flavor entries. Shared link lands on `radar.html?flavor={name}` with auto-scroll and highlight. Small share icon on each flavor card.
- Share UX uses existing Web Share API + clipboard copy pattern from planner-ui.js. Playful flavor-themed share text.

### Claude's Discretion
- OG card visual treatment (dark blue gradient vs quiz-mode accent colors vs hybrid)
- Loading/transition when quiz enters skip-to-result mode
- Exact share icon design and placement on Radar flavor entries
- Radar flavor highlight animation when arriving from shared link

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHARE-01 | Quiz results page has optimized og:image and shareable URL for social platforms | OG card rendering via workers-og PNG conversion; Worker-level crawler interception for correct meta tags; quiz.html skip-to-result rendering path |
| SHARE-02 | Flavor rarity stats are shareable as standalone social content (OG card per flavor) | Flavor rarity card rendering using metrics API data + rarityLabelFromGapDays(); radar.html?flavor= param handling with auto-scroll |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| workers-og | 0.0.27 | PNG OG card generation from HTML templates in Cloudflare Workers | Wraps satori + resvg-wasm with HTML template support (not JSX required); uses Cloudflare-native HTMLRewriter for parsing; produces PNG output that Twitter/Facebook/iMessage actually render |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.x (already installed) | Worker test framework | Testing new card rendering functions and crawler routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| workers-og | Raw satori + @resvg/resvg-wasm | More control but requires manual WASM bundling, font loading, and HTMLRewriter-free template handling. workers-og wraps all of this. |
| workers-og | Keep SVG (no conversion) | SVGs do NOT render on Twitter, Facebook, or iMessage. The entire feature becomes non-functional without PNG conversion. |
| Worker crawler interception | Client-side JS meta tag updates | Social crawlers do NOT execute JavaScript. Client-side meta tag updates are invisible to Twitter/Facebook crawlers. |

**Installation:**
```bash
cd worker && npm install workers-og
```

**Version verification:** `workers-og@0.0.27` confirmed via npm registry 2026-03-20.

## Architecture Patterns

### Recommended Project Structure
```
worker/src/
  social-card.js          # Extended: 2 new card types (quiz, flavor rarity) + PNG conversion
  index.js                # Extended: crawler interception route for shared URLs
docs/
  quiz.html               # Modified: skip-to-result rendering path, share button improvements
  quizzes/engine.js       # Modified: skip-to-result mode when URL params present
  index.html              # Modified: radar ?flavor= param handling (radar.html redirects here)
  planner-ui.js           # Reused: initShareButton() pattern for radar share icons
```

### Pattern 1: PNG Card Generation via workers-og
**What:** Replace SVG response with PNG using workers-og's ImageResponse class
**When to use:** All new OG card endpoints (`/og/quiz/`, `/og/flavor/`)
**Example:**
```javascript
// Source: workers-og npm README + existing social-card.js pattern
import { ImageResponse } from 'workers-og';

async function renderQuizCardPng({ archetypeName, flavorName, conePngBase64 }) {
  const html = `
    <div style="display:flex; flex-direction:column; width:1200px; height:630px;
                background:linear-gradient(180deg,#1a1a2e,#16213e);">
      <div style="height:8px; background:${accentColor};"></div>
      <div style="display:flex; padding:60px 80px;">
        <img src="data:image/png;base64,${conePngBase64}" width="150" height="175"/>
        <div style="display:flex; flex-direction:column; margin-left:40px;">
          <span style="font-size:52px; font-weight:bold; color:#fff;">${archetypeName}</span>
          <span style="font-size:36px; color:#9EC5E8;">${flavorName}</span>
          <span style="font-size:24px; color:#4a4a5a; margin-top:20px;">Take the quiz at custard.chriskaschner.com</span>
        </div>
      </div>
    </div>`;
  return new ImageResponse(html, { width: 1200, height: 630 });
}
```

### Pattern 2: Crawler Interception for Dynamic OG Tags
**What:** Worker detects social crawler User-Agent on shared URLs and returns a minimal HTML page with correct OG meta tags instead of the full app. Human browsers get passed through to GitHub Pages.
**When to use:** When quiz.html or index.html is requested with share params (`?archetype=`, `?flavor=`)
**Example:**
```javascript
// Source: architecture pattern for static sites needing dynamic OG tags
const CRAWLER_UA = /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Slackbot|Discordbot|TelegramBot/i;

function isSocialCrawler(request) {
  const ua = request.headers.get('User-Agent') || '';
  return CRAWLER_UA.test(ua);
}

// In fetch handler, before falling through to GitHub Pages:
if (isSocialCrawler(request) && url.pathname === '/quiz.html' && url.searchParams.has('archetype')) {
  const archetype = url.searchParams.get('archetype');
  const flavor = url.searchParams.get('flavor') || '';
  const ogImage = `https://custard.chriskaschner.com/og/quiz/${archetype}/${encodeURIComponent(flavor)}.png`;
  return new Response(`<!DOCTYPE html>
<html><head>
  <meta property="og:title" content="${archetype}: ${flavor} -- Custard Personality Engine">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${url.href}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0;url=${url.href}">
</head><body></body></html>`, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

### Pattern 3: Skip-to-Result Mode in Quiz Engine
**What:** When `?archetype=X&flavor=Y` params are present, bypass quiz questions and render result directly
**When to use:** When user arrives at quiz.html from a shared link
**Example:**
```javascript
// In engine.js init(), after loadConfigs():
const params = new URLSearchParams(window.location.search);
const shareArchetype = params.get('archetype');
const shareFlavor = params.get('flavor');
if (shareArchetype && shareFlavor) {
  // Skip quiz rendering, show result directly
  const archetype = state.archetypes.find(a => a.id === shareArchetype);
  if (archetype) {
    renderShareResult(archetype, shareFlavor);
    return; // Do not render quiz form
  }
}
```

### Anti-Patterns to Avoid
- **Client-side OG tag injection:** Social crawlers (Twitter, Facebook, iMessage, WhatsApp, Discord, Slack, Telegram) do NOT execute JavaScript. Updating `<meta>` tags via JS after page load is invisible to crawlers. All OG tags must be in the initial HTML served to the crawler.
- **SVG og:image URLs:** Twitter and Facebook do not render SVG images in link previews. They display blank placeholders. All og:image URLs must point to PNG (or JPEG).
- **Fetching images inside satori without manual base64:** Satori's built-in image fetching silently fails on Cloudflare Workers. Always pre-fetch images and convert to base64 data URIs before passing to the HTML template.
- **Dynamic WASM compilation:** Cloudflare Workers block `WebAssembly.instantiate()` with raw bytes. workers-og handles this correctly via static imports, but custom satori+resvg setups must use wrangler's esbuild static WASM imports.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG-to-PNG conversion | Custom canvas/ImageMagick pipeline | workers-og (satori + resvg-wasm) | WASM bundling for Workers is tricky; workers-og handles it. Satori's image fetch silently fails without workarounds. |
| HTML-to-image rendering | Puppeteer/Playwright screenshot | workers-og ImageResponse | No browser runtime available in Workers; workers-og is browser-less |
| Social crawler detection | Custom UA parsing | Simple regex against known crawler UAs | Well-documented list of crawler User-Agents; regex is sufficient |
| Web Share API + clipboard | Custom share implementation | Reuse existing `initShareButton()` pattern from planner-ui.js | Already tested, handles fallback, reads og: meta tags |

**Key insight:** The core complexity is not in rendering cards (the SVG templates already exist) but in ensuring social platforms can actually USE them. SVG cards are invisible to Twitter/Facebook, and client-side meta tags are invisible to crawlers. Both issues require server-side (Worker) solutions.

## Common Pitfalls

### Pitfall 1: SVG og:image Produces Blank Previews
**What goes wrong:** OG cards served as SVG (`image/svg+xml`) display as blank placeholders on Twitter, Facebook, iMessage, WhatsApp, Discord, and Slack.
**Why it happens:** These platforms only support JPEG, PNG, GIF, and (some) WebP for og:image rendering. SVG is explicitly not supported.
**How to avoid:** Serve OG cards as PNG via workers-og. Change file extensions from `.svg` to `.png` in new endpoints.
**Warning signs:** Test with Twitter Card Validator and Facebook Sharing Debugger before shipping. Blank preview = SVG issue.

### Pitfall 2: Client-Side Meta Tag Updates Invisible to Crawlers
**What goes wrong:** JavaScript updates `og:image` and `og:title` content attributes, but Twitter/Facebook show the original static values.
**Why it happens:** Social crawlers do not execute JavaScript. They read only the initial HTML response.
**How to avoid:** Use Worker-level crawler interception (Pattern 2 above) to serve HTML with correct OG tags server-side.
**Warning signs:** If preview shows "Custard Personality Engine" (generic) instead of "Cool Front: Mint Cookie" (specific), the crawler is seeing static HTML.

### Pitfall 3: Satori Image Fetch Fails Silently on Workers
**What goes wrong:** Cone PNG images that should appear on OG cards render as blank space.
**Why it happens:** Satori's internal fetch mechanism silently fails in Cloudflare Workers runtime.
**How to avoid:** Pre-fetch all images via `fetch()` before calling ImageResponse, convert to base64 data URIs, and embed directly in the HTML template. The existing `fetchConePngBase64()` function in social-card.js already does this.
**Warning signs:** Cards render correctly in local dev but images are missing in production.

### Pitfall 4: URL Encoding of Flavor Names in OG Paths
**What goes wrong:** Flavors with special characters (apostrophes, spaces) like "Really Reese's" produce broken URLs or 404s.
**Why it happens:** URL path segments need proper encoding; the slug conversion may not match expectations.
**How to avoid:** Use the existing `flavorToSlug()` function from social-card.js for path segments. Test with flavors containing apostrophes, ampersands, and spaces.
**Warning signs:** "Bailey's Irish Cream" and "Really Reese's" are good test cases.

### Pitfall 5: Radar Page is a Redirect
**What goes wrong:** Shared `radar.html?flavor=X` links redirect to `index.html` with the query params, but the index page may not handle the `?flavor=` param.
**Why it happens:** `radar.html` contains a `<meta http-equiv="refresh">` redirect to `index.html`. The redirect preserves query params via JS (`window.location.search`).
**How to avoid:** Implement `?flavor=` param handling in the index page's JS, or change the share URL to point directly to `index.html?flavor=X`. Ensure crawler interception handles both paths.
**Warning signs:** Shared radar links land on homepage with no flavor highlight.

### Pitfall 6: workers-og CPU Time on Cloudflare Free Tier
**What goes wrong:** OG card PNG generation times out on the first request.
**Why it happens:** Cloudflare free tier has a 10ms CPU time limit. Image generation with satori + resvg can exceed this on cold starts.
**How to avoid:** Cache generated PNG responses in KV or use `Cache-Control` headers. The existing 24h cache on SVG cards should be carried over to PNG cards. Consider using Cloudflare's Cache API for edge caching.
**Warning signs:** Intermittent 503 errors on `/og/quiz/` and `/og/flavor/` endpoints.

## Code Examples

### Existing Share Button (engine.js lines 1226-1249)
```javascript
// Source: docs/quizzes/engine.js
// The quiz engine already creates a share button with Web Share API + clipboard fallback
if (els.resultShare) {
  els.resultShare.innerHTML = '';
  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn result-share-btn';
  shareBtn.textContent = 'Share your result';
  const shareTitle = displayFlavor
    ? `${archetype.name}: ${displayFlavor} -- Custard Personality Engine`
    : `${archetype.name} -- Custard Personality Engine`;
  const shareUrl = window.location.href;
  shareBtn.addEventListener('click', function () {
    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(function () {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(function () {
        shareBtn.textContent = 'Link copied!';
        setTimeout(function () { shareBtn.textContent = 'Share your result'; }, 2000);
      });
    }
  });
  els.resultShare.appendChild(shareBtn);
}
```

### Existing URL Param Update (engine.js lines 1221-1224)
```javascript
// Source: docs/quizzes/engine.js
// Quiz already writes archetype + flavor to URL params after result
const resultParams = new URLSearchParams({ archetype: archetype.id });
if (displayFlavor) resultParams.set('flavor', displayFlavor);
history.replaceState(null, '', '?' + resultParams.toString());
```

### Existing Card SVG Template Pattern (social-card.js)
```javascript
// Source: worker/src/social-card.js
// Existing rendering pattern for page cards -- new quiz/flavor cards follow same structure
async function renderPageCard({ headline, subhead, flavorName }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const profile = getFlavorProfile(flavorName || '');
  const accentColor = BASE_COLORS[profile.base] || '#005696';
  const coneMarkup = flavorName ? await renderConeEmbed(flavorName, 1000, 100, 150, 175) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" ...>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect y="0" width="1200" height="8" fill="${accentColor}"/>
    ${coneMarkup}
    <text x="80" y="220" ...>${esc(headline)}</text>
    ...
  </svg>`;
}
```

### Existing Rarity Classification (planner-domain.js)
```javascript
// Source: docs/planner-domain.js
function rarityLabelFromGapDays(avgGapDays) {
  var days = Math.round(Number(avgGapDays));
  if (!Number.isFinite(days) || days < 2) return null;
  if (days > 120) return 'Ultra Rare';
  if (days > 60) return 'Rare';
  return null;
}
```

### Archetype Structure (flavor-archetypes.json)
```json
{
  "id": "cool-front",
  "name": "Cool Front",
  "headline": "A cool mint front is rolling through.",
  "blurb": "You stay composed under pressure...",
  "profile": { "calm": 4, "analytical": 3, ... },
  "flavors": ["Andes Mint Avalanche", "Mint Cookie", ...]
}
```
There are 8 archetypes total: cool-front, bold-storm, steady-classic, candy-burst, berry-sunrise, caramel-architect, cheesecake-signal, explorer-jetstream.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG og:image (current codebase) | PNG og:image via satori + resvg-wasm | Always required for social platforms | SVG og:images have NEVER worked on Twitter/Facebook. Fixing this is a compatibility fix, not a migration. |
| Client-side meta tag updates | Server-side crawler interception | Always required | Social crawlers never execute JS. This is a fundamental web platform constraint. |
| @vercel/og for edge OG generation | workers-og for Cloudflare Workers | 2023+ | @vercel/og WASM bundling is incompatible with Workers. workers-og wraps same satori engine with CF-native HTMLRewriter. |

**Deprecated/outdated:**
- SVG og:image: Never supported by Twitter, Facebook, or iMessage. All existing OG cards in this codebase likely display as blank placeholders.
- Client-side dynamic meta tags for crawlers: Fundamental web platform limitation. Crawlers see initial HTML only.

## Open Questions

1. **Should existing SVG card endpoints also be converted to PNG?**
   - What we know: All 11 page cards + 4 trivia cards + per-store/date cards currently serve SVG. They likely show blank previews on social platforms.
   - What's unclear: Whether fixing all existing cards is in scope for Phase 34 or should be a separate effort.
   - Recommendation: Build the PNG pipeline for new quiz/flavor cards. Converting existing cards can follow in a later pass. Document this as a known issue.

2. **Cloudflare free tier CPU limits with workers-og**
   - What we know: Free tier = 10ms CPU. PNG generation may exceed this.
   - What's unclear: Actual CPU time for workers-og rendering in production.
   - Recommendation: Implement aggressive caching (KV + Cache API). Test CPU usage. If it exceeds limits, consider the paid Workers plan ($5/mo) or pre-generating static PNGs.

3. **workers-og font rendering quality**
   - What we know: workers-og uses satori for layout, which supports system fonts but may render differently than browser SVG text.
   - What's unclear: Whether the visual quality matches the existing SVG cards.
   - Recommendation: Test early with a simple card and compare visual output. May need to embed a custom font (Google Fonts fetched + cached).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (via @cloudflare/vitest-pool-workers) |
| Config file | `worker/vitest.config.js` |
| Quick run command | `cd worker && npx vitest run test/social-card.test.js` |
| Full suite command | `cd worker && npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01a | Quiz OG card renders PNG with archetype + flavor + cone | unit | `cd worker && npx vitest run test/social-card.test.js -t "quiz card"` | Extends existing file |
| SHARE-01b | Worker returns crawler-targeted HTML with correct og:image for quiz shared URLs | unit | `cd worker && npx vitest run test/social-card.test.js -t "crawler"` | Extends existing file |
| SHARE-01c | Quiz skip-to-result mode renders result without taking quiz | smoke | Manual browser test (quiz.html?archetype=cool-front&flavor=Turtle) | N/A (frontend) |
| SHARE-01d | Share button generates correct URL with archetype + flavor params | smoke | Manual browser test | N/A (frontend) |
| SHARE-02a | Flavor rarity OG card renders PNG with flavor name + rarity + cone | unit | `cd worker && npx vitest run test/social-card.test.js -t "flavor card"` | Extends existing file |
| SHARE-02b | Worker returns crawler-targeted HTML with correct og:image for flavor shared URLs | unit | `cd worker && npx vitest run test/social-card.test.js -t "crawler flavor"` | Extends existing file |
| SHARE-02c | Radar share link uses correct URL pattern | smoke | Manual browser test (index.html?flavor=Turtle) | N/A (frontend) |

### Sampling Rate
- **Per task commit:** `cd worker && npx vitest run test/social-card.test.js`
- **Per wave merge:** `cd worker && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `workers-og` package installation (`cd worker && npm install workers-og`)
- [ ] No new test files needed -- extend existing `worker/test/social-card.test.js` (37 tests currently)

## Sources

### Primary (HIGH confidence)
- `worker/src/social-card.js` -- Read full source. 3 existing card types (per-store/date, per-page, trivia), SVG rendering pattern, cone PNG embedding via base64, accent color from flavor profile.
- `docs/quizzes/engine.js` -- Read full source. URL param writing (lines 1221-1224), share button mounting (lines 1226-1249), existing `?archetype=&flavor=` param reading.
- `worker/test/social-card.test.js` -- Read full source. 37 existing tests covering all card types, PNG embedding, fallbacks, caching.
- `docs/planner-domain.js` -- Read relevant section. `rarityLabelFromGapDays()` classification logic.
- `docs/planner-ui.js` -- Read relevant section. `initShareButton()` with Web Share API + clipboard fallback.
- `docs/quiz.html` -- Read full source. OG meta tags (static, pointing to `/og/page/quiz.svg`), `#result-share` mount point, quiz result section structure.

### Secondary (MEDIUM confidence)
- [workers-og npm](https://www.npmjs.com/package/workers-og) -- v0.0.27, HTML template support via HTMLRewriter, wraps satori + resvg-wasm
- [6 Pitfalls of Dynamic OG Image Generation on Cloudflare Workers](https://dev.to/devoresyah/6-pitfalls-of-dynamic-og-image-generation-on-cloudflare-workers-satori-resvg-wasm-1kle) -- WASM bundling, silent image fetch failure, satori-html size limits, CloudFront 403s, no WebP support, node:buffer unavailable
- [Dynamic OG Images with Cloudflare Workers](https://tom-sherman.com/blog/dynamic-og-image-cloudflare-workers) -- workers-og usage, font caching, CPU time constraints
- [workers-og GitHub](https://github.com/kvnang/workers-og) -- API documentation, HTML template parsing, Cloudflare-native WASM handling

### Tertiary (LOW confidence)
- [Open Graph Image Sizes for Social Media 2025 Guide](https://www.krumzi.com/blog/open-graph-image-sizes-for-social-media-the-complete-2025-guide) -- SVG not supported by Twitter/Facebook (consistent across multiple sources)
- [Workaround for SVG og:image not supported](https://blog.termian.dev/posts/twitter-og-image-svg/) -- Confirmed SVG limitation, Sharp/resvg conversion approach
- [How to Fix Social Sharing Link Previews](https://prerender.io/blog/how-to-fix-link-previews/) -- Crawlers don't execute JavaScript (confirmed by multiple sources)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - workers-og is well-documented and appropriate, but untested in this specific codebase. CPU time limits on free tier are a risk.
- Architecture: HIGH - The SVG-incompatibility and crawler-JS-blindness findings are well-established web platform facts. The crawler interception pattern is a proven approach.
- Pitfalls: HIGH - SVG/crawler issues confirmed across multiple authoritative sources. Satori/Workers pitfalls documented by practitioners.
- Code integration: HIGH - Read all canonical reference files. Existing patterns (social-card.js, engine.js, planner-ui.js) are well-understood and directly extensible.

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain -- social platform SVG/JS behavior has been consistent for years)
