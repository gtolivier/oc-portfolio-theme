import { test, expect, type Page } from '@playwright/test';
import { EXAMPLE_SITE_UNDER_PORTFOLIO } from './helpers/built-site';

function isAFont(resourceType: string, url: string): boolean {
  return resourceType === 'font' || /\.(woff2?|ttf|otf)(\?|#|$)/i.test(url);
}

/* Families of the fonts the browser actually loaded. */
async function loadedFamilies(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/["']/g, ''));
  });
}

/* Weights of the IBM Plex Mono faces the browser actually loaded. */
async function loadedMonoWeights(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded' && face.family.replace(/["']/g, '') === 'IBM Plex Mono')
      .map((face) => face.weight);
  });
}

test('body text is in IBM Plex Sans and the header text (logo and navigation) in IBM Plex Mono, fonts actually loaded from the site itself and never from another domain', async ({
  page,
  baseURL,
}) => {
  const requestedFonts: string[] = [];
  const receivedFonts: string[] = [];
  page.on('request', (request) => {
    if (isAFont(request.resourceType(), request.url())) requestedFonts.push(request.url());
  });
  page.on('response', (response) => {
    const request = response.request();
    if (response.ok() && isAFont(request.resourceType(), response.url())) receivedFonts.push(response.url());
  });

  await page.goto('/fr/');
  const origin = new URL(page.url()).origin;
  expect(origin).toBe(new URL(baseURL!).origin);

  const textFamily = await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily);
  expect(textFamily.split(',')[0].trim().replace(/["']/g, '')).toBe('IBM Plex Sans');

  /* The logo and the navigation links, without the language switch link. */
  const headerLinks = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true })
    .or(page.locator('header nav').getByRole('link'));
  await expect(headerLinks).toHaveCount(4);
  const headerFamilies = await headerLinks.evaluateAll((links) =>
    links.map((link) => getComputedStyle(link).fontFamily.split(',')[0].trim().replace(/["']/g, '')),
  );
  expect(headerFamilies).toEqual(['IBM Plex Mono', 'IBM Plex Mono', 'IBM Plex Mono', 'IBM Plex Mono']);

  const loadedFonts = await loadedFamilies(page);
  expect(loadedFonts).toContain('IBM Plex Sans');
  expect(loadedFonts).toContain('IBM Plex Mono');

  await expect
    .poll(() => receivedFonts.filter((url) => /sans/i.test(url) && new URL(url).origin === origin).length)
    .toBeGreaterThan(0);
  await expect
    .poll(() => receivedFonts.filter((url) => /mono/i.test(url) && new URL(url).origin === origin).length)
    .toBeGreaterThan(0);
  expect(requestedFonts.filter((url) => new URL(url).origin !== origin)).toEqual([]);
});

test('served under a subpath (baseURL /portfolio/), the site still loads its IBM Plex Sans and IBM Plex Mono fonts, with no font file not found', async ({
  page,
}) => {
  const failedFonts: string[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (!response.ok() && isAFont(request.resourceType(), response.url())) {
      failedFonts.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`${EXAMPLE_SITE_UNDER_PORTFOLIO}fr/`);

  const loadedFonts = await loadedFamilies(page);
  expect(failedFonts).toEqual([]);
  expect(loadedFonts).toEqual(expect.arrayContaining(['IBM Plex Sans', 'IBM Plex Mono']));
});

test('the page title (IBM Plex Mono bold, 700) and the header language switcher (IBM Plex Mono semibold, 600) use weights actually loaded from the site, not synthesized or replaced by the browser', async ({
  page,
}) => {
  await page.goto('/fr/projets/');

  const title = page.locator('h1');
  await expect(title).toHaveText('Projets');
  const titleStyle = await title.evaluate((h1) => {
    const style = getComputedStyle(h1);
    return {
      family: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
      weight: style.fontWeight,
    };
  });
  expect(titleStyle).toEqual({ family: 'IBM Plex Mono', weight: '700' });
  expect(await loadedMonoWeights(page)).toContain('700');

  await page.goto('/fr/');

  const group = page.locator('header').getByRole('group', { name: 'Langue', exact: true });
  const entries = group.getByText('FR', { exact: true }).or(group.getByRole('link', { name: 'EN', exact: true }));
  await expect(entries).toHaveCount(2);
  const styles = await entries.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
        weight: style.fontWeight,
      };
    }),
  );
  const expected = { family: 'IBM Plex Mono', weight: '600' };
  expect(styles).toEqual([expected, expected]);
  expect(await loadedMonoWeights(page)).toContain('600');
});
