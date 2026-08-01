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

describe('accumulateFlavors synthetic-entry guard', () => {
  it('never adds our own placeholders to the autocomplete catalog', async () => {
    const kv = createMockKV();

    await accumulateFlavors(kv, [
      { title: 'Genuinely New Flavor', description: 'From upstream.' },
      { title: 'New flavor premiere', description: 'Placeholder.', source: 'premiere' },
      { title: 'Hand Pinned', description: 'Manual.', source: 'override' },
    ]);

    const written = JSON.parse(kv.put.mock.calls[0][1]);
    const titles = written.flavors.map(f => f.title);
    expect(titles).toContain('Genuinely New Flavor');
    expect(titles).not.toContain('New flavor premiere');
    expect(titles).not.toContain('Hand Pinned');
  });

  it('writes nothing when every entry is synthetic', async () => {
    const kv = createMockKV();

    await accumulateFlavors(kv, [
      { title: 'New flavor premiere', description: '', source: 'premiere' },
    ]);

    expect(kv.put).not.toHaveBeenCalled();
  });
});
