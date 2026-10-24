import { test, expect, type Page } from '@playwright/test';

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

test('body text is in IBM Plex Sans, a font actually loaded from the site itself and never from another domain', async ({ page, baseURL }) => {
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

  const loadedFonts = await loadedFamilies(page);
  expect(loadedFonts).toContain('IBM Plex Sans');

  await expect
    .poll(() => receivedFonts.filter((url) => new URL(url).origin === origin).length)
    .toBeGreaterThan(0);
  expect(requestedFonts.filter((url) => new URL(url).origin !== origin)).toEqual([]);
});

test('the header text (logo and navigation) is in IBM Plex Mono, a font actually loaded from the site itself', async ({ page }) => {
  const receivedMonoFonts: string[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (response.ok() && isAFont(request.resourceType(), response.url()) && /mono/i.test(response.url())) {
      receivedMonoFonts.push(response.url());
    }
  });

  await page.goto('/fr/');
  const origin = new URL(page.url()).origin;

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
  expect(loadedFonts).toContain('IBM Plex Mono');

  await expect
    .poll(() => receivedMonoFonts.filter((url) => new URL(url).origin === origin).length)
    .toBeGreaterThan(0);
});

test('served under a subpath (baseURL /portfolio/), the site still loads its IBM Plex Sans and IBM Plex Mono fonts, with no font file not found', async ({ page }) => {
  const failedFonts: string[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (!response.ok() && isAFont(request.resourceType(), response.url())) {
      failedFonts.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('http://localhost:1315/portfolio/fr/');

  const loadedFonts = await loadedFamilies(page);
  expect(failedFonts).toEqual([]);
  expect(loadedFonts).toEqual(expect.arrayContaining(['IBM Plex Sans', 'IBM Plex Mono']));
});

test('the page title is in IBM Plex Mono bold (700), a weight actually loaded from the site and not synthesized by the browser', async ({ page }) => {
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

  const loadedMonoWeights = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded' && face.family.replace(/["']/g, '') === 'IBM Plex Mono')
      .map((face) => face.weight);
  });
  expect(loadedMonoWeights).toContain('700');
});

test('the header language switcher is in IBM Plex Mono semibold (600), a weight actually loaded from the site and not replaced by bold (700)', async ({ page }) => {
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

  const loadedMonoWeights = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded' && face.family.replace(/["']/g, '') === 'IBM Plex Mono')
      .map((face) => face.weight);
  });
  expect(loadedMonoWeights).toContain('600');
});
