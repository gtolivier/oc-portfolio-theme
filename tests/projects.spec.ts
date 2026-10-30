import { test, expect } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND,
  SITE_WITH_OTHER_PROJECTS,
  SITE_WITH_PROJECTS_IN_ANOTHER_SECTION,
  buildSite,
  removeDirectory,
  runBuildTestsInOneProjectOnly,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';

/* The projects the example site's French home page features, in the order its front matter lists
   them (params.projects, page references to content/projets/<slug>). The order is neither
   alphabetical nor reverse alphabetical, so that a sorted listing cannot pass for it. Each entry
   holds what the project's page declares in its front matter: title and description, and under
   [params] role, years and stack. Every value differs from one project to the next, so that a
   card showing another project's text cannot pass. The slug is the page's file name, which sets
   its address: /fr/projets/<slug>/. */
const FEATURED_PROJECTS = [
  {
    slug: 'restauration-pendule',
    title: 'Restauration d’une pendule de cheminée',
    description: 'Remise en marche d’une pendule Empire en bronze doré : mouvement nettoyé, suspension refaite, cadran retouché.',
    role: 'Restaurateur',
    years: '2019 – 2020',
    stack: ['Bronze doré', 'Laiton', 'Soie'],
  },
  {
    slug: 'montre-grande-complication',
    title: 'Montre de poche à grande complication',
    description: 'Calibre à quantième perpétuel et répétition minutes, dessiné puis assemblé pièce par pièce.',
    role: 'Concepteur du mouvement',
    years: '2021 – 2023',
    stack: ['Or rose', 'Acier trempé', 'Rubis', 'Émail grand feu'],
  },
  {
    slug: 'horloge-astronomique',
    title: 'Horloge astronomique de l’atelier',
    description: 'Horloge murale qui affiche les phases de la lune, l’équation du temps et le lever du soleil à la latitude de l’atelier.',
    role: 'Horloger principal',
    years: '2016 – 2018',
    stack: ['Laiton', 'Acier', 'Verre'],
  },
  {
    slug: 'regulateur-noyer',
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

test('on the French home page, each featured project’s card ends with a "Voir le détail" link, separate from its title, whose accessible name names the project; following it opens the project’s page, at the site root and under /portfolio/', async ({ page }) => {
  /* The example site served at the root of its origin, then under a subpath (playwright.config.ts). */
  for (const siteRoot of ['http://localhost:1314/', 'http://localhost:1315/portfolio/']) {
    for (const project of FEATURED_PROJECTS) {
      await page.goto(`${siteRoot}fr/`);
      const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
      const card = section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: project.title, exact: true }) });
      await expect(card).toHaveCount(1);
      /* The title is not itself the link. */
      await expect(card.getByRole('heading', { level: 3 }).getByRole('link')).toHaveCount(0);
      const link = card.getByRole('link', { name: 'Voir le détail' });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toContainText('Voir le détail');
      /* Every card shows the same text: the accessible name also names the project, so that a
         list of the page's links tells them apart. The arrow is decorative: not in the name. */
      await expect(link).toHaveAccessibleName(new RegExp(project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(link).not.toHaveAccessibleName(/→/);
      await link.click();
      await expect(page).toHaveURL(`${siteRoot}fr/projets/${project.slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    }
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

  test('the card of a featured project without a detail page has no link, while the other cards keep theirs, and the site publishes no page at that project’s address', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    const cardOf = (title: string) =>
      section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
    /* tests/fixtures/other-projects/content/projets/chronometre-marine.md declares
       [build] render = 'never': its card is still shown, with no link at all, not even an empty one. */
    const card = cardOf('Chronomètre de marine');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.locator('a')).toHaveCount(0);
    /* The projects that have a page keep their link to it. */
    for (const title of ['Coucou de la Forêt-Noire', 'Baromètre à mercure']) {
      await expect(cardOf(title).getByRole('link', { name: 'Voir le détail' })).toHaveCount(1);
    }
    /* Nothing is published where the project's page would be. */
    const response = await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/projets/chronometre-marine/`);
    expect(response?.status()).toBe(404);
  });
});

test.describe('home pages whose featured projects live in sections of different names', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_IN_ANOTHER_SECTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" has, once and after the cards, a "Tous les projets" link that opens the section holding the featured projects, at the site root and under /portfolio/', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_PROJECTS_IN_ANOTHER_SECTION, siteDirectory);
    const sites = [
      /* The example site, whose featured projects are in content/projets/ (title "Projets"),
         served at the root of its origin, then under a subpath (playwright.config.ts)… */
      { home: 'http://localhost:1314/fr/', sectionAddress: 'http://localhost:1314/fr/projets/', sectionTitle: 'Projets' },
      { home: 'http://localhost:1315/portfolio/fr/', sectionAddress: 'http://localhost:1315/portfolio/fr/projets/', sectionTitle: 'Projets' },
      /* …and a site whose featured project is in content/realisations/, while projets/ still
         exists: a hard-coded /projets/ address cannot pass. */
      {
        home: `${SITE_WITH_PROJECTS_IN_ANOTHER_SECTION.origin}/fr/`,
        sectionAddress: `${SITE_WITH_PROJECTS_IN_ANOTHER_SECTION.origin}/fr/realisations/`,
        sectionTitle: 'Réalisations',
      },
    ];
    for (const site of sites) {
      await page.goto(site.home);
      const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
      /* The arrow is decorative: the accessible name is the text alone. */
      const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toContainText('Tous les projets');
      await expect(link).toHaveAccessibleName('Tous les projets');
      /* It belongs to the section, not to a card, and comes after every card. */
      await expect(section.getByRole('article').getByRole('link', { name: 'Tous les projets' })).toHaveCount(0);
      const lastCard = section.getByRole('article').last();
      await expect(lastCard).toBeVisible();
      const followsLastCard = await link.evaluate(
        (anchor, card) => (card!.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        await lastCard.elementHandle(),
      );
      expect(followsLastCard).toBe(true);
      await link.click();
      await expect(page).toHaveURL(site.sectionAddress);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.sectionTitle);
    }
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

test.describe('featured project content errors: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a home page that features a page that does not exist makes the site build fail, with a French error message that names the projects parameter and that page reference, without a template execution error after it', () => {
    /* tests/fixtures/featured-ref-without-page/content/_index.md features
       'projets/restauration-pendule', an existing page, then 'projets/sablier-introuvable', which
       no page answers. Rather than a section that silently drops that card, the person building
       the site must get a failure whose French message names the projects parameter, in the style
       of the clients messages ("le paramètre clients…"), and the reference as written in the front
       matter, whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the French message should name the projects parameter').toMatch(
      /\bparamètre\s+projects\b/,
    );
    expect(build.errors, 'the French message should name the missing page reference').toContain(
      'projets/sablier-introuvable',
    );
    expect(build.errors, 'no template execution error should follow the French message').not.toMatch(
      /execute of template failed|error calling/i,
    );
  });
});
