import { test, expect } from '@playwright/test';

test('le texte courant est en IBM Plex Sans, police réellement chargée depuis le site lui-même et jamais depuis un autre domaine', async ({ page, baseURL }) => {
  const policesDemandees: string[] = [];
  const policesRecues: string[] = [];
  const estUnePolice = (resourceType: string, url: string) =>
    resourceType === 'font' || /\.(woff2?|ttf|otf)(\?|#|$)/i.test(url);
  page.on('request', (request) => {
    if (estUnePolice(request.resourceType(), request.url())) policesDemandees.push(request.url());
  });
  page.on('response', (response) => {
    const request = response.request();
    if (response.ok() && estUnePolice(request.resourceType(), response.url())) policesRecues.push(response.url());
  });

  await page.goto('/');
  const origine = new URL(page.url()).origin;
  expect(origine).toBe(new URL(baseURL!).origin);

  const familleDuTexte = await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily);
  expect(familleDuTexte.split(',')[0].trim().replace(/["']/g, '')).toBe('IBM Plex Sans');

  const policesChargees = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/["']/g, ''));
  });
  expect(policesChargees).toContain('IBM Plex Sans');

  await expect
    .poll(() => policesRecues.filter((url) => new URL(url).origin === origine).length)
    .toBeGreaterThan(0);
  expect(policesDemandees.filter((url) => new URL(url).origin !== origine)).toEqual([]);
});

test('le texte de l’en-tête (logo et liens de navigation) est en IBM Plex Mono, police réellement chargée depuis le site lui-même', async ({ page, baseURL }) => {
  const policesDemandees: string[] = [];
  const policesRecues = new Set<string>();
  const estUnePolice = (resourceType: string, url: string) =>
    resourceType === 'font' || /\.(woff2?|ttf|otf)(\?|#|$)/i.test(url);
  page.on('request', (request) => {
    if (estUnePolice(request.resourceType(), request.url())) policesDemandees.push(request.url());
  });
  page.on('response', (response) => {
    const request = response.request();
    if (response.ok() && estUnePolice(request.resourceType(), response.url())) policesRecues.add(response.url());
  });

  await page.goto('/');
  const origine = new URL(page.url()).origin;
  expect(origine).toBe(new URL(baseURL!).origin);

  const liens = page.locator('header').getByRole('link');
  await expect(liens).toHaveCount(4);
  for (const lien of await liens.all()) {
    const famille = await lien.evaluate((element) => getComputedStyle(element).fontFamily);
    expect(famille.split(',')[0].trim().replace(/["']/g, '')).toBe('IBM Plex Mono');
  }

  const policesChargees = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/["']/g, ''));
  });
  expect(policesChargees).toContain('IBM Plex Mono');

  // Sans (texte courant) et Mono (en-tête) : deux fichiers distincts, tous deux servis par le site.
  await expect
    .poll(() => [...policesRecues].filter((url) => new URL(url).origin === origine).length)
    .toBeGreaterThanOrEqual(2);
  expect(policesDemandees.filter((url) => new URL(url).origin !== origine)).toEqual([]);
});
