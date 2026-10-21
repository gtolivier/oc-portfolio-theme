import { test, expect } from '@playwright/test';

test('le pied de page affiche le logo du site suivi de « © <année courante> <auteur du site> »', async ({ page }) => {
  await page.goto('/');
  const annee = new Date().getFullYear();
  const piedDePage = page.locator('footer');
  await expect(piedDePage).toHaveText(
    new RegExp(`\\| E \\|\\|\\| \\| X \\|\\|\\|\\s*(—\\s*)?© ${annee} Jean Exemple`),
  );
});
