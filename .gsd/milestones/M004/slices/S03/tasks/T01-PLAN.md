---
estimated_steps: 5
estimated_files: 2
skills_used:
  - test
  - review
---

# T01: Add PNG page card renderer, handler, route, and tests

**Slice:** S03 — PNG OG Page Cards
**Milestone:** M004

## Description

Add `renderPageCardPng()` and `handlePageCardPng()` to `worker/src/social-card.js`, wire the PNG route into the `handleSocialCard` router, add `compare` and `fun` entries to `PAGE_CARD_DEFS`, and write comprehensive vitest tests. This follows the exact pattern already proven by `renderQuizCardPng` / `handleQuizCard` and `renderFlavorRarityCardPng` / `handleFlavorCard`.

## Steps

1. **Add `compare` and `fun` entries to `PAGE_CARD_DEFS`** (around line 155 in `social-card.js`, after the `scoop` entry):
   ```js
   compare: {
     headline: 'Compare Today\'s Flavors',
     subhead: 'Side-by-side schedules for your favorite stores.',
     flavorName: 'Turtle',
   },
   fun: {
     headline: 'Custard Fun Zone',
     subhead: 'Mad Libs, trivia, and flavor surprises.',
     flavorName: 'Cookie Dough',
   },
   ```
   This brings `PAGE_CARD_DEFS` to 13 entries, covering every HTML page that has an `og:image` tag.

2. **Add `renderPageCardPng()` function** after the existing `handlePageCard` function (around line 247). Copy the HTML template structure from `renderQuizCardPng` (lines 336–366) but adapt the text content for page cards:
   ```js
   async function renderPageCardPng({ headline, subhead, flavorName, conePngBase64, accentColor }) {
     const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
     const coneImg = conePngBase64
       ? `<img src="data:image/png;base64,${conePngBase64}" width="150" height="175" style="object-fit:contain;" />`
       : '';
     const html = `
       <div style="display:flex; flex-direction:column; width:1200px; height:630px;
                   background:linear-gradient(180deg,#1a1a2e,#16213e); position:relative;">
         <div style="height:8px; background:${esc(accentColor)}; width:100%;"></div>
         <div style="display:flex; flex-direction:row; padding:60px 80px; align-items:center; flex:1;">
           <div style="display:flex; margin-right:40px;">${coneImg}</div>
           <div style="display:flex; flex-direction:column;">
             <div style="font-size:56px; font-weight:bold; color:#ffffff; font-family:sans-serif; margin-bottom:16px; line-height:1.1;">
               ${esc(headline)}
             </div>
             <div style="font-size:28px; color:#9EC5E8; font-family:sans-serif; margin-bottom:24px;">
               ${esc(subhead)}
             </div>
             <div style="font-size:22px; color:#4a4a5a; font-family:sans-serif;">
               custard.chriskaschner.com
             </div>
           </div>
         </div>
       </div>`;
     return new ImageResponse(html, { width: 1200, height: 630 });
   }
   ```

3. **Add `handlePageCardPng()` function** immediately after `renderPageCardPng`. Follow `handleQuizCard` pattern exactly (lines 368–406):
   ```js
   async function handlePageCardPng(pageSlug, corsHeaders) {
     const def = PAGE_CARD_DEFS[pageSlug];
     if (!def) {
       return new Response(JSON.stringify({ error: 'Page card not found.' }), {
         status: 404,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
     const profile = getFlavorProfile(def.flavorName || '');
     const accentColor = BASE_COLORS[profile.base] || '#005696';
     const conePngBase64 = await fetchConePngBase64(def.flavorName);
     const response = await renderPageCardPng({
       headline: def.headline,
       subhead: def.subhead,
       flavorName: def.flavorName,
       conePngBase64,
       accentColor,
     });
     const headers = new Headers(response.headers);
     for (const [k, v] of Object.entries(corsHeaders)) {
       headers.set(k, v);
     }
     headers.set('Cache-Control', 'public, max-age=86400');
     return new Response(response.body, { status: response.status, headers });
   }
   ```

4. **Add PNG route match to `handleSocialCard`**. Insert **before** the existing SVG page match (currently around line 555 `const pageMatch = path.match(/^\/og\/page\/([\w-]+)\.svg$/)`). Add these two lines just above it:
   ```js
   // Match /og/page/{slug}.png -- page-level static cards (PNG for social platforms)
   const pagePngMatch = path.match(/^\/og\/page\/([\w-]+)\.png$/);
   if (pagePngMatch) return handlePageCardPng(pagePngMatch[1], corsHeaders);
   ```

5. **Update the file header comment** (lines 3–11) to include the new endpoint:
   Add to the endpoint list: `*   - Per-page static cards (PNG): GET /og/page/{page-slug}.png (PNG)`

6. **Add vitest tests** in `worker/test/social-card.test.js`. Add a new describe block after the flavor rarity describe block (after line ~494). Tests to write:

   ```js
   describe('handleSocialCard - page PNG card', () => {
     let originalFetch;
     beforeEach(() => { originalFetch = globalThis.fetch; globalThis.fetch = mockFetchSuccess(); });
     afterEach(() => { globalThis.fetch = originalFetch; });

     it('returns a PNG response for a valid page slug', async () => { ... });
     it('returns 404 for unknown page slug', async () => { ... });
     it('sets 24h cache TTL', async () => { ... });
     it('includes CORS headers in response', async () => { ... });
     it('returns PNG for all 13 defined page slugs', async () => { ... });
     it('falls back gracefully when cone PNG fetch fails', async () => { ... });
     it('does not interfere with existing SVG page route', async () => { ... });
     it('does not interfere with existing SVG store/date routes', async () => { ... });
   });
   ```

   Reference the quiz card test block (lines 327–404) for exact assertion patterns. Key details:
   - Valid slug test: call `handleSocialCard('/og/page/forecast.png', {}, CORS)`, assert status 200, content-type matches `/image\/png/`
   - 404 test: call with `/og/page/nonexistent.png`, assert status 404, body has error field
   - Cache test: assert `Cache-Control` header is `public, max-age=86400`
   - CORS test: pass custom CORS headers, assert they appear in response
   - All slugs test: iterate `['forecast','calendar','alerts','map','quiz','radar','siri','widget','fronts','scoop','group','compare','fun']`, assert each returns 200
   - Cone failure test: set `globalThis.fetch = mockFetch404()`, assert still returns 200 PNG
   - SVG non-interference: assert `/og/page/forecast.svg` still returns 200 SVG
   - Store/date non-interference: assert `/og/mt-horeb/2026-02-22.svg` still works (needs mock D1)

## Must-Haves

- [ ] `PAGE_CARD_DEFS` has `compare` and `fun` entries (13 total slugs)
- [ ] `renderPageCardPng()` produces an `ImageResponse` with 1200×630 dimensions
- [ ] `handlePageCardPng()` returns 404 JSON for unknown slugs, 200 PNG for valid slugs
- [ ] PNG route regex is matched **before** the SVG page regex in `handleSocialCard`
- [ ] Response includes CORS headers and `Cache-Control: public, max-age=86400`
- [ ] Cone fetch failure does not crash the handler (null fallback)
- [ ] All new tests pass; all existing tests remain green
- [ ] Existing SVG page/trivia/store routes are untouched

## Verification

- `cd worker && npm test -- test/social-card.test.js` — all tests pass (existing + ~8 new page PNG tests)
- `cd worker && npm test` — full suite still green
- `grep -c 'renderPageCardPng\|handlePageCardPng' worker/src/social-card.js` returns 2+ (functions exist)
- `grep -c 'pagePngMatch' worker/src/social-card.js` returns 2 (regex + if statement)

## Inputs

- `worker/src/social-card.js` — existing file with `PAGE_CARD_DEFS`, `renderPageCard`, `handlePageCard`, `renderQuizCardPng`, `handleQuizCard`, `handleSocialCard` router
- `worker/test/social-card.test.js` — existing test file with quiz/flavor PNG card test patterns to follow

## Expected Output

- `worker/src/social-card.js` — modified: `PAGE_CARD_DEFS` gains `compare`/`fun`; new `renderPageCardPng` and `handlePageCardPng` functions; new PNG route regex in `handleSocialCard`
- `worker/test/social-card.test.js` — modified: new `describe('handleSocialCard - page PNG card')` block with ~8 tests
