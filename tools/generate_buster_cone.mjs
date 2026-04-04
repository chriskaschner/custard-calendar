#!/usr/bin/env node
/**
 * Generate a "buster cone" image for holiday closures.
 *
 * Uses Azure OpenAI gpt-image-1.5 generations endpoint with a reference
 * image of an existing cone. Overlays a flat red prohibition sign in the
 * same pixel art style. Buster line goes top-right to bottom-left.
 *
 * Output: docs/assets/buster-cone.png
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const ENDPOINT =
  'https://etc-ai-foundry-sbx-east-us-2.cognitiveservices.azure.com/openai/deployments/gpt-image-1.5/images/generations?api-version=2024-02-01';

const REFERENCE_CONE = path.join(REPO_ROOT, 'docs', 'assets', 'cones', 'brownie-explosion.png');
const OUTPUT_PATH = path.join(REPO_ROOT, 'docs', 'assets', 'buster-cone.png');

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
    console.error(
      'Error: No API key found.\n' +
        'Set AZURE_OPENAI_API_KEY env var, or add a keychain entry:\n' +
        '  security add-generic-password -a "$USER" -s "azure-openai-api-key" -w "<key>"',
    );
    process.exit(1);
  }
}

const PROMPT = `Pixel art ice cream cone with a prohibition sign overlay, centered composition, 1:1 aspect ratio.

Quality target: L5 -- Premium Showcase

Style:
Highly detailed modern pixel art, crisp edges, 32-64px style density, smooth but still clearly pixel-based.
Not vector. Not painterly. Not photorealistic. No blur.

Lighting:
Soft studio lighting from upper left.
Gentle highlight across scoop.
Subtle shadow under scoop lip.
No harsh reflections.

Background:
Transparent background.
No gradients. No texture. No logo. No text.
The subject must be completely isolated on transparency -- no dark background, no colored background.

Cone:
Golden waffle cone with checker pattern.
Warm orange + honey tones.
NO darkened tip.
Tip same tone as rest of cone.

Scoop:
Rich dark chocolate brown base.
Visible pixel texture with highlights.
Generous rounded single scoop.

Prohibition sign overlay (buster):
A flat red prohibition circle with a single diagonal line overlaid ON TOP of the cone.
CRITICAL LINE DIRECTION: The diagonal line starts at the upper-RIGHT of the circle and ends at the lower-LEFT of the circle. This is the same direction as in the Ghostbusters logo or a standard "no entry" road sign. Think of it as a line going from 2 o'clock to 8 o'clock on a clock face.
The red must be FLAT -- solid red pixels (#CC0000), absolutely NO 3D shading, NO bevel, NO gradient, NO glow on the red elements.
The circle and line thickness should be proportional and clean.
The cone is fully contained INSIDE the circle -- no part of the cone sticks out beyond the buster ring.
The cone is visible behind/through the buster overlay.`;

async function main() {
  const apiKey = getApiKey();
  console.log('Generating buster cone...');

  const body = {
    prompt: PROMPT,
    n: 1,
    size: '1024x1024',
    quality: 'medium',
    background: 'transparent',
    output_format: 'png',
  };

  let res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '30', 10);
    console.log(`Rate limited. Waiting ${retryAfter}s...`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': apiKey },
      body: form,
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

  const pngBuf = Buffer.from(json.data[0].b64_json, 'base64');
  fs.writeFileSync(OUTPUT_PATH, pngBuf);
  console.log(`Wrote ${pngBuf.length} bytes to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
