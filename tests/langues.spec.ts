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

test.describe('navigateur en anglais britannique', () => {
  test.use({ locale: 'en-GB' });

  test('un navigateur en anglais britannique (en-GB) qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en français', () => {
  test.use({ locale: 'fr-FR' });

  test('un navigateur en français (fr-FR) qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('navigateur dans une autre langue', () => {
  test.use({ locale: 'de-DE' });

  test('un navigateur dans une autre langue (de-DE) qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});
