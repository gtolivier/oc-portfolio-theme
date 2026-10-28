import { test, expect, type Page } from '@playwright/test';

/* The clients the example site's home pages declare, in their order (proper names, the same in every language). */
const CLIENTS = [
  'Bijouterie Valmont',
  'Antiquités Roussel',
  'Château de Mirevent',
  'Galerie Aubertin',
  'Maison Delorme',
];

/* Checks that the page exposes the declared clients once each, in order, as the list named `name`. */
async function expectClientList(page: Page, name: string) {
  /* "/children: equal" makes the match exact: a missing, extra or repeated client fails it. */
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - list "${name}":
      ${CLIENTS.map((client) => `- listitem: ${client}`).join('\n      ')}
      - /children: equal
  `);
  /* The copy of the list that makes the band loop stays hidden: each name is exposed once on the page. */
  const accessibilityTree = await page.locator('body').ariaSnapshot();
  for (const client of CLIENTS) {
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
