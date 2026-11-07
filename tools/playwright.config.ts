import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const baseURL = `http://127.0.0.1:${process.env.PORT ?? 4317}`;
export default defineConfig({
  testDir: resolve(root, 'EnglishCards.Tests/frontend/e2e'),
  outputDir: resolve(root, '.build/test-results'), timeout: 120000, workers: 1,
  reporter: [['list'], ['json', { outputFile: resolve(root, '.build/verification/e2e.json') }]],
  use: { baseURL, viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'npm run test:serve', env: { SETTINGS_PATH: resolve(root, '.build/test-runtime/settings.json') }, cwd: root, url: baseURL, reuseExistingServer: false, timeout: 120000 },
});
