import { test, expect } from '@playwright/test';

test('les pages françaises sont servies sous /fr/ : /fr/ est l’accueil français', async ({ page, baseURL }) => {
  const response = await page.goto('/fr/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toContainText('Bienvenue sur ce site de démonstration');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* Vérifié une fois l'accueil affiché : le visiteur y est resté sur /fr/, sans redirection. */
  await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
});

test.describe('navigateur en anglais', () => {
  test.use({ locale: 'en-US' });

  test('un navigateur en anglais (en-US) qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});
