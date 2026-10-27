import { defineConfig } from 'vitest/config';

// Separate from the Vite config. The Solid plugin would switch tests to a
// DOM environment, and the simulation does not need one.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
