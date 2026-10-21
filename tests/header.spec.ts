import { test, expect } from '@playwright/test';

test('le logo de l’en-tête affiche les initiales et mène à l’accueil', async ({ page }) => {
  await page.goto('/');
  const logo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveAttribute('href', '/');
});

test('la navigation de l’en-tête liste les entrées du menu principal du site', async ({ page }) => {
  await page.goto('/');
  const liens = page.locator('header nav').getByRole('link');
  await expect(liens).toHaveText(['Accueil', 'Projets', 'Contact']);
  await expect(liens.nth(0)).toHaveAttribute('href', '/');
  await expect(liens.nth(1)).toHaveAttribute('href', '/projets/');
  await expect(liens.nth(2)).toHaveAttribute('href', '/#contact');
});

test('sur la page d’accueil, seul le lien « Accueil » de la navigation est marqué comme page courante', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Projets', exact: true })).not.toHaveAttribute('aria-current');
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).not.toHaveAttribute('aria-current');
});

test('sur la page Projets, seul le lien « Projets » de la navigation est marqué comme page courante', async ({ page }) => {
  await page.goto('/projets/');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Projets', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).not.toHaveAttribute('aria-current');
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).not.toHaveAttribute('aria-current');
});

test('le lien de la navigation marqué page courante est souligné d’un trait de couleur accent', async ({ page }) => {
  await page.goto('/');
  const courant = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(courant).toHaveAttribute('aria-current', 'page');
  await expect(courant).toHaveCSS('border-bottom-style', 'solid');
  await expect(courant).toHaveCSS('border-bottom-color', 'rgb(42, 136, 141)');
  await expect(courant).not.toHaveCSS('border-bottom-width', '0px');
});

test('en anglais, la navigation de l’en-tête liste les entrées du menu principal anglais', async ({ page }) => {
  await page.goto('/en/');
  const liens = page.locator('header nav').getByRole('link');
  await expect(liens).toHaveText(['Home', 'Projects', 'Contact']);
  await expect(liens.nth(0)).toHaveAttribute('href', '/en/');
  await expect(liens.nth(1)).toHaveAttribute('href', '/en/projets/');
  await expect(liens.nth(2)).toHaveAttribute('href', '/en/#contact');
});

test('en anglais, le logo de l’en-tête mène à l’accueil anglais', async ({ page }) => {
  await page.goto('/en/');
  const logo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toHaveAttribute('href', '/en/');
});

test('sur ordinateur, un lien de la navigation survolé est souligné en couleur accent, le trait décalé sous le texte', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'le survol à la souris n’existe pas sur un écran tactile');
  await page.goto('/');
  const lien = page.locator('header nav').getByRole('link', { name: 'Projets', exact: true });
  await expect(lien).not.toHaveAttribute('aria-current');
  await lien.hover();
  await expect(lien).toHaveCSS('text-decoration-line', 'underline');
  await expect(lien).toHaveCSS('text-decoration-color', 'rgb(42, 136, 141)');
  await expect(lien).toHaveCSS('text-underline-offset', '5px');
});

test('les liens de l’en-tête sont de couleur papier et ne sont pas soulignés', async ({ page }) => {
  await page.goto('/');
  const liens = page.locator('header').getByRole('link');
  await expect(liens).toHaveCount(4);
  for (const lien of await liens.all()) {
    await expect(lien).toHaveCSS('color', 'rgb(227, 223, 204)');
    await expect(lien).toHaveCSS('text-decoration-line', 'none');
  }
});
