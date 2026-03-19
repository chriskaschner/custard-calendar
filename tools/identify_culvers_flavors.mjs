#!/usr/bin/env node
/**
 * Identify which FLAVOR_PROFILES flavors are Culver's vs other brands.
 * Cross-references with flavor-catalog.js SEED_CATALOG (Culver's only).
 */

import fs from 'node:fs';

// Read flavor-catalog.js to extract SEED_CATALOG titles (Culver's flavors)
const catalogSrc = fs.readFileSync('worker/src/flavor-catalog.js', 'utf-8');
const titleMatches = catalogSrc.match(/title:\s*['"]([^'"]+)['"]/g) || [];
const culversTitles = new Set(
  titleMatches.map(m => m.replace(/title:\s*['"]/, '').replace(/['"]$/, '').toLowerCase())
);

// Read FLAVOR_PROFILES keys
const colorsSrc = fs.readFileSync('worker/src/flavor-colors.js', 'utf-8');
const profileKeys = [];
const keyRe = /^\s*'([^']+)':\s*\{/gm;
let match;
while ((match = keyRe.exec(colorsSrc)) !== null) {
  // Only grab keys inside FLAVOR_PROFILES (after line ~89)
  if (colorsSrc.lastIndexOf('FLAVOR_PROFILES', match.index) > colorsSrc.lastIndexOf('};', match.index)) {
    profileKeys.push(match[1]);
  }
}

const culvers = [];
const other = [];

for (const key of profileKeys) {
  if (culversTitles.has(key)) {
    culvers.push(key);
  } else {
    other.push(key);
  }
}

console.log('=== Culvers Flavors (' + culvers.length + ') ===');
culvers.forEach(f => console.log(' ', f));
console.log('');
console.log('=== Non-Culvers / Unknown (' + other.length + ') ===');
other.forEach(f => console.log(' ', f));
console.log('');
console.log('Total FLAVOR_PROFILES:', profileKeys.length);
console.log('Culvers match:', culvers.length);
console.log('Other/unknown:', other.length);
