/**
 * Parse an Oscar's WordPress REST response into the exact payload the Worker
 * would have produced, for out-of-band ingest.
 *
 * Reads the raw /wp-json/wp/v2/pages response on stdin, writes JSON on stdout:
 *   { name, flavors: [{date, title, description}], dropped, rawCount, kvRecord }
 *
 * This deliberately imports the Worker's own parser, sanitizer and cache-record
 * builder rather than reimplementing them in the ingest script. The ingest path
 * writes straight into KV, bypassing the sanitisation that getFlavorsCached
 * applies on a normal fetch, so it has to apply the same rules -- and the record
 * has to match makeFlavorCacheRecord's shape exactly or parseFlavorCacheRecord
 * rejects it on read and the cache silently never hits.
 *
 * Usage: node scripts/oscars_parse.mjs < response.json
 */

import { parseOscarsHtml } from '../worker/src/oscars-fetcher.js';
import { sanitizeFlavorPayload, makeFlavorCacheRecord } from '../worker/src/kv-cache.js';
import { normalize } from '../worker/src/flavor-matcher.js';

// Must match the kvPrefix for the oscars entry in worker/src/brand-registry.js.
const SHARED_CACHE_KEY = 'flavors:oscars-shared';

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

const raw = await readStdin();

let pages;
try {
  pages = JSON.parse(raw);
} catch (err) {
  console.error(`stdin was not valid JSON: ${err.message}`);
  process.exit(1);
}

const rendered = pages?.[0]?.content?.rendered;
if (!rendered) {
  console.error("no content.rendered in Oscar's WordPress response");
  process.exit(1);
}

const parsed = parseOscarsHtml(rendered);
const { data, dropped, rawCount } = sanitizeFlavorPayload(parsed);

if (data.flavors.length === 0) {
  console.error(`parsed 0 usable flavors from ${rawCount} raw entries -- refusing to publish an empty cache`);
  process.exit(1);
}

process.stdout.write(JSON.stringify({
  name: data.name,
  // normalized_flavor is computed here, with the Worker's own normalize(), so
  // rows written by this path match rows written by recordSnapshot().
  flavors: data.flavors.map(f => ({ ...f, normalized_flavor: normalize(f.title) })),
  dropped,
  rawCount,
  cacheKey: SHARED_CACHE_KEY,
  // isShared=true: one key serves oscars-muskego and oscars-new-berlin.
  kvRecord: makeFlavorCacheRecord(data, null, true),
}));
