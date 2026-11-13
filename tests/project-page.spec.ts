import { test, expect } from '@playwright/test';
import {
  SITE_WITH_PROJECTS_IN_A_SUBSECTION,
  SITE_WITH_PROJECTS_IN_THE_CONFIGURED_SECTION,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';

/* Two projects of the example site (content/projects/<slug>.md and its .en.md translation): the
   slug is the page's file name, and each title differs from the other project's and from its
   translation's, so that a page showing another project's or another language's title fails. */
const PROJECTS = [
  {
    slug: 'horloge-astronomique',
    frenchTitle: 'Horloge astronomique de l’atelier',
    englishTitle: 'The workshop’s astronomical clock',
    frenchDescription:
      'Horloge murale qui affiche les phases de la lune, l’équation du temps et le lever du soleil à la latitude de l’atelier.',
    englishDescription:
      'A wall clock showing the phases of the moon, the equation of time and sunrise at the workshop’s latitude.',
    frenchRole: 'Horloger principal',
    englishRole: 'Lead clockmaker',
  },
  {
    slug: 'regulateur-noyer',
    frenchTitle: 'Régulateur de parquet en noyer',
    englishTitle: 'Walnut floor regulator',
    frenchDescription: 'Régulateur à balancier compensé, logé dans une caisse en noyer massif sculptée à la main.',
    englishDescription: 'A regulator with a compensated pendulum, housed in a hand-carved solid walnut case.',
    frenchRole: 'Ébéniste et horloger',
    englishRole: 'Cabinetmaker and clockmaker',
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

test('a project page opens with a link back to the projects list of its language, before the project title', async ({
  page,
}) => {
  /* The link's arrow may be decorative: its name is the words alone, or the words after the arrow. */
  for (const project of PROJECTS) {
    for (const { url, name, href } of [
      { url: `/fr/projets/${project.slug}/`, name: /^(←\s*)?Tous les projets$/, href: '/fr/projets/' },
      { url: `/en/projects/${project.slug}/`, name: /^(←\s*)?All projects$/, href: '/en/projects/' },
    ]) {
      await page.goto(url);
      const main = page.getByRole('main');
      const backLink = main.getByRole('link', { name });
      await expect(backLink, `back link on ${url}`).toBeVisible();
      await expect(backLink, `back link on ${url}`).toHaveAttribute('href', href);

      const heading = await main.getByRole('heading', { level: 1 }).elementHandle();
      const comesBeforeHeading = await backLink.evaluate(
        (link, title) => (link.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        heading,
      );
      expect(comesBeforeHeading, `back link before the main heading on ${url}`).toBe(true);
    }
  }
});

test('a project page shows the kicker "// Étude de cas" (English: "// Case study") before its title', async ({
  page,
}) => {
  /* The kicker's "//" may be decorative: its text is the words alone, or the words after it. */
  for (const project of PROJECTS) {
    for (const { url, text } of [
      { url: `/fr/projets/${project.slug}/`, text: /^(\/\/\s*)?Étude de cas$/ },
      { url: `/en/projects/${project.slug}/`, text: /^(\/\/\s*)?Case study$/ },
    ]) {
      await page.goto(url);
      const main = page.getByRole('main');
      const kicker = main.getByText(text);
      await expect(kicker, `kicker on ${url}`).toBeVisible();

      const heading = await main.getByRole('heading', { level: 1 }).elementHandle();
      const comesBeforeHeading = await kicker.evaluate(
        (element, title) => (element.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        heading,
      );
      expect(comesBeforeHeading, `kicker before the main heading on ${url}`).toBe(true);
    }
  }
});

test('a project page shows the description of its front matter, in its language, below its title', async ({ page }) => {
  for (const project of PROJECTS) {
    for (const { url, description } of [
      { url: `/fr/projets/${project.slug}/`, description: project.frenchDescription },
      { url: `/en/projects/${project.slug}/`, description: project.englishDescription },
    ]) {
      await page.goto(url);
      const main = page.getByRole('main');
      const descriptionText = main.getByText(description, { exact: true });
      await expect(descriptionText, `description on ${url}`).toBeVisible();

      const headingBox = await main.getByRole('heading', { level: 1 }).boundingBox();
      const descriptionBox = await descriptionText.boundingBox();
      expect(descriptionBox!.y, `description below the main heading on ${url}`).toBeGreaterThanOrEqual(
        headingBox!.y + headingBox!.height - 1,
      );
    }
  }
});

test('a project page lists its role in a list of facts, labelled "Rôle" (English: "Role"), in its language', async ({
  page,
}) => {
  /* A list of facts is a description list: each fact is a term (its label) followed by its
     definition (its value), as assistive technologies announce them. */
  for (const project of PROJECTS) {
    for (const { url, label, role } of [
      { url: `/fr/projets/${project.slug}/`, label: 'Rôle', role: project.frenchRole },
      { url: `/en/projects/${project.slug}/`, label: 'Role', role: project.englishRole },
    ]) {
      await page.goto(url);
      const term = page
        .getByRole('main')
        .getByRole('term')
        .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });
      await expect(term, `"${label}" term on ${url}`).toHaveCount(1);
      await expect(term, `"${label}" term on ${url}`).toBeVisible();
      const value = term.locator('xpath=following-sibling::*[1]');
      await expect(value, `value of "${label}" on ${url}`).toHaveRole('definition');
      await expect(value, `value of "${label}" on ${url}`).toHaveText(role);
      await expect(value, `value of "${label}" on ${url}`).toBeVisible();
    }
  }
});

test('a project page lists, in this order and only those filled in, the facts Client, Agence, Rôle, Période and Format (English: Client, Agency, Role, Period, Format), each with its value', async ({
  page,
}) => {
  /* The example site's horloge-astronomique fills in all five facts; regulateur-noyer has no
     agency and no format. Other facts (an engagement's mode or duration, for instance) may sit
     among them: only these five labels are checked, in their relative order. */
  const pages = [
    {
      url: '/fr/projets/horloge-astronomique/',
      labels: ['Client', 'Agence', 'Rôle', 'Période', 'Format'],
      facts: [
        ['Client', 'Musée des Arts du Temps'],
        ['Agence', 'Balancier & Associés'],
        ['Rôle', 'Horloger principal'],
        ['Période', '2016 – 2018'],
        ['Format', 'Pièce unique'],
      ],
    },
    {
      url: '/en/projects/horloge-astronomique/',
      labels: ['Client', 'Agency', 'Role', 'Period', 'Format'],
      facts: [
        ['Client', 'Museum of the Arts of Time'],
        ['Agency', 'Balancier & Partners'],
        ['Role', 'Lead clockmaker'],
        ['Period', '2016 – 2018'],
        ['Format', 'One-off piece'],
      ],
    },
    {
      url: '/fr/projets/regulateur-noyer/',
      labels: ['Client', 'Agence', 'Rôle', 'Période', 'Format'],
      facts: [
        ['Client', 'Famille Duvernoy'],
        ['Rôle', 'Ébéniste et horloger'],
        ['Période', '2022 – 2024'],
      ],
    },
    {
      url: '/en/projects/regulateur-noyer/',
      labels: ['Client', 'Agency', 'Role', 'Period', 'Format'],
      facts: [
        ['Client', 'The Duvernoy family'],
        ['Role', 'Cabinetmaker and clockmaker'],
        ['Period', '2022 – 2024'],
      ],
    },
  ];
  for (const { url, labels, facts } of pages) {
    await page.goto(url);
    const terms = page.getByRole('main').getByRole('term');
    const shownLabels = (await terms.allTextContents())
      .map((text) => text.trim())
      .filter((text) => labels.includes(text));
    expect(shownLabels, `facts listed on ${url}`).toEqual(facts.map(([label]) => label));
    for (const [label, value] of facts) {
      const term = terms.filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });
      await expect(term, `"${label}" term on ${url}`).toBeVisible();
      const definition = term.locator('xpath=following-sibling::*[1]');
      await expect(definition, `value of "${label}" on ${url}`).toHaveRole('definition');
      await expect(definition, `value of "${label}" on ${url}`).toHaveText(value);
      await expect(definition, `value of "${label}" on ${url}`).toBeVisible();
    }
  }
});

test('a page outside the projects section keeps the plain layout, without a link back to the projects list', async ({
  page,
}) => {
  const url = '/fr/page-longue/';
  const response = await page.goto(url);
  expect(response?.status(), url).toBe(200);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 }), `main heading on ${url}`).toBeVisible();
  await expect(main.getByRole('link', { name: /^(←\s*)?Tous les projets$/ }), `back link on ${url}`).toHaveCount(0);
});

test.describe('pages of another site, whose projectsSection param names the section of its projects', () => {
  test('the pages of the section named by the projectsSection param open with the link back to the projects list, and the pages of the projects/ section do not', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/projects-in-the-configured-section/hugo.toml sets projectsSection =
       'realisations'; its content/realisations/ holds two projects, published at
       /fr/realisations/<page>/. The example site's projects/ section is still built: its pages
       are no longer project pages, so the link back to the projects list has no place there. */
    const site = SITE_WITH_PROJECTS_IN_THE_CONFIGURED_SECTION;
    const siteDirectory = buildSite(site);
    const name = /^(←\s*)?Tous les projets$/;
    try {
      await serveSite(context, site, siteDirectory);
      for (const slug of ['pendule-de-voyage', 'horloge-de-parquet']) {
        const url = `${site.origin}/fr/realisations/${slug}/`;
        const response = await page.goto(url);
        expect(response?.status(), url).toBe(200);
        const backLink = page.getByRole('main').getByRole('link', { name });
        await expect(backLink, `back link on ${url}`).toBeVisible();
        await expect(backLink, `back link on ${url}`).toHaveAttribute('href', '/fr/realisations/');
      }
      for (const slug of ['horloge-astronomique', 'regulateur-noyer']) {
        const url = `${site.origin}/fr/projets/${slug}/`;
        const response = await page.goto(url);
        expect(response?.status(), url).toBe(200);
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 1 }), `main heading on ${url}`).toBeVisible();
        await expect(main.getByRole('link', { name }), `back link on ${url}`).toHaveCount(0);
      }
    } finally {
      removeDirectory(siteDirectory);
    }
  });
});

test.describe('pages of another site, whose projects are filed in a subsection of the projects section', () => {
  test('the "Tous les projets" link of a project filed in a subsection of the projects section leads to the projects list, not to the subsection', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/projects-in-a-subsection/content/projects/horlogerie/ holds two projects, in
       a subsection titled "Horlogerie" and published at /fr/projets/horlogerie/. The projects list
       is the example site's content/projects/, titled "Projets" and published at /fr/projets/. */
    const site = SITE_WITH_PROJECTS_IN_A_SUBSECTION;
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      /* The subsection's page redirects to the projects list with a meta refresh: opened in a page
         of its own, closed before the next navigation, its refresh cannot interrupt that one. */
      const subsectionPage = await context.newPage();
      const subsectionResponse = await subsectionPage.goto(`${site.origin}/fr/projets/horlogerie/`);
      await subsectionPage.close();
      expect(subsectionResponse?.status(), 'status of the subsection page').toBe(200);
      const url = `${site.origin}/fr/projets/horlogerie/pendule-de-voyage/`;
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(200);
      const backLink = page.getByRole('main').getByRole('link', { name: /^(←\s*)?Tous les projets$/ });
      await expect(backLink, `back link on ${url}`).toBeVisible();
      /* The link itself leads to the projects list: no stop on the subsection's page. */
      await expect(backLink, `back link on ${url}`).toHaveAttribute('href', '/fr/projets/');
      await backLink.click();
      await expect(page).toHaveURL(`${site.origin}/fr/projets/`);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Projets');
    } finally {
      removeDirectory(siteDirectory);
    }
  });
});

test('on a project page, in French and in English, the Projects navigation link is marked as the current section, and no navigation link as the current page', async ({
  page,
}) => {
  for (const project of PROJECTS) {
    for (const { url, section } of [
      { url: `/fr/projets/${project.slug}/`, section: 'Projets' },
      { url: `/en/projects/${project.slug}/`, section: 'Projects' },
    ]) {
      await page.goto(url);
      const nav = page.locator('header nav');
      const sectionLink = nav.getByRole('link', { name: section, exact: true });
      await expect(sectionLink, `${section} on ${url}`).toHaveAttribute('aria-current', 'true');
      await expect(nav.locator('a[aria-current="page"]'), `current page links on ${url}`).toHaveCount(0);
    }
  }
});

test('on a project page, the header "EN" link leads to the English translation of the project, and the "FR" link of that translation back to the French page', async ({
  page,
}) => {
  for (const project of PROJECTS) {
    const frenchUrl = `/fr/projets/${project.slug}/`;
    const englishUrl = `/en/projects/${project.slug}/`;
    const mainHeading = page.getByRole('main').getByRole('heading', { level: 1 });

    await page.goto(frenchUrl);
    await page.locator('header').getByRole('link', { name: 'EN', exact: true }).click();
    await expect(page, `EN link on ${frenchUrl}`).toHaveURL(englishUrl);
    await expect(mainHeading, `heading after EN on ${frenchUrl}`).toHaveText(project.englishTitle);

    await page.locator('header').getByRole('link', { name: 'FR', exact: true }).click();
    await expect(page, `FR link on ${englishUrl}`).toHaveURL(frenchUrl);
    await expect(mainHeading, `heading after FR on ${englishUrl}`).toHaveText(project.frenchTitle);
  }
});
