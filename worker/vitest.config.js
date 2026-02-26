import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: [...configDefaults.exclude, 'test/browser/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        ...configDefaults.coverage.exclude,
        'test/**',
        'node_modules/**',
      ],
      thresholds: {
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
