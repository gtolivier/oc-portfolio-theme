import { test, expect } from '@playwright/test';
import {
  SITE_WITH_LOGOS_MISSING_FROM_THE_PAGE_BUNDLE,
  SITE_WITH_PROJECTS_IN_A_SUBSECTION,
  SITE_WITH_PROJECTS_IN_THE_CONFIGURED_SECTION,
  TEMPLATE_EXECUTION_ERROR,
  buildSite,
  removeDirectory,
  runBuildTestsInOneProjectOnly,
  serveSite,
  tryToBuildSite,
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
    frenchStack: ['Laiton', 'Acier', 'Verre'],
    englishStack: ['Brass', 'Steel', 'Glass'],
  },
  {
    slug: 'regulateur-noyer',
    frenchTitle: 'Régulateur de parquet en noyer',
    englishTitle: 'Walnut floor regulator',
    frenchDescription: 'Régulateur à balancier compensé, logé dans une caisse en noyer massif sculptée à la main.',
    englishDescription: 'A regulator with a compensated pendulum, housed in a hand-carved solid walnut case.',
    frenchRole: 'Ébéniste et horloger',
    englishRole: 'Cabinetmaker and clockmaker',
    frenchStack: ['Noyer', 'Invar', 'Laiton'],
    englishStack: ['Walnut', 'Invar', 'Brass'],
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

test('a project page whose clientLogo and agencyLogo params name images of its page bundle shows both logos, under the labels "Client" and "Agence" (English: "Client", "Agency"), each with the client’s or the agency’s name as its alternative text; without either, it shows no logo box', async ({
  page,
}) => {
  /* The example site's horloge-astronomique is a page bundle (content/projects/horloge-astronomique/)
     whose clientLogo and agencyLogo params name its logo-musee.svg and logo-balancier.svg;
     regulateur-noyer sets neither. A logo sits under its label: the last text before the image, in
     reading order, is the label, shown above it. */
  const pagesWithLogos = [
    {
      url: '/fr/projets/horloge-astronomique/',
      logos: [
        ['Client', 'Musée des Arts du Temps'],
        ['Agence', 'Balancier & Associés'],
      ],
    },
    {
      url: '/en/projects/horloge-astronomique/',
      logos: [
        ['Client', 'Museum of the Arts of Time'],
        ['Agency', 'Balancier & Partners'],
      ],
    },
  ];
  for (const { url, logos } of pagesWithLogos) {
    await page.goto(url);
    const main = page.getByRole('main');
    for (const [label, name] of logos) {
      const logo = main.getByRole('img', { name, exact: true });
      await expect(logo, `"${label}" logo on ${url}`).toHaveCount(1);
      await logo.scrollIntoViewIfNeeded();
      await expect(logo, `"${label}" logo on ${url}`).toBeVisible();
      await expect
        .poll(
          () => logo.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
          { message: `"${label}" logo loaded on ${url}` },
        )
        .toBe(true);

      const { previousText, labelBottom, logoTop } = await logo.evaluate((image) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let previous: Node | null = null;
        for (
          let node = walker.nextNode();
          node && (node.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
          node = walker.nextNode()
        ) {
          if (node.textContent!.trim() !== '') previous = node;
        }
        return {
          previousText: previous?.textContent!.trim() ?? null,
          labelBottom: previous?.parentElement?.getBoundingClientRect().bottom ?? null,
          logoTop: image.getBoundingClientRect().top,
        };
      });
      expect(previousText, `label before the "${label}" logo on ${url}`).toBe(label);
      expect(labelBottom!, `"${label}" label above its logo on ${url}`).toBeLessThanOrEqual(logoTop + 1);
    }
  }

  for (const { url, clientLabel, agencyLabel } of [
    { url: '/fr/projets/regulateur-noyer/', clientLabel: 'Client', agencyLabel: 'Agence' },
    { url: '/en/projects/regulateur-noyer/', clientLabel: 'Client', agencyLabel: 'Agency' },
  ]) {
    await page.goto(url);
    const main = page.getByRole('main');
    await expect(main.getByRole('img'), `logos on ${url}`).toHaveCount(0);
    /* Only the list of facts names the client, and nothing names an agency. */
    await expect(main.getByText(clientLabel, { exact: true }), `"${clientLabel}" labels on ${url}`).toHaveCount(1);
    await expect(main.getByText(agencyLabel, { exact: true }), `"${agencyLabel}" labels on ${url}`).toHaveCount(0);
  }
});

test.describe('project pages whose logo params name no image of their page bundle: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a project page whose clientLogo or agencyLogo param names no image of its page bundle makes the site build fail, with an error message that cites that param, the file it names and the page, without a template execution error after it', () => {
    /* tests/fixtures/logos-missing-from-the-bundle/content/projects/ holds two page bundles whose
       logo params each name, once, an image the bundle does not hold: carillon-beffroi's
       clientLogo names logo-ville.png (its bundle holds logo-ville.svg), chronometre-marine's
       agencyLogo names logo-atelier-naval.svg. Rather than a page quietly showing no logo, the
       person building the site must get, for each, a failure whose message, on one line, cites
       the param, the file it names and the page by its path, whatever the rest of the wording,
       and not the other logo param, which names an image the bundle holds. Neither of those
       images may be reported. Two pages and two params, so that no fixed message passes. */
    const build = tryToBuildSite(SITE_WITH_LOGOS_MISSING_FROM_THE_PAGE_BUNDLE);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    for (const { page, param, otherParam, file } of [
      { page: 'projects/carillon-beffroi', param: 'clientLogo', otherParam: 'agencyLogo', file: 'logo-ville.png' },
      {
        page: 'projects/chronometre-marine',
        param: 'agencyLogo',
        otherParam: 'clientLogo',
        file: 'logo-atelier-naval.svg',
      },
    ]) {
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(page) && line.includes(file) && new RegExp(`\\b${param}\\b`).test(line));
      expect(messages, `one error message citing ${param}, ${file} and ${page}, in:\n${build.errors}`).toHaveLength(1);
      expect(messages[0], `the error message about ${page} should not cite ${otherParam}`).not.toMatch(
        new RegExp(`\\b${otherParam}\\b`),
      );
    }
    for (const file of ['logo-fonderie.svg', 'logo-port.svg']) {
      expect(build.errors, `${file}, which its page bundle holds, should not be reported`).not.toContain(file);
    }
    expect(build.errors, 'no template execution error should follow the error messages').not.toMatch(
      TEMPLATE_EXECUTION_ERROR,
    );
  });
});

test('an engagement’s page lists, after its period, its duration and its contract mode, labelled "Durée" and "Contrat" (English: "Duration", "Contract"), each with its value', async ({
  page,
}) => {
  /* The example site's horloge-astronomique and restauration-pendule are engagements: their front
     matter sets params.kind = 'engagement', with params.duration and params.mode. Only the
     position of each new fact after the period is checked, not their order between them. */
  const pages = [
    {
      url: '/fr/projets/horloge-astronomique/',
      period: 'Période',
      facts: [
        ['Durée', '26 mois'],
        ['Contrat', 'Régie'],
      ],
    },
    {
      url: '/en/projects/horloge-astronomique/',
      period: 'Period',
      facts: [
        ['Duration', '26 months'],
        ['Contract', 'Time and materials'],
      ],
    },
    {
      url: '/fr/projets/restauration-pendule/',
      period: 'Période',
      facts: [
        ['Durée', '14 mois'],
        ['Contrat', 'Forfait'],
      ],
    },
    {
      url: '/en/projects/restauration-pendule/',
      period: 'Period',
      facts: [
        ['Duration', '14 months'],
        ['Contract', 'Fixed-price'],
      ],
    },
  ];
  for (const { url, period, facts } of pages) {
    await page.goto(url);
    const terms = page.getByRole('main').getByRole('term');
    const shownLabels = (await terms.allTextContents()).map((text) => text.trim());
    for (const [label, value] of facts) {
      const term = terms.filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });
      await expect(term, `"${label}" term on ${url}`).toHaveCount(1);
      await expect(term, `"${label}" term on ${url}`).toBeVisible();
      const definition = term.locator('xpath=following-sibling::*[1]');
      await expect(definition, `value of "${label}" on ${url}`).toHaveRole('definition');
      await expect(definition, `value of "${label}" on ${url}`).toHaveText(value);
      await expect(definition, `value of "${label}" on ${url}`).toBeVisible();
      expect(
        shownLabels.indexOf(label),
        `"${label}" after "${period}" on ${url} (facts listed: ${shownLabels.join(', ')})`,
      ).toBeGreaterThan(shownLabels.indexOf(period));
    }
    expect(shownLabels, `"${period}" term on ${url}`).toContain(period);
  }
});

test('a project page shows the stack of its front matter, in its language, after its list of facts, its entries separated by " · "', async ({
  page,
}) => {
  for (const project of PROJECTS) {
    for (const { url, stack } of [
      { url: `/fr/projets/${project.slug}/`, stack: project.frenchStack },
      { url: `/en/projects/${project.slug}/`, stack: project.englishStack },
    ]) {
      await page.goto(url);
      const main = page.getByRole('main');
      const stackText = main.getByText(stack.join(' · '), { exact: true });
      await expect(stackText, `stack on ${url}`).toHaveCount(1);
      await expect(stackText, `stack on ${url}`).toBeVisible();

      /* After the list of facts: after its last value, in reading order. */
      const lastFact = await main.getByRole('definition').last().elementHandle();
      const comesAfterFacts = await stackText.evaluate(
        (element, fact) => (fact!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        lastFact,
      );
      expect(comesAfterFacts, `stack after the list of facts on ${url}`).toBe(true);
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
