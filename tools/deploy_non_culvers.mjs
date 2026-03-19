#!/usr/bin/env node
/**
 * 1. Copy 3 exact-match cones from Culver's assets
 * 2. List likely visual aliases (similar base + toppings)
 * 3. Identify pure-base flavors for simple color generation
 */

import fs from 'node:fs';
import path from 'node:path';

const fills = JSON.parse(fs.readFileSync('docs/assets/masterlock-flavor-fills.json', 'utf-8'));
const culversKeys = new Set(JSON.parse(fs.readFileSync('tools/culvers_flavors.json', 'utf-8')));
const CONES_DIR = 'docs/assets/cones';

function slug(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Build maps
const culversFlavors = {};
const nonCulvers = [];

for (const f of fills.flavors) {
  if (culversKeys.has(f.flavor_key)) {
    culversFlavors[f.flavor_key] = f;
  } else {
    nonCulvers.push(f);
  }
}

// --- 1. Exact matches: copy PNGs ---
const exactMatches = [
  { from: 'brownie thunder', to: 'brownie explosion' },
  { from: 'caramel cashew', to: 'cashew delight' },
  { from: 'peanut butter cup', to: "really reese's" },
];

console.log('=== 1. Exact Matches (copying) ===');
for (const m of exactMatches) {
  const src = path.join(CONES_DIR, slug(m.from) + '.png');
  const dst = path.join(CONES_DIR, slug(m.to) + '.png');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log('  COPIED', slug(m.from) + '.png', '->', slug(m.to) + '.png');
  } else {
    console.log('  MISSING source:', src);
  }
}

// --- 2. Likely visual aliases ---
// Score similarity: same base = 3pts, shared toppings = 1pt each, same ribbon type = 2pts
console.log('\n=== 2. Likely Visual Aliases ===');
console.log('(non-Culvers -> suggested Culvers cone to reuse)\n');

const culversArr = Object.values(culversFlavors);
const aliases = [];
const pureBase = [];
const needsGen = [];

for (const nc of nonCulvers) {
  const p = nc.profile;
  if (!p) continue;

  // Skip exact matches already handled
  if (['brownie explosion', 'cashew delight', "really reese's"].includes(nc.flavor_key)) continue;

  // Pure base flavors (no toppings, no ribbon)
  if ((!p.toppings || p.toppings.length === 0) && !p.ribbon && p.density === 'pure') {
    pureBase.push(nc);
    continue;
  }

  // Find best Culver's match
  let bestMatch = null;
  let bestScore = 0;

  for (const cf of culversArr) {
    const cp = cf.profile;
    if (!cp) continue;

    let score = 0;

    // Base match
    if (p.base === cp.base) score += 3;
    // Similar base families
    else if (
      (p.base === 'dark_chocolate' && cp.base === 'chocolate') ||
      (p.base === 'chocolate' && cp.base === 'dark_chocolate') ||
      (p.base === 'chocolate_custard' && (cp.base === 'chocolate' || cp.base === 'dark_chocolate')) ||
      (p.base === 'espresso' && cp.base === 'chocolate') ||
      (p.base === 'butter_pecan' && cp.base === 'vanilla') ||
      (p.base === 'caramel' && cp.base === 'vanilla') ||
      (p.base === 'cherry' && cp.base === 'vanilla')
    ) score += 1;

    // Ribbon match
    if (p.ribbon && cp.ribbon && p.ribbon === cp.ribbon) score += 2;
    else if (!p.ribbon && !cp.ribbon) score += 1;

    // Topping overlap
    const ncTops = new Set(p.toppings || []);
    const cfTops = new Set(cp.toppings || []);
    let shared = 0;
    for (const t of ncTops) {
      if (cfTops.has(t)) shared++;
    }
    score += shared;

    // Density match bonus
    if (p.density === cp.density) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = cf;
    }
  }

  if (bestScore >= 4) {
    aliases.push({
      flavor: nc.flavor_key,
      match: bestMatch.flavor_key,
      score: bestScore,
      reason: `base: ${p.base}/${bestMatch.profile.base}, toppings: [${(p.toppings||[]).join(',')}]/[${(bestMatch.profile.toppings||[]).join(',')}]`
    });
  } else {
    needsGen.push(nc);
  }
}

// Sort aliases by score descending
aliases.sort((a, b) => b.score - a.score);

for (const a of aliases) {
  console.log(`  ${a.flavor} -> ${a.match} (score: ${a.score}, ${a.reason})`);
}

console.log('\n=== 3. Pure Base Flavors (need color-only generation) ===');
for (const p of pureBase) {
  console.log(`  ${p.flavor_key} | base: ${p.profile.base}`);
}

console.log('\n=== 4. Remaining (need unique generation) ===');
for (const n of needsGen) {
  const p = n.profile;
  console.log(`  ${n.flavor_key} | base: ${p.base} | ribbon: ${p.ribbon} | toppings: ${(p.toppings||[]).join(', ')} | density: ${p.density}`);
}

console.log('\n--- Summary ---');
console.log('Exact copies:', exactMatches.length);
console.log('Likely aliases (score >= 4):', aliases.length);
console.log('Pure base (color gen):', pureBase.length);
console.log('Need unique generation:', needsGen.length);
