import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests.
 *
 * Deliberately tiny in scope: they load pages that need no session and check
 * that the bundle actually comes alive. That narrow question is the one the
 * other suites cannot answer — typecheck, lint and the end-to-end suites all
 * passed on a build whose Content-Security-Policy blocked Next's inline
 * bootstrap, so React never hydrated and every button on the site did nothing.
 * A green pipeline reported a completely dead application.
 *
 * Placeholder Supabase credentials are enough here on purpose: nothing these
 * tests touch requires a real backend, so they run on any push without secrets.
 */
export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.SMOKE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Reuses an already running server locally; starts one in CI. `next start`
  // rather than `next dev` because the failure being guarded against — a header
  // that only the production build emits — does not exist in dev.
  webServer: process.env.SMOKE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://127.0.0.1:3000/login',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
