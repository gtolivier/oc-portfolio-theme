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
