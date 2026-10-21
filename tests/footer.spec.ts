import { test, expect } from '@playwright/test';

test('le pied de page affiche le logo du site suivi de « © <année courante> <auteur du site> »', async ({ page }) => {
  await page.goto('/fr/');
  const annee = new Date().getFullYear();
  const piedDePage = page.locator('footer');
  await expect(piedDePage).toHaveText(
    new RegExp(`\\| E \\|\\|\\| \\| X \\|\\|\\|\\s*(—\\s*)?© ${annee} Jean Exemple`),
  );
});

test('les lecteurs d’écran ne lisent pas les barres décoratives du logo du pied de page', async ({ page }) => {
  await page.goto('/fr/');
  const annee = new Date().getFullYear();
  const arbreAccessible = await page.locator('footer').ariaSnapshot();
  expect(arbreAccessible).toContain(`© ${annee} Jean Exemple`);
  expect(arbreAccessible).not.toContain('|');
});

test('le pied de page affiche la mention du site dans la langue de la page', async ({ page }) => {
  await page.goto('/fr/');
  const piedDePageFr = page.locator('footer');
  await expect(piedDePageFr).toContainText('Horloger de démonstration');
  await expect(piedDePageFr).not.toContainText('Sample clockmaker');

  await page.goto('/en/');
  const piedDePageEn = page.locator('footer');
  await expect(piedDePageEn).toContainText('Sample clockmaker');
  await expect(piedDePageEn).not.toContainText('Horloger de démonstration');
});
