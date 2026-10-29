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

test('on a phone and on a desktop, the client names move continuously to the left: one second later, they sit further left, while the label "Ils me font confiance" stays put', async ({ page }) => {
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const list = page.getByRole('list', { name: 'Ils me font confiance' });
    await expect(list).toBeVisible();
    /* The page's animations are frozen, so that "now" and "one second later" are read at known
       times, whatever the test's own pace. */
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.pause()));
    const namesLeft = () =>
      Promise.all(CLIENTS.map(async (client) => (await list.getByRole('listitem').filter({ hasText: client }).boundingBox())!.x));
    const namesBefore = await namesLeft();
    const labelBefore = await labelExtent(page, 'Ils me font confiance');
    expect(labelBefore, `at ${width} px, the label "Ils me font confiance" is shown on screen`).not.toBeNull();
    /* One second later. */
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => {
        animation.currentTime = Number(animation.currentTime ?? 0) + 1000;
      }),
    );
    const namesAfter = await namesLeft();
    CLIENTS.forEach((client, index) => {
      expect.soft(namesAfter[index], `at ${width} px, left of "${client}" one second later, against before (${namesBefore[index]} px)`)
        .toBeLessThan(namesBefore[index] - 1);
    });
    /* Only the names move: the label keeps its place. */
    const labelAfter = await labelExtent(page, 'Ils me font confiance');
    expect.soft(Math.abs(labelAfter!.left - labelBefore!.left), `at ${width} px, horizontal shift of the label`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(labelAfter!.top - labelBefore!.top), `at ${width} px, vertical shift of the label`).toBeLessThanOrEqual(1);
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

  test('with few clients or many, on a phone and on a desktop, the band never shows a gap: at any moment of the loop, names cover its whole width, and the end of a loop looks like its start', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_CLIENTS, siteDirectory);
    /* This site's three clients, and the example site's five. */
    const homePages = [`${SITE_WITH_OTHER_CLIENTS.origin}/fr/`, '/fr/'];
    const viewports = [{ width: 390, height: 844 }, { width: 1280, height: 900 }, { width: 1920, height: 1080 }];
    for (const homePage of homePages) {
      for (const { width, height } of viewports) {
        const where = `on ${homePage} at ${width} px`;
        await page.setViewportSize({ width, height });
        await page.goto(homePage);
        await page.evaluate(() => document.fonts.ready);
        const list = page.getByRole('list', { name: 'Ils me font confiance' });
        await expect(list).toBeVisible();
        /* The page's animations are frozen; the band's loop (the animations of the box that clips
           the names, or of what it holds) is then set to chosen moments, as a fraction of its length. */
        await page.evaluate(() => document.getAnimations().forEach((animation) => animation.pause()));
        const loopCount = await list.evaluate((ul) => {
          let window: Element | null = ul.parentElement;
          while (window && getComputedStyle(window).overflow === 'visible') window = window.parentElement;
          return document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return !!window && !!target && window.contains(target);
          }).length;
        });
        expect(loopCount, `${where}, the band loops`).toBeGreaterThan(0);

        /* At a moment of the loop (a fraction of its length, or that length minus a fraction), the
           part of the window that clips the names, as the visitor sees it, and the box of every name
           in it, separator included, from left to right, with whether it shows in the window. */
        const bandAt = (moment: { fraction: number; fromEnd?: boolean }) =>
          list.evaluate((ul, { fraction, fromEnd }) => {
            let window: Element | null = ul.parentElement;
            while (window && getComputedStyle(window).overflow === 'visible') window = window.parentElement;
            for (const animation of document.getAnimations()) {
              const target = (animation.effect as KeyframeEffect | null)?.target;
              if (!window || !target || !window.contains(target)) continue;
              const length = Number(animation.effect!.getComputedTiming().duration);
              animation.currentTime = fromEnd ? length * (1 - fraction) : length * fraction;
            }
            let { left, right } = window!.getBoundingClientRect();
            for (let ancestor = window!.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
              if (getComputedStyle(ancestor).overflow === 'visible') continue;
              const clip = ancestor.getBoundingClientRect();
              left = Math.max(left, clip.left);
              right = Math.min(right, clip.right);
            }
            right = Math.min(right, document.documentElement.clientWidth);
            const names = Array.from(window!.querySelectorAll('li'))
              .map((item) => {
                const box = item.getBoundingClientRect();
                return { name: item.textContent ?? '', left: box.left, right: box.right, shown: box.right > left && box.left < right };
              })
              .sort((a, b) => a.left - b.left);
            return { left, right, names };
          }, moment);

        /* The usual space between two names that follow each other: no stretch of the window may be
           left emptier than that. */
        const start = await bandAt({ fraction: 0 });
        const usualSpace = start.names[1].left - start.names[0].right;

        for (const fraction of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.999]) {
          const band = await bandAt({ fraction });
          const shown = band.names.filter((name) => name.shown);
          const at = `${where}, at ${fraction * 100} % of the loop`;
          expect.soft(shown.length, `${at}, names are shown`).toBeGreaterThan(0);
          if (shown.length === 0) continue;
          expect.soft(shown[0].left, `${at}, left of the first name shown against the left of the window (${band.left} px)`)
            .toBeLessThanOrEqual(band.left + usualSpace + 1);
          let coveredUpTo = shown[0].right;
          for (const name of shown.slice(1)) {
            expect.soft(name.left - coveredUpTo, `${at}, empty space before "${name.name}" against the usual space between two names (${usualSpace} px)`)
              .toBeLessThanOrEqual(usualSpace + 1);
            coveredUpTo = Math.max(coveredUpTo, name.right);
          }
          expect.soft(coveredUpTo, `${at}, right of the last name shown against the right of the window (${band.right} px)`)
            .toBeGreaterThanOrEqual(band.right - usualSpace - 1);
        }

        /* Just before the end of a loop, the band shows the same names at the same places as at its
           start, give or take the distance the names travel in that short time. */
        const justAfterStart = await bandAt({ fraction: 0.001 });
        const justBeforeEnd = await bandAt({ fraction: 0.001, fromEnd: true });
        const travel = Math.abs(justAfterStart.names[0].left - start.names[0].left);
        for (const [shownIn, foundIn, label] of [
          [start, justBeforeEnd, 'at the start, found just before the end'],
          [justBeforeEnd, start, 'just before the end, found at the start'],
        ] as const) {
          for (const name of shownIn.names.filter((name) => name.shown)) {
            const closest = Math.min(
              ...foundIn.names.filter((other) => other.name === name.name).map((other) => Math.abs(other.left - name.left)),
            );
            expect.soft(closest, `${where}, "${name.name}" shown ${label}: distance to the same name (travel: ${travel} px)`)
              .toBeLessThanOrEqual(travel + 1);
          }
        }
      }
    }
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
