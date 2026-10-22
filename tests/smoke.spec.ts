import { test, expect } from '@playwright/test';

// Test d'environnement : le site d'exemple est servi dans les deux langues.
test('la page d’accueil est servie en français', async ({ page }) => {
  const response = await page.goto('/fr/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
});

test('la page d’accueil est servie en anglais', async ({ page }) => {
  const response = await page.goto('/en/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
});
