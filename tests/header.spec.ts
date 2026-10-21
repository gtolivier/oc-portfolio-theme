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
