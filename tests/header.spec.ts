import { test, expect } from '@playwright/test';

test('le logo de l’en-tête affiche les initiales et mène à l’accueil', async ({ page }) => {
  await page.goto('/');
  const logo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveAttribute('href', '/');
});
