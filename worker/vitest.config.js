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
        // Per-file floors to prevent regression in previously-low-coverage modules
        'src/email-sender.js': { branches: 63 },
        'src/snapshot-targets.js': { branches: 75 },
        'src/metrics.js': { branches: 59 },
      },
    },
  },
});
