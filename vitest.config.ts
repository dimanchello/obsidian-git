import { defineConfig } from 'vitest/config';

const TEST_RUNNER_CONFIG = {
  environment: 'node',
  include: ['tests/**/*.test.ts'],
  timeoutMs: 15_000,
} as const;

export default defineConfig({
  test: {
    environment: TEST_RUNNER_CONFIG.environment,
    include: TEST_RUNNER_CONFIG.include,
    testTimeout: TEST_RUNNER_CONFIG.timeoutMs,
    hookTimeout: TEST_RUNNER_CONFIG.timeoutMs,
  },
});
