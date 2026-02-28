#!/usr/bin/env node
/**
 * Generates worker/src/store-index.js and worker/src/store-coords.js from docs/stores.json.
 *
 * store-index.js — slim search index for /api/stores?q= typeahead (slug, name, city, state)
 * store-coords.js — coordinate + display map for the planner (lat, lng, name, address)
 *
 * Run whenever the store manifest is refreshed:
 *   node worker/scripts/generate-store-index.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const storesPath = join(__dirname, '..', '..', 'docs', 'stores.json');
const indexPath = join(__dirname, '..', 'src', 'store-index.js');
const coordsPath = join(__dirname, '..', 'src', 'store-coords.js');

const { stores } = JSON.parse(readFileSync(storesPath, 'utf8'));

// store-index: slim search fields only
const slim = stores.map(s => ({
  slug: s.slug,
  name: s.name,
  city: s.city,
  state: s.state,
}));

const indexLines = [
  '// Auto-generated from docs/stores.json — do not edit manually.',
  '// Regenerate with: node worker/scripts/generate-store-index.js',
  `// ${slim.length} stores as of ${new Date().toISOString().slice(0, 10)}`,
  `export const STORE_INDEX = ${JSON.stringify(slim)};`,
  '',
];

writeFileSync(indexPath, indexLines.join('\n'));
console.log(`Wrote ${slim.length} stores to ${indexPath}`);

// store-coords: coordinate + display map for the nearby-store planner
// Map<slug, {lat, lng, name, address}>
const coordEntries = stores.map(s => [s.slug, { lat: s.lat, lng: s.lng, name: s.name, address: s.address }]);

const coordLines = [
  '// Auto-generated from docs/stores.json — do not edit manually.',
  '// Regenerate with: node worker/scripts/generate-store-index.js',
  '// Provides coordinates + display fields for the nearby-store planner.',
  `// ${stores.length} stores as of ${new Date().toISOString().slice(0, 10)}`,
  '',
  '// Map<slug, {lat, lng, name, address}>',
  `export const STORE_COORDS = new Map(${JSON.stringify(coordEntries)});`,
  '',
];

writeFileSync(coordsPath, coordLines.join('\n'));
console.log(`Wrote ${stores.length} entries to ${coordsPath}`);
