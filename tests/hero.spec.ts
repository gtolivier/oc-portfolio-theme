import { test, expect } from '@playwright/test';

test('sur l’accueil français, le titre principal commence par le nom de l’auteur du site', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
  /* Le texte du DOM, tel qu'écrit dans params.author : l'affichage en majuscules relève du CSS. */
  await expect(titrePrincipal).toHaveText(/^\s*Jean Exemple/);
});

test('sur l’accueil français, le titre principal affiche, à la ligne sous le nom de l’auteur, son titre professionnel', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
  /* Le titre vient du front matter de exampleSite/content/_index.md, bloc [params.hero], clé title.
     Texte du DOM, tel qu'écrit dans le front matter : l'affichage en majuscules relève du CSS. */
  await expect(titrePrincipal).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);
  /* Le titre est un élément à part dans le h1, rendu à la ligne, sous le nom. */
  const titreProfessionnel = titrePrincipal.getByText('Horloger indépendant', { exact: true });
  await expect(titreProfessionnel).toBeVisible();
  const boiteTitrePrincipal = await titrePrincipal.boundingBox();
  const boiteTitreProfessionnel = await titreProfessionnel.boundingBox();
  expect(boiteTitreProfessionnel!.y - boiteTitrePrincipal!.y).toBeGreaterThanOrEqual(boiteTitreProfessionnel!.height / 2);
});
