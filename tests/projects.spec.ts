import { test, expect } from '@playwright/test';

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
