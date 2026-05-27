import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e/videos',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'e2e/test-results',
});
