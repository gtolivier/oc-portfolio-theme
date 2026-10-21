import { test, expect } from '@playwright/test';

test('le logo de l’en-tête affiche les initiales et mène à l’accueil', async ({ page }) => {
  await page.goto('/');
  const logo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveAttribute('href', '/');
});

test('en anglais, le logo de l’en-tête mène à l’accueil anglais', async ({ page }) => {
  await page.goto('/en/');
  const logo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toHaveAttribute('href', '/en/');
});
