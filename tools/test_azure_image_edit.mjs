#!/usr/bin/env node
/**
 * Test Azure OpenAI gpt-image-1.5 edits endpoint with reference image.
 *
 * Usage:
 *   node tools/test_azure_image_edit.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const EDITS_ENDPOINT =
  'https://etc-ai-foundry-sbx-east-us-2.cognitiveservices.azure.com/openai/deployments/gpt-image-1.5/images/edits?api-version=2024-02-01';

const GENERATIONS_ENDPOINT =
  'https://etc-ai-foundry-sbx-east-us-2.cognitiveservices.azure.com/openai/deployments/gpt-image-1.5/images/generations?api-version=2024-02-01';

function getApiKey() {
  return execSync('security find-generic-password -a "$USER" -s "azure-openai-api-key" -w')
    .toString()
    .trim();
}

async function testEditsEndpoint(apiKey, imgBuf) {
  console.log('\n--- Test 1: /images/edits with multipart form data ---');

  const form = new FormData();
  form.append('image[]', new Blob([imgBuf], { type: 'image/png' }), 'reference.png');
  form.append('prompt', 'A pixel art ice cream cone inspired by this chocolate eclair frozen custard. Pixel art style, 32x32 sprite density, transparent background, crisp pixel edges.');
  form.append('n', '1');
  form.append('size', '1024x1024');

  const res = await fetch(EDITS_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey },
    body: form,
  });

  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (res.ok) {
      console.log('Response keys:', Object.keys(json));
      if (json.data && json.data[0] && json.data[0].b64_json) {
        const buf = Buffer.from(json.data[0].b64_json, 'base64');
        fs.writeFileSync('docs/assets/sprites/_test-edit-reference.png', buf);
        console.log('SUCCESS - saved to docs/assets/sprites/_test-edit-reference.png (' + buf.length + ' bytes)');
      }
    } else {
      console.log('Error:', JSON.stringify(json, null, 2));
    }
  } catch {
    console.log('Raw response:', text.slice(0, 500));
  }
}

async function testGenerationsWithImage(apiKey, imgBuf) {
  console.log('\n--- Test 2: /images/generations with image[] in JSON body (base64) ---');

  const b64 = imgBuf.toString('base64');
  const body = {
    prompt: 'A pixel art ice cream cone inspired by this chocolate eclair frozen custard. Pixel art style, 32x32 sprite density, transparent background, crisp pixel edges.',
    n: 1,
    size: '1024x1024',
    background: 'transparent',
    quality: 'medium',
    image: 'data:image/png;base64,' + b64.slice(0, 100) + '...',  // truncated for test
  };

  // Don't actually send the full base64, just test parameter acceptance
  body.image = undefined;  // remove, just test without for now

  const res = await fetch(GENERATIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body }),
  });

  console.log('Status:', res.status, res.statusText);
  // Don't save this one, just checking endpoint behavior
  if (res.ok) {
    console.log('Generations endpoint works (without image ref)');
  }
}

async function main() {
  const apiKey = getApiKey();

  // Fetch a reference image from Culver's
  console.log('Fetching reference image from Culver\'s...');
  const imgRes = await fetch('https://www.culvers.com/fotd/chocolate-eclair/chocolate-eclair-landing.png');
  if (!imgRes.ok) {
    console.error('Could not fetch reference image:', imgRes.status);
    // Try with a local image instead
    console.log('Using local test image as fallback...');
    const localBuf = fs.readFileSync('docs/assets/sprites/_test-azure-transparent.png');
    await testEditsEndpoint(apiKey, localBuf);
    return;
  }

  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  console.log('Reference image:', imgBuf.length, 'bytes');

  await testEditsEndpoint(apiKey, imgBuf);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});
