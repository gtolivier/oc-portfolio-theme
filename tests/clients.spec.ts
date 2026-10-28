import { test, expect, type Page } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_OTHER_CLIENTS,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';

/* The clients the example site's home pages declare, in their order (proper names, the same in every language). */
const CLIENTS = [
  'Bijouterie Valmont',
  'Antiquités Roussel',
  'Château de Mirevent',
  'Galerie Aubertin',
  'Maison Delorme',
];

/* Checks that the page exposes the declared clients once each, in order, as the list named `name`. */
async function expectClientList(page: Page, name: string, clients: string[] = CLIENTS) {
  /* "/children: equal" makes the match exact: a missing, extra or repeated client fails it. */
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list "${name}":
      ${clients.map((client) => `- listitem: ${client}`).join('\n      ')}
      - /children: equal
  `);
  /* The copy of the list that makes the band loop stays hidden: each name is exposed once on the page. */
  const accessibilityTree = await page.locator('body').ariaSnapshot();
  for (const client of clients) {
    expect(accessibilityTree.split(client).length - 1, `"${client}" exposed once`).toBe(1);
  }
}

test('on the French home page, assistive technologies get the declared clients once each, in order, as the list "Ils me font confiance"', async ({ page }) => {
  await page.goto('/fr/');
  await expectClientList(page, 'Ils me font confiance');
});

test('on the English home page, assistive technologies get the same clients once each, in order, as the list "Trusted by"', async ({ page }) => {
  await page.goto('/en/');
  await expectClientList(page, 'Trusted by');
});

test.describe('home page of another site, with other clients', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_OTHER_CLIENTS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the list "Ils me font confiance" holds this site’s clients once each, in its order, and none of the example site’s', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_CLIENTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_CLIENTS.origin}/fr/`);
    /* Declared in tests/fixtures/other-clients/content/_index.md, in an order that is not alphabetical. */
    await expectClientList(page, 'Ils me font confiance', [
      'Reliure Marchetti',
      'Atelier Bonnefoy',
      'Librairie Castagne',
    ]);
  });
});

test.describe('home page of another site, without clients', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITHOUT_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a home page whose front matter declares no clients shows no client band: no list "Ils me font confiance", no such label, no empty list', async ({ page, context }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    await page.goto(`${SITE_WITHOUT_HERO.origin}/fr/`);
    /* tests/fixtures/without-hero/content/_index.md declares no clients: its text is displayed… */
    const main = page.getByRole('main');
    await expect(main.getByText('Accueil fictif sans hero')).toBeVisible();
    /* …with no band of clients, named or not, even empty, and none of the example site's clients. */
    await expect(page.getByRole('list', { name: 'Ils me font confiance' })).toHaveCount(0);
    await expect(page.getByText('Ils me font confiance')).toHaveCount(0);
    await expect(main.getByRole('list')).toHaveCount(0);
    for (const client of CLIENTS) {
      await expect(page.getByText(client)).toHaveCount(0);
    }
  });
});
