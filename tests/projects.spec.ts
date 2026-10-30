import { test, expect } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_OTHER_PROJECTS,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';

/* The titles of the projects the example site's French home page features, in the order its
   front matter lists them (params.projects, page references to content/projets/<slug>). The order
   is neither alphabetical nor reverse alphabetical, so that a sorted listing cannot pass for it. */
const FEATURED_PROJECTS = [
  'Restauration d’une pendule de cheminée',
  'Montre de poche à grande complication',
  'Horloge astronomique de l’atelier',
  'Régulateur de parquet en noyer',
];

test('on the French home page, the section "Projets sélectionnés" shows one card per featured project, in the order the home page lists them, each headed by the project’s title', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  await expect(section.getByRole('heading', { level: 2, name: 'Projets sélectionnés' })).toBeVisible();
  /* An array makes the match exact: a missing, extra, repeated or misplaced project fails it. */
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(FEATURED_PROJECTS);
});

test.describe('home page of another site, featuring other projects', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_OTHER_PROJECTS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" shows one card per project this site features, in its order, and none of the example site’s', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    /* Featured in tests/fixtures/other-projects/content/_index.md, in an order that is neither
       alphabetical nor reverse alphabetical. An array makes the match exact. */
    await expect(section.getByRole('heading', { level: 3 })).toHaveText([
      'Coucou de la Forêt-Noire',
      'Baromètre à mercure',
      'Chronomètre de marine',
    ]);
  });
});

test.describe('home page of another site, featuring no projects', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITHOUT_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a home page whose front matter features no projects shows no section "Projets sélectionnés": no such heading, no empty region, no project card', async ({ page, context }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    await page.goto(`${SITE_WITHOUT_HERO.origin}/fr/`);
    /* tests/fixtures/without-hero/content/_index.md declares no params.projects, while the example
       site's project pages are still built: its text is displayed… */
    const main = page.getByRole('main');
    const homePageText = 'Accueil fictif sans hero : seul ce texte occupe le corps de la page.';
    await expect(main.getByText(homePageText)).toBeVisible();
    /* …with no projects section, named or not, even empty, and none of the example site's projects. */
    await expect(page.getByRole('region', { name: 'Projets sélectionnés' })).toHaveCount(0);
    await expect(page.getByText('Projets sélectionnés')).toHaveCount(0);
    await expect(main.getByRole('region')).toHaveCount(0);
    await expect(main.getByRole('heading')).toHaveCount(0);
    for (const project of FEATURED_PROJECTS) {
      await expect(page.getByText(project)).toHaveCount(0);
    }
  });
});
