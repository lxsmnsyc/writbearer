import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Separate from the Vite config. The Solid plugin would switch tests to a
// DOM environment, and the simulation does not need one.
export default defineConfig({
  resolve: {
    // Job modules bring their own spell icons. Tests never draw them.
    alias: [
      {
        find: /^~icons\/.*$/,
        replacement: fileURLToPath(new URL('test/support/icon.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
