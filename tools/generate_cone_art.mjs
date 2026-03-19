#!/usr/bin/env node
/**
 * AI cone art generation pipeline.
 *
 * Calls Azure OpenAI gpt-image-1.5 to generate pixel art cone PNGs for each
 * flavor in the masterlock flavor fills catalog. Produces multiple candidates
 * per flavor for downstream human curation.
 *
 * Auth: macOS keychain (azure-openai-api-key) or AZURE_OPENAI_API_KEY env var.
 *
 * Usage:
 *   node tools/generate_cone_art.mjs --trial                    # 3 flavors x 2 qualities x 3 candidates = 18 images
 *   node tools/generate_cone_art.mjs --all --quality medium     # All 94 flavors at medium quality
 *   node tools/generate_cone_art.mjs --all --quality high       # All 94 flavors at high quality
 *   node tools/generate_cone_art.mjs --flavor "vanilla" --quality medium
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const ENDPOINT =
  'https://etc-ai-foundry-sbx-east-us-2.cognitiveservices.azure.com/openai/deployments/gpt-image-1.5/images/generations?api-version=2024-02-01';
const CANDIDATES_DIR = path.join(REPO_ROOT, 'docs', 'assets', 'ai-candidates');
const FLAVOR_FILLS_PATH = path.join(REPO_ROOT, 'docs', 'assets', 'masterlock-flavor-fills.json');
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs', 'assets', 'ai-generation-manifest.json');
const DELAY_MS = 5000; // 5 seconds between requests (conservative rate limit buffer)

const TRIAL_FLAVORS = ['vanilla', 'mint explosion', 'caramel turtle'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flavorSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function promptHash(prompt) {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

/**
 * Resolve API key: env var first, then macOS keychain, else exit.
 */
function getApiKey() {
  if (process.env.AZURE_OPENAI_API_KEY) {
    return process.env.AZURE_OPENAI_API_KEY;
  }
  try {
    return execSync(
      'security find-generic-password -a "$USER" -s "azure-openai-api-key" -w',
      { encoding: 'utf-8' },
    ).trim();
  } catch {
    // keychain lookup failed
  }
  console.error(
    'Error: No API key found.\n' +
      'Set AZURE_OPENAI_API_KEY env var, or add a keychain entry:\n' +
      '  security add-generic-password -a "$USER" -s "azure-openai-api-key" -w "<key>"',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

/**
 * Build an L5-quality prompt for the given flavor entry.
 *
 * Starts from the MASTERLOCK_TEMPLATE and:
 *   1. Replaces Quality target section with L5 directive
 *   2. Replaces Background section with transparent background instruction
 *   3. Replaces Flavor section with premium_treatment_override data
 */
function buildL5Prompt(flavor, template) {
  let prompt = template;

  // 1. Replace quality target block
  prompt = prompt.replace(
    /Quality target:\nChoose one tier from the complexity ladder: \[L0 \| L1 \| L2 \| L3 \| L4 \| L5\]\nDo not blend tiers in a single render\./,
    'Quality target: L5 -- Premium Showcase',
  );

  // 2. Replace Background section (from "Background:" through "No text.")
  prompt = prompt.replace(
    /Background:\nSolid deep brown-black background \(#140c06 tone\)\.\nNo gradients\.\nNo texture\.\nNo logo\.\nNo text\./,
    'Background:\nTransparent background.\nNo gradients. No texture. No logo. No text.\nEnsure there is no transparency within the ice cream scoop or waffle cone itself, only around the isolated subject.',
  );

  // 3. Replace Flavor section and everything below it
  const flavorSectionStart = prompt.indexOf('Flavor: [FLAVOR NAME]');
  if (flavorSectionStart === -1) {
    throw new Error(`Template missing "Flavor: [FLAVOR NAME]" placeholder`);
  }

  const po = flavor.premium_treatment_override;
  const flavorSection = [
    `Flavor: ${flavor.title}`,
    '',
    'Description:',
    flavor.description,
    '',
    'Ingredient treatment:',
    `- Base custard color: ${po.base}`,
    `- Swirls: ${po.swirls}`,
    `- Chunk inclusions: ${po.chunks}`,
    `- Texture notes: ${po.texture}`,
  ].join('\n');

  prompt = prompt.slice(0, flavorSectionStart) + flavorSection;

  return prompt;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

/**
 * Generate a single image via Azure OpenAI.
 * Handles 429 rate-limit with one retry using Retry-After header.
 */
async function generateImage(apiKey, prompt, quality) {
  const body = {
    prompt,
    n: 1,
    size: '1024x1024',
    quality,
    background: 'transparent',
    output_format: 'png',
  };

  const headers = {
    'api-key': apiKey,
    'Content-Type': 'application/json',
  };

  let res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Handle 429 rate limit: wait and retry once
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '30', 10);
    console.log(`  Rate limited. Waiting ${retryAfter}s before retry...`);
    await sleep(retryAfter * 1000);
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.data || json.data.length === 0) {
    throw new Error('No image data in response');
  }

  return Buffer.from(json.data[0].b64_json, 'base64');
}

// ---------------------------------------------------------------------------
// Manifest management
// ---------------------------------------------------------------------------

async function loadManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveManifest(manifest) {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Generation orchestration
// ---------------------------------------------------------------------------

/**
 * Generate candidates for a single flavor at a given quality.
 *
 * @param {object} flavor - Flavor entry from masterlock-flavor-fills.json
 * @param {string} template - MASTERLOCK_TEMPLATE string
 * @param {string} apiKey - Azure OpenAI API key
 * @param {string} quality - "medium" or "high"
 * @param {number} candidateCount - Number of candidates to generate (default 3)
 * @param {boolean} isTrial - Whether this is a trial run (affects filename prefix)
 * @param {object} manifest - Generation manifest (mutated in place)
 * @param {object} progress - { current, total } for progress display
 */
async function generateForFlavor(
  flavor,
  template,
  apiKey,
  quality,
  candidateCount,
  isTrial,
  manifest,
  progress,
) {
  const slug = flavorSlug(flavor.flavor_key);
  const outDir = path.join(CANDIDATES_DIR, slug);
  await fs.mkdir(outDir, { recursive: true });

  const prompt = buildL5Prompt(flavor, template);
  const hash = promptHash(prompt);

  // Manifest key: for trial, separate by quality; for full batch, use flavor_key
  const manifestKey = isTrial ? `${flavor.flavor_key}:${quality}` : flavor.flavor_key;

  const candidates = [];

  for (let i = 1; i <= candidateCount; i++) {
    const prefix = isTrial ? `${slug}-${quality}-` : `${slug}-`;
    const filename = `${prefix}${i}.png`;
    const filePath = path.join(outDir, filename);

    progress.current++;
    console.log(
      `[${progress.current}/${progress.total}] ${slug}/${filename} (${quality})`,
    );

    const imageBytes = await generateImage(apiKey, prompt, quality);
    await fs.writeFile(filePath, imageBytes);
    console.log(`  Saved: ${imageBytes.length} bytes`);

    candidates.push({
      file: filename,
      generated_at: new Date().toISOString(),
    });

    // Delay between API calls (skip after the last one)
    if (i < candidateCount || progress.current < progress.total) {
      await sleep(DELAY_MS);
    }
  }

  manifest[manifestKey] = {
    flavor_key: flavor.flavor_key,
    slug,
    model: 'gpt-image-1.5',
    quality,
    size: '1024x1024',
    background: 'transparent',
    prompt_hash: hash,
    candidates,
    selected: null,
    status: 'pending',
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage:
  node tools/generate_cone_art.mjs --trial
    Generate 3 trial flavors at both medium and high quality (18 images)

  node tools/generate_cone_art.mjs --all --quality <medium|high>
    Generate all 94 flavors at the specified quality (282 images)

  node tools/generate_cone_art.mjs --flavor "flavor key" --quality <medium|high>
    Generate 3 candidates for a single flavor

Options:
  --trial           Trial mode: 3 flavors x 2 qualities x 3 candidates
  --all             Full batch: all flavors
  --flavor "key"    Single flavor by key
  --quality <q>     medium or high (required for --all and --flavor)
  --candidates <n>  Number of candidates per flavor (default: 5)
  --offset <n>      Start at flavor index N (0-based, for parallel batches)
  --limit <n>       Generate only N flavors (for parallel batches)
  --no-manifest     Skip manifest writes (use when running parallel batches)
  --delay <ms>      Delay between API calls in ms (default: ${DELAY_MS})
  --help            Show this help`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const isTrial = args.includes('--trial');
  const isAll = args.includes('--all');
  const flavorFlag = args.includes('--flavor')
    ? args[args.indexOf('--flavor') + 1]
    : null;
  const qualityFlag = args.includes('--quality')
    ? args[args.indexOf('--quality') + 1]
    : null;
  const delayFlag = args.includes('--delay')
    ? parseInt(args[args.indexOf('--delay') + 1], 10)
    : DELAY_MS;

  if (!isTrial && !isAll && !flavorFlag) {
    printUsage();
    process.exit(1);
  }

  if ((isAll || flavorFlag) && !qualityFlag) {
    console.error('Error: --quality <medium|high> is required for --all and --flavor modes.');
    process.exit(1);
  }

  if (qualityFlag && !['medium', 'high'].includes(qualityFlag)) {
    console.error('Error: --quality must be "medium" or "high".');
    process.exit(1);
  }

  // Load flavor data
  const fillsRaw = await fs.readFile(FLAVOR_FILLS_PATH, 'utf-8');
  const fills = JSON.parse(fillsRaw);
  const template = fills.template;

  if (!template) {
    console.error('Error: No template found in masterlock-flavor-fills.json');
    process.exit(1);
  }

  const apiKey = getApiKey();

  // Determine which flavors to generate
  let flavorsToGenerate = [];
  let qualities = [];

  if (isTrial) {
    for (const key of TRIAL_FLAVORS) {
      const entry = fills.flavors.find((f) => f.flavor_key === key);
      if (!entry) {
        console.error(`Error: Trial flavor "${key}" not found in flavor fills.`);
        process.exit(1);
      }
      flavorsToGenerate.push(entry);
    }
    qualities = ['medium', 'high'];
  } else if (flavorFlag) {
    const entry = fills.flavors.find((f) => f.flavor_key === flavorFlag);
    if (!entry) {
      console.error(`Error: Flavor "${flavorFlag}" not found in flavor fills.`);
      process.exit(1);
    }
    flavorsToGenerate.push(entry);
    qualities = [qualityFlag];
  } else if (isAll) {
    // Filter by --flavors-file if provided
    const flavorsFileIdx = args.indexOf('--flavors-file');
    if (flavorsFileIdx >= 0) {
      const filterKeys = JSON.parse(await fs.readFile(args[flavorsFileIdx + 1], 'utf-8'));
      const filterSet = new Set(filterKeys);
      flavorsToGenerate = fills.flavors.filter(f => filterSet.has(f.flavor_key));
      console.log(`Filtered to ${flavorsToGenerate.length} flavors from ${args[flavorsFileIdx + 1]}`);
    } else {
      flavorsToGenerate = fills.flavors;
    }
    qualities = [qualityFlag];

    // Apply offset/limit for parallel batch support
    const offset = args.includes('--offset')
      ? parseInt(args[args.indexOf('--offset') + 1], 10)
      : 0;
    const limit = args.includes('--limit')
      ? parseInt(args[args.indexOf('--limit') + 1], 10)
      : flavorsToGenerate.length;
    flavorsToGenerate = flavorsToGenerate.slice(offset, offset + limit);
    console.log(`Batch: offset=${offset} limit=${limit} (flavors ${offset + 1}-${offset + flavorsToGenerate.length} of ${fills.flavors.length})`);
  }

  const candidateCount = args.includes('--candidates')
    ? parseInt(args[args.indexOf('--candidates') + 1], 10)
    : 5;
  const totalImages = flavorsToGenerate.length * qualities.length * candidateCount;

  console.log(`\nGenerating ${totalImages} images:`);
  console.log(`  Flavors: ${flavorsToGenerate.length}`);
  console.log(`  Qualities: ${qualities.join(', ')}`);
  console.log(`  Candidates per combo: ${candidateCount}`);
  console.log(`  Delay between calls: ${delayFlag}ms`);
  console.log(`  Estimated time: ~${Math.ceil((totalImages * delayFlag) / 1000 / 60)} min\n`);

  await fs.mkdir(CANDIDATES_DIR, { recursive: true });

  const noManifest = args.includes('--no-manifest');
  const manifest = noManifest ? {} : await loadManifest();
  const progress = { current: 0, total: totalImages };

  for (const quality of qualities) {
    for (const flavor of flavorsToGenerate) {
      await generateForFlavor(
        flavor,
        template,
        apiKey,
        quality,
        candidateCount,
        isTrial,
        manifest,
        progress,
      );
      // Save manifest after each flavor (crash recovery) -- skip in parallel mode
      if (!noManifest) {
        await saveManifest(manifest);
      }
    }
  }

  console.log(`\nDone. ${progress.current} images generated.`);
  if (!noManifest) {
    console.log(`Manifest: ${MANIFEST_PATH}`);
  }
  console.log(`Candidates: ${CANDIDATES_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
