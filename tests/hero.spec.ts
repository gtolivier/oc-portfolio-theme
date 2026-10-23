import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  SITE_A_UN_AUTRE_HERO,
  SITE_A_UN_BOUTON_SANS_DESTINATION,
  SITE_A_UN_BOUTON_SANS_LIBELLE,
  SITE_A_UN_PAGE_REF_INTROUVABLE,
  SITE_SANS_HERO,
  SITE_SOUS_PORTFOLIO_A_UNE_URL_DEPUIS_LA_RACINE,
  construireUnSite,
  servirUnSite,
  supprimerUnSite,
  tenterDeConstruireUnSite,
} from './helpers/site-construit';
import { tabulerJusqua } from './helpers/clavier';

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

/* Composantes d'une couleur calculée, quelle que soit la façon dont le navigateur la
   sérialise (`rgb(…)`, `rgba(…)` ou `color(srgb …)`) : rouge, vert et bleu de 0 à 255
   arrondis à l'unité, opacité de 0 à 1 arrondie au centième. */
function composantesDeCouleur(couleur: string) {
  const nombre = '([\\d.]+%?)';
  const versUnite = (valeur: string) => (valeur.endsWith('%') ? parseFloat(valeur) / 100 : parseFloat(valeur));
  const rgb = couleur.match(new RegExp(`^rgba?\\(\\s*${nombre}[\\s,]+${nombre}[\\s,]+${nombre}(?:\\s*[,/]\\s*${nombre})?\\s*\\)$`));
  const srgb = couleur.match(new RegExp(`^color\\(srgb\\s+${nombre}\\s+${nombre}\\s+${nombre}(?:\\s*/\\s*${nombre})?\\s*\\)$`));
  const correspondance = rgb ?? srgb;
  if (!correspondance) throw new Error(`couleur non reconnue : ${couleur}`);
  const echelle = rgb ? 1 : 255;
  const [rouge, vert, bleu] = correspondance.slice(1, 4).map((valeur) =>
    Math.round(valeur.endsWith('%') ? versUnite(valeur) * 255 : parseFloat(valeur) * echelle));
  const opacite = correspondance[4] === undefined ? 1 : Math.round(versUnite(correspondance[4]) * 100) / 100;
  return { rouge, vert, bleu, opacite };
}

/* Styles calculés qui décident de l'allure d'un bouton : couleur du texte, fond,
   soulignement, et bordure de chaque côté. Couleurs en composantes. */
async function styleDuBouton(bouton: Locator) {
  const { couleur, fond, soulignement, bordures } = await bouton.evaluate((lien) => {
    const style = getComputedStyle(lien);
    const cotes = ['top', 'right', 'bottom', 'left'] as const;
    return {
      couleur: style.color,
      fond: style.backgroundColor,
      soulignement: style.textDecorationLine,
      bordures: cotes.map((cote) => ({
        cote,
        epaisseur: style.getPropertyValue(`border-${cote}-width`),
        trait: style.getPropertyValue(`border-${cote}-style`),
        couleur: style.getPropertyValue(`border-${cote}-color`),
      })),
    };
  });
  return {
    couleur: composantesDeCouleur(couleur),
    fond: composantesDeCouleur(fond),
    soulignement,
    bordures: bordures.map((bordure) => ({ ...bordure, couleur: composantesDeCouleur(bordure.couleur) })),
  };
}

/* Le hero précède le texte d'accueil : ses boutons d'action sont, dans l'ordre, les premiers
   liens du contenu principal. On les cherche là, et non dans toute la page, parce que l'en-tête
   a ses propres liens, dont un « Contact ». */
function premierBoutonDuHero(page: Page): Locator {
  return page.getByRole('main').getByRole('link').first();
}

function secondBoutonDuHero(page: Page): Locator {
  return page.getByRole('main').getByRole('link').nth(1);
}

function titrePrincipalDuContenu(page: Page): Locator {
  return page.getByRole('main').getByRole('heading', { level: 1 });
}

test('sur l’accueil français, le titre principal commence par le nom de l’auteur du site', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = titrePrincipalDuContenu(page);
  /* Le texte du DOM, tel qu'écrit dans params.author : l'affichage en majuscules relève du CSS. */
  await expect(titrePrincipal).toHaveText(/^\s*Jean Exemple/);
});

test('sur l’accueil français, le titre principal affiche, à la ligne sous le nom de l’auteur, son titre professionnel', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = titrePrincipalDuContenu(page);
  /* Le titre vient du front matter de exampleSite/content/_index.md, bloc [params.hero], clé title.
     Texte du DOM, tel qu'écrit dans le front matter : l'affichage en majuscules relève du CSS. */
  await expect(titrePrincipal).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);
  /* À la ligne : le titre professionnel commence au moins une demi-ligne plus bas que le nom. */
  const titreProfessionnel = titrePrincipal.getByText('Horloger indépendant', { exact: true });
  await expect(titreProfessionnel).toBeVisible();
  const boiteTitrePrincipal = await titrePrincipal.boundingBox();
  const boiteTitreProfessionnel = await titreProfessionnel.boundingBox();
  expect(boiteTitreProfessionnel!.y - boiteTitrePrincipal!.y).toBeGreaterThanOrEqual(boiteTitreProfessionnel!.height / 2);
});

test('sur l’accueil français, le nom de l’auteur s’affiche en majuscules, en IBM Plex Mono grasse (700), couleur papier, plus grand que le titre professionnel qui le suit', async ({ page }) => {
  await page.goto('/fr/');
  const titrePrincipal = titrePrincipalDuContenu(page);
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
  const titrePrincipal = titrePrincipalDuContenu(page);
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
     clé stack (une liste de chaînes : 'Laiton', 'Acier', 'Rubis', 'Émail'). Elles s'affichent
     d'un seul tenant, séparées par un point médian entouré d'espaces. */
  await expect(principal.getByText('Laiton · Acier · Rubis · Émail', { exact: true })).toBeVisible();
});

test('sur l’accueil français, l’accroche du hero s’affiche en IBM Plex Sans, couleur papier à 88 % d’opacité, et la stack en IBM Plex Mono, couleur accent', async ({ page }) => {
  await page.goto('/fr/');
  const principal = page.getByRole('main');
  /* Référence de design : papier #E3DFCC à 88 % d'opacité pour l'accroche, accent #2A888D
     pour la stack. */
  const lignes = [
    'Montres mécaniques sur mesure — 20 ans d’atelier.',
    'Conception, réparation et entretien',
    'de pendules et de montres anciennes.',
  ];
  for (const ligne of lignes) {
    const element = principal.getByText(ligne);
    await expect(element).toBeVisible();
    const { famille, couleur } = await styleDuTexte(element);
    expect({ famille, couleur: composantesDeCouleur(couleur) }, `style de « ${ligne} »`).toEqual({
      famille: 'IBM Plex Sans',
      couleur: { rouge: 227, vert: 223, bleu: 204, opacite: 0.88 },
    });
  }
  const stack = principal.getByText('Laiton · Acier · Rubis · Émail', { exact: true });
  await expect(stack).toBeVisible();
  const { famille, couleur } = await styleDuTexte(stack);
  expect({ famille, couleur: composantesDeCouleur(couleur) }, 'style de la stack').toEqual({
    famille: 'IBM Plex Mono',
    couleur: { rouge: 42, vert: 136, bleu: 141, opacite: 1 },
  });
});

test('sur l’accueil français, le premier bouton du hero, « Voir les projets », mène à la page Projets française', async ({ page }) => {
  await page.goto('/fr/');
  /* Les boutons viennent du front matter de exampleSite/content/_index.md, blocs
     [[params.hero.actions]] ; le premier a pageRef = '/projets'. */
  const premierBouton = premierBoutonDuHero(page);
  await expect(premierBouton).toHaveText('Voir les projets');
  await expect(premierBouton).toHaveAttribute('href', '/fr/projets/');
  await premierBouton.click();
  await expect(page).toHaveURL('/fr/projets/');
});

test('sur l’accueil français, le premier bouton du hero affiche une flèche « → » après « Voir les projets », que les lecteurs d’écran ne lisent pas', async ({ page }) => {
  await page.goto('/fr/');
  /* À l'écran, la flèche suit le libellé ; le nom accessible du lien reste le seul libellé. */
  const premierBouton = premierBoutonDuHero(page);
  await expect(premierBouton).toHaveAccessibleName('Voir les projets');
  expect(await texteAffiche(premierBouton)).toMatch(/^Voir les projets ?→$/);
});

test('sur l’accueil français, le premier bouton du hero, « Voir les projets », est plein : texte encre sur fond papier, en IBM Plex Mono demi-grasse (600), non souligné', async ({ page }) => {
  await page.goto('/fr/');
  /* Référence de design : encre #013549, papier #E3DFCC. */
  const premierBouton = premierBoutonDuHero(page);
  await expect(premierBouton).toHaveText(/^\s*Voir les projets/);
  const { famille, graisse } = await styleDuTexte(premierBouton);
  const { couleur, fond, soulignement } = await styleDuBouton(premierBouton);
  expect({ famille, graisse, couleur, fond, soulignement }, 'style du premier bouton').toEqual({
    famille: 'IBM Plex Mono',
    graisse: '600',
    couleur: { rouge: 1, vert: 53, bleu: 73, opacite: 1 },
    fond: { rouge: 227, vert: 223, bleu: 204, opacite: 1 },
    soulignement: 'none',
  });
});

test('sur l’accueil français, le second bouton du hero, placé après « Voir les projets », est « Contact » et mène à #contact', async ({ page }) => {
  await page.goto('/fr/');
  /* Les boutons viennent du front matter de exampleSite/content/_index.md, blocs
     [[params.hero.actions]] ; le second a url = '#contact'. */
  await expect(premierBoutonDuHero(page)).toHaveText('Voir les projets');
  const secondBouton = secondBoutonDuHero(page);
  await expect(secondBouton).toHaveText('Contact');
  await expect(secondBouton).toHaveAttribute('href', '#contact');
});

test('sur l’accueil français, le second bouton du hero, « Contact », est en contour : texte papier, bordure pleine de 1 px papier à 50 % d’opacité sur les quatre côtés, fond transparent, non souligné', async ({ page }) => {
  await page.goto('/fr/');
  /* Référence de design : papier #E3DFCC, bordure 1px solid à 50 % d'opacité. */
  await expect(premierBoutonDuHero(page)).toHaveText(/^\s*Voir les projets/);
  const secondBouton = secondBoutonDuHero(page);
  await expect(secondBouton).toHaveText('Contact');
  const { couleur, fond, soulignement, bordures } = await styleDuBouton(secondBouton);
  expect({ couleur, opaciteDuFond: fond.opacite, soulignement, bordures }, 'style du second bouton').toEqual({
    couleur: { rouge: 227, vert: 223, bleu: 204, opacite: 1 },
    opaciteDuFond: 0,
    soulignement: 'none',
    bordures: (['top', 'right', 'bottom', 'left'] as const).map((cote) => ({
      cote,
      epaisseur: '1px',
      trait: 'solid',
      couleur: { rouge: 227, vert: 223, bleu: 204, opacite: 0.5 },
    })),
  });
});

test('sur ordinateur, le second bouton du hero, « Contact », survolé passe en couleur accent : texte et bordure sur les quatre côtés', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'le survol à la souris n’existe pas sur un écran tactile');
  await page.goto('/fr/');
  /* Référence de design : au survol, texte et bordure en accent #2A888D, opaques. On attend
     que les couleurs se stabilisent, au cas où une transition accompagne le survol. */
  await expect(premierBoutonDuHero(page)).toHaveText(/^\s*Voir les projets/);
  const secondBouton = secondBoutonDuHero(page);
  await expect(secondBouton).toHaveText('Contact');
  await secondBouton.hover();
  const accent = { rouge: 42, vert: 136, bleu: 141, opacite: 1 };
  await expect.poll(async () => {
    const { couleur, bordures } = await styleDuBouton(secondBouton);
    return {
      couleur,
      bordures: bordures.map(({ cote, couleur: couleurDuCote }) => ({ cote, couleur: couleurDuCote })),
    };
  }, { message: 'style du second bouton survolé' }).toEqual({
    couleur: accent,
    bordures: (['top', 'right', 'bottom', 'left'] as const).map((cote) => ({ cote, couleur: accent })),
  });
});

test('sur téléphone comme sur ordinateur, le second bouton du hero, « Contact », atteint au clavier passe en couleur accent : texte et bordure sur les quatre côtés', async ({ page, browserName }) => {
  await page.goto('/fr/');
  /* Référence de design : au focus clavier, comme au survol, texte et bordure en accent
     #2A888D, opaques. Le focus vient de la touche Tab, comme pour un visiteur au clavier. On
     attend que les couleurs se stabilisent, au cas où une transition accompagne le focus. */
  await expect(premierBoutonDuHero(page)).toHaveText(/^\s*Voir les projets/);
  const secondBouton = secondBoutonDuHero(page);
  await expect(secondBouton).toHaveText('Contact');
  await tabulerJusqua(secondBouton, browserName);
  await expect(secondBouton).toBeFocused();
  const accent = { rouge: 42, vert: 136, bleu: 141, opacite: 1 };
  await expect.poll(async () => {
    const { couleur, bordures } = await styleDuBouton(secondBouton);
    return {
      couleur,
      bordures: bordures.map(({ cote, couleur: couleurDuCote }) => ({ cote, couleur: couleurDuCote })),
    };
  }, { message: 'style du second bouton atteint au clavier' }).toEqual({
    couleur: accent,
    bordures: (['top', 'right', 'bottom', 'left'] as const).map((cote) => ({ cote, couleur: accent })),
  });
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

test('le contenu du hero est aligné sur le logo de l’en-tête : à 16 px du bord gauche sur téléphone, à 48 px sur ordinateur', async ({ page, isMobile }) => {
  await page.goto('/fr/');
  /* Référence de design : 16 px de marge latérale sur téléphone, 48 px sur ordinateur, comme
     l'en-tête. Le logo est le lien de l'en-tête nommé d'après le titre du site. */
  const logo = page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toBeVisible();
  const bordGaucheAttendu = isMobile ? 16 : 48;
  expect((await logo.boundingBox())!.x, 'bord gauche du logo').toBeCloseTo(bordGaucheAttendu, 0);
  /* Les éléments du hero : nom et titre professionnel dans le h1, accroche, stack et premier
     bouton. */
  const principal = page.getByRole('main');
  const titrePrincipal = principal.getByRole('heading', { level: 1 });
  const elements = {
    'nom de l’auteur (h1)': titrePrincipal,
    'titre professionnel': titrePrincipal.getByText('Horloger indépendant', { exact: true }),
    'accroche': principal.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    'stack': principal.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    'premier bouton': premierBoutonDuHero(page),
  };
  await expect(elements['premier bouton']).toHaveText(/^\s*Voir les projets/);
  for (const [nom, element] of Object.entries(elements)) {
    await expect(element, nom).toBeVisible();
    const boite = (await element.boundingBox())!;
    expect.soft(boite.x, `bord gauche : ${nom}`).toBeCloseTo(bordGaucheAttendu, 0);
  }
});

test('sur téléphone, le hero tient dans la largeur de l’écran : pas de défilement horizontal, nom, titre, accroche, stack et boutons entièrement visibles', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'comportement propre au téléphone');
  await page.goto('/fr/');
  const largeur = page.viewportSize()!.width;

  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeurPage, 'pas de défilement horizontal').toBeLessThanOrEqual(largeur);

  /* Les éléments du hero : nom et titre professionnel dans le h1, les trois lignes de
     l'accroche, la stack et les deux boutons. */
  const principal = page.getByRole('main');
  const titrePrincipal = principal.getByRole('heading', { level: 1 });
  const elements = {
    'nom de l’auteur (h1)': titrePrincipal,
    'titre professionnel': titrePrincipal.getByText('Horloger indépendant', { exact: true }),
    'accroche, ligne 1': principal.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    'accroche, ligne 2': principal.getByText('Conception, réparation et entretien'),
    'accroche, ligne 3': principal.getByText('de pendules et de montres anciennes.'),
    'stack': principal.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    'premier bouton': premierBoutonDuHero(page),
    'second bouton': secondBoutonDuHero(page),
  };
  await expect(elements['premier bouton']).toHaveText(/^\s*Voir les projets/);
  await expect(elements['second bouton']).toHaveText('Contact');
  for (const [nom, element] of Object.entries(elements)) {
    await expect(element, nom).toBeVisible();
    /* Étendue affichée : la boîte de l'élément et celle de son contenu (un texte trop long
       peut déborder de sa boîte sans l'élargir). */
    const { gauche, droite } = await element.evaluate((el) => {
      const plage = document.createRange();
      plage.selectNodeContents(el);
      const boites = [el.getBoundingClientRect(), plage.getBoundingClientRect()];
      return { gauche: Math.min(...boites.map((b) => b.left)), droite: Math.max(...boites.map((b) => b.right)) };
    });
    expect.soft(gauche, `bord gauche dans la fenêtre : ${nom}`).toBeGreaterThanOrEqual(0);
    expect.soft(droite, `bord droit dans la fenêtre : ${nom}`).toBeLessThanOrEqual(largeur);
  }
});

test('sur téléphone comme sur ordinateur, chaque bouton du hero offre une cible d’au moins 24 × 24 px (WCAG 2.5.8)', async ({ page }) => {
  await page.goto('/fr/');
  const boutons = {
    'premier bouton, « Voir les projets »': premierBoutonDuHero(page),
    'second bouton, « Contact »': secondBoutonDuHero(page),
  };
  await expect(boutons['premier bouton, « Voir les projets »']).toHaveText(/^\s*Voir les projets/);
  await expect(boutons['second bouton, « Contact »']).toHaveText('Contact');
  for (const [nom, bouton] of Object.entries(boutons)) {
    await expect(bouton, nom).toBeVisible();
    const boite = (await bouton.boundingBox())!;
    expect.soft(boite.width, `largeur de la cible : ${nom}`).toBeGreaterThanOrEqual(24);
    expect.soft(boite.height, `hauteur de la cible : ${nom}`).toBeGreaterThanOrEqual(24);
  }
});

test('servi sous /portfolio/, le premier bouton du hero de l’accueil français, « Voir les projets », mène à /portfolio/fr/projets/', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/fr/');
  const premierBouton = premierBoutonDuHero(page);
  await expect(premierBouton).toHaveText('Voir les projets');
  await expect(premierBouton).toHaveAttribute('href', '/portfolio/fr/projets/');
  await premierBouton.click();
  await expect(page).toHaveURL('http://localhost:1315/portfolio/fr/projets/');
});

test('servi sous /portfolio/, le second bouton du hero de l’accueil français, déclaré par l’ancre « #contact », mène toujours à « #contact », sans préfixe', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/fr/');
  /* Le second bouton de exampleSite/content/_index.md déclare url = '#contact' : une ancre de
     la page courante, que le chemin de publication du site ne doit pas préfixer. */
  await expect(premierBoutonDuHero(page)).toHaveText('Voir les projets');
  const secondBouton = secondBoutonDuHero(page);
  await expect(secondBouton).toHaveText('Contact');
  await expect(secondBouton).toHaveAttribute('href', '#contact');
});

test('sur l’accueil anglais, le titre sous le nom de l’auteur est le titre professionnel anglais', async ({ page }) => {
  await page.goto('/en/');
  const titrePrincipal = titrePrincipalDuContenu(page);
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
     clé stack (une liste de chaînes : 'Brass', 'Steel', 'Ruby', 'Enamel'). Elles s'affichent
     d'un seul tenant, séparées par un point médian entouré d'espaces. */
  await expect(principal.getByText('Brass · Steel · Ruby · Enamel', { exact: true })).toBeVisible();
});

test('sur l’accueil anglais, le premier bouton du hero, « View projects », mène à la page Projets anglaise', async ({ page }) => {
  await page.goto('/en/');
  /* La page Projets anglaise a pour slug 'projects' (exampleSite/content/projets/_index.en.md). */
  const premierBouton = premierBoutonDuHero(page);
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
    const titrePrincipal = titrePrincipalDuContenu(page);
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

test.describe('accueil d’un site servi sous /portfolio/, au bouton déclaré par une url depuis la racine du site', () => {
  let dossierDuSite: string;
  test.beforeAll(() => {
    dossierDuSite = construireUnSite(SITE_SOUS_PORTFOLIO_A_UNE_URL_DEPUIS_LA_RACINE);
  });
  test.afterAll(() => {
    supprimerUnSite(dossierDuSite);
  });

  test('servi sous /portfolio/, un bouton du hero déclaré par url = « /fr/page-longue/ », relative à la racine du site, mène à /portfolio/fr/page-longue/', async ({ page, context }) => {
    const site = SITE_SOUS_PORTFOLIO_A_UNE_URL_DEPUIS_LA_RACINE;
    await servirUnSite(context, site, dossierDuSite);
    await page.goto(`${site.origine}/portfolio/fr/`);
    /* L'unique bouton de tests/fixtures/url-depuis-la-racine/content/_index.md déclare
       url = '/fr/page-longue/' : la page exampleSite/content/page-longue.md, depuis la racine
       du site. Servi sous /portfolio/, ce site la publie à /portfolio/fr/page-longue/. */
    const bouton = premierBoutonDuHero(page);
    await expect(bouton).toHaveText('Lire la page longue');
    await expect(bouton).toHaveAttribute('href', '/portfolio/fr/page-longue/');
    await bouton.click();
    await expect(page).toHaveURL(`${site.origine}/portfolio/fr/page-longue/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page longue');
  });
});

/* Ces tests ne lancent que hugo build, sans navigateur : les lancer dans chaque projet
   Playwright referait la même construction cinq fois. */
const PROJET_DES_TESTS_DE_CONSTRUCTION = 'chromium';

test.describe('erreurs de contenu du hero : échec de la construction', () => {
  test.skip(
    () => test.info().project.name !== PROJET_DES_TESTS_DE_CONSTRUCTION,
    `construction sans navigateur, identique dans chaque projet : lancée dans ${PROJET_DES_TESTS_DE_CONSTRUCTION} seulement`,
  );

  test('un accueil dont un bouton du hero déclare un pageRef vers une page qui n’existe pas fait échouer la construction du site, avec un message d’erreur qui cite ce pageRef', () => {
    /* Le premier bouton de tests/fixtures/page-ref-introuvable/content/_index.md déclare
       pageRef = '/page-fictive-introuvable', que le site ne contient pas. Plutôt qu'un bouton
       sans destination, la personne qui construit le site doit obtenir un échec qui nomme ce
       pageRef. */
    const construction = tenterDeConstruireUnSite(SITE_A_UN_PAGE_REF_INTROUVABLE);
    expect(construction.reussie, 'la construction du site devrait échouer').toBe(false);
    expect(construction.erreurs).toContain('/page-fictive-introuvable');
  });

  test('un accueil dont un bouton du hero n’a pas de label fait échouer la construction du site, avec un message d’erreur qui cite le champ label manquant', () => {
    /* Le second bouton de tests/fixtures/bouton-sans-libelle/content/_index.md a une
       url = '#contact' valide mais pas de label. Plutôt qu'un lien vide, la personne qui
       construit le site doit obtenir un échec dont le message nomme le champ label du front
       matter, quelle que soit la phrase choisie. */
    const construction = tenterDeConstruireUnSite(SITE_A_UN_BOUTON_SANS_LIBELLE);
    expect(construction.reussie, 'la construction du site devrait échouer').toBe(false);
    expect(construction.erreurs).toMatch(/\blabel\b/);
  });

  test('un accueil dont un bouton du hero n’a ni url ni pageRef fait échouer la construction du site, avec un message d’erreur qui cite ces deux champs', () => {
    /* Le second bouton de tests/fixtures/bouton-sans-destination/content/_index.md a un label
       mais ni url ni pageRef. Plutôt qu'un lien qui ne mène nulle part, la personne qui
       construit le site doit obtenir un échec dont le message nomme les champs url et pageRef
       du front matter, quelle que soit la phrase choisie. */
    const construction = tenterDeConstruireUnSite(SITE_A_UN_BOUTON_SANS_DESTINATION);
    expect(construction.reussie, 'la construction du site devrait échouer').toBe(false);
    expect(construction.erreurs).toMatch(/\burl\b/);
    expect(construction.erreurs).toMatch(/\bpageRef\b/);
  });
});
