import { test, expect, type Locator } from '@playwright/test';

/* Vérifie que chaque ligne de l'accroche est visible dans la zone, et que chacune commence
   sous la précédente, dans l'ordre donné. */
async function verifierLignesDansLOrdre(principal: Locator, lignes: string[]) {
  for (const ligne of lignes) {
    await expect(principal.getByText(ligne)).toBeVisible();
  }
  /* Position à l'écran du début et de la fin de chaque ligne, quelle que soit la façon dont
     le gabarit les sépare. Une ligne longue peut elle-même passer à la ligne sur téléphone :
     on compare le début d'une ligne à la fin de la précédente. */
  const positions = await principal.evaluate((racine, textes) => {
    return textes.map((texte) => {
      const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
      for (let noeud = parcours.nextNode(); noeud; noeud = parcours.nextNode()) {
        const debut = (noeud.textContent ?? '').indexOf(texte);
        if (debut === -1) continue;
        const plage = document.createRange();
        plage.setStart(noeud, debut);
        plage.setEnd(noeud, debut + texte.length);
        const boites = Array.from(plage.getClientRects()).filter((boite) => boite.height > 0);
        const premiere = boites[0];
        const derniere = boites[boites.length - 1];
        return { haut: premiere.top, hautFin: derniere.top, hauteurFin: derniere.height };
      }
      return null;
    });
  }, lignes);
  for (let i = 1; i < lignes.length; i++) {
    const precedente = positions[i - 1];
    const courante = positions[i];
    expect(precedente, `ligne introuvable : ${lignes[i - 1]}`).not.toBeNull();
    expect(courante, `ligne introuvable : ${lignes[i]}`).not.toBeNull();
    expect(courante!.haut - precedente!.hautFin, `« ${lignes[i]} » commence sous « ${lignes[i - 1]} »`)
      .toBeGreaterThanOrEqual(precedente!.hauteurFin / 2);
  }
}

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

test('sur l’accueil français, le hero affiche l’accroche, une ligne par entrée : les trois lignes, dans l’ordre, chacune sous la précédente', async ({ page }) => {
  await page.goto('/fr/');
  const principal = page.getByRole('main');
  /* L'accroche vient du front matter de exampleSite/content/_index.md, bloc [params.hero],
     clé tagline (une liste de chaînes, une par ligne). */
  const lignes = [
    'Montres mécaniques sur mesure — 20 ans d’atelier.',
    'Conception, réparation et entretien',
    'de pendules et de montres anciennes.',
  ];
  await verifierLignesDansLOrdre(principal, lignes);
});

test('sur l’accueil anglais, le titre sous le nom de l’auteur est le titre professionnel anglais', async ({ page }) => {
  await page.goto('/en/');
  const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
  /* Le titre vient du front matter de exampleSite/content/_index.en.md, bloc [params.hero], clé title.
     Texte du DOM, tel qu'écrit dans le front matter : l'affichage en majuscules relève du CSS. */
  await expect(titrePrincipal.getByText('Independent clockmaker', { exact: true })).toBeVisible();
});

test('sur l’accueil anglais, le hero affiche les trois lignes de l’accroche anglaise, dans l’ordre, chacune sous la précédente', async ({ page }) => {
  await page.goto('/en/');
  const principal = page.getByRole('main');
  /* L'accroche vient du front matter de exampleSite/content/_index.en.md, bloc [params.hero],
     clé tagline (une liste de chaînes, une par ligne). */
  const lignes = [
    'Custom mechanical watches — 20 years at the bench.',
    'Design, repair and servicing',
    'of antique clocks and watches.',
  ];
  await verifierLignesDansLOrdre(principal, lignes);
});
