import { test, expect, type Page } from '@playwright/test';
import { SITE_WITH_ALIASES, buildSite, serveSite, removeDirectory } from './helpers/built-site';

/* Playwright's locale option sets a single language: the full list of
   preferred languages is defined before the page scripts run. */
async function setPreferredLanguages(page: Page, languages: string[]): Promise<void> {
  await page.addInitScript((preferred) => {
    Object.defineProperty(Navigator.prototype, 'languages', { get: () => preferred, configurable: true });
    Object.defineProperty(Navigator.prototype, 'language', { get: () => preferred[0], configurable: true });
  }, languages);
}

test('French pages are served under /fr/: /fr/ is the French home page', async ({ page, baseURL }) => {
  const response = await page.goto('/fr/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toContainText('Bienvenue sur ce site de démonstration');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* Checked once the home page is displayed: the visitor stayed on /fr/, with no redirect. */
  await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
});

test('the redirect page served for / asks search engines not to index it (meta robots noindex)', async ({ page, request }) => {
  /* / redirects at once: the HTML served for / is what gets examined, parsed without being run. */
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  const robots = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'text/html');
    return Array.from(document.querySelectorAll('head meta[name="robots" i]'), (meta) => meta.getAttribute('content') ?? '');
  }, html);
  expect(robots.some((content) => content.split(',').map((directive) => directive.trim().toLowerCase()).includes('noindex'))).toBe(true);
});

test.describe('browser without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, a browser that opens / lands on /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('English browser', () => {
  test.use({ locale: 'en-US' });

  test('an English (en-US) browser that opens / lands on /en/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('an English browser keeps the anchor and the query: /#contact lands on /en/#contact, /?source=test on /en/?source=test', async ({ page, baseURL }) => {
    await page.goto('/#contact');
    await expect(page).toHaveURL(new URL('/en/#contact', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');

    await page.goto('/?source=test');
    await expect(page).toHaveURL(new URL('/en/?source=test', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('English browser, site served under a subpath', () => {
  test.use({ locale: 'en-US' });

  test('served under /portfolio/, an English browser that opens /portfolio/ lands on /portfolio/en/', async ({ page }) => {
    await page.goto('http://localhost:1315/portfolio/');
    await expect(page).toHaveURL('http://localhost:1315/portfolio/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('British English browser', () => {
  test.use({ locale: 'en-GB' });

  test('a British English (en-GB) browser that opens / lands on /en/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('French browser, old address of an English page', () => {
  test.use({ locale: 'fr-FR' });

  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ALIASES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a French browser that opens the old address (alias) of an English page or of the English home page lands on that English page, not on its French translation', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_ALIASES, siteDirectory);
    await page.goto(`${SITE_WITH_ALIASES.origin}/en/old-english-page/`);
    await expect(page).toHaveURL(`${SITE_WITH_ALIASES.origin}/en/page-avec-alias/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.getByRole('main')).toContainText('Fictional English page, reachable from its old address.');

    await page.goto(`${SITE_WITH_ALIASES.origin}/en/english/`);
    await expect(page).toHaveURL(`${SITE_WITH_ALIASES.origin}/en/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.getByRole('main')).toContainText('Welcome to this demo site');
  });
});

test.describe('French browser, after a click on "EN"', () => {
  test.use({ locale: 'fr-FR' });

  test('a click on "EN" from a French page is not remembered: nothing is stored in the browser, and / still leads a French browser to /fr/', async ({ page, context, baseURL }) => {
    await page.goto('/fr/');
    await page.locator('header').getByRole('group', { name: 'Langue', exact: true }).getByRole('link', { name: 'EN', exact: true }).click();
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    /* Neither localStorage nor cookie. */
    expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual([]);
    expect(await context.cookies(baseURL)).toEqual([]);
    /* / follows only the browser language. */
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('browser in another language', () => {
  test.use({ locale: 'de-DE' });

  test('a browser in another language (de-DE) that opens / lands on /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('German, then English browser', () => {
  test.use({ locale: 'de-DE' });

  test('a browser whose preferred languages are [de-DE, en] that opens / lands on /en/', async ({ page, baseURL }) => {
    await setPreferredLanguages(page, ['de-DE', 'en']);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('French, then English browser', () => {
  test.use({ locale: 'fr-FR' });

  test('a browser whose preferred languages are [fr-FR, en] that opens / lands on /fr/', async ({ page, baseURL }) => {
    await setPreferredLanguages(page, ['fr-FR', 'en']);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('North Frisian, then English browser', () => {
  test('a browser whose preferred languages are [frr, en] (North Frisian, then English) that opens / lands on /en/', async ({ page, baseURL }) => {
    await setPreferredLanguages(page, ['frr', 'en']);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});
