import { test, expect, type Locator, type Page } from '@playwright/test';

/* Le logo est le lien de l'en-tête nommé d'après le titre du site. */
function logoDeLEnTete(page: Page): Locator {
  return page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
}

test('le logo de l’en-tête affiche les initiales et mène à l’accueil', async ({ page }) => {
  await page.goto('/fr/');
  const logo = logoDeLEnTete(page);
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveAttribute('href', '/fr/');
});

test('la navigation de l’en-tête liste les entrées du menu principal du site', async ({ page }) => {
  await page.goto('/fr/');
  const liens = page.locator('header nav').getByRole('link');
  await expect(liens).toHaveText(['Accueil', 'Projets', 'Contact']);
  await expect(liens.nth(0)).toHaveAttribute('href', '/fr/');
  await expect(liens.nth(1)).toHaveAttribute('href', '/fr/projets/');
  await expect(liens.nth(2)).toHaveAttribute('href', '/fr/#contact');
});

test('sur la page d’accueil, seul le lien « Accueil » de la navigation est marqué comme page courante', async ({ page }) => {
  await page.goto('/fr/');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Projets', exact: true })).not.toHaveAttribute('aria-current');
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).not.toHaveAttribute('aria-current');
});

test('sur la page Projets, seul le lien « Projets » de la navigation est marqué comme page courante', async ({ page }) => {
  await page.goto('/fr/projets/');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Projets', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).not.toHaveAttribute('aria-current');
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).not.toHaveAttribute('aria-current');
});

test('le lien de la navigation marqué page courante est souligné d’un trait de couleur accent', async ({ page }) => {
  await page.goto('/fr/');
  const courant = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(courant).toHaveAttribute('aria-current', 'page');
  await expect(courant).toHaveCSS('border-bottom-style', 'solid');
  await expect(courant).toHaveCSS('border-bottom-color', 'rgb(42, 136, 141)');
  await expect(courant).not.toHaveCSS('border-bottom-width', '0px');
});

test('en anglais, la navigation de l’en-tête liste les entrées du menu principal anglais', async ({ page }) => {
  await page.goto('/en/');
  const liens = page.locator('header nav').getByRole('link');
  await expect(liens).toHaveText(['Home', 'Projects', 'Contact']);
  await expect(liens.nth(0)).toHaveAttribute('href', '/en/');
  await expect(liens.nth(1)).toHaveAttribute('href', '/en/projets/');
  await expect(liens.nth(2)).toHaveAttribute('href', '/en/#contact');
});

test('en anglais, le logo de l’en-tête mène à l’accueil anglais', async ({ page }) => {
  await page.goto('/en/');
  const logo = logoDeLEnTete(page);
  await expect(logo).toHaveAttribute('href', '/en/');
});

test('sur l’accueil français, l’en-tête propose un lien « EN » vers l’accueil anglais', async ({ page }) => {
  await page.goto('/fr/');
  const lienEN = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await expect(lienEN).toBeVisible();
  await expect(lienEN).toHaveAttribute('href', '/en/');
});

test('sur la page Projets française, le lien « EN » de l’en-tête mène à la page Projets anglaise', async ({ page }) => {
  await page.goto('/fr/projets/');
  const lienEN = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await expect(lienEN).toBeVisible();
  await expect(lienEN).toHaveAttribute('href', '/en/projets/');
});

test('sur la page Projets anglaise, le lien « FR » de l’en-tête mène à la page Projets française', async ({ page }) => {
  await page.goto('/en/projets/');
  const lienFR = page.locator('header').getByRole('link', { name: 'FR', exact: true });
  await expect(lienFR).toBeVisible();
  await expect(lienFR).toHaveAttribute('href', '/fr/projets/');
});

test('sur une page française, l’en-tête affiche la langue courante « FR » à côté du lien « EN », sans lien, marquée comme courante', async ({ page }) => {
  await page.goto('/fr/');
  const entete = page.locator('header');
  await expect(entete.getByRole('link', { name: 'EN', exact: true })).toBeVisible();
  const langueCourante = entete.getByText('FR', { exact: true });
  await expect(langueCourante).toBeVisible();
  await expect(langueCourante).toHaveAttribute('aria-current');
  await expect(entete.getByRole('link', { name: 'FR', exact: true })).toHaveCount(0);
});

test('sur ordinateur, un lien de la navigation survolé est souligné en couleur accent, le trait décalé sous le texte', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'le survol à la souris n’existe pas sur un écran tactile');
  await page.goto('/fr/');
  const lien = page.locator('header nav').getByRole('link', { name: 'Projets', exact: true });
  await expect(lien).not.toHaveAttribute('aria-current');
  await lien.hover();
  await expect(lien).toHaveCSS('text-decoration-line', 'underline');
  await expect(lien).toHaveCSS('text-decoration-color', 'rgb(42, 136, 141)');
  await expect(lien).toHaveCSS('text-underline-offset', '5px');
});

test('sur ordinateur, le lien de la page courante survolé garde un seul trait couleur accent (pas de soulignement en plus de sa bordure)', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'le survol à la souris n’existe pas sur un écran tactile');
  await page.goto('/fr/');
  const courant = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(courant).toHaveAttribute('aria-current', 'page');
  await courant.hover();
  await expect(courant).toHaveCSS('border-bottom-style', 'solid');
  await expect(courant).toHaveCSS('border-bottom-color', 'rgb(42, 136, 141)');
  await expect(courant).toHaveCSS('border-bottom-width', '2px');
  await expect(courant).toHaveCSS('text-decoration-line', 'none');
});

test('après défilement d’une page longue, l’en-tête reste collé en haut de la fenêtre et visible', async ({ page }) => {
  await page.goto('/fr/page-longue/');
  const fenetre = page.viewportSize()!;
  const hauteurPage = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(hauteurPage).toBeGreaterThan(fenetre.height * 2);

  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const entete = page.locator('header');
  await expect(entete).toBeInViewport();
  const boite = await entete.boundingBox();
  expect(boite?.y).toBeCloseTo(0, 0);
});

test('l’en-tête collant reste au-dessus d’un contenu positionné qui défile sous lui : logo et liens restent cliquables', async ({ page }) => {
  await page.goto('/fr/page-longue/');
  const encart = page.getByText('Encart positionné', { exact: false });
  await expect(encart).toHaveCount(1);

  /* Fait défiler la page jusqu'à placer le haut de l'encart en haut de la fenêtre, sous l'en-tête. */
  await encart.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const liens = page.locator('header').getByRole('link');
  await expect(liens).toHaveCount(5);
  for (const lien of await liens.all()) {
    const boite = (await lien.boundingBox())!;
    const encartSousLeLien = await encart.evaluate(
      (el, { x, y }) => { const r = el.getBoundingClientRect(); return r.top <= y && y <= r.bottom && r.left <= x && x <= r.right; },
      { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 },
    );
    expect(encartSousLeLien).toBe(true);
    const atteintLeLien = await lien.evaluate(
      (el, { x, y }) => { const touche = document.elementFromPoint(x, y); return touche !== null && el.contains(touche); },
      { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 },
    );
    expect(atteintLeLien).toBe(true);
  }
});

test('à l’arrivée sur une ancre d’une page longue, l’élément ciblé n’est pas masqué par l’en-tête collant', async ({ page }) => {
  await page.goto('/fr/page-longue/#quatrième-chapitre');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const cible = page.getByRole('heading', { name: 'Quatrième chapitre', level: 2 });
  await expect(cible).toHaveAttribute('id', 'quatrième-chapitre');
  await expect(cible).toBeInViewport();

  const boiteEntete = (await page.locator('header').boundingBox())!;
  const boiteCible = (await cible.boundingBox())!;
  expect(boiteCible.y).toBeGreaterThanOrEqual(boiteEntete.y + boiteEntete.height);
});

test('sur téléphone, l’en-tête tient dans la largeur de l’écran : pas de défilement horizontal, logo et liens entièrement visibles', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'comportement propre au téléphone');
  await page.goto('/fr/');
  const largeur = page.viewportSize()!.width;

  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeurPage).toBeLessThanOrEqual(largeur);

  const liens = page.locator('header').getByRole('link');
  await expect(liens).toHaveCount(5);
  for (const lien of await liens.all()) {
    await expect(lien).toBeVisible();
    const boite = (await lien.boundingBox())!;
    expect(boite.x).toBeGreaterThanOrEqual(0);
    expect(boite.x + boite.width).toBeLessThanOrEqual(largeur);
  }
});

test('le logo de l’en-tête est à 16 px du bord gauche de la fenêtre sur téléphone, à 48 px sur ordinateur', async ({ page, isMobile }) => {
  await page.goto('/fr/');
  const logo = logoDeLEnTete(page);
  const boite = (await logo.boundingBox())!;
  expect(boite.x).toBeCloseTo(isMobile ? 16 : 48, 0);
});

test('les liens de l’en-tête sont de couleur papier et ne sont pas soulignés', async ({ page }) => {
  await page.goto('/fr/');
  /* Le logo et les liens de la navigation, sans le lien de changement de langue. */
  const liens = logoDeLEnTete(page).or(page.locator('header nav').getByRole('link'));
  await expect(liens).toHaveCount(4);
  for (const lien of await liens.all()) {
    await expect(lien).toHaveCSS('color', 'rgb(227, 223, 204)');
    await expect(lien).toHaveCSS('text-decoration-line', 'none');
  }
});
