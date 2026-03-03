#!/usr/bin/env node
/**
 * Offline sprite generator: renders all FLAVOR_PROFILES × all 6 tiers to SVG files.
 *
 * Output: docs/assets/sprites/
 *   flavor-{slug}-l0.svg  (Tidbyt Micro)
 *   flavor-{slug}-l1.svg  (Map Marker Micro)
 *   flavor-{slug}-l2.svg  (Widget Mini)
 *   flavor-{slug}-l3.svg  (Radar HD)
 *   flavor-{slug}-l4.svg  (Hero / OG Pixel)
 *   flavor-{slug}-l5.svg  (Premium Showcase)
 *   manifest.json
 *   sprite-preview.html
 *
 * Usage:
 *   node tools/generate_sprites.mjs
 *   node tools/generate_sprites.mjs --flavor "blackberry cobbler"  # single flavor
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FLAVOR_PROFILES,
  renderConeSVG,
  renderConeHDSVG,
  renderConeHeroSVG,
  renderConePremiumSVG,
} from '../worker/src/flavor-colors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets', 'sprites');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Title-case a flavor key ('dark chocolate pb crunch' -> 'Dark Chocolate Pb Crunch'). */
function toDisplayName(key) {
  return key.replace(/(^|[\s-])(\w)/g, (_, sep, c) => sep + c.toUpperCase());
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapMarkerSvg(innerConeSvg) {
  const inner = innerConeSvg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72" width="64" height="72" shape-rendering="crispEdges">
  <path d="M32 2 C18 2 7 13 7 27 C7 45 23 56 32 70 C41 56 57 45 57 27 C57 13 46 2 32 2 Z"
        fill="#173054" stroke="#325a87" stroke-width="2"/>
  <rect x="17" y="13" width="30" height="30" rx="15" fill="#102744"/>
  <g transform="translate(18,14)">${inner}</g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

const TIERS = [
  {
    id: 'l0',
    label: 'Tidbyt Micro',
    dims: '9x10',
    render: (name) => renderConeSVG(name, 1),
  },
  {
    id: 'l1',
    label: 'Map Marker Micro',
    dims: '64x72',
    render: (name) => mapMarkerSvg(renderConeSVG(name, 3)),
  },
  {
    id: 'l2',
    label: 'Widget Mini',
    dims: '45x50',
    render: (name) => renderConeSVG(name, 5),
  },
  {
    id: 'l3',
    label: 'Radar HD',
    dims: '90x105',
    render: (name) => renderConeHDSVG(name, 5),
  },
  {
    id: 'l4',
    label: 'Hero / OG Pixel',
    dims: '144x168',
    render: (name) => renderConeHeroSVG(name, 4),
  },
  // L5 Premium Showcase removed — replaced by AI-generated L4 PNG
];

// ---------------------------------------------------------------------------
// Preview page
// ---------------------------------------------------------------------------

function buildPreviewHtml(manifest) {
  const flavorEntries = Object.entries(manifest);
  const rows = flavorEntries
    .map(([slug, entry]) => {
      const cells = TIERS.map(
        (t) =>
          `<td class="cell"><img src="./${esc(path.basename(entry.tiers[t.id].path))}" alt="${esc(entry.name)} ${esc(t.label)}" title="${esc(t.label)}"></td>`
      ).join('');
      return `<tr><td class="flavor-name">${esc(entry.name)}</td>${cells}</tr>`;
    })
    .join('\n');

  const headerCells = TIERS.map(
    (t) => `<th>${esc(t.id)}<br><span class="dims">${esc(t.label)}</span></th>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Custard Sprite Sheet</title>
<style>
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: #0e1117; color: #e8eaf0; }
  main { max-width: 1400px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #98a2b3; font-size: 13px; margin-bottom: 16px; }
  input { background: #1a1f2e; border: 1px solid #2e3548; color: #e8eaf0; border-radius: 6px;
          padding: 6px 10px; font-size: 13px; width: 260px; margin-bottom: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #1a1f2e; border: 1px solid #2e3548; padding: 6px 10px; font-size: 11px;
       text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  .dims { font-size: 10px; color: #64748b; text-transform: none; letter-spacing: 0; }
  td { border: 1px solid #2e3548; vertical-align: middle; }
  .flavor-name { padding: 4px 10px; font-size: 12px; white-space: nowrap; min-width: 200px;
                 color: #cbd5e1; }
  .cell { padding: 6px; text-align: center; background: #140c06; }
  .cell img { image-rendering: pixelated; image-rendering: crisp-edges; display: block; margin: 0 auto; }
  tr:hover td { background: #1a1f2e; }
  tr:hover .cell { background: #1e1208; }
  tr.hidden { display: none; }
</style>
</head>
<body>
<main>
  <h1>Custard Sprite Sheet</h1>
  <div class="meta">${flavorEntries.length} flavors &times; ${TIERS.length} tiers = ${flavorEntries.length * TIERS.length} sprites</div>
  <input type="search" id="filter" placeholder="Filter flavors..." oninput="filterRows(this.value)">
  <table>
    <thead><tr><th>Flavor</th>${headerCells}</tr></thead>
    <tbody id="tbody">${rows}</tbody>
  </table>
</main>
<script>
function filterRows(q) {
  const term = q.toLowerCase();
  document.querySelectorAll('#tbody tr').forEach(row => {
    row.classList.toggle('hidden', !row.querySelector('.flavor-name').textContent.toLowerCase().includes(term));
  });
}
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const filterIdx = args.indexOf('--flavor');
  const filterKey = filterIdx >= 0 ? args[filterIdx + 1]?.toLowerCase() : null;

  await fs.mkdir(OUT_DIR, { recursive: true });

  const allKeys = Object.keys(FLAVOR_PROFILES);
  const keys = filterKey ? allKeys.filter((k) => k === filterKey) : allKeys;

  if (filterKey && keys.length === 0) {
    console.error(`Flavor key not found: "${filterKey}"`);
    console.error(`Available: ${allKeys.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const manifest = {};
  let written = 0;

  for (const flavorKey of keys) {
    const slug = slugify(flavorKey);
    const name = toDisplayName(flavorKey);

    manifest[slug] = { flavor: flavorKey, name, tiers: {} };

    for (const tier of TIERS) {
      const filename = `flavor-${slug}-${tier.id}.svg`;
      const filepath = path.join(OUT_DIR, filename);
      const svg = tier.render(name);
      await fs.writeFile(filepath, svg, 'utf8');
      manifest[slug].tiers[tier.id] = {
        label: tier.label,
        dims: tier.dims,
        path: `assets/sprites/${filename}`,
      };
      written++;
    }

    process.stdout.write(`  ${name}\n`);
  }

  // Always write manifest covering full set (merge with existing if partial run)
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch {
    // first run
  }
  const merged = { ...existing, ...manifest };
  await fs.writeFile(manifestPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

  // Rebuild preview from full manifest
  await fs.writeFile(
    path.join(OUT_DIR, 'sprite-preview.html'),
    buildPreviewHtml(merged),
    'utf8'
  );

  const total = Object.keys(merged).length;
  console.log(`\nWrote ${written} sprites.`);
  console.log(`Manifest: ${total} flavors x ${TIERS.length} tiers`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
