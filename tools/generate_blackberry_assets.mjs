#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BASE_COLORS,
  CONE_COLORS,
  FLAVOR_PROFILES,
  RIBBON_COLORS,
  TOPPING_COLORS,
  renderConeHDSVG,
  renderConeHeroSVG,
  renderConePremiumSVG,
  renderConeSVG,
} from '../worker/src/flavor-colors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets', 'blackberry-cobbler');
const MASTERLOCK_JSON = path.join(REPO_ROOT, 'docs', 'assets', 'masterlock-flavor-fills.json');

const FLAVOR_NAME = 'Blackberry Cobbler';
const FLAVOR_KEY = 'blackberry cobbler';

const LOCKED_TEMPLATE = `Pixel art ice cream cone, centered composition, single scoop, 1:1 aspect ratio.

Quality target:
Choose one tier from the complexity ladder: [L0 | L1 | L2 | L3 | L4 | L5]
Do not blend tiers in a single render.

Style:
Highly detailed modern pixel art, crisp edges, 32-64px style density, smooth but still clearly pixel-based.
Not vector. Not painterly. Not photorealistic. No blur.

Lighting:
Soft studio lighting from upper left.
Gentle highlight across scoop.
Subtle shadow under scoop lip.
No harsh reflections.

Background:
Solid deep brown-black background (#140c06 tone).
No gradients.
No texture.
No logo.
No text.

Cone:
Golden waffle cone with checker pattern.
Warm orange + honey tones.
NO darkened tip.
Tip same tone as rest of cone.
Cone slightly higher resolution than scoop.

Scoop:
Ingredients must be clearly readable.
Distinct chunks and swirls.
Visible texture depth.
Balanced distribution.

Flavor: [FLAVOR NAME]

Description:
[Official Culver's description]

Ingredient treatment:
- Base custard color:
- Swirls:
- Chunk inclusions:
- Texture notes:`;

const COMPLEXITY_LADDER = [
  { tier: 'L0', label: 'Tidbyt Micro', output: 'blackberry-l0-tidbyt.svg' },
  { tier: 'L1', label: 'Map Marker Micro', output: 'blackberry-l1-map-marker.svg' },
  { tier: 'L2', label: 'Widget Mini', output: 'blackberry-l2-widget.svg' },
  { tier: 'L3', label: 'Radar HD', output: 'blackberry-l3-radar-hd.svg' },
  { tier: 'L4', label: 'Hero / OG Pixel', output: 'blackberry-l4-hero.svg' },
  { tier: 'L5', label: 'Premium Showcase', output: 'blackberry-l5-premium.svg' },
];

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function withClass(svg, className) {
  return svg.replace('<svg ', `<svg class="${className}" `);
}

function mapMarkerSvg(innerConeSvg) {
  const markerW = 64;
  const markerH = 72;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${markerW} ${markerH}" width="${markerW}" height="${markerH}" shape-rendering="crispEdges">
  <path d="M32 2 C18 2 7 13 7 27 C7 45 23 56 32 70 C41 56 57 45 57 27 C57 13 46 2 32 2 Z"
        fill="#173054" stroke="#325a87" stroke-width="2"/>
  <rect x="17" y="13" width="30" height="30" rx="15" fill="#102744" />
  <g transform="translate(18,14)">
    ${innerConeSvg.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>
</svg>`;
}

function buildPromptFromFill(card, treatment) {
  return LOCKED_TEMPLATE
    .replace('[FLAVOR NAME]', card.title)
    .replace("[Official Culver's description]", card.description || '')
    .replace('- Base custard color:', `- Base custard color: ${treatment.base || ''}`)
    .replace('- Swirls:', `- Swirls: ${treatment.swirls || ''}`)
    .replace('- Chunk inclusions:', `- Chunk inclusions: ${treatment.chunks || ''}`)
    .replace('- Texture notes:', `- Texture notes: ${treatment.texture || ''}`);
}

async function main() {
  const raw = JSON.parse(await fs.readFile(MASTERLOCK_JSON, 'utf8'));
  const card = (raw.flavors || []).find((item) => item.flavor_key === FLAVOR_KEY);
  if (!card) {
    throw new Error(`Flavor key "${FLAVOR_KEY}" not found in ${MASTERLOCK_JSON}`);
  }

  const profile = FLAVOR_PROFILES[FLAVOR_KEY];
  if (!profile) {
    throw new Error(`Flavor key "${FLAVOR_KEY}" not found in canonical profiles`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const l0 = withClass(renderConeSVG(FLAVOR_NAME, 1), 'cone-l0');
  const l1Cone = renderConeSVG(FLAVOR_NAME, 3);
  const l1 = mapMarkerSvg(l1Cone);
  const l2 = withClass(renderConeSVG(FLAVOR_NAME, 5), 'cone-l2');
  const l3 = withClass(renderConeHDSVG(FLAVOR_NAME, 5), 'cone-l3');
  const l4 = withClass(renderConeHeroSVG(FLAVOR_NAME, 4), 'cone-l4');
  const l5 = withClass(renderConePremiumSVG(FLAVOR_NAME, 6), 'cone-l5');

  const files = [
    ['blackberry-l0-tidbyt.svg', l0],
    ['blackberry-l1-map-marker.svg', l1],
    ['blackberry-l2-widget.svg', l2],
    ['blackberry-l3-radar-hd.svg', l3],
    ['blackberry-l4-hero.svg', l4],
    ['blackberry-l5-premium.svg', l5],
  ];

  for (const [name, content] of files) {
    await fs.writeFile(path.join(OUT_DIR, name), content, 'utf8');
  }

  const canonicalPrompt = buildPromptFromFill(card, card.ingredient_treatment || {});
  const premiumPrompt = buildPromptFromFill(
    card,
    card.premium_treatment_override || card.ingredient_treatment || {}
  );

  const promptDoc = `# Blackberry Cobbler Prompt Set

Flavor: ${card.title}
Description: ${card.description}

## Canonical Prompt (L0-L4 aligned)

\`\`\`text
${canonicalPrompt}
\`\`\`

## Premium Prompt (L5 showcase)

\`\`\`text
${premiumPrompt}
\`\`\`
`;
  await fs.writeFile(path.join(OUT_DIR, 'blackberry-prompts.md'), promptDoc, 'utf8');

  const metadata = {
    flavor: card.title,
    flavor_key: FLAVOR_KEY,
    description: card.description,
    generated_at: new Date().toISOString(),
    outputs: COMPLEXITY_LADDER,
    canonical_profile: profile,
    palettes: {
      base: BASE_COLORS,
      ribbon: RIBBON_COLORS,
      toppings: TOPPING_COLORS,
      cone: CONE_COLORS,
    },
    treatments: {
      canonical: card.ingredient_treatment,
      premium: card.premium_treatment_override || null,
    },
  };
  await fs.writeFile(
    path.join(OUT_DIR, 'blackberry-asset-manifest.json'),
    JSON.stringify(metadata, null, 2) + '\n',
    'utf8'
  );

  const preview = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blackberry Cobbler Asset Preview</title>
<style>
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: #0e1117; color: #e8eaf0; }
  main { max-width: 1180px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin-bottom: 6px; }
  p { color: #98a2b3; margin-top: 0; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(260px, 1fr)); gap: 12px; }
  .card { background: #1a1f2e; border: 1px solid #2e3548; border-radius: 8px; padding: 12px; }
  .name { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
  .swatch { background: #140c06; border-radius: 8px; min-height: 180px; display: flex; align-items: center; justify-content: center; }
  .swatch img { image-rendering: pixelated; image-rendering: crisp-edges; }
</style>
</head>
<body>
<main>
  <h1>${esc(card.title)} Asset Pack</h1>
  <p>${esc(card.description || '')}</p>
  <div class="grid">
    ${COMPLEXITY_LADDER.map((item) => `<section class="card"><div class="name">${esc(item.tier)} · ${esc(item.label)}</div><div class="swatch"><img src="./${esc(item.output)}" alt="${esc(item.tier)} ${esc(item.label)}"></div></section>`).join('\n')}
  </div>
</main>
</body>
</html>`;

  await fs.writeFile(path.join(OUT_DIR, 'blackberry-asset-preview.html'), preview, 'utf8');

  console.log(`Wrote blackberry asset set to ${OUT_DIR}`);
  for (const [name] of files) {
    console.log(`- ${name}`);
  }
  console.log('- blackberry-prompts.md');
  console.log('- blackberry-asset-manifest.json');
  console.log('- blackberry-asset-preview.html');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
