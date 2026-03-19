#!/usr/bin/env node
/**
 * Scrape Culver's CDN image URLs for all 94 flavors.
 * Outputs a JSON map of flavor_key -> CDN URL.
 *
 * Usage: node tools/scrape_culvers_images.mjs
 */

import fs from 'node:fs';

const fills = JSON.parse(fs.readFileSync('docs/assets/masterlock-flavor-fills.json', 'utf-8'));

function flavorSlug(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function getCdnUrl(flavorKey) {
  const slug = flavorSlug(flavorKey);
  const pageUrl = 'https://www.culvers.com/flavor-of-the-day/' + slug;

  try {
    const res = await fetch(pageUrl);
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/src="(https:\/\/cdn\.culvers\.com\/menu-item-detail\/[^"?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const results = {};
  let found = 0;
  let missing = 0;

  // Process in batches of 5 to respect rate limits
  for (let i = 0; i < fills.flavors.length; i += 5) {
    const batch = fills.flavors.slice(i, i + 5);
    const promises = batch.map(async (f) => {
      const url = await getCdnUrl(f.flavor_key);
      if (url) {
        results[f.flavor_key] = url;
        found++;
        console.log(`[${found + missing}/${fills.flavors.length}] ${f.flavor_key} -> found`);
      } else {
        missing++;
        console.log(`[${found + missing}/${fills.flavors.length}] ${f.flavor_key} -> MISSING`);
      }
    });
    await Promise.all(promises);
    // Small delay between batches
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nFound: ${found}, Missing: ${missing}`);

  fs.writeFileSync(
    'docs/assets/culvers-image-urls.json',
    JSON.stringify(results, null, 2) + '\n'
  );
  console.log('Saved to docs/assets/culvers-image-urls.json');
}

main().catch(e => { console.error(e); process.exit(1); });
