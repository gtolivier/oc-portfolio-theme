import { test, expect, type Page } from '@playwright/test';

function estUnePolice(resourceType: string, url: string): boolean {
  return resourceType === 'font' || /\.(woff2?|ttf|otf)(\?|#|$)/i.test(url);
}

/* Familles des polices que le navigateur a effectivement chargées. */
async function famillesChargees(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/["']/g, ''));
  });
}

test('le texte courant est en IBM Plex Sans, police réellement chargée depuis le site lui-même et jamais depuis un autre domaine', async ({ page, baseURL }) => {
  const policesDemandees: string[] = [];
  const policesRecues: string[] = [];
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

  const policesChargees = await famillesChargees(page);
  expect(policesChargees).toContain('IBM Plex Sans');

  await expect
    .poll(() => policesRecues.filter((url) => new URL(url).origin === origine).length)
    .toBeGreaterThan(0);
  expect(policesDemandees.filter((url) => new URL(url).origin !== origine)).toEqual([]);
});

test('le texte de l’en-tête (logo et navigation) est en IBM Plex Mono, police réellement chargée depuis le site lui-même', async ({ page }) => {
  const policesMonoRecues: string[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (response.ok() && estUnePolice(request.resourceType(), response.url()) && /mono/i.test(response.url())) {
      policesMonoRecues.push(response.url());
    }
  });

  await page.goto('/');
  const origine = new URL(page.url()).origin;

  const liensDeLEnTete = page.locator('header a');
  await expect(liensDeLEnTete).toHaveCount(4);
  const famillesDeLEnTete = await liensDeLEnTete.evaluateAll((liens) =>
    liens.map((lien) => getComputedStyle(lien).fontFamily.split(',')[0].trim().replace(/["']/g, '')),
  );
  expect(famillesDeLEnTete).toEqual(['IBM Plex Mono', 'IBM Plex Mono', 'IBM Plex Mono', 'IBM Plex Mono']);

  const policesChargees = await famillesChargees(page);
  expect(policesChargees).toContain('IBM Plex Mono');

  await expect
    .poll(() => policesMonoRecues.filter((url) => new URL(url).origin === origine).length)
    .toBeGreaterThan(0);
});

test('servi sous un sous-chemin (baseURL /portfolio/), le site charge quand même ses polices IBM Plex Sans et IBM Plex Mono, sans fichier de police introuvable', async ({ page }) => {
  const policesEnEchec: string[] = [];
  page.on('response', (response) => {
    const request = response.request();
    if (!response.ok() && estUnePolice(request.resourceType(), response.url())) {
      policesEnEchec.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('http://localhost:1315/portfolio/');

  const policesChargees = await famillesChargees(page);
  expect(policesEnEchec).toEqual([]);
  expect(policesChargees).toEqual(expect.arrayContaining(['IBM Plex Sans', 'IBM Plex Mono']));
});

test('le titre de la page est en IBM Plex Mono grasse (700), graisse réellement chargée depuis le site et non simulée par le navigateur', async ({ page }) => {
  await page.goto('/projets/');

  const titre = page.locator('h1');
  await expect(titre).toHaveText('Projets');
  const styleDuTitre = await titre.evaluate((h1) => {
    const style = getComputedStyle(h1);
    return {
      famille: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
      graisse: style.fontWeight,
    };
  });
  expect(styleDuTitre).toEqual({ famille: 'IBM Plex Mono', graisse: '700' });

  const policesMonoChargees = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded' && face.family.replace(/["']/g, '') === 'IBM Plex Mono')
      .map((face) => face.weight);
  });
  expect(policesMonoChargees).toContain('700');
});
