import { defineConfig, devices } from '@playwright/test';
import { EXAMPLE_SITE_UNDER_PORTFOLIO, EXAMPLE_SITE_UNDER_PORTFOLIO_PORT } from './tests/helpers/built-site';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/* Tests that read the pixels of a canvas run on Chromium only (chromium and
   mobile-chrome): the other engines render the same page, so running them
   there only adds time. Text and layout tests stay on every project. */
const PIXEL_TESTS = /@pixels/;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry once on CI only. */
  retries: process.env.CI ? 1 : 0,
  /* One worker per CPU core of the CI runner. */
  workers: process.env.CI ? '100%' : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:1314',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grepInvert: PIXEL_TESTS,
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grepInvert: PIXEL_TESTS,
    },

    /* Mobile first: every behavior is also checked on a phone. */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 15'] },
      grepInvert: PIXEL_TESTS,
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Serves the theme's example site, in the production environment
     to test the same output as the one that will be deployed. Both servers
     render to memory, so neither overwrites the pages on disk of another
     Hugo server running on the same site, such as the development one. */
  webServer: [
    {
      command: 'hugo server --source exampleSite --environment production --port 1314 --disableLiveReload --renderToMemory',
      url: 'http://localhost:1314',
      reuseExistingServer: !process.env.CI,
    },
    /* The same site served under a subpath, like a deployment in a
       subfolder (baseURL /portfolio/). */
    {
      command:
        `hugo server --source exampleSite --environment production --port ${EXAMPLE_SITE_UNDER_PORTFOLIO_PORT} --baseURL ${EXAMPLE_SITE_UNDER_PORTFOLIO} --disableLiveReload --renderToMemory`,
      url: EXAMPLE_SITE_UNDER_PORTFOLIO,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
