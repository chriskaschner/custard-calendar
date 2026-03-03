#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FLAVOR_PROFILES,
  BASE_COLORS,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_COLORS,
} from '../worker/src/flavor-colors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FLAVORS_JSON_PATH = path.join(REPO_ROOT, 'docs', 'flavors.json');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets');
const OUT_PATH_MD = path.join(OUT_DIR, 'masterlock-prompt-pack.md');
const OUT_PATH_JSON = path.join(OUT_DIR, 'masterlock-flavor-fills.json');
const OUT_PATH_JS = path.join(OUT_DIR, 'masterlock-flavor-fills.js');

const TITLE_FALLBACK = {
  'double butter pecan': 'Double Butter Pecan',
  'oreo cookie overload': 'OREO Cookie Overload',
};

const DESCRIPTION_FALLBACK = {
  'double butter pecan': 'Vanilla Fresh Frozen Custard with extra pecan pieces.',
  'oreo cookie overload': 'Chocolate Fresh Frozen Custard overloaded with OREO cookie pieces and chocolate syrup.',
};

const BASE_LABELS = {
  vanilla: 'Vanilla custard',
  chocolate: 'Chocolate custard',
  chocolate_custard: 'Deep chocolate custard',
  dark_chocolate: 'Dark chocolate custard',
  mint: 'Mint custard',
  mint_andes: 'Andes mint custard',
  strawberry: 'Strawberry custard',
  cheesecake: 'Cheesecake custard',
  caramel: 'Caramel custard',
  butter_pecan: 'Butter pecan custard',
  peach: 'Peach custard',
  lemon: 'Lemon custard',
  blackberry: 'Blackberry custard',
};

const RIBBON_LABELS = {
  caramel: 'Caramel ribbon',
  peanut_butter: 'Peanut butter swirl',
  marshmallow: 'Marshmallow swirl',
  chocolate_syrup: 'Chocolate syrup ribbon',
  fudge: 'Fudge ribbon',
};

const TOPPING_LABELS = {
  oreo: 'OREO cookie chunks',
  andes: 'Andes mint pieces',
  dove: 'Dark chocolate chunks',
  pecan: 'Pecan pieces',
  cashew: 'Cashew pieces',
  heath: 'Heath toffee bits',
  butterfinger: 'Butterfinger crunch bits',
  cookie_dough: 'Cookie dough chunks',
  strawberry_bits: 'Strawberry bits',
  raspberry: 'Raspberry pieces',
  peach_bits: 'Peach bits',
  salt: 'Salt crystals',
  snickers: 'Snickers pieces',
  cake: 'Chocolate cake chunks',
  cheesecake_bits: 'Cheesecake bits',
  m_and_m: 'M and M candy pieces',
  reeses: "Reese's cup pieces",
  brownie: 'Brownie chunks',
  blueberry: 'Blueberry pieces',
  pie_crust: 'Pie crust pieces',
};

const DENSITY_NOTES = {
  pure: 'Smooth scoop with low inclusion noise. Keep texture subtle and creamy.',
  standard: 'Balanced texture depth with inclusions spread evenly and clearly separated.',
  double: 'Emphasize the primary inclusion with repeated chunks near top and mid scoop.',
  explosion: 'Dense inclusion field with layered depth while keeping each ingredient readable.',
  overload: 'Very dense single-ingredient distribution across the scoop surface.',
};

const PREMIUM_TREATMENT_OVERRIDES = {
  'blackberry cobbler': {
    base: 'Creamy vanilla-white custard with blackberry marbling (#F5DEB3 mixed with deep blackberry tones #6B3FA0).',
    swirls: 'Deep purple blackberry sauce ribbons with visible marbling through the scoop.',
    chunks: 'Whole blackberries with clustered drupelet shape and glossy deep-purple highlights; pie crust pieces as irregular golden crumbles with slightly toasted edges.',
    texture: 'Visible sauce marbling, balanced chunk placement, and clear depth between berries, sauce, and custard body.',
  },
};

const QUALITY_LADDER = [
  {
    tier: 'L0',
    name: 'Tidbyt Micro',
    appSurface: 'Tidbyt forecast columns',
    density: '9x11',
    guidance: 'Extreme simplification. Keep a clean cone silhouette, no anti-aliasing, and 0-3 readable inclusions.',
  },
  {
    tier: 'L1',
    name: 'Map Marker Micro',
    appSurface: 'Map marker cone icon',
    density: '9x11 in pin',
    guidance: 'Same geometry as L0 with slightly boosted contrast for map legibility.',
  },
  {
    tier: 'L2',
    name: 'Widget Mini',
    appSurface: 'Widget and inline mini cone',
    density: '9x11 scaled',
    guidance: 'Allow mild highlight and up to 4 inclusions while preserving hard pixel edges.',
  },
  {
    tier: 'L3',
    name: 'Radar HD',
    appSurface: 'Radar cards',
    density: '18x21',
    guidance: 'Use HD slot layout, visible ribbon curve, and clearly separated ingredient colors.',
  },
  {
    tier: 'L4',
    name: 'Hero/OG Pixel',
    appSurface: 'Hero and OG cone render',
    density: '36x42',
    guidance: 'Use hero slot layout with specular highlight, edge shadow, and strong ingredient readability.',
  },
  {
    tier: 'L5',
    name: 'Premium Showcase',
    appSurface: 'Marketing or hero reference art',
    density: '32-64px style density',
    guidance: 'Highest detail while still pixel art: visible marbling, realistic chunk forms, and crisp per-pixel depth.',
  },
];

const MASTERLOCK_TEMPLATE = `Pixel art ice cream cone, centered composition, single scoop, 1:1 aspect ratio.

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

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122]/g, '')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromKey(key) {
  if (TITLE_FALLBACK[key]) return TITLE_FALLBACK[key];
  return key
    .split(' ')
    .map((word) => {
      if (word === 'oreo') return 'OREO';
      if (word === 'pb') return 'PB';
      if (word === 'and') return 'and';
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
          .join("'");
      }
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatChunkInclusions(toppings) {
  if (!toppings || toppings.length === 0) {
    return 'None (clean scoop with no chunk inclusions).';
  }

  const counts = new Map();
  const order = [];
  for (const topping of toppings) {
    if (!counts.has(topping)) order.push(topping);
    counts.set(topping, (counts.get(topping) || 0) + 1);
  }

  return order
    .map((topping) => {
      const label = TOPPING_LABELS[topping] || topping;
      const hex = TOPPING_COLORS[topping] || 'n/a';
      return `${label} x${counts.get(topping)} (${hex})`;
    })
    .join('; ');
}

function textureNotesForProfile(profile) {
  const density = profile.density || 'standard';
  const notes = [DENSITY_NOTES[density] || DENSITY_NOTES.standard];

  if (profile.ribbon) {
    notes.push('Keep ribbon visible through inclusions with clean edge contrast.');
  }

  const hasDarkBase = profile.base === 'dark_chocolate' || profile.base === 'chocolate_custard';
  const hasDarkChunks = (profile.toppings || []).some((key) => key === 'dove' || key === 'brownie' || key === 'oreo');
  if (hasDarkBase && hasDarkChunks) {
    notes.push('Boost local contrast around dark chunks so ingredients stay readable.');
  }

  return notes.join(' ');
}

function ingredientTreatmentForFlavor(profile) {
  const baseLabel = BASE_LABELS[profile.base] || profile.base;
  const baseHex = BASE_COLORS[profile.base] || 'n/a';

  const swirls = profile.ribbon
    ? `${RIBBON_LABELS[profile.ribbon] || profile.ribbon} (${RIBBON_COLORS[profile.ribbon] || 'n/a'}).`
    : 'None.';

  return {
    base: `${baseLabel} (${baseHex}).`,
    swirls,
    chunks: formatChunkInclusions(profile.toppings || []),
    texture: textureNotesForProfile(profile),
  };
}

function flavorFillSnippet({ title, description, treatment }) {
  return `Flavor: ${title}

Description:
${description}

Ingredient treatment:
- Base custard color: ${treatment.base}
- Swirls: ${treatment.swirls}
- Chunk inclusions: ${treatment.chunks}
- Texture notes: ${treatment.texture}`;
}

async function main() {
  const rawFlavorCatalog = JSON.parse(await fs.readFile(FLAVORS_JSON_PATH, 'utf8'));
  const catalog = Array.isArray(rawFlavorCatalog.flavors) ? rawFlavorCatalog.flavors : rawFlavorCatalog;

  const titleByNormalized = new Map();
  const descriptionByNormalized = new Map();
  for (const flavor of catalog) {
    const key = normalizeName(flavor.title);
    titleByNormalized.set(key, flavor.title);
    descriptionByNormalized.set(key, flavor.description);
  }

  const fillCards = [];
  const profileKeys = Object.keys(FLAVOR_PROFILES).sort();

  for (const key of profileKeys) {
    const normalized = normalizeName(key);
    const title = titleByNormalized.get(normalized) || titleFromKey(key);
    const description = descriptionByNormalized.get(normalized) || DESCRIPTION_FALLBACK[key];
    if (!description) {
      throw new Error(`No description available for flavor key "${key}"`);
    }

    const profile = FLAVOR_PROFILES[key];
    const treatment = ingredientTreatmentForFlavor(profile);
    const premiumTreatmentOverride = PREMIUM_TREATMENT_OVERRIDES[key] || null;
    fillCards.push({
      flavor_key: key,
      title,
      description,
      treatment,
      premium_treatment_override: premiumTreatmentOverride,
      profile,
    });
  }

  const ladderTableRows = QUALITY_LADDER
    .map((row) => `| ${row.tier} | ${row.name} | ${row.appSurface} | ${row.density} | ${row.guidance} |`)
    .join('\n');

  const markdownCards = fillCards
    .map((card) => `## ${card.title}

Description: ${card.description}

Flavor fill:
\`\`\`text
${flavorFillSnippet({
  title: card.title,
  description: card.description,
  treatment: card.treatment,
})}
\`\`\`

Canonical profile:
- Base key: \`${card.profile.base}\`
- Ribbon key: \`${card.profile.ribbon || 'none'}\`
- Toppings: \`${(card.profile.toppings || []).join(', ') || 'none'}\`
- Density: \`${card.profile.density || 'standard'}\`

${card.premium_treatment_override ? `L5 premium override (showcase detail):
\`\`\`text
Ingredient treatment:
- Base custard color: ${card.premium_treatment_override.base}
- Swirls: ${card.premium_treatment_override.swirls}
- Chunk inclusions: ${card.premium_treatment_override.chunks}
- Texture notes: ${card.premium_treatment_override.texture}
\`\`\`` : ''}`)
    .join('\n\n---\n\n');

  const markdown = `# Masterlock Pixel Prompt Pack

Auto-generated from:
- worker/src/flavor-colors.js
- docs/flavors.json

Regenerate:
\`\`\`bash
node tools/generate_masterlock_prompts.mjs
\`\`\`

## Locked Template

\`\`\`text
${MASTERLOCK_TEMPLATE}
\`\`\`

## Complexity Ladder

Use this ladder to scale from left-side map/Tidbyt simplicity up to premium Blackberry-style detail.

| Tier | Name | App surface | Density | Guidance |
| --- | --- | --- | --- | --- |
${ladderTableRows}

## Flavor Fill Cards (${fillCards.length})

${markdownCards}
`;

  const json = {
    generated_at: new Date().toISOString(),
    source: {
      flavor_profiles: 'worker/src/flavor-colors.js',
      descriptions: 'docs/flavors.json',
    },
    color_data: {
      profiles: FLAVOR_PROFILES,
      base_colors: BASE_COLORS,
      ribbon_colors: RIBBON_COLORS,
      topping_colors: TOPPING_COLORS,
      cone_colors: CONE_COLORS,
    },
    complexity_ladder: QUALITY_LADDER,
    template: MASTERLOCK_TEMPLATE,
    flavors: fillCards.map((card) => ({
      flavor_key: card.flavor_key,
      title: card.title,
      description: card.description,
      ingredient_treatment: card.treatment,
      premium_treatment_override: card.premium_treatment_override,
      profile: card.profile,
    })),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_PATH_MD, markdown, 'utf8');
  await fs.writeFile(OUT_PATH_JSON, JSON.stringify(json, null, 2) + '\n', 'utf8');
  await fs.writeFile(OUT_PATH_JS, 'window.MASTERLOCK_FLAVOR_FILLS = ' + JSON.stringify(json, null, 2) + ';\n', 'utf8');
  console.log(`Wrote ${fillCards.length} flavor cards to ${OUT_PATH_MD}`);
  console.log(`Wrote JSON flavor fills to ${OUT_PATH_JSON}`);
  console.log(`Wrote browser seed JS to ${OUT_PATH_JS}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
