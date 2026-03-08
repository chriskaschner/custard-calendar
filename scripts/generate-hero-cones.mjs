#!/usr/bin/env node
/**
 * Generate hero cone PNG assets for all flavors in FLAVOR_PROFILES.
 *
 * Uses the Worker's renderConeHeroSVG (36x42 grid) at scale 4 (= 144x168px),
 * then rasterizes each SVG to a 120px-wide PNG via sharp.
 *
 * Output: docs/assets/cones/{slug}.png for each flavor.
 *
 * Usage: node scripts/generate-hero-cones.mjs
 */

import { createRequire } from 'module';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Import the flavor-colors module from the Worker source
const {
  FLAVOR_PROFILES,
  renderConeHeroSVG,
  getFlavorProfile,
  BASE_COLORS,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_COLORS,
  CONE_TIP_COLOR,
} = await import(join(ROOT, 'worker', 'src', 'flavor-colors.js'));

// Dynamically import sharp
let sharp;
try {
  const sharpMod = await import('sharp');
  sharp = sharpMod.default || sharpMod;
} catch {
  // Try require approach
  try {
    const require = createRequire(import.meta.url);
    sharp = require('sharp');
  } catch {
    console.error('sharp not available. Install with: npm install sharp');
    console.log('Falling back to SVG-only generation + sips conversion...');
    sharp = null;
  }
}

const CONES_DIR = join(ROOT, 'docs', 'assets', 'cones');
mkdirSync(CONES_DIR, { recursive: true });

/**
 * Convert a flavor name to a slug for the PNG filename.
 */
function flavorSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate SVG string for a flavor using the hero renderer.
 * Scale 4 = 144x168px SVG, which will be resized to 120px width.
 */
function generateSVG(flavorName) {
  return renderConeHeroSVG(flavorName, 4);
}

/**
 * Convert SVG string to PNG buffer via sharp.
 */
async function svgToPng(svgString, width) {
  const svgBuffer = Buffer.from(svgString);
  return sharp(svgBuffer)
    .resize({ width, kernel: 'nearest' })
    .png()
    .toBuffer();
}

/**
 * Convert SVG file to PNG using macOS sips (fallback when sharp unavailable).
 */
async function svgToPngViaSips(svgString, outputPath, width) {
  const { execSync } = await import('child_process');
  const tmpSvg = outputPath.replace('.png', '.tmp.svg');
  writeFileSync(tmpSvg, svgString);
  try {
    // sips can convert SVG to PNG on macOS
    execSync(`sips -s format png "${tmpSvg}" --out "${outputPath}" --resampleWidth ${width} 2>/dev/null`);
  } finally {
    try { const { unlinkSync } = await import('fs'); unlinkSync(tmpSvg); } catch {}
  }
}

// Get all flavor names from FLAVOR_PROFILES
const flavorNames = Object.keys(FLAVOR_PROFILES);
console.log(`Generating hero cone PNGs for ${flavorNames.length} flavors...`);

let generated = 0;
let errors = 0;

for (const flavorName of flavorNames) {
  const slug = flavorSlug(flavorName);
  const outputPath = join(CONES_DIR, slug + '.png');
  const svg = generateSVG(flavorName);

  try {
    if (sharp) {
      const pngBuffer = await svgToPng(svg, 120);
      writeFileSync(outputPath, pngBuffer);
    } else {
      await svgToPngViaSips(svg, outputPath, 120);
    }
    generated++;
    process.stdout.write(`  [${generated}/${flavorNames.length}] ${slug}.png\n`);
  } catch (err) {
    errors++;
    console.error(`  FAILED: ${slug}.png -- ${err.message}`);
  }
}

console.log(`\nDone: ${generated} generated, ${errors} errors, ${flavorNames.length} total flavors.`);

// Verify output
const { readdirSync } = await import('fs');
const pngFiles = readdirSync(CONES_DIR).filter(f => f.endsWith('.png'));
console.log(`Files in docs/assets/cones/: ${pngFiles.length} PNGs`);
