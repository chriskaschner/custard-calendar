#!/usr/bin/env node
/**
 * Deploy non-Culver's cones from alias map.
 * - aliases: copy Culver's cone PNG
 * - own: copy from ai-candidates (raw, since post-processing may not have run on these)
 */

import fs from 'node:fs';
import path from 'node:path';

const map = JSON.parse(fs.readFileSync('/Users/chriskaschner/Documents/GitHub/custard/cone-alias-map.json', 'utf-8'));
const CONES_DIR = 'docs/assets/cones';
const CANDIDATES_DIR = 'docs/assets/ai-candidates';

let deployed = 0;
let errors = 0;

// Deploy aliases (copy from existing Culver's cone)
console.log('=== Aliases ===');
for (const [slug, aliasSlug] of Object.entries(map.aliases)) {
  const src = path.join(CONES_DIR, aliasSlug + '.png');
  const dst = path.join(CONES_DIR, slug + '.png');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log('  ALIAS', slug, '<-', aliasSlug);
    deployed++;
  } else {
    console.log('  ERROR', slug, '- source missing:', src);
    errors++;
  }
}

// Deploy own selections (copy from ai-candidates, prefer processed version)
console.log('\n=== Own Selections ===');
for (const [slug, file] of Object.entries(map.own)) {
  const processedFile = file.replace('.png', '-processed.png');
  const processedSrc = path.join(CANDIDATES_DIR, slug, processedFile);
  const rawSrc = path.join(CANDIDATES_DIR, slug, file);
  const dst = path.join(CONES_DIR, slug + '.png');

  if (fs.existsSync(processedSrc)) {
    fs.copyFileSync(processedSrc, dst);
    const size = fs.statSync(dst).size;
    console.log('  DEPLOY', slug, '<-', processedFile, '(' + Math.round(size / 1024) + 'KB)');
    deployed++;
  } else if (fs.existsSync(rawSrc)) {
    fs.copyFileSync(rawSrc, dst);
    const size = fs.statSync(dst).size;
    console.log('  DEPLOY (raw)', slug, '<-', file, '(' + Math.round(size / 1024) + 'KB)');
    deployed++;
  } else {
    console.log('  ERROR', slug, '- not found:', processedSrc, 'or', rawSrc);
    errors++;
  }
}

console.log('\n=== Skipped ===');
for (const slug of map.skipped) {
  console.log('  SKIP', slug);
}

console.log('\n--- Summary ---');
console.log('Deployed:', deployed);
console.log('Skipped:', map.skipped.length);
console.log('Errors:', errors);
