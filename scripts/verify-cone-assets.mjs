#!/usr/bin/env node
/**
 * Verify cone asset completeness, dimensions, manifest, and transparency.
 *
 * Used by Plans 02 and 03 and the final phase gate to confirm all 94 flavors
 * have correctly sized, transparent PNGs and a complete generation manifest.
 *
 * Usage:
 *   node scripts/verify-cone-assets.mjs              # Check all 94 PNGs exist
 *   node scripts/verify-cone-assets.mjs --dimensions  # Verify PNG dimensions
 *   node scripts/verify-cone-assets.mjs --manifest    # Verify generation manifest
 *   node scripts/verify-cone-assets.mjs --transparency # Verify alpha channel
 *   node scripts/verify-cone-assets.mjs --all         # Run all checks
 */

import { createRequire } from 'module';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Import FLAVOR_PROFILES from worker source
const { FLAVOR_PROFILES } = await import(join(ROOT, 'worker', 'src', 'flavor-colors.js'));

// Import sharp -- resolve from worker/node_modules using same pattern as generate-hero-cones.mjs
let sharp;
try {
  const sharpMod = await import('sharp');
  sharp = sharpMod.default || sharpMod;
} catch {
  try {
    const require = createRequire(join(ROOT, 'worker', 'package.json'));
    sharp = require('sharp');
  } catch {
    // sharp only required for --dimensions, --transparency, --all
    sharp = null;
  }
}

const CONES_DIR = join(ROOT, 'docs', 'assets', 'cones');
const MANIFEST_PATH = join(ROOT, 'docs', 'assets', 'ai-generation-manifest.json');
const VALID_DIMENSIONS = [
  { width: 288, height: 336 },
  { width: 144, height: 168 },
];

/**
 * Convert a flavor name to a slug for the PNG filename.
 */
function flavorSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Get all expected slugs from FLAVOR_PROFILES.
 */
function getAllSlugs() {
  return Object.keys(FLAVOR_PROFILES).map(flavorSlug).sort();
}

// ---------------------------------------------------------------------------
// Check: Existence (default mode)
// ---------------------------------------------------------------------------
function checkExistence() {
  console.log('=== Check: Existence ===');
  const expectedSlugs = getAllSlugs();
  const missing = [];

  for (const slug of expectedSlugs) {
    const pngPath = join(CONES_DIR, slug + '.png');
    if (!existsSync(pngPath)) {
      missing.push(slug);
    }
  }

  const found = expectedSlugs.length - missing.length;
  if (missing.length === 0) {
    console.log(`PASS: ${found}/${expectedSlugs.length} PNGs present`);
  } else {
    console.log(`FAIL: ${found}/${expectedSlugs.length} PNGs present, missing: [${missing.join(', ')}]`);
  }

  return missing.length === 0;
}

// ---------------------------------------------------------------------------
// Check: Dimensions (--dimensions)
// ---------------------------------------------------------------------------
async function checkDimensions() {
  console.log('=== Check: Dimensions ===');
  if (!sharp) {
    console.log('FAIL: sharp is not available. Install with: cd worker && npm install');
    return false;
  }

  let pngFiles;
  try {
    pngFiles = readdirSync(CONES_DIR).filter(f => f.endsWith('.png'));
  } catch {
    console.log('FAIL: Could not read ' + CONES_DIR);
    return false;
  }

  if (pngFiles.length === 0) {
    console.log('FAIL: No PNG files found in ' + CONES_DIR);
    return false;
  }

  const mismatched = [];
  for (const file of pngFiles) {
    const fullPath = join(CONES_DIR, file);
    const meta = await sharp(fullPath).metadata();
    const valid = VALID_DIMENSIONS.some(d => d.width === meta.width && d.height === meta.height);
    if (!valid) {
      mismatched.push({ file, width: meta.width, height: meta.height });
    }
  }

  if (mismatched.length === 0) {
    console.log(`PASS: ${pngFiles.length}/${pngFiles.length} PNGs have valid dimensions (288x336 or 144x168)`);
  } else {
    console.log(`FAIL: ${mismatched.length} PNGs have unexpected dimensions:`);
    for (const m of mismatched) {
      console.log(`  ${m.file}: ${m.width}x${m.height}`);
    }
  }

  return mismatched.length === 0;
}

// ---------------------------------------------------------------------------
// Check: Manifest (--manifest)
// ---------------------------------------------------------------------------
function checkManifest() {
  console.log('=== Check: Manifest ===');

  if (!existsSync(MANIFEST_PATH)) {
    console.log('FAIL: ai-generation-manifest.json not found at ' + MANIFEST_PATH);
    return false;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    console.log('FAIL: Could not parse manifest: ' + err.message);
    return false;
  }

  const entries = Array.isArray(manifest) ? manifest : (manifest.flavors || manifest.entries || []);
  const expectedSlugs = getAllSlugs();
  const entryBySlug = new Map();
  for (const entry of entries) {
    const slug = entry.slug || flavorSlug(entry.flavor_key || '');
    entryBySlug.set(slug, entry);
  }

  const missing = [];
  const incomplete = [];

  for (const slug of expectedSlugs) {
    const entry = entryBySlug.get(slug);
    if (!entry) {
      missing.push(slug);
      continue;
    }

    const issues = [];
    if (!entry.flavor_key) issues.push('missing flavor_key');
    if (!entry.slug) issues.push('missing slug');
    if (!entry.model) issues.push('missing model');
    if (!entry.quality) issues.push('missing quality');
    if (!entry.prompt_hash) issues.push('missing prompt_hash');
    if (!Array.isArray(entry.candidates) || entry.candidates.length < 1) issues.push('candidates must be array with >=1 entry');
    if (!entry.selected) issues.push('missing or null selected');
    if (entry.status !== 'approved') issues.push('status must be "approved", got: ' + entry.status);

    if (issues.length > 0) {
      incomplete.push({ slug, issues });
    }
  }

  const valid = expectedSlugs.length - missing.length - incomplete.length;
  if (missing.length === 0 && incomplete.length === 0) {
    console.log(`PASS: ${valid}/${expectedSlugs.length} manifest entries valid`);
  } else {
    console.log(`FAIL: ${valid}/${expectedSlugs.length} valid`);
    if (missing.length > 0) {
      console.log(`  Missing entries: [${missing.join(', ')}]`);
    }
    for (const inc of incomplete) {
      console.log(`  Incomplete: ${inc.slug} -- ${inc.issues.join(', ')}`);
    }
  }

  return missing.length === 0 && incomplete.length === 0;
}

// ---------------------------------------------------------------------------
// Check: Transparency (--transparency)
// ---------------------------------------------------------------------------
async function checkTransparency() {
  console.log('=== Check: Transparency ===');
  if (!sharp) {
    console.log('FAIL: sharp is not available. Install with: cd worker && npm install');
    return false;
  }

  let pngFiles;
  try {
    pngFiles = readdirSync(CONES_DIR).filter(f => f.endsWith('.png'));
  } catch {
    console.log('FAIL: Could not read ' + CONES_DIR);
    return false;
  }

  if (pngFiles.length === 0) {
    console.log('FAIL: No PNG files found in ' + CONES_DIR);
    return false;
  }

  const noAlpha = [];
  for (const file of pngFiles) {
    const fullPath = join(CONES_DIR, file);
    const meta = await sharp(fullPath).metadata();
    if (meta.channels !== 4 || meta.hasAlpha !== true) {
      noAlpha.push({ file, channels: meta.channels, hasAlpha: meta.hasAlpha });
    }
  }

  if (noAlpha.length === 0) {
    console.log(`PASS: ${pngFiles.length}/${pngFiles.length} PNGs have alpha channel`);
  } else {
    console.log(`FAIL: ${noAlpha.length} PNGs without transparency:`);
    for (const f of noAlpha) {
      console.log(`  ${f.file}: channels=${f.channels}, hasAlpha=${f.hasAlpha}`);
    }
  }

  return noAlpha.length === 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const runAll = process.argv.includes('--all');
  const runDimensions = process.argv.includes('--dimensions') || runAll;
  const runManifest = process.argv.includes('--manifest') || runAll;
  const runTransparency = process.argv.includes('--transparency') || runAll;
  const runExistence = !runDimensions && !runManifest && !runTransparency || runAll;

  const results = [];

  if (runExistence) {
    results.push(checkExistence());
  }

  if (runDimensions) {
    results.push(await checkDimensions());
  }

  if (runManifest) {
    results.push(checkManifest());
  }

  if (runTransparency) {
    results.push(await checkTransparency());
  }

  const allPassed = results.every(r => r === true);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
