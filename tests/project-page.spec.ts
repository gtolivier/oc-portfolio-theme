import { test, expect } from '@playwright/test';
import {
  SITE_WITH_HOME_PAGES_WITHOUT_CONTACT_INTRO,
  SITE_WITH_LOGOS_MISSING_FROM_THE_PAGE_BUNDLE,
  SITE_WITH_LOGOS_THAT_ARE_NOT_IMAGES,
  SITE_WITH_PROJECT_FACTS_NOT_AS_TEXTS,
  SITE_WITH_PROJECT_FACTS_READ_AS_EMPTY,
  SITE_WITH_A_SUBSECTION_OF_AN_UNWRITTEN_PROJECTS_LIST,
  SITE_WITH_PROJECTS_IN_A_SUBSECTION,
  SITE_WITH_PROJECTS_IN_THE_CONFIGURED_SECTION,
  TEMPLATE_EXECUTION_ERROR,
  buildSite,
  languageCodePattern,
  removeDirectory,
  runBuildTestsInOneProjectOnly,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import { displayedText } from './helpers/text-on-screen';

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
      const backLink = main.getByRole('link', { name }).first();
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

test('a project page’s kicker shows the "//" marker before "Étude de cas" (English: "Case study") on screen, while assistive technologies get the words alone', async ({
  page,
}) => {
  /* The kicker is the element of the main content whose text is its words, with or without the
     marker before them. */
  for (const project of PROJECTS) {
    for (const { url, words } of [
      { url: `/fr/projets/${project.slug}/`, words: 'Étude de cas' },
      { url: `/en/projects/${project.slug}/`, words: 'Case study' },
    ]) {
      await page.goto(url);
      const kicker = page.getByRole('main').getByText(new RegExp(`^(//\\s*)?${words}$`));
      await expect(kicker, `kicker on ${url}`).toHaveCount(1);
      await expect(kicker, `kicker on ${url}`).toBeVisible();
      /* On screen: the marker, then the words, whether the marker is text in the page or
         generated by the stylesheet. */
      expect(await displayedText(kicker), `on ${url}, text displayed by the kicker`).toMatch(
        new RegExp(`^// ?${words}$`),
      );
      /* For assistive technologies: the words, without the marker. */
      expect(
        (await kicker.ariaSnapshot()).trim(),
        `on ${url}, what assistive technologies get from the kicker`,
      ).toMatch(new RegExp(`^- (paragraph|text): "?${words}"?$`));
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

  test('a project page whose clientLogo or agencyLogo param names a file of its page bundle that is not an image makes the site build fail, with an error message that cites that param, the file it names and the page', () => {
    /* tests/fixtures/logos-not-images-in-the-bundle/content/projects/ holds two page bundles whose
       logo params each name, once, a file the bundle holds but that is not an image:
       sonnerie-angelus's clientLogo names devis-paroisse.pdf, montre-gousset's agencyLogo names
       notice-atelier.txt. Rather than a page showing an <img> that points to that file, the
       person building the site must get, for each, a failure whose message, on one line, cites
       the param, the file it names and the page by its path, whatever the rest of the wording,
       and not the other logo param, which names an image the bundle holds. Neither of those
       images may be reported. Two pages, two params and two kinds of files, so that neither a
       fixed message nor a check for one kind of file passes. */
    const build = tryToBuildSite(SITE_WITH_LOGOS_THAT_ARE_NOT_IMAGES);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    for (const { page, param, otherParam, file } of [
      { page: 'projects/sonnerie-angelus', param: 'clientLogo', otherParam: 'agencyLogo', file: 'devis-paroisse.pdf' },
      { page: 'projects/montre-gousset', param: 'agencyLogo', otherParam: 'clientLogo', file: 'notice-atelier.txt' },
    ]) {
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(page) && line.includes(file) && new RegExp(`\\b${param}\\b`).test(line));
      expect(messages, `one error message citing ${param}, ${file} and ${page}, in:\n${build.errors}`).toHaveLength(1);
      expect(messages[0], `the error message about ${page} should not cite ${otherParam}`).not.toMatch(
        new RegExp(`\\b${otherParam}\\b`),
      );
    }
    for (const file of ['logo-ebenisterie.svg', 'logo-collection.svg']) {
      expect(build.errors, `${file}, an image its page bundle holds, should not be reported`).not.toContain(file);
    }
  });
});

test.describe('project pages whose facts are not texts: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a project page whose client, agency, role, years, duration, mode or format param is not a text makes the site build fail, with an error message that cites that param, the page and its language', () => {
    /* tests/fixtures/facts-not-as-texts/content/projects/ holds two bilingual engagements, each of
       whose versions writes some facts as a number, a list or a table rather than a text (see
       SITE_WITH_PROJECT_FACTS_NOT_AS_TEXTS). Rather than a list of facts showing "[1887 1889]" or
       "map[title:Clockmaker]", the person building the site must get, for each such fact, a
       failure whose message, on one line, cites the param, the page by its path and the page's
       language, looked for as a word that no other word follows, whatever the rest of the
       wording. The same param of the other version of the page, written as a text, must not be
       reported in that version's language. Two pages, both languages and all seven params, so
       that no fixed message passes. */
    const build = tryToBuildSite(SITE_WITH_PROJECT_FACTS_NOT_AS_TEXTS);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const lines = build.errors.split('\n');
    const messagesAbout = (page: string, param: string, language: string) =>
      lines.filter(
        (line) =>
          line.includes(page) &&
          new RegExp(`\\b${param}\\b`).test(line) &&
          new RegExp(languageCodePattern(language), 'u').test(line),
      );
    for (const { page, param, language, otherLanguage } of [
      { page: 'projects/sonnerie-quarts', param: 'client', language: 'fr', otherLanguage: 'en' },
      { page: 'projects/sonnerie-quarts', param: 'years', language: 'fr', otherLanguage: 'en' },
      { page: 'projects/sonnerie-quarts', param: 'role', language: 'en', otherLanguage: 'fr' },
      { page: 'projects/sonnerie-quarts', param: 'format', language: 'en', otherLanguage: 'fr' },
      { page: 'projects/remontoir-egalite', param: 'agency', language: 'fr', otherLanguage: 'en' },
      { page: 'projects/remontoir-egalite', param: 'duration', language: 'fr', otherLanguage: 'en' },
      { page: 'projects/remontoir-egalite', param: 'mode', language: 'en', otherLanguage: 'fr' },
    ]) {
      expect(
        messagesAbout(page, param, language),
        `one error message citing ${param}, ${page} and ${language}, in:\n${build.errors}`,
      ).toHaveLength(1);
      expect(
        messagesAbout(page, param, otherLanguage),
        `no error message citing ${param}, ${page} and ${otherLanguage}, whose ${param} is a text, in:\n${build.errors}`,
      ).toEqual([]);
    }
  });

  test('a project page whose fact is not a text but a value Go templates read as empty (0, false, an empty list) makes the site build fail too, with an error message that cites that param, the page and its language', () => {
    /* tests/fixtures/facts-read-as-empty/content/projects/ holds a bilingual engagement whose
       versions each write two facts as 0, false or an empty list (see
       SITE_WITH_PROJECT_FACTS_READ_AS_EMPTY). Rather than those facts being left out of the page
       silently, the person building the site must get, for each, the same failure as for any
       other fact that is not a text: a message that, on one line, cites the param, the page by
       its path and the page's language. The same param of the other version, written as a
       text, must not be reported in that version's language. Three values on four params, so
       that a fix for a single value does not pass. */
    const build = tryToBuildSite(SITE_WITH_PROJECT_FACTS_READ_AS_EMPTY);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const lines = build.errors.split('\n');
    const messagesAbout = (page: string, param: string, language: string) =>
      lines.filter(
        (line) =>
          line.includes(page) &&
          new RegExp(`\\b${param}\\b`).test(line) &&
          new RegExp(languageCodePattern(language), 'u').test(line),
      );
    for (const { param, language, otherLanguage } of [
      { param: 'role', language: 'fr', otherLanguage: 'en' },
      { param: 'duration', language: 'fr', otherLanguage: 'en' },
      { param: 'client', language: 'en', otherLanguage: 'fr' },
      { param: 'mode', language: 'en', otherLanguage: 'fr' },
    ]) {
      const page = 'projects/echappement-ancre';
      expect(
        messagesAbout(page, param, language),
        `one error message citing ${param}, ${page} and ${language}, in:\n${build.errors}`,
      ).toHaveLength(1);
      expect(
        messagesAbout(page, param, otherLanguage),
        `no error message citing ${param}, ${page} and ${otherLanguage}, whose ${param} is a text, in:\n${build.errors}`,
      ).toEqual([]);
    }
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

test('a project page shows its body, in its language: its section headings, paragraphs, list and captures, each capture loaded with its alternative text', async ({
  page,
}) => {
  /* The example site's horloge-astronomique has a Markdown body in each language: two sections,
     each a level-2 heading, a paragraph, then a list or a capture, an image of its page bundle
     (cadran-lunaire.svg, rouages-equation.svg) whose alternative text is written in the page's
     language. */
  const pages = [
    {
      url: '/fr/projets/horloge-astronomique/',
      headings: ['Le besoin', 'Le mécanisme'],
      paragraphs: [
        'Le musée voulait une horloge qui raconte le ciel de l’atelier, lisible par un visiteur pressé comme par un astronome.',
        'Un train d’engrenages dédié corrige chaque jour l’écart entre le temps solaire et le temps moyen.',
      ],
      listItems: [
        'Une came en acier trempé pour l’équation du temps',
        'Un rouage de 59 dents pour la lunaison',
        'Un disque de verre gravé pour le lever du soleil',
      ],
      captures: [
        'Cadran lunaire de l’horloge, l’aiguille des phases sur le premier croissant',
        'Rouages de l’équation du temps, vus de dos, la came en avant-plan',
      ],
    },
    {
      url: '/en/projects/horloge-astronomique/',
      headings: ['The need', 'The mechanism'],
      paragraphs: [
        'The museum wanted a clock that tells the sky above the workshop, readable by a hurried visitor as well as by an astronomer.',
        'A dedicated gear train corrects, every day, the gap between solar time and mean time.',
      ],
      listItems: [
        'A hardened steel cam for the equation of time',
        'A 59-tooth wheel for the lunar month',
        'An engraved glass disc for sunrise',
      ],
      captures: [
        'The clock’s lunar dial, the phase hand on the first crescent',
        'The equation-of-time gearing, seen from the back, the cam in the foreground',
      ],
    },
  ];
  for (const { url, headings, paragraphs, listItems, captures } of pages) {
    await page.goto(url);
    const main = page.getByRole('main');
    /* The body's section headings only: the contact section, the #contact anchor that ends the
       page, has a level-2 heading of its own. */
    const sectionHeadings = main
      .getByRole('heading', { level: 2 })
      .and(page.locator('xpath=//*[not(ancestor::*[@id="contact"])]'));
    await expect(sectionHeadings, `section headings on ${url}`).toHaveText(headings);
    for (const heading of await sectionHeadings.all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading, `section heading on ${url}`).toBeVisible();
    }
    for (const paragraph of paragraphs) {
      const text = main.getByText(paragraph, { exact: true });
      await expect(text, `paragraph on ${url}`).toHaveCount(1);
      await text.scrollIntoViewIfNeeded();
      await expect(text, `paragraph on ${url}`).toBeVisible();
    }
    const list = main.getByRole('list').filter({ hasText: listItems[0] });
    await expect(list, `list on ${url}`).toHaveCount(1);
    await expect(list.getByRole('listitem'), `list items on ${url}`).toHaveText(listItems);
    await list.scrollIntoViewIfNeeded();
    await expect(list, `list on ${url}`).toBeVisible();
    for (const name of captures) {
      const capture = main.getByRole('img', { name, exact: true });
      await expect(capture, `capture "${name}" on ${url}`).toHaveCount(1);
      await capture.scrollIntoViewIfNeeded();
      await expect(capture, `capture "${name}" on ${url}`).toBeVisible();
      await expect
        .poll(
          () =>
            capture.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
          { message: `capture "${name}" loaded on ${url}` },
        )
        .toBe(true);
    }
  }
});

test('on a phone (390 px), a project page fits within the screen width, without horizontal scrolling, its facts above its body; on a desktop (1280 px), the facts column sits to the left of the body, their tops aligned', async ({
  page,
  isMobile,
}) => {
  /* The example site's horloge-astronomique has a list of facts, its client and agency logos and
     a stack (its facts), then a body that opens on its first section heading, "Le besoin". */
  const url = '/fr/projets/horloge-astronomique/';
  const PHONE = { width: 390, height: 844 };
  const DESKTOP = { width: 1280, height: 900 };

  /* The extent, in the page, of the facts: the terms and values of the list of facts, the logos and
     the stack; the bottom of the first fact, the topmost of them; and the box of the body's first
     section heading. */
  async function factsAndBody() {
    const main = page.getByRole('main');
    const facts = [
      ...(await main.getByRole('term').all()),
      ...(await main.getByRole('definition').all()),
      main.getByRole('img', { name: 'Musée des Arts du Temps', exact: true }),
      main.getByRole('img', { name: 'Balancier & Associés', exact: true }),
      main.getByText('Laiton · Acier · Verre', { exact: true }),
    ];
    const boxes = [];
    for (const fact of facts) boxes.push((await fact.boundingBox())!);
    const extent = {
      left: Math.min(...boxes.map((box) => box.x)),
      right: Math.max(...boxes.map((box) => box.x + box.width)),
      top: Math.min(...boxes.map((box) => box.y)),
      bottom: Math.max(...boxes.map((box) => box.y + box.height)),
    };
    const firstFact = boxes.reduce((topmost, box) => (box.y < topmost.y ? box : topmost));
    const firstFactBottom = firstFact.y + firstFact.height;
    const body = (await main.getByRole('heading', { level: 2, name: 'Le besoin', exact: true }).boundingBox())!;
    return { facts: extent, firstFactBottom, body };
  }

  /* On mobile projects, the device's own screen counts as a phone too. */
  const phones = isMobile ? [page.viewportSize()!, PHONE] : [PHONE];
  for (const viewport of phones) {
    const { width } = viewport;
    await page.setViewportSize(viewport);
    await page.goto(url);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect.soft(pageWidth, `at ${width} px, width of the page content`).toBeLessThanOrEqual(width);
    const { facts, body } = await factsAndBody();
    expect.soft(facts.bottom, `at ${width} px, facts above the body`).toBeLessThanOrEqual(body.y + 1);
  }

  await page.setViewportSize(DESKTOP);
  await page.goto(url);
  const { facts, firstFactBottom, body } = await factsAndBody();
  expect.soft(facts.right, 'at 1280 px, facts column to the left of the body').toBeLessThanOrEqual(body.x + 1);
  /* Tops aligned: the first fact and the body's first heading face each other, each starting
     above the other's bottom. */
  expect
    .soft(facts.top, 'at 1280 px, top of the facts above the bottom of the body’s first heading')
    .toBeLessThan(body.y + body.height);
  expect
    .soft(body.y, 'at 1280 px, top of the body’s first heading above the bottom of the first fact')
    .toBeLessThan(firstFactBottom);
});

test('after its body, a project page shows a link back to the projects list of its language and a "Discuter d’un projet similaire" link (English: "Discuss a similar project") to the contact section of the page', async ({
  page,
}) => {
  /* The example site's horloge-astronomique ends its body with a capture. The links' arrows may be
     decorative: each name is the words alone, or the words with their arrow. The second link must
     lead to the #contact fragment of the page itself, where its contact section sits. */
  for (const { url, backName, discussName, href, lastCapture } of [
    {
      url: '/fr/projets/horloge-astronomique/',
      backName: /^(←\s*)?Tous les projets$/,
      discussName: /^Discuter d['’]un projet similaire(\s*→)?$/,
      href: '/fr/projets/',
      lastCapture: 'Rouages de l’équation du temps, vus de dos, la came en avant-plan',
    },
    {
      url: '/en/projects/horloge-astronomique/',
      backName: /^(←\s*)?All projects$/,
      discussName: /^Discuss a similar project(\s*→)?$/,
      href: '/en/projects/',
      lastCapture: 'The equation-of-time gearing, seen from the back, the cam in the foreground',
    },
  ]) {
    await page.goto(url);
    const main = page.getByRole('main');
    const capture = await main.getByRole('img', { name: lastCapture, exact: true }).elementHandle();
    const comesAfterBody = (link: Element, image: Element | null) =>
      (image!.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    /* The page already opens with a link back to the projects list: this one is the last. */
    const backLink = main.getByRole('link', { name: backName }).last();
    await backLink.scrollIntoViewIfNeeded();
    await expect(backLink, `back link after the body on ${url}`).toBeVisible();
    await expect(backLink, `back link after the body on ${url}`).toHaveAttribute('href', href);
    expect(await backLink.evaluate(comesAfterBody, capture), `back link after the body on ${url}`).toBe(true);

    const discussLink = main.getByRole('link', { name: discussName });
    await expect(discussLink, `contact link on ${url}`).toHaveCount(1);
    await discussLink.scrollIntoViewIfNeeded();
    await expect(discussLink, `contact link on ${url}`).toBeVisible();
    const target = await discussLink.evaluate((link) => (link as HTMLAnchorElement).href);
    expect(target, `contact link target on ${url}`).toBe(new URL('#contact', page.url()).href);
    expect(await discussLink.evaluate(comesAfterBody, capture), `contact link after the body on ${url}`).toBe(true);
  }
});

test.describe('project page in a browser without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  /* The example site's horloge-astronomique, in each language: what its page shows (its title,
     description and role, the first heading and paragraph of its body), the contact intro of the
     home page of its language and of the other one, and the name of its "Discuss a similar
     project" link. */
  const astronomicalClock = PROJECTS[0];
  const ASTRONOMICAL_CLOCK_PAGES = [
    {
      url: '/fr/projets/horloge-astronomique/',
      lang: 'fr',
      title: astronomicalClock.frenchTitle,
      description: astronomicalClock.frenchDescription,
      role: astronomicalClock.frenchRole,
      bodyHeading: 'Le besoin',
      bodyParagraph:
        'Le musée voulait une horloge qui raconte le ciel de l’atelier, lisible par un visiteur pressé comme par un astronome.',
      intro: 'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.',
      otherIntro: 'Available for new restorations, at the workshop or at your home. Let us talk about your clock.',
      discussName: /^Discuter d['’]un projet similaire(\s*→)?$/,
    },
    {
      url: '/en/projects/horloge-astronomique/',
      lang: 'en',
      title: astronomicalClock.englishTitle,
      description: astronomicalClock.englishDescription,
      role: astronomicalClock.englishRole,
      bodyHeading: 'The need',
      bodyParagraph:
        'The museum wanted a clock that tells the sky above the workshop, readable by a hurried visitor as well as by an astronomer.',
      intro: 'Available for new restorations, at the workshop or at your home. Let us talk about your clock.',
      otherIntro: 'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.',
      discussName: /^Discuss a similar project(\s*→)?$/,
    },
  ];

  test('a project page ends with the contact section of the home page of its language: after the "Discuter d’un projet similaire" link, the intro that home page declares, above a form that posts the email, the message and the page’s language to the address the site’s contactAction param gives', async ({
    page,
    baseURL,
  }) => {
    /* The example site's home pages declare their contact intro in content/_index.md and
       content/_index.en.md ([params.contact] table, intro key); exampleSite/hugo.toml gives the
       form the address /api/contact. No endpoint answers on the test servers: the post gets a page
       here, so that the browser has somewhere to land. */
    const contactAction = '/api/contact';
    await page.route(`**${contactAction}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' }),
    );
    for (const { url, lang, intro, otherIntro, discussName } of ASTRONOMICAL_CLOCK_PAGES) {
      await page.goto(url);
      const main = page.getByRole('main');
      /* The contact section, a region named by its title, as on the home page. */
      const section = main.getByRole('region', { name: 'Contact', exact: true });
      await expect(section, `contact section on ${url}`).toHaveCount(1);

      /* It ends the page: after the "Discuss a similar project" link, and nothing of the main
         content shows after it. */
      const discussLink = await main.getByRole('link', { name: discussName }).elementHandle();
      const place = await section.evaluate((contact, link) => {
        const mainElement = contact.closest('main')!;
        const walker = document.createTreeWalker(mainElement, NodeFilter.SHOW_TEXT);
        const textAfter: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const isAfter =
            !contact.contains(node) && (contact.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
          if (isAfter && node.textContent!.trim() !== '') textAfter.push(node.textContent!.trim());
        }
        return {
          afterDiscussLink: (link!.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          textAfter,
        };
      }, discussLink);
      expect(place.afterDiscussLink, `contact section after the contact link on ${url}`).toBe(true);
      expect(place.textAfter, `text of the main content after the contact section on ${url}`).toEqual([]);

      /* The intro of the home page of the page's language, not the other language's, above the form. */
      const introText = section.getByText(intro, { exact: true });
      await introText.scrollIntoViewIfNeeded();
      await expect(introText, `contact intro on ${url}`).toBeVisible();
      await expect(section.getByText(otherIntro), `the other language's intro on ${url}`).toHaveCount(0);
      const form = section.getByRole('form');
      await expect(form, `contact form on ${url}`).toBeVisible();
      const introBox = (await introText.boundingBox())!;
      const formBox = (await form.boundingBox())!;
      expect(introBox.y + introBox.height, `contact intro above the form on ${url}`).toBeLessThanOrEqual(formBox.y + 1);

      /* Sent as a visitor would: the email and the message, with the page's language, posted to the
         contactAction address. */
      await form.locator('[name="email"]').fill('marie.horloge@exemple.fr');
      await form.locator('[name="message"]').fill('Bonjour, ma pendule de cheminée retarde de dix minutes par jour.');
      const [request] = await Promise.all([
        page.waitForRequest((sent) => sent.method() === 'POST'),
        form.getByRole('button').click(),
      ]);
      expect(request.url(), `the address the form posts to from ${url}`).toBe(new URL(contactAction, baseURL).href);
      const body = Object.fromEntries(new URLSearchParams(request.postData() ?? ''));
      expect(body, `the data sent from ${url}`).toEqual(
        expect.objectContaining({
          email: 'marie.horloge@exemple.fr',
          message: 'Bonjour, ma pendule de cheminée retarde de dix minutes par jour.',
          lang,
        }),
      );
    }
  });

  test('without JavaScript, a project page shows its title, its description, its facts, its body and the contact form, in its language', async ({
    page,
  }) => {
    /* The role is one of the page's facts, and its body opens on a level-2 heading and a paragraph.
       Each element is scrolled to, then must be visible: nothing may wait for a script to show it. */
    for (const { url, title, description, role, bodyHeading, bodyParagraph } of ASTRONOMICAL_CLOCK_PAGES) {
      await page.goto(url);
      const main = page.getByRole('main');
      const shown = [
        { what: 'title', element: main.getByRole('heading', { level: 1 }) },
        { what: 'description', element: main.getByText(description, { exact: true }) },
        { what: 'role', element: main.getByRole('definition').filter({ hasText: role }) },
        { what: 'body heading', element: main.getByRole('heading', { level: 2, name: bodyHeading, exact: true }) },
        { what: 'body paragraph', element: main.getByText(bodyParagraph, { exact: true }) },
        { what: 'contact form', element: main.getByRole('form') },
        { what: 'email field', element: main.getByRole('form').locator('[name="email"]') },
        { what: 'message field', element: main.getByRole('form').locator('[name="message"]') },
        { what: 'send button', element: main.getByRole('form').getByRole('button') },
      ];
      await expect(shown[0].element, `title on ${url}`).toHaveText(title);
      for (const { what, element } of shown) {
        await expect(element, `${what} on ${url}`).toHaveCount(1);
        await element.scrollIntoViewIfNeeded();
        await expect(element, `${what} on ${url}`).toBeVisible();
      }
    }
  });
});

test('a project page whose contactIntro param is set shows it as the contact intro, in its language, instead of the intro of the home page', async ({
  page,
}) => {
  /* The example site's regulateur-noyer sets contactIntro in its French and English front matter,
     each in its own language; horloge-astronomique sets none, and the test above checks it keeps
     the home page's intro. */
  const homeIntros = [
    'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.',
    'Available for new restorations, at the workshop or at your home. Let us talk about your clock.',
  ];
  const projectIntros = [
    'Une caisse de régulateur à restaurer ou à sculpter ? L’atelier travaille le noyer comme le mouvement.',
    'A regulator case to restore or to carve? The workshop works the walnut as well as the movement.',
  ];
  for (const { url, intro } of [
    { url: '/fr/projets/regulateur-noyer/', intro: projectIntros[0] },
    { url: '/en/projects/regulateur-noyer/', intro: projectIntros[1] },
  ]) {
    await page.goto(url);
    const section = page.getByRole('main').getByRole('region', { name: 'Contact', exact: true });
    await expect(section, `contact section on ${url}`).toHaveCount(1);
    await expect(section.getByText(intro, { exact: true }), `the page's contact intro on ${url}`).toBeVisible();
    for (const other of [...homeIntros, ...projectIntros].filter((text) => text !== intro)) {
      await expect(section.getByText(other), `another intro on ${url}`).toHaveCount(0);
    }
  }
});

test('the contact section of a project page is titled by a level-2 heading, like the sections of its body, so that the page’s headings skip no level', async ({
  page,
}) => {
  /* The example site's horloge-astronomique has level-2 section headings in its body;
     regulateur-noyer has none, so that its contact heading directly follows its level-1 title. The
     section is found as on the home page: a region named by its title. */
  for (const project of PROJECTS) {
    for (const url of [`/fr/projets/${project.slug}/`, `/en/projects/${project.slug}/`]) {
      await page.goto(url);
      const main = page.getByRole('main');
      const section = main.getByRole('region', { name: 'Contact', exact: true });
      await expect(section, `contact section on ${url}`).toHaveCount(1);

      /* The section's only heading, its title, is a level-2 one. */
      await expect(section.getByRole('heading'), `headings of the contact section on ${url}`).toHaveCount(1);
      await expect(
        section.getByRole('heading', { level: 2 }),
        `level-2 title of the contact section on ${url}`,
      ).toHaveCount(1);

      /* In reading order, no heading of the main content goes more than one level deeper than the
         one before it. */
      const levels = await main.evaluate((element) =>
        Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).map((heading) => {
          const ariaLevel = heading.getAttribute('aria-level');
          return ariaLevel ? Number(ariaLevel) : Number(heading.tagName.slice(1));
        }),
      );
      for (let index = 1; index < levels.length; index++) {
        expect(
          levels[index],
          `heading ${index + 1} on ${url}, after a level-${levels[index - 1]} one (levels: ${levels.join(', ')})`,
        ).toBeLessThanOrEqual(levels[index - 1] + 1);
      }
    }
  }
});

test.describe('project pages of another site, whose home pages declare no contact intro', () => {
  test('when the home page of its language declares no contact intro, a project page shows neither the contact section nor the "Discuter d’un projet similaire" link (English: "Discuss a similar project"), even when it sets its own contactIntro param, and keeps its links back to the projects list', async ({
    page,
    context,
  }) => {
    /* SITE_WITH_HOME_PAGES_WITHOUT_CONTACT_INTRO: the French home page has no contact params, the
       English one contact params without an intro. horloge-astronomique sets no contactIntro;
       regulateur-noyer sets one in each language, which must not bring the section back. */
    const site = SITE_WITH_HOME_PAGES_WITHOUT_CONTACT_INTRO;
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      for (const { path: address, backName, discussName } of [
        ...['horloge-astronomique', 'regulateur-noyer'].map((slug) => ({
          path: `/fr/projets/${slug}/`,
          backName: /^(←\s*)?Tous les projets$/,
          discussName: /^Discuter d['’]un projet similaire(\s*→)?$/,
        })),
        ...['horloge-astronomique', 'regulateur-noyer'].map((slug) => ({
          path: `/en/projects/${slug}/`,
          backName: /^(←\s*)?All projects$/,
          discussName: /^Discuss a similar project(\s*→)?$/,
        })),
      ]) {
        const url = `${site.origin}${address}`;
        const response = await page.goto(url);
        expect(response?.status(), url).toBe(200);
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 1 }), `main heading on ${url}`).toBeVisible();
        /* The page still opens and ends with its links back to the projects list… */
        await expect(main.getByRole('link', { name: backName }), `back links on ${url}`).toHaveCount(2);
        /* …but offers no contact: no section, no form, no link to a #contact that would lead nowhere. */
        await expect(
          main.getByRole('region', { name: 'Contact', exact: true }),
          `contact section on ${url}`,
        ).toHaveCount(0);
        await expect(page.locator('#contact'), `#contact anchor on ${url}`).toHaveCount(0);
        await expect(main.getByRole('form'), `contact form on ${url}`).toHaveCount(0);
        await expect(main.getByRole('link', { name: discussName }), `contact link on ${url}`).toHaveCount(0);
      }
    } finally {
      removeDirectory(siteDirectory);
    }
  });
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
        const backLink = page.getByRole('main').getByRole('link', { name }).first();
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
      const backLink = page
        .getByRole('main')
        .getByRole('link', { name: /^(←\s*)?Tous les projets$/ })
        .first();
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

test.describe('pages of another site, whose projects list Hugo does not publish', () => {
  test('when the projects list is not published ([build] render = "never" or "link"), a project page shows no link back to the projects list, neither above its title nor after its body', async ({
    page,
    context,
  }) => {
    /* In tests/fixtures/unwritten-projects-list/content/projects/, the French list declares
       render = 'never' (no address at all) and the English one render = 'link' (an address, but
       nothing written there). The example site's projects still sit directly in projects/, with
       their pages: a link back to the list would lead nowhere, or to a missing page. */
    const site = SITE_WITH_A_SUBSECTION_OF_AN_UNWRITTEN_PROJECTS_LIST;
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      for (const project of PROJECTS) {
        for (const { url, title, backName } of [
          {
            url: `${site.origin}/fr/projets/${project.slug}/`,
            title: project.frenchTitle,
            backName: /^(←\s*)?Tous les projets$/,
          },
          {
            url: `${site.origin}/en/projects/${project.slug}/`,
            title: project.englishTitle,
            backName: /^(←\s*)?All projects$/,
          },
        ]) {
          const response = await page.goto(url);
          expect(response?.status(), url).toBe(200);
          const main = page.getByRole('main');
          await expect(main.getByRole('heading', { level: 1 }), `main heading on ${url}`).toHaveText(title);
          await expect(main.getByRole('link', { name: backName }), `back links on ${url}`).toHaveCount(0);
        }
      }
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
