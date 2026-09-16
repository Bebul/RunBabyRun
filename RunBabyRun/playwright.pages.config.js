import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  use: { baseURL: 'http://127.0.0.1:4175/RunBabyRun/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort --base /RunBabyRun/',
    port: 4175,
    reuseExistingServer: false,
  },
});
