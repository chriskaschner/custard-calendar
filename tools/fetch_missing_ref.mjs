#!/usr/bin/env node
import fs from 'node:fs';

async function main() {
  const res = await fetch('https://www.culvers.com/flavor-of-the-day/oreo-cookie-cheesecake');
  if (!res.ok) { console.log('Page fetch failed:', res.status); return; }
  const html = await res.text();
  const match = html.match(/src="(https:\/\/cdn\.culvers\.com\/menu-item-detail\/[^"?]+)/);
  if (!match) { console.log('No image found on page'); return; }
  console.log('Found:', match[1]);

  const urls = JSON.parse(fs.readFileSync('docs/assets/culvers-image-urls.json', 'utf-8'));
  urls['oreo cheesecake'] = match[1];
  fs.writeFileSync('docs/assets/culvers-image-urls.json', JSON.stringify(urls, null, 2) + '\n');
  console.log('Updated culvers-image-urls.json');
}
main().catch(e => console.error(e));
