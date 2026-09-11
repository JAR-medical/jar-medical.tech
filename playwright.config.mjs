import { defineConfig, devices } from '@playwright/test';

// End-to-end configuration for the public site.
//
// The server is started in globalSetup on an ephemeral port rather than through
// `webServer`, which needs the URL up front. Workers pick the address up from
// E2E_BASE_URL; see tests/e2e/fixtures.mjs.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  globalSetup: './tests/e2e/global-setup.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  outputDir: './test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
