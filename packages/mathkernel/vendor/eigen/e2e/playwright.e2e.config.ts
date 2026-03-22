import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config that reuses an already-running dev server on :1420
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
