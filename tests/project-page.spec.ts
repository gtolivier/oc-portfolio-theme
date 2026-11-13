import { test, expect } from '@playwright/test';

/* Two projects of the example site (content/projects/<slug>.md and its .en.md translation): the
   slug is the page's file name, and each title differs from the other project's and from its
   translation's, so that a page showing another project's or another language's title fails. */
const PROJECTS = [
  {
    slug: 'horloge-astronomique',
    frenchTitle: 'Horloge astronomique de l’atelier',
    englishTitle: 'The workshop’s astronomical clock',
  },
  {
    slug: 'regulateur-noyer',
    frenchTitle: 'Régulateur de parquet en noyer',
    englishTitle: 'Walnut floor regulator',
  },
];

test('on the example site, a project page is served at /fr/projets/<page>/ and its translation at /en/projects/<page>/, each with the project title as its main heading', async ({
  page,
}) => {
  for (const project of PROJECTS) {
    for (const { url, title } of [
      { url: `/fr/projets/${project.slug}/`, title: project.frenchTitle },
      { url: `/en/projects/${project.slug}/`, title: project.englishTitle },
    ]) {
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(200);
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(title);
    }
  }
});
