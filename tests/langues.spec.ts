import { test, expect } from '@playwright/test';

test('les pages françaises sont servies sous /fr/ : /fr/ est l’accueil français', async ({ page, baseURL }) => {
  const response = await page.goto('/fr/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toContainText('Bienvenue sur ce site de démonstration');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* Vérifié une fois l'accueil affiché : le visiteur y est resté sur /fr/, sans redirection. */
  await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
});

test.describe('navigateur sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('sans JavaScript, un navigateur qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
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

test.describe('navigateur en allemand, puis en anglais', () => {
  test.use({ locale: 'de-DE' });

  test('un navigateur dont les langues préférées sont [de-DE, en] qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    /* L'option locale de Playwright ne fixe qu'une langue : la liste complète
       des langues préférées est définie avant que les scripts de la page ne s'exécutent. */
    await page.addInitScript(() => {
      const languages = ['de-DE', 'en'];
      Object.defineProperty(Navigator.prototype, 'languages', { get: () => languages, configurable: true });
      Object.defineProperty(Navigator.prototype, 'language', { get: () => languages[0], configurable: true });
    });
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en français, puis en anglais', () => {
  test.use({ locale: 'fr-FR' });

  test('un navigateur dont les langues préférées sont [fr-FR, en] qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    /* L'option locale de Playwright ne fixe qu'une langue : la liste complète
       des langues préférées est définie avant que les scripts de la page ne s'exécutent. */
    await page.addInitScript(() => {
      const languages = ['fr-FR', 'en'];
      Object.defineProperty(Navigator.prototype, 'languages', { get: () => languages, configurable: true });
      Object.defineProperty(Navigator.prototype, 'language', { get: () => languages[0], configurable: true });
    });
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});
