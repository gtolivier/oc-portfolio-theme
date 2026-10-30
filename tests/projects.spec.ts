import { test, expect } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_OTHER_PROJECTS,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';

/* The projects the example site's French home page features, in the order its front matter lists
   them (params.projects, page references to content/projets/<slug>). The order is neither
   alphabetical nor reverse alphabetical, so that a sorted listing cannot pass for it. Each entry
   holds what the project's page declares in its front matter: title and description, and under
   [params] role, years and stack. Every value differs from one project to the next, so that a
   card showing another project's text cannot pass. */
const FEATURED_PROJECTS = [
  {
    title: 'Restauration d’une pendule de cheminée',
    description: 'Remise en marche d’une pendule Empire en bronze doré : mouvement nettoyé, suspension refaite, cadran retouché.',
    role: 'Restaurateur',
    years: '2019 – 2020',
    stack: ['Bronze doré', 'Laiton', 'Soie'],
  },
  {
    title: 'Montre de poche à grande complication',
    description: 'Calibre à quantième perpétuel et répétition minutes, dessiné puis assemblé pièce par pièce.',
    role: 'Concepteur du mouvement',
    years: '2021 – 2023',
    stack: ['Or rose', 'Acier trempé', 'Rubis', 'Émail grand feu'],
  },
  {
    title: 'Horloge astronomique de l’atelier',
    description: 'Horloge murale qui affiche les phases de la lune, l’équation du temps et le lever du soleil à la latitude de l’atelier.',
    role: 'Horloger principal',
    years: '2016 – 2018',
    stack: ['Laiton', 'Acier', 'Verre'],
  },
  {
    title: 'Régulateur de parquet en noyer',
    description: 'Régulateur à balancier compensé, logé dans une caisse en noyer massif sculptée à la main.',
    role: 'Ébéniste et horloger',
    years: '2022 – 2024',
    stack: ['Noyer', 'Invar', 'Laiton'],
  },
];

test('on the French home page, the section "Projets sélectionnés" shows one card per featured project, in the order the home page lists them, each headed by the project’s title', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  await expect(section.getByRole('heading', { level: 2, name: 'Projets sélectionnés' })).toBeVisible();
  /* An array makes the match exact: a missing, extra, repeated or misplaced project fails it. */
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(FEATURED_PROJECTS.map((project) => project.title));
});

test('on the French home page, each featured project’s card gives the role, years, description and stack its page declares, the description as a paragraph and the stack on one line, items separated by " · "', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  for (const project of FEATURED_PROJECTS) {
    /* The card is the article headed by the project's title: its texts must be in it, not just
       somewhere in the section. */
    const card = section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: project.title, exact: true }) });
    await expect(card).toHaveCount(1);
    const stack = project.stack.join(' · ');
    for (const text of [project.years, project.role, stack]) {
      await expect(card.getByText(text, { exact: true })).toBeVisible();
      /* Shown once in the section: in this card only. */
      await expect(section.getByText(text, { exact: true })).toHaveCount(1);
    }
    const description = card.getByText(project.description, { exact: true });
    await expect(description).toBeVisible();
    await expect(description).toHaveRole('paragraph');
    await expect(section.getByText(project.description, { exact: true })).toHaveCount(1);
  }
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

  test('a featured project whose page declares only a title and a description gets a card with just those: no empty slot for the role, years or stack, no stray separator', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    /* tests/fixtures/other-projects/content/projets/barometre-mercure.md declares no [params]. */
    const title = 'Baromètre à mercure';
    const description = 'Baromètre à colonne de mercure remonté dans son cadre d’origine, avec une échelle regravée.';
    const card = section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
    await expect(card).toHaveCount(1);
    await expect(card.getByText(description, { exact: true })).toHaveRole('paragraph');
    /* Outside links (a link to the project's page may come later, with its own text), the title
       and the description are all the card shows: no role, years or stack text, no separator left
       alone… */
    const textOutsideLinks = () =>
      card.evaluate((article) => {
        const copy = article.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('a').forEach((link) => link.remove());
        return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      });
    await expect.poll(textOutsideLinks).toBe(`${title} ${description}`);
    /* …and no text element left empty, or holding only whitespace, where they would go. Other
       non-text elements (decoration, link) may come later: only text elements are checked. */
    const textElements = card.locator('p, span, li, dt, dd, time, small, strong, em, h1, h2, h3, h4, h5, h6');
    await expect(textElements.filter({ hasNotText: /\S/ })).toHaveCount(0);
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
      await expect(page.getByText(project.title)).toHaveCount(0);
    }
  });
});
