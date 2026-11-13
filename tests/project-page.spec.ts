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
