import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const frontendRoot = resolve(repoRoot, 'EnglishCards/frontend');
export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@frontend': resolve(frontendRoot, 'src'),
      '@fixtures': resolve(frontendRoot, 'assets'),
      '@test-server': resolve(repoRoot, 'tools/test-server'),
    },
  },
  build: {
    outDir: resolve(repoRoot, 'EnglishCards/.build/frontend-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: [resolve(frontendRoot, 'index.html'), resolve(frontendRoot, 'render.html')],
    },
  },
  test: { include: ['../../EnglishCards.Tests/frontend/unit/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
