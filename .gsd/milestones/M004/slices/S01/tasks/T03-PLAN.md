---
estimated_steps: 4
estimated_files: 1
skills_used:
  - frontend-design
  - accessibility
  - best-practices
---

# T03: Build bootstrap snippet generator on widget.html

**Slice:** S01 — Widget Bootstrap Flow
**Milestone:** M004

## Description

Transform `docs/widget.html` from a manual 5-step copy-paste setup guide into a one-paste bootstrap experience. The existing store finder (Step 1) becomes the input for a new snippet generator that produces a short, personalized Scriptable bootstrap snippet. Users select their store(s), choose single or multi-store mode, and get a ready-to-copy snippet that downloads and installs the full widget automatically.

This task delivers R011 (one-paste install with store slug pre-configured) and R012 (multi-store setup without code editing).

## Steps

1. **Keep the existing store finder (Step 1)** — the search input, results list, and slug-copy functionality in the `<script>` block at the bottom of widget.html. This is solid UI that already works. Modify the slug click handler so that instead of (or in addition to) copying the slug to clipboard, it also populates the snippet generator with the selected store.

2. **Replace Steps 2-5 with a snippet generator section**. Add a new `<section class="widget-section">` after Step 1 containing:
   - **Mode toggle**: Two styled buttons/tabs — "Single Store" (default active) and "Multi-Store". Use the existing `.widget-mode-card` styling pattern as a reference.
   - **Store selection state**: For single store, show the currently selected store slug (populated when user clicks a slug in Step 1). For multi-store, allow selecting up to 3 stores — each click on a slug in the finder adds it to a list (with remove buttons). Show "Select up to 3 stores" placeholder when empty.
   - **Snippet output**: A `<textarea>` (read-only, monospace) showing the generated bootstrap snippet. The snippet template for single-store mode:
     ```
     let fm; try { fm = FileManager.iCloud(); } catch(e) { fm = FileManager.local(); }
     let dir = fm.documentsDirectory();
     let path = fm.joinPath(dir, "Custard Today.js");
     let req = new Request("https://custard.chriskaschner.com/api/v1/widget/script");
     let code = await req.loadString();
     let config = 'var slug = "SLUG";\n';
     fm.writeString(path, config + code);
     ```
     For multi-store, the config line becomes: `'var MODE = "multi";\nvar slugs = ["slug1","slug2","slug3"];\nvar slug = "slug1";\n'`
   - **Copy button**: A prominent "Copy Snippet" button that copies the textarea content to clipboard and shows the existing toast notification.
   - **Updated instructions** below the snippet: Simplified to 4 steps: (1) Find your store above, (2) Copy the snippet, (3) Open Scriptable → tap + → paste the snippet → tap ▶ to run, (4) Add a Scriptable widget to your home screen and set it to "Custard Today".

3. **Keep the Widget Modes section** (Small/Medium/Multi-Store cards) — this is useful reference documentation. Update the Multi-Store card description to mention that multi-store is now configured through the snippet generator above (not by editing the script).

4. **Wire up the JavaScript**: In the existing `<script>` block at the bottom:
   - Add state variables: `selectedMode` ('single'/'multi'), `selectedSlugs` (array, max 3)
   - Modify the slug click handler in `resultsDiv.addEventListener('click', ...)` to call a new `addStoreToSnippet(slug)` function that updates state and regenerates the snippet
   - Add `generateSnippet()` function that builds the appropriate snippet string based on mode and selected slugs, and writes it to the textarea
   - Add mode toggle click handlers
   - Add copy button handler using `navigator.clipboard.writeText()`
   - The snippet textarea should show a placeholder message ("Select a store above to generate your snippet") when no store is selected

## Must-Haves

- [ ] Store finder (Step 1) works as before — search, results, click to select
- [ ] Mode toggle between Single Store and Multi-Store is functional
- [ ] Snippet textarea shows personalized bootstrap code with selected store slug(s)
- [ ] Multi-store mode allows selecting up to 3 stores with pre-configured `MODE` and `slugs`
- [ ] Copy button copies snippet to clipboard with toast feedback
- [ ] Bootstrap snippet includes `FileManager.iCloud()` with `FileManager.local()` fallback
- [ ] Setup instructions reduced to 4 clear steps
- [ ] Existing shared-nav, planner scripts, and footer remain functional

## Verification

- `grep -q 'FileManager' docs/widget.html` — bootstrap snippet template present
- `grep -q 'MODE.*multi' docs/widget.html` — multi-store snippet template present
- `grep -q 'generateSnippet\|addStoreToSnippet' docs/widget.html` — generator JS functions present
- `grep -q '/api/v1/widget/script' docs/widget.html` — snippet references the correct API endpoint

## Inputs

- `docs/widget.html` — existing 427-line widget setup page with store finder and 5-step instructions

## Expected Output

- `docs/widget.html` — rewritten with snippet generator UI, mode toggle, copy button, and simplified 4-step instructions
