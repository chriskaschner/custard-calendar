#!/usr/bin/env node
/**
 * Generates worker/src/store-index.js from docs/stores.json.
 * The store index powers the /api/stores?q= search endpoint.
 * Run whenever the store manifest is refreshed:
 *   node worker/scripts/generate-store-index.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const storesPath = join(__dirname, '..', '..', 'docs', 'stores.json');
const outputPath = join(__dirname, '..', 'src', 'store-index.js');

const { stores } = JSON.parse(readFileSync(storesPath, 'utf8'));

// Keep only the fields needed for search + display
const slim = stores.map(s => ({
  slug: s.slug,
  name: s.name,
  city: s.city,
  state: s.state,
}));

const lines = [
  '// Auto-generated from docs/stores.json — do not edit manually.',
  '// Regenerate with: node worker/scripts/generate-store-index.js',
  `// ${slim.length} stores as of ${new Date().toISOString().slice(0, 10)}`,
  `export const STORE_INDEX = ${JSON.stringify(slim)};`,
  '',
];

writeFileSync(outputPath, lines.join('\n'));
console.log(`Wrote ${slim.length} stores to ${outputPath}`);
