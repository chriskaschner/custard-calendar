import { describe, it, expect, vi } from 'vitest';
import { accumulateFlavors } from '../src/flavor-catalog.js';

function createMockKV(initialData = {}) {
  const store = new Map(Object.entries(initialData));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
  };
}

describe('accumulateFlavors KV resilience', () => {
  it('KV write failure does not throw', async () => {
    const kv = createMockKV();
    kv.put.mockRejectedValue(new Error('KV 429'));

    // Should not throw despite KV write failure
    await expect(
      accumulateFlavors(kv, [{ title: 'New Flavor', description: 'Delicious.' }])
    ).resolves.toBeUndefined();
  });
});
