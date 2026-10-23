import { test, expect } from '@playwright/test';

test('sur l’accueil français, le titre principal commence par le nom de l’auteur du site', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
  /* Le texte du DOM, tel qu'écrit dans params.author : l'affichage en majuscules relève du CSS. */
  await expect(titrePrincipal).toHaveText(/^\s*Jean Exemple/);
});
