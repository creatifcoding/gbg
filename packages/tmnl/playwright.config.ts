import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for TMNL E2E tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,

  use: {
    baseURL: process.env.TMNL_BASE_URL ?? 'http://localhost:1421',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run dev server before tests
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:1421',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
