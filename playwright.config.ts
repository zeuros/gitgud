import {defineConfig} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TAURI_BINARY = path.join(__dirname, 'src-tauri/target/release/gitgud');
const USE_BINARY = fs.existsSync(TAURI_BINARY);

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/videos/**',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', {open: 'never', outputFolder: 'e2e/playwright-report'}]],
  outputDir: 'e2e/test-results',
  // In dev-server mode (no built binary) start the Angular server automatically
  ...(USE_BINARY ? {} : {
    webServer: {
      command: 'npm run ng:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  }),
});
