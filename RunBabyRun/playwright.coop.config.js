import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/coop',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4174' },
  webServer: { command: 'node scripts/coop-test-server.mjs', port: 4174, reuseExistingServer: false },
});
