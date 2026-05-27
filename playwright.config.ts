import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/videos/**',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', {open: 'never', outputFolder: 'e2e/playwright-report'}]],
  outputDir: 'e2e/test-results',
});
