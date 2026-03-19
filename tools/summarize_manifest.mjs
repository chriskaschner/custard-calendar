#!/usr/bin/env node
import fs from 'node:fs';

const file = process.argv[2] || '/Users/chriskaschner/Documents/GitHub/custard/ai-generation-manifest3.json';
const m = JSON.parse(fs.readFileSync(file, 'utf-8'));
let approved = 0, flagged = 0, pending = 0;
const flaggedList = [];

for (const [slug, entry] of Object.entries(m.flavors)) {
  if (entry.status === 'approved') approved++;
  else if (entry.status === 'flagged') { flagged++; flaggedList.push(slug); }
  else pending++;
}

console.log('Approved:', approved);
console.log('Flagged:', flagged);
console.log('Pending:', pending);
if (flaggedList.length > 0) {
  console.log('');
  console.log('Flagged:');
  flaggedList.forEach(f => console.log(' ', f));
}
