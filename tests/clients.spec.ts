import { test, expect, type Page } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_OTHER_CLIENTS,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';
import { textOnScreen } from './helpers/text-on-screen';

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

test('on the French home page, each client name is followed on screen by a "|||" separator that assistive technologies do not get', async ({ page }) => {
  await page.goto('/fr/');
  /* On screen, in reading order, each name is directly followed by its "|||" (textOnScreen drops whitespace). */
  const body = page.locator('body');
  await expect
    .poll(() => textOnScreen(body))
    .toContain(CLIENTS.map((client) => `${client.replace(/ /g, '')}|||`).join(''));
  /* The separator is decoration: the list still exposes the bare names, and no "|||" reaches assistive technologies. */
  await expectClientList(page, 'Ils me font confiance');
  expect(await body.ariaSnapshot()).not.toContain('|||');
});

test('on the French home page, the label "Ils me font confiance" is shown on screen just before the client names, and assistive technologies get it once, as the list’s name', async ({ page }) => {
  await page.goto('/fr/');
  /* On screen, in reading order, the label directly precedes the first name: nothing but
     punctuation or decoration between them (textOnScreen drops whitespace). */
  const body = page.locator('body');
  await expect
    .poll(() => textOnScreen(body))
    .toMatch(new RegExp(`Ilsmefontconfiance[^\\p{L}\\p{N}]*${CLIENTS[0].replace(/ /g, '')}`, 'u'));
  /* Assistive technologies still get the label as the list's name, and only there: it is not
     announced a second time as separate content. */
  await expectClientList(page, 'Ils me font confiance');
  const accessibilityTree = await body.ariaSnapshot();
  expect(accessibilityTree.split('Ils me font confiance').length - 1, '"Ils me font confiance" exposed once').toBe(1);
});

/* The extent, in the window, of the label "Ils me font confiance" shown on screen on the open
   page, whatever the markup: a text node holding it, or an element's ::before generated content.
   The browser gives no box for generated content: its top left corner is taken as the top left
   corner of its element's content box, where the label, first in reading order, starts at the
   earliest, and its size is the pseudo-element's used size. Null when the label is not shown. */
async function labelExtent(
  page: Page,
  label: string,
): Promise<{ top: number; bottom: number; left: number; right: number } | null> {
  return page.locator('body').evaluate((body, label) => {
    const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (normalize(node.textContent ?? '') !== label) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const { top, bottom, left, right, height } = range.getBoundingClientRect();
      if (height > 0) return { top, bottom, left, right };
    }
    for (const element of Array.from(body.querySelectorAll('*'))) {
      const style = getComputedStyle(element, '::before');
      const shown = (style.content.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [])
        .map((string) => JSON.parse(string) as string)
        .join('');
      if (normalize(shown) !== label || style.display === 'none') continue;
      const host = getComputedStyle(element);
      const hostBox = element.getBoundingClientRect();
      const top = hostBox.top + parseFloat(host.borderTopWidth) + parseFloat(host.paddingTop);
      const left = hostBox.left + parseFloat(host.borderLeftWidth) + parseFloat(host.paddingLeft);
      return { top, bottom: top + parseFloat(style.height), left, right: left + parseFloat(style.width) };
    }
    return null;
  }, label);
}

test('on a phone, the label "Ils me font confiance" sits above the client names, not on their line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const list = page.getByRole('list', { name: 'Ils me font confiance' });
  await expect(list).toBeVisible();
  const labelBox = await labelExtent(page, 'Ils me font confiance');
  expect(labelBox, 'the label "Ils me font confiance" is shown on screen').not.toBeNull();
  /* Vertical positions only: the names may slide sideways, but they stay below the label. */
  for (const client of CLIENTS) {
    const box = (await list.getByRole('listitem').filter({ hasText: client }).boundingBox())!;
    expect.soft(box.y, `top of "${client}" against the bottom of the label (${labelBox!.bottom} px)`)
      .toBeGreaterThanOrEqual(labelBox!.bottom - 1);
  }
});

test('from 768 px wide, the label "Ils me font confiance" sits to the left of the client names, on their line', async ({ page }) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const list = page.getByRole('list', { name: 'Ils me font confiance' });
    await expect(list).toBeVisible();
    const labelBox = await labelExtent(page, 'Ils me font confiance');
    expect(labelBox, `at ${width} px, the label "Ils me font confiance" is shown on screen`).not.toBeNull();
    /* The part of each name left visible by the boxes that clip it: the names may slide sideways
       and be partly hidden, but what shows of them begins right of the label, on its line. */
    const visibleBoxes = await list.getByRole('listitem').evaluateAll((items) =>
      items.map((item) => {
        let { left, right, top, bottom } = item.getBoundingClientRect();
        for (let ancestor = item.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          if (getComputedStyle(ancestor).overflow === 'visible') continue;
          const clip = ancestor.getBoundingClientRect();
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
        return { name: item.textContent ?? '', left, right, top, bottom, shown: right > left && bottom > top };
      }),
    );
    const shownBoxes = visibleBoxes.filter((box) => box.shown);
    expect(shownBoxes.length, `at ${width} px, client names are shown`).toBeGreaterThan(0);
    for (const box of shownBoxes) {
      expect.soft(box.left, `at ${width} px, left of what shows of "${box.name}" against the right of the label (${labelBox!.right} px)`)
        .toBeGreaterThanOrEqual(labelBox!.right - 1);
      expect.soft(box.top, `at ${width} px, top of what shows of "${box.name}" against the bottom of the label (${labelBox!.bottom} px)`)
        .toBeLessThan(labelBox!.bottom);
      expect.soft(box.bottom, `at ${width} px, bottom of what shows of "${box.name}" against the top of the label (${labelBox!.top} px)`)
        .toBeGreaterThan(labelBox!.top);
    }
  }
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
