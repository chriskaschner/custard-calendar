#!/usr/bin/env node
/**
 * Deploy approved AI cone candidates to docs/assets/cones/.
 * Reads the manifest, copies selected processed PNGs to final location.
 *
 * Usage: node tools/deploy_approved_cones.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync('docs/assets/ai-generation-manifest.json', 'utf-8'));
const CANDIDATES_DIR = 'docs/assets/ai-candidates';
const CONES_DIR = 'docs/assets/cones';

fs.mkdirSync(CONES_DIR, { recursive: true });

let deployed = 0;
let skipped = 0;
let errors = 0;

for (const [slug, entry] of Object.entries(manifest.flavors)) {
  if (entry.status !== 'approved' || !entry.selected) {
    console.log('SKIP', slug, '- status:', entry.status);
    skipped++;
    continue;
  }

  // The selected field is the raw filename like "vanilla-5.png"
  // The processed version has "-processed" suffix
  const rawName = entry.selected;
  const processedName = rawName.replace('.png', '-processed.png');
  const src = path.join(CANDIDATES_DIR, slug, processedName);
  const dst = path.join(CONES_DIR, slug + '.png');

  if (!fs.existsSync(src)) {
    // Try without -processed suffix (in case post-processing wasn't run)
    const altSrc = path.join(CANDIDATES_DIR, slug, rawName);
    if (fs.existsSync(altSrc)) {
      fs.copyFileSync(altSrc, dst);
      console.log('DEPLOY (raw)', slug, '<-', rawName);
      deployed++;
    } else {
      console.log('ERROR', slug, '- file not found:', src);
      errors++;
    }
    continue;
  }

  fs.copyFileSync(src, dst);
  const size = fs.statSync(dst).size;
  console.log('DEPLOY', slug, '<-', processedName, '(' + Math.round(size / 1024) + 'KB)');
  deployed++;
}

console.log('');
console.log('Deployed:', deployed);
console.log('Skipped:', skipped);
console.log('Errors:', errors);
