import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Coverage thresholds (90%+ requirement)
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },

      // Files to include in coverage
      include: [
        'src/**/*.{js,ts}',
        'npm/*/src/**/*.{js,ts}',
        'tests/simulation/**/*.test.{js,ts}',
      ],

      // Files to exclude from coverage
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/tests/**',
        '**/__tests__/**',
        '**/examples/**',
        '**/docs/**',
      ],

      // Enable all coverage reporters
      all: true,

      // Clean coverage results before running tests
      clean: true,
    },

    // Test file patterns
    include: [
      'tests/**/*.test.{js,ts}',
      'tests/**/*.spec.{js,ts}',
      '**/__tests__/**/*.{js,ts}',
    ],

    // Files to exclude
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.config.{js,ts}',
    ],

    // Test timeout (30 seconds for integration tests)
    testTimeout: 30000,

    // Hook timeouts
    hookTimeout: 30000,

    // Reporter configuration
    reporters: ['verbose', 'json', 'html'],

    // Output file for results
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html',
    },

    // Concurrency settings
    maxConcurrency: 5,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Watch mode configuration
    watch: false,

    // Benchmark configuration
    benchmark: {
      include: ['tests/**/performance.test.{js,ts}'],
      exclude: ['node_modules/**'],
    },

    // Setup files
    setupFiles: [],

    // Global test setup
    globalSetup: undefined,

    // Retry failed tests
    retry: 0,

    // Fail on console errors
    onConsoleLog: undefined,

    // Silent console output during tests
    silent: false,

    // Sequence configuration
    sequence: {
      shuffle: false,
      concurrent: false,
    },

    // TypeScript configuration
    typecheck: {
      enabled: false,
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@simulation': path.resolve(__dirname, './tests/simulation'),
    },
  },

  // Define global constants
  define: {
    'import.meta.vitest': 'undefined',
  },
});
