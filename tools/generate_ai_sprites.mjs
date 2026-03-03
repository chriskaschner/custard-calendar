#!/usr/bin/env node
/**
 * AI sprite generator: calls OpenAI DALL-E 3 to produce L4/L5 PNGs for all flavors.
 *
 * Reads:  docs/assets/masterlock-flavor-fills.json  (prompts + per-flavor treatments)
 * Writes: docs/assets/sprites/flavor-{slug}-l4.png
 *         docs/assets/sprites/flavor-{slug}-l5.png  (when premium override exists)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs
 *   OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs --flavor "blackberry cobbler"
 *   OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs --force          # overwrite existing
 *   OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs --l4-only
 *   OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs --l5-only
 *   OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs --model gpt-image-1
 *
 * Models:
 *   dall-e-3    default; tier 1: 5 img/min -> 13s delay
 *   gpt-image-1 same model as ChatGPT; may produce better pixel art adherence
 *
 * Rate limits:
 *   DALL-E 3 tier 1: 5 img/min  -> default 13s delay between requests
 *   DALL-E 3 tier 2: 50 img/min -> pass --delay 1500 to go faster
 *   gpt-image-1: check your tier; pass --delay as needed
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FILLS_PATH = path.join(REPO_ROOT, 'docs', 'assets', 'masterlock-flavor-fills.json');
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'assets', 'sprites');

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(template, card, treatment, tier) {
  return template
    .replace('[L0 | L1 | L2 | L3 | L4 | L5]', tier)
    .replace('[FLAVOR NAME]', card.title)
    .replace("[Official Culver's description]", card.description || '')
    .replace('- Base custard color:', `- Base custard color: ${treatment.base || ''}`)
    .replace('- Swirls:', `- Swirls: ${treatment.swirls || ''}`)
    .replace('- Chunk inclusions:', `- Chunk inclusions: ${treatment.chunks || ''}`)
    .replace('- Texture notes:', `- Texture notes: ${treatment.texture || ''}`);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function generateImage(apiKey, prompt, model = 'dall-e-3') {
  const body = { model, prompt, n: 1, size: '1024x1024' };
  // gpt-image-1 does not support response_format; dall-e-3 requires it for b64
  if (model === 'dall-e-3') body.response_format = 'b64_json';

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retry = parseInt(res.headers.get('retry-after') || '60', 10);
    throw Object.assign(new Error(`rate_limited`), { retryAfter: retry });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  const json = await res.json();
  // gpt-image-1 returns a URL; dall-e-3 returns b64_json when requested
  if (json.data[0].b64_json) {
    return Buffer.from(json.data[0].b64_json, 'base64');
  }
  // URL response: fetch the image bytes
  const imgRes = await fetch(json.data[0].url);
  return Buffer.from(await imgRes.arrayBuffer());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY not set');
    process.exitCode = 1;
    return;
  }

  const args = process.argv.slice(2);

  const filterIdx = args.indexOf('--flavor');
  const filterKey = filterIdx >= 0 ? args[filterIdx + 1]?.toLowerCase() : null;

  const modelIdx = args.indexOf('--model');
  const model = modelIdx >= 0 ? args[modelIdx + 1] : 'dall-e-3';

  const delayIdx = args.indexOf('--delay');
  const delayMs = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 13000;

  const force = args.includes('--force');
  const l4Only = args.includes('--l4-only');
  const l5Only = args.includes('--l5-only');

  await fs.mkdir(OUT_DIR, { recursive: true });

  const data = JSON.parse(await fs.readFile(FILLS_PATH, 'utf8'));
  const { template, flavors } = data;

  const candidates = filterKey
    ? flavors.filter((f) => f.flavor_key === filterKey)
    : flavors;

  if (filterKey && candidates.length === 0) {
    console.error(`Flavor key not found: "${filterKey}"`);
    console.error(`Available: ${flavors.map((f) => f.flavor_key).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // Build work queue: { card, tier, filename, treatment }
  const queue = [];
  for (const card of candidates) {
    const slug = slugify(card.title);

    if (!l5Only) {
      queue.push({
        card,
        tier: 'L4',
        filename: `flavor-${slug}-l4.png`,
        treatment: card.ingredient_treatment,
      });
    }

    if (l5Only || args.includes('--l5')) {
      // L5 only generated when explicitly requested
      if (card.premium_treatment_override) {
        queue.push({
          card,
          tier: 'L5',
          filename: `flavor-${slug}-l5.png`,
          treatment: card.premium_treatment_override,
        });
      }
    }
  }

  console.log(`Model: ${model}`);
  console.log(`Queue: ${queue.length} images  (delay: ${delayMs}ms between requests)`);
  console.log(`Estimated time: ~${Math.ceil((queue.length * delayMs) / 60000)} min\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const { card, tier, filename, treatment } = queue[i];
    const filepath = path.join(OUT_DIR, filename);

    // Skip if file already exists and --force not set
    if (!force) {
      try {
        await fs.access(filepath);
        console.log(`  skip  [${i + 1}/${queue.length}] ${filename}`);
        skipped++;
        continue;
      } catch {
        // file does not exist — proceed
      }
    }

    const prompt = buildPrompt(template, card, treatment, tier);
    process.stdout.write(`  gen   [${i + 1}/${queue.length}] ${filename} ...`);

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      try {
        const imageBytes = await generateImage(apiKey, prompt, model);
        await fs.writeFile(filepath, imageBytes);
        process.stdout.write(` done\n`);
        generated++;
        success = true;
      } catch (err) {
        attempts++;
        if (err.message === 'rate_limited' && attempts < 3) {
          const wait = (err.retryAfter || 60) * 1000;
          process.stdout.write(` rate limited, waiting ${err.retryAfter || 60}s...\n`);
          await sleep(wait);
          process.stdout.write(`  retry [${i + 1}/${queue.length}] ${filename} ...`);
        } else {
          process.stdout.write(` FAILED: ${err.message}\n`);
          failed++;
          break;
        }
      }
    }

    // Delay before next request (skip delay after last item)
    if (i < queue.length - 1 && success) {
      await sleep(delayMs);
    }
  }

  console.log(`\nDone. generated=${generated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) {
    console.log(`Re-run to retry failed items (existing files are skipped automatically).`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
