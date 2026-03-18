#!/usr/bin/env node
/**
 * Quick connectivity test for Azure OpenAI gpt-image-1.5 endpoint.
 *
 * Usage:
 *   AZURE_OPENAI_API_KEY=... node tools/test_azure_image_api.mjs
 *
 * Generates a single small test image and saves to docs/assets/sprites/_test-azure.png
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'assets', 'sprites', '_test-azure.png');

const ENDPOINT =
  'https://etc-ai-foundry-sbx-east-us-2.cognitiveservices.azure.com/openai/deployments/gpt-image-1.5/images/generations?api-version=2024-02-01';

async function main() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: AZURE_OPENAI_API_KEY not set');
    process.exitCode = 1;
    return;
  }

  const prompt =
    'A single scoop of vanilla frozen custard on a waffle cone, pixel art style, 32x32 sprite, transparent background, soft studio lighting';

  console.log('Endpoint:', ENDPOINT);
  console.log('Prompt:', prompt);
  console.log('Sending request...\n');

  const body = {
    prompt,
    n: 1,
    size: '1024x1024',
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  console.log('Status:', res.status, res.statusText);

  if (!res.ok) {
    const text = await res.text();
    console.error('Error response:', text);
    process.exitCode = 1;
    return;
  }

  const json = await res.json();
  console.log('Response keys:', Object.keys(json));

  if (!json.data || json.data.length === 0) {
    console.error('No image data in response');
    console.log('Full response:', JSON.stringify(json, null, 2));
    process.exitCode = 1;
    return;
  }

  const item = json.data[0];
  console.log('Image data keys:', Object.keys(item));

  let imageBytes;
  if (item.b64_json) {
    imageBytes = Buffer.from(item.b64_json, 'base64');
    console.log('Got base64 image data');
  } else if (item.url) {
    console.log('Got URL, fetching image...');
    const imgRes = await fetch(item.url);
    imageBytes = Buffer.from(await imgRes.arrayBuffer());
  } else {
    console.error('Unexpected response format:', JSON.stringify(item, null, 2));
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, imageBytes);
  console.log(`\nSaved: ${OUT_PATH} (${imageBytes.length} bytes)`);
  console.log('Azure OpenAI image API is working.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exitCode = 1;
});
