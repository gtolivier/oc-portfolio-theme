import { test, expect, type Locator, type Page } from '@playwright/test';
import { SITE_WITH_UNWRITTEN_HOME_PAGES, buildSite, removeDirectory, serveSite } from './helpers/built-site';

/* Addresses the example site has no page for, under each language. */
const FRENCH_UNKNOWN_ADDRESS = '/fr/page-qui-n-existe-pas/';
const ENGLISH_UNKNOWN_ADDRESS = '/en/page-that-does-not-exist/';

async function trimmedText(element: Locator): Promise<string> {
  return (await element.textContent())?.trim() ?? '';
}

/* Opens the French error page and reads its heading and message, for a test that compares another page with them. */
async function frenchErrorPageTexts(page: Page): Promise<{ heading: string; message: string }> {
  await page.goto(FRENCH_UNKNOWN_ADDRESS);
  const main = page.getByRole('main');
  return {
    heading: await trimmedText(main.getByRole('heading', { level: 1 })),
    message: await trimmedText(main.getByRole('paragraph').first()),
  };
}

test('an unknown address under /fr/ answers with a 404 status and the theme’s French error page: the site’s header and footer around a heading and a message', async ({
  page,
}) => {
  const response = await page.goto(FRENCH_UNKNOWN_ADDRESS);
  expect(response?.status()).toBe(404);
  /* A page of the French site, not Hugo's own "Page Not Found" page. */
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* The French site's header: its logo leads to the French home page. */
  await expect(page.locator('header').getByRole('link', { name: 'Exemple', exact: true })).toHaveAttribute(
    'href',
    '/fr/',
  );
  /* The French site's footer, with its French note. */
  await expect(page.locator('footer').getByText('Horloger de démonstration', { exact: true })).toBeVisible();
  /* Between them, a heading and a message. */
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(main.getByRole('paragraph').first()).not.toHaveText('');
});

test('an unknown address with no language prefix answers with a 404 status and the French error page, the default language’s: the same heading and message as under /fr/, the page in French', async ({
  page,
}) => {
  /* The French error page's heading and message, which this page must show. */
  const { heading: frenchHeading, message: frenchMessage } = await frenchErrorPageTexts(page);
  expect(frenchHeading).not.toBe('');
  expect(frenchMessage).not.toBe('');

  const response = await page.goto('/page-qui-n-existe-pas/');
  expect(response?.status()).toBe(404);
  /* A page of the French site, not Hugo's own "Page Not Found" page. */
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
  /* The French error page's heading and message. */
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(frenchHeading);
  await expect(main.getByRole('paragraph').first()).toHaveText(frenchMessage);
});

test('an unknown address under /en/ answers with a 404 status and the English error page: its heading and message in English, the page in English', async ({
  page,
}) => {
  /* The French error page's heading and message, which the English page must not show. */
  const { heading: frenchHeading, message: frenchMessage } = await frenchErrorPageTexts(page);
  expect(frenchHeading).not.toBe('');
  expect(frenchMessage).not.toBe('');

  const response = await page.goto(ENGLISH_UNKNOWN_ADDRESS);
  expect(response?.status()).toBe(404);
  /* A page of the English site. */
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  /* Its heading and message, translated: present, and not the French ones. */
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(main.getByRole('heading', { level: 1 })).not.toHaveText(frenchHeading);
  await expect(main.getByRole('paragraph').first()).not.toHaveText('');
  await expect(main.getByRole('paragraph').first()).not.toHaveText(frenchMessage);
});

test('the error page’s title in the browser tab is its heading, in its own language, followed by the site’s name, in French and in English', async ({
  page,
}) => {
  /* The site's name, the example site's title, which the header's logo also shows. */
  const siteName = 'Exemple';
  const headings: string[] = [];
  for (const url of [FRENCH_UNKNOWN_ADDRESS, ENGLISH_UNKNOWN_ADDRESS]) {
    await page.goto(url);
    const heading = await trimmedText(page.getByRole('main').getByRole('heading', { level: 1 }));
    expect(heading, `heading on ${url}`).not.toBe('');
    headings.push(heading);
    /* The same separator as the other pages: "<page title> | <site title>". */
    await expect(page, `tab title on ${url}`).toHaveTitle(`${heading} | ${siteName}`);
  }
  /* Two languages, two titles: a single hard-coded title cannot pass. */
  expect(headings[1]).not.toBe(headings[0]);
});

test('the error page’s main content links back to the home page of its own language: /fr/ from the French page, /en/ from the English one', async ({
  page,
  baseURL,
}) => {
  for (const [url, home, lang] of [
    [FRENCH_UNKNOWN_ADDRESS, '/fr/', 'fr-FR'],
    [ENGLISH_UNKNOWN_ADDRESS, '/en/', 'en-US'],
  ]) {
    await page.goto(url);
    /* In the page's main content, not the header's logo or menu nor the footer's home link. */
    const homeLink = page.getByRole('main').getByRole('link');
    await expect(homeLink, `link in the main content of ${url}`).toHaveCount(1);
    /* Followed, it leads to the home page of the error page's language. */
    await homeLink.click();
    await expect(page, `home page reached from ${url}`).toHaveURL(new URL(home, baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
});

test('on the error page, the header language switcher leads to the other language’s home page: /en/ from the French page, /fr/ from the English one', async ({
  page,
  baseURL,
}) => {
  for (const [url, otherHome, otherLang] of [
    [FRENCH_UNKNOWN_ADDRESS, '/en/', 'en-US'],
    [ENGLISH_UNKNOWN_ADDRESS, '/fr/', 'fr-FR'],
  ]) {
    await page.goto(url);
    /* The header's language switcher: its only link is the other language's entry. */
    const otherLanguageLink = page.locator('header').getByRole('group').getByRole('link');
    await expect(otherLanguageLink, `language switch link on ${url}`).toHaveCount(1);
    /* Followed, it leads to the other language's home page, not to its error page. */
    await otherLanguageLink.click();
    await expect(page, `page reached from the language switcher of ${url}`).toHaveURL(new URL(otherHome, baseURL).href);
    await expect(page.locator('html')).toHaveAttribute('lang', otherLang);
  }
});

test('the error pages, opened at /fr/404.html and /en/404.html, ask search engines not to index them (meta robots noindex)', async ({
  page,
  request,
}) => {
  for (const url of ['/fr/404.html', '/en/404.html']) {
    /* What a crawler reads: the document served at the error page's own address, parsed without being run. */
    const response = await request.get(url);
    expect(response.ok(), `the response for ${url}`).toBe(true);
    const html = await response.text();
    const robots = await page.evaluate((source) => {
      const document = new DOMParser().parseFromString(source, 'text/html');
      return Array.from(
        document.querySelectorAll('head meta[name="robots" i]'),
        (meta) => meta.getAttribute('content') ?? '',
      );
    }, html);
    expect(
      robots.some((content) =>
        content
          .split(',')
          .map((directive) => directive.trim().toLowerCase())
          .includes('noindex'),
      ),
      `the robots directives of the document served at ${url}: ${JSON.stringify(robots)}`,
    ).toBe(true);
  }
});

test.describe('site whose home pages are not written', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_UNWRITTEN_HOME_PAGES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test("when a language's home page is not written (render = 'never' or 'link'), its error page has no link back to it in its main content, as the footer has none", async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_UNWRITTEN_HOME_PAGES, siteDirectory);
    for (const url of ['/fr/404.html', '/en/404.html']) {
      const response = await page.goto(`${SITE_WITH_UNWRITTEN_HOME_PAGES.origin}${url}`);
      expect(response?.ok(), `the response for ${url}`).toBe(true);
      const main = page.getByRole('main');
      /* The error page is displayed, its heading in its main content… */
      await expect(main.getByRole('heading', { level: 1 }), `heading on ${url}`).toBeVisible();
      await expect(main.getByRole('heading', { level: 1 }), `heading on ${url}`).not.toHaveText('');
      /* …without a link to the home page, which does not exist. */
      await expect(main.getByRole('link'), `link in the main content of ${url}`).toHaveCount(0);
    }
  });
});
