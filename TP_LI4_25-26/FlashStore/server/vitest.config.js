// server/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['../**/vite.config.js', '../vite.config.js'],
    server: {
      deps: {
        inline: []
      }
    }
  }
});
