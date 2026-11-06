import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: 'artifacts/dist',
    rollupOptions: {
      input: [
        fileURLToPath(new URL('../index.html', import.meta.url)),
        fileURLToPath(new URL('../render.html', import.meta.url)),
      ],
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
