import { test, expect } from '@playwright/test';

test('an unknown address under /fr/ answers with a 404 status and the theme’s French error page: the site’s header and footer around a heading and a message', async ({
  page,
}) => {
  const response = await page.goto('/fr/page-qui-n-existe-pas/');
  expect(response?.status()).toBe(404);
  /* A page of the French site, not Hugo's own "Page Not Found" page. */
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* The French site's header: its logo leads to the French home page. */
  await expect(page.locator('header').getByRole('link', { name: 'Exemple', exact: true })).toHaveAttribute(
    'href',
    '/fr/',
  );
  /* The French site's footer, with its French note. */
  await expect(page.locator('footer').getByText('Horloger de démonstration', { exact: true })).toBeVisible();
  /* Between them, a heading and a message. */
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(main.getByRole('paragraph').first()).not.toHaveText('');
});

test('an unknown address with no language prefix answers with a 404 status and the French error page, the default language’s: the same heading and message as under /fr/, the page in French', async ({
  page,
}) => {
  /* The French error page's heading and message, which this page must show. */
  await page.goto('/fr/page-qui-n-existe-pas/');
  const frenchMain = page.getByRole('main');
  const frenchHeading = (await frenchMain.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  const frenchMessage = (await frenchMain.getByRole('paragraph').first().textContent())?.trim() ?? '';
  expect(frenchHeading).not.toBe('');
  expect(frenchMessage).not.toBe('');

  const response = await page.goto('/page-qui-n-existe-pas/');
  expect(response?.status()).toBe(404);
  /* A page of the French site, not Hugo's own "Page Not Found" page. */
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* The French error page's heading and message. */
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(frenchHeading);
  await expect(main.getByRole('paragraph').first()).toHaveText(frenchMessage);
});

test('an unknown address under /en/ answers with a 404 status and the English error page: its heading and message in English, the page in English', async ({
  page,
}) => {
  /* The French error page's heading and message, which the English page must not show. */
  await page.goto('/fr/page-qui-n-existe-pas/');
  const frenchMain = page.getByRole('main');
  const frenchHeading = (await frenchMain.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  const frenchMessage = (await frenchMain.getByRole('paragraph').first().textContent())?.trim() ?? '';
  expect(frenchHeading).not.toBe('');
  expect(frenchMessage).not.toBe('');

  const response = await page.goto('/en/page-that-does-not-exist/');
  expect(response?.status()).toBe(404);
  /* A page of the English site. */
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  /* Its heading and message, translated: present, and not the French ones. */
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText(frenchHeading);
  await expect(main.getByRole('paragraph').first()).not.toHaveText('');
  await expect(main.getByRole('paragraph').first()).not.toHaveText(frenchMessage);
});
