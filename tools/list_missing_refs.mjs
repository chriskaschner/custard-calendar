#!/usr/bin/env node
import fs from 'node:fs';

const culversKeys = JSON.parse(fs.readFileSync('tools/culvers_flavors.json', 'utf-8'));
const culversUrls = JSON.parse(fs.readFileSync('docs/assets/culvers-image-urls.json', 'utf-8'));
const NOT_PICTURED = 'img-fotd-notpictured.png';

for (const key of culversKeys) {
  const url = culversUrls[key];
  const hasRef = url && !url.includes(NOT_PICTURED);
  if (!hasRef) {
    console.log(key);
  }
}
