#!/usr/bin/env node
/**
 * Inspect premium treatment overrides for specific flavors.
 * Usage: node tools/inspect_flavors.mjs
 */

import fs from 'node:fs';

const fills = JSON.parse(fs.readFileSync('docs/assets/masterlock-flavor-fills.json', 'utf-8'));

const inspect = [
  'dark chocolate decadence',
  'cookies & cream',
  'chocolate oreo volcano',
  'chocolate covered strawberry',
  'brownie batter overload',
  'brownie explosion',
  'brownie thunder',
  'cappuccino cookie crumble',
  'chocolate caramel twist',
  'crazy for cookie dough',
  'creamy lemon crumble',
];

// Also load FLAVOR_PROFILES to cross-reference
let profiles = {};
try {
  const src = fs.readFileSync('worker/src/flavor-colors.js', 'utf-8');
  const match = src.match(/const FLAVOR_PROFILES\s*=\s*\{([\s\S]*?)\n\};/);
  if (match) {
    // Extract just the keys we care about
    for (const key of inspect) {
      const re = new RegExp("'" + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*\\{([^}]+)\\}", 'i');
      const m = src.match(re);
      if (m) profiles[key] = m[0];
    }
  }
} catch {}

for (const key of inspect) {
  const entry = fills.flavors.find(f => f.flavor_key === key);
  if (!entry) {
    console.log('=== NOT FOUND:', key, '===\n');
    continue;
  }

  console.log('===', entry.title, '===');
  console.log('Description:', entry.description);
  console.log('');

  if (profiles[key]) {
    console.log('FLAVOR_PROFILE:', profiles[key]);
    console.log('');
  }

  const po = entry.premium_treatment_override;
  if (po) {
    console.log('Premium Override:');
    console.log('  base:', po.base);
    console.log('  swirls:', po.swirls);
    console.log('  chunks:', po.chunks);
    console.log('  texture:', po.texture);
  } else {
    console.log('  NO PREMIUM OVERRIDE');
  }
  console.log('');
}
