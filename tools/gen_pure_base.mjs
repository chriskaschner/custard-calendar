#!/usr/bin/env node
/**
 * Generate 5 candidates each for the 3 pure-base flavors.
 */
import fs from 'node:fs';

const pureKeys = ['blue moon', 'orange creamsicle', 'pistachio'];
fs.writeFileSync('tools/pure_base_flavors.json', JSON.stringify(pureKeys, null, 2) + '\n');
console.log('Wrote tools/pure_base_flavors.json');
