import { test, expect, type Locator } from '@playwright/test';
import { SITE_A_UN_AUTRE_HERO, SITE_SANS_HERO, construireUnSite, servirUnSite, supprimerUnSite } from './helpers/site-construit';

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

/* Texte affiché à l'écran par un élément, dans l'ordre de rendu : ses nœuds texte et le
   contenu généré de ses pseudo-éléments ::before et ::after (sans le texte alternatif d'un
   `content: "…" / "…"`), éléments masqués exclus. Indépendant du balisage choisi. */
async function texteAffiche(element: Locator): Promise<string> {
  const texte = await element.evaluate((racine) => {
    const genere = (el: Element, pseudo: '::before' | '::after') => {
      const contenu = getComputedStyle(el, pseudo).content;
      const chaines = contenu.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
      return chaines.map((chaine) => JSON.parse(chaine) as string).join('');
    };
    const parcourir = (el: Element): string => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return '';
      let resultat = genere(el, '::before');
      for (const enfant of Array.from(el.childNodes)) {
        if (enfant.nodeType === Node.TEXT_NODE) resultat += enfant.textContent ?? '';
        else if (enfant.nodeType === Node.ELEMENT_NODE) resultat += parcourir(enfant as Element);
      }
      return resultat + genere(el, '::after');
    };
    return parcourir(racine);
  });
  return texte.replace(/\s+/g, ' ').trim();
}

/* Styles calculés qui décident de l'allure d'un texte : casse affichée, première police de la
   pile, graisse et couleur. */
async function styleDuTexte(element: Locator) {
  return element.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      casse: style.textTransform,
      famille: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
      graisse: style.fontWeight,
      couleur: style.color,
    };
  });
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

test('sur l’accueil français, le nom de l’auteur s’affiche en majuscules, en IBM Plex Mono grasse (700), couleur papier, plus grand que le titre professionnel qui le suit', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
  await expect(titrePrincipal).toHaveText(/^\s*Jean Exemple/);
  const titreProfessionnel = titrePrincipal.getByText('Horloger indépendant', { exact: true });
  await expect(titreProfessionnel).toBeVisible();
  /* Le nom est un nœud texte direct du h1 : il prend les styles calculés du h1. Référence de
     design : nom en clamp(44px, 6.4vw, 100px), titre en clamp(22px, 3vw, 46px). */
  const styleDuNom = await styleDuTexte(titrePrincipal);
  expect(styleDuNom).toEqual({
    casse: 'uppercase',
    famille: 'IBM Plex Mono',
    graisse: '700',
    couleur: 'rgb(227, 223, 204)',
  });
  const tailleDuNom = await titrePrincipal.evaluate((h1) => parseFloat(getComputedStyle(h1).fontSize));
  const tailleDuTitre = await titreProfessionnel.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tailleDuNom, 'le nom est plus grand que le titre professionnel').toBeGreaterThan(tailleDuTitre);
});

test('sur l’accueil français, le titre professionnel qui suit le nom de l’auteur s’affiche en majuscules, en IBM Plex Mono demi-grasse (600), couleur accent', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
  /* Le titre est un élément à part dans le h1 : ce sont ses propres styles calculés qui
     décident de son allure. Référence de design : accent #2A888D. */
  const titreProfessionnel = titrePrincipal.getByText('Horloger indépendant', { exact: true });
  await expect(titreProfessionnel).toBeVisible();
  expect(await styleDuTexte(titreProfessionnel)).toEqual({
    casse: 'uppercase',
    famille: 'IBM Plex Mono',
    graisse: '600',
    couleur: 'rgb(42, 136, 141)',
  });
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

test('sur l’accueil français, le hero affiche la stack sur une ligne, entrées séparées par « · »', async ({ page }) => {
  await page.goto('/fr/');
  const principal = page.getByRole('main');
  /* La stack vient du front matter de exampleSite/content/_index.md, bloc [params.hero],
     clé stack (une liste de chaînes : 'Laiton', 'Acier', 'Rubis', 'Émail'). Le gabarit les
     joint en un seul élément, séparées par un point médian entouré d'espaces. */
  await expect(principal.getByText('Laiton · Acier · Rubis · Émail', { exact: true })).toBeVisible();
});

test('sur l’accueil français, le premier bouton du hero, « Voir les projets », mène à la page Projets française', async ({ page }) => {
  await page.goto('/fr/');
  /* Les boutons viennent du front matter de exampleSite/content/_index.md, blocs
     [[params.hero.actions]] ; le premier a pageRef = '/projets'. Le hero précède le texte
     d'accueil : son premier bouton est le premier lien du contenu principal. */
  const premierBouton = page.getByRole('main').getByRole('link').first();
  await expect(premierBouton).toHaveText('Voir les projets');
  await expect(premierBouton).toHaveAttribute('href', '/fr/projets/');
  await premierBouton.click();
  await expect(page).toHaveURL('/fr/projets/');
});

test('sur l’accueil français, le premier bouton du hero affiche une flèche « → » après « Voir les projets », que les lecteurs d’écran ne lisent pas', async ({ page }) => {
  await page.goto('/fr/');
  /* Le hero précède le texte d'accueil : son premier bouton est le premier lien du contenu
     principal. À l'écran, la flèche suit le libellé ; le nom accessible du lien reste le seul
     libellé. */
  const premierBouton = page.getByRole('main').getByRole('link').first();
  await expect(premierBouton).toHaveAccessibleName('Voir les projets');
  expect(await texteAffiche(premierBouton)).toMatch(/^Voir les projets ?→$/);
});

test('sur l’accueil français, le second bouton du hero, placé après « Voir les projets », est « Contact » et mène à #contact', async ({ page }) => {
  await page.goto('/fr/');
  /* Les boutons viennent du front matter de exampleSite/content/_index.md, blocs
     [[params.hero.actions]] ; le second a url = '#contact'. L'en-tête a aussi un lien
     « Contact » : on cherche dans le contenu principal, où le hero précède le texte d'accueil,
     donc son second bouton est le deuxième lien. */
  const liens = page.getByRole('main').getByRole('link');
  await expect(liens.first()).toHaveText('Voir les projets');
  const secondBouton = liens.nth(1);
  await expect(secondBouton).toHaveText('Contact');
  await expect(secondBouton).toHaveAttribute('href', '#contact');
});

test('sur l’accueil français, le hero occupe au moins toute la hauteur de la fenêtre sous l’en-tête : il commence juste sous l’en-tête et finit au bas de la fenêtre, ou plus bas', async ({ page }) => {
  await page.goto('/fr/');
  /* Le hero est la région du contenu principal nommée par son titre principal (une section
     étiquetée par le h1) : elle regroupe le titre, l'accroche, la stack et les boutons. */
  const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
  await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(hero.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.')).toBeVisible();
  await expect(hero.getByText('Laiton · Acier · Rubis · Émail', { exact: true })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Voir les projets' })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Contact' })).toBeVisible();
  /* Référence de design : hauteur minimale « 100vh moins la hauteur de l'en-tête ». Page en
     haut de défilement : le haut du hero touche le bas de l'en-tête, son bas atteint au moins
     le bas de la fenêtre. */
  const hauteurFenetre = page.viewportSize()!.height;
  const boiteEntete = (await page.locator('header').boundingBox())!;
  const boiteHero = (await hero.boundingBox())!;
  const basEntete = boiteEntete.y + boiteEntete.height;
  expect(Math.abs(boiteHero.y - basEntete), 'le haut du hero est juste sous l’en-tête').toBeLessThanOrEqual(1);
  expect(boiteHero.y + boiteHero.height, 'le bas du hero est au bas de la fenêtre, ou plus bas')
    .toBeGreaterThanOrEqual(hauteurFenetre - 1);
});

test('servi sous /portfolio/, le premier bouton du hero de l’accueil français, « Voir les projets », mène à /portfolio/fr/projets/', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/fr/');
  /* Le hero précède le texte d'accueil : son premier bouton est le premier lien du contenu
     principal. */
  const premierBouton = page.getByRole('main').getByRole('link').first();
  await expect(premierBouton).toHaveText('Voir les projets');
  await expect(premierBouton).toHaveAttribute('href', '/portfolio/fr/projets/');
  await premierBouton.click();
  await expect(page).toHaveURL('http://localhost:1315/portfolio/fr/projets/');
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

test('sur l’accueil anglais, le hero affiche la stack anglaise, entrées séparées par « · »', async ({ page }) => {
  await page.goto('/en/');
  const principal = page.getByRole('main');
  /* La stack vient du front matter de exampleSite/content/_index.en.md, bloc [params.hero],
     clé stack (une liste de chaînes : 'Brass', 'Steel', 'Ruby', 'Enamel'). Le gabarit les
     joint en un seul élément, séparées par un point médian entouré d'espaces. */
  await expect(principal.getByText('Brass · Steel · Ruby · Enamel', { exact: true })).toBeVisible();
});

test('sur l’accueil anglais, le premier bouton du hero, « View projects », mène à la page Projets anglaise', async ({ page }) => {
  await page.goto('/en/');
  /* Le hero précède le texte d'accueil : son premier bouton est le premier lien du contenu
     principal. La page Projets anglaise a pour slug 'projects'
     (exampleSite/content/projets/_index.en.md). */
  const premierBouton = page.getByRole('main').getByRole('link').first();
  await expect(premierBouton).toHaveText('View projects');
  await expect(premierBouton).toHaveAttribute('href', '/en/projects/');
  await premierBouton.click();
  await expect(page).toHaveURL('/en/projects/');
});

test.describe('accueil sans hero', () => {
  let dossierDuSite: string;
  test.beforeAll(() => {
    dossierDuSite = construireUnSite(SITE_SANS_HERO);
  });
  test.afterAll(() => {
    supprimerUnSite(dossierDuSite);
  });

  test('un accueil dont le front matter n’a pas de bloc [params.hero] n’affiche ni titre principal, ni accroche, ni boutons d’action : seulement l’en-tête et son contenu', async ({ page, context }) => {
    await servirUnSite(context, SITE_SANS_HERO, dossierDuSite);
    await page.goto(`${SITE_SANS_HERO.origine}/fr/`);
    /* L'en-tête est affiché normalement. */
    await expect(page.locator('header').getByRole('link', { name: 'Exemple', exact: true })).toBeVisible();
    /* Le contenu de l'accueil (tests/fixtures/sans-hero/content/_index.md) est affiché… */
    const principal = page.getByRole('main');
    const texteDeLAccueil = 'Accueil fictif sans hero : seul ce texte occupe le corps de la page.';
    await expect(principal.getByText(texteDeLAccueil)).toBeVisible();
    /* …sans hero : ni titre principal (h1, pas même le nom de l'auteur), ni accroche, ni
       boutons d'action. Le contenu principal n'affiche que le texte de l'accueil. */
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
    await expect(principal.getByText('Jean Exemple')).toHaveCount(0);
    await expect(principal.getByRole('link')).toHaveCount(0);
    await expect(principal).toHaveText(texteDeLAccueil);
  });
});

test.describe('accueil d’un autre site, au hero différent', () => {
  let dossierDuSite: string;
  test.beforeAll(() => {
    dossierDuSite = construireUnSite(SITE_A_UN_AUTRE_HERO);
  });
  test.afterAll(() => {
    supprimerUnSite(dossierDuSite);
  });

  test('le titre principal affiche le nom de l’autrice de ce site, puis le titre de son hero, et non ceux du site d’exemple', async ({ page, context }) => {
    await servirUnSite(context, SITE_A_UN_AUTRE_HERO, dossierDuSite);
    await page.goto(`${SITE_A_UN_AUTRE_HERO.origine}/fr/`);
    const titrePrincipal = page.getByRole('main').getByRole('heading', { level: 1 });
    /* L'autrice vient de params.author (tests/fixtures/autre-hero/hugo.toml), le titre du
       bloc [params.hero], clé title, de tests/fixtures/autre-hero/content/_index.md.
       Texte du DOM, tel qu'écrit dans la configuration : l'affichage en majuscules relève du CSS. */
    await expect(titrePrincipal).toHaveText(/^\s*Camille Fictive\s*Relieuse d’art\s*$/);
  });

  test('le hero affiche le seul bouton déclaré par ce site, « Écrire à Camille », vers son adresse mailto:, et non les boutons du site d’exemple', async ({ page, context }) => {
    await servirUnSite(context, SITE_A_UN_AUTRE_HERO, dossierDuSite);
    await page.goto(`${SITE_A_UN_AUTRE_HERO.origine}/fr/`);
    /* Le bouton vient de tests/fixtures/autre-hero/content/_index.md, unique bloc
       [[params.hero.actions]], avec une url externe. Le texte de cet accueil n'a aucun lien :
       le seul lien du contenu principal est ce bouton (l'en-tête a ses propres liens). */
    const principal = page.getByRole('main');
    const liens = principal.getByRole('link');
    await expect(liens).toHaveCount(1);
    await expect(liens.first()).toHaveText('Écrire à Camille');
    await expect(liens.first()).toHaveAttribute('href', 'mailto:camille@example.org');
    await expect(principal.getByRole('link', { name: 'Voir les projets' })).toHaveCount(0);
    await expect(principal.getByRole('link', { name: 'Contact' })).toHaveCount(0);
  });
});
