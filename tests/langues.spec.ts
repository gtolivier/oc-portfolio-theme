import { test, expect, type Page } from '@playwright/test';
import {
  ORIGINE_SITE_AVEC_ALIAS,
  construireLeSiteAvecAlias,
  servirLeSiteAvecAlias,
  supprimerLeSiteAvecAlias,
} from './helpers/site-avec-alias';

/* L'option locale de Playwright ne fixe qu'une langue : la liste complète
   des langues préférées est définie avant que les scripts de la page ne s'exécutent. */
async function definirLesLanguesPreferees(page: Page, langues: string[]): Promise<void> {
  await page.addInitScript((languages) => {
    Object.defineProperty(Navigator.prototype, 'languages', { get: () => languages, configurable: true });
    Object.defineProperty(Navigator.prototype, 'language', { get: () => languages[0], configurable: true });
  }, langues);
}

test('les pages françaises sont servies sous /fr/ : /fr/ est l’accueil français', async ({ page, baseURL }) => {
  const response = await page.goto('/fr/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toContainText('Bienvenue sur ce site de démonstration');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* Vérifié une fois l'accueil affiché : le visiteur y est resté sur /fr/, sans redirection. */
  await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
});

test('la page de redirection servie pour / demande aux moteurs de recherche de ne pas l’indexer (meta robots noindex)', async ({ page, request }) => {
  /* / redirige aussitôt : c'est le HTML servi pour / qui est examiné, analysé sans être exécuté. */
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  const robots = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'text/html');
    return Array.from(document.querySelectorAll('head meta[name="robots" i]'), (meta) => meta.getAttribute('content') ?? '');
  }, html);
  expect(robots.some((content) => content.split(',').map((directive) => directive.trim().toLowerCase()).includes('noindex'))).toBe(true);
});

test.describe('navigateur sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('sans JavaScript, un navigateur qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('navigateur en anglais', () => {
  test.use({ locale: 'en-US' });

  test('un navigateur en anglais (en-US) qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('un navigateur en anglais qui ouvre /#contact arrive sur /en/#contact', async ({ page, baseURL }) => {
    await page.goto('/#contact');
    await expect(page).toHaveURL(new URL('/en/#contact', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('un navigateur en anglais qui ouvre /?source=test arrive sur /en/?source=test', async ({ page, baseURL }) => {
    await page.goto('/?source=test');
    await expect(page).toHaveURL(new URL('/en/?source=test', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });

  test('avec un choix enregistré qui ne correspond à aucune langue du site (« de »), un navigateur en anglais qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    /* Aucun lien du site n'enregistre « de » : le choix est déposé directement,
       sous la clé où le sélecteur de langue enregistre le sien. */
    await page.addInitScript(() => {
      localStorage.setItem('oc-lang', 'de');
    });
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en anglais, site servi sous un sous-chemin', () => {
  test.use({ locale: 'en-US' });

  test('servi sous /portfolio/, un navigateur en anglais qui ouvre /portfolio/ arrive sur /portfolio/en/', async ({ page }) => {
    await page.goto('http://localhost:1315/portfolio/');
    await expect(page).toHaveURL('http://localhost:1315/portfolio/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en anglais britannique', () => {
  test.use({ locale: 'en-GB' });

  test('un navigateur en anglais britannique (en-GB) qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en français', () => {
  test.use({ locale: 'fr-FR' });

  test('un navigateur en français (fr-FR) qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('navigateur en français, ancienne adresse d’une page anglaise', () => {
  test.use({ locale: 'fr-FR' });

  let dossierDuSite: string;
  test.beforeAll(() => {
    dossierDuSite = construireLeSiteAvecAlias();
  });
  test.afterAll(() => {
    supprimerLeSiteAvecAlias(dossierDuSite);
  });

  test('un navigateur en français qui ouvre l’ancienne adresse (alias) d’une page anglaise arrive sur cette page anglaise, pas sur sa traduction française', async ({ page, context }) => {
    await servirLeSiteAvecAlias(context, dossierDuSite);
    await page.goto(`${ORIGINE_SITE_AVEC_ALIAS}/en/old-english-page/`);
    await expect(page).toHaveURL(`${ORIGINE_SITE_AVEC_ALIAS}/en/page-avec-alias/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(page.getByRole('main')).toContainText('Fictional English page, reachable from its old address.');
  });
});

test.describe('navigateur en français, après un choix explicite de l’anglais', () => {
  test.use({ locale: 'fr-FR' });

  test('après un clic sur « EN » depuis une page française, un navigateur en français qui rouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await page.goto('/fr/');
    await page.locator('header').getByRole('group', { name: 'Langue', exact: true }).getByRole('link', { name: 'EN', exact: true }).click();
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en anglais, après un choix explicite du français', () => {
  test.use({ locale: 'en-US' });

  test('après un clic sur « FR » depuis une page anglaise, un navigateur anglais qui rouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/en/');
    await page.locator('header').getByRole('group', { name: 'Language', exact: true }).getByRole('link', { name: 'FR', exact: true }).click();
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('navigateur dans une autre langue', () => {
  test.use({ locale: 'de-DE' });

  test('un navigateur dans une autre langue (de-DE) qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('navigateur en allemand, puis en anglais', () => {
  test.use({ locale: 'de-DE' });

  test('un navigateur dont les langues préférées sont [de-DE, en] qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await definirLesLanguesPreferees(page, ['de-DE', 'en']);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});

test.describe('navigateur en français, puis en anglais', () => {
  test.use({ locale: 'fr-FR' });

  test('un navigateur dont les langues préférées sont [fr-FR, en] qui ouvre / arrive sur /fr/', async ({ page, baseURL }) => {
    await definirLesLanguesPreferees(page, ['fr-FR', 'en']);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/fr/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  });
});

test.describe('navigateur en frison septentrional, puis en anglais', () => {
  test('un navigateur dont les langues préférées sont [frr, en] (frison septentrional, puis anglais) qui ouvre / arrive sur /en/', async ({ page, baseURL }) => {
    await definirLesLanguesPreferees(page, ['frr', 'en']);
    await page.goto('/');
    await expect(page).toHaveURL(new URL('/en/', baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  });
});
