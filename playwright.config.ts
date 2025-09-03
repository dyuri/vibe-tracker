import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests-e2e/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:8090',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on test failure */
    screenshot: 'only-on-failure',

    /* Record video on test failure */
    video: 'retain-on-failure',

    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 10000,

    /* Maximum time each navigation such as `goto()` can take. Defaults to 0 (no limit). */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Global setup and teardown */
  globalSetup: './tests-e2e/global-setup.ts',
  globalTeardown: './tests-e2e/global-teardown.ts',

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'test-results/',

  /* Maximum time one test can run for. */
  timeout: 30 * 1000,

  /* Maximum time expect() should wait for the condition to be met. */
  expect: {
    timeout: 5000,
  },

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'go run . serve --dir=tests-e2e/fixtures --dev',
    url: 'http://localhost:8090/health/live',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      TEST_MODE: 'true',
      ENABLE_RATE_LIMITING: 'false',
      TEST_EMAIL: 'testuser@example.com',
      TEST_PASSWORD: 'testpassword123',
    },
  },
});
