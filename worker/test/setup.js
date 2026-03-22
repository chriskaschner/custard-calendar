/**
 * Global test setup: mock workers-og so WASM doesn't fail in Node/Vitest.
 * workers-og requires Cloudflare Workers WASM bundling (via wrangler/esbuild)
 * which is incompatible with standard Node.js module resolution.
 */
import { vi } from 'vitest';

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

vi.mock('workers-og', () => {
  class ImageResponse extends Response {
    constructor(_html, _opts) {
      super(FAKE_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    }
  }
  return { ImageResponse };
});
