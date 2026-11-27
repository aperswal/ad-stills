import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['features/**/*.test.ts', 'shared/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '@': new URL('.', import.meta.url).pathname } },
});
