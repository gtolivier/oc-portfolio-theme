import { test, expect, type Page } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_A_SINGLE_SHORT_CLIENT,
  SITE_WITH_OTHER_CLIENTS,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';
import { clientBandBox, heroRegion } from './helpers/hero';
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

test('under prefers-reduced-motion: reduce, on a phone and on a desktop, the client names stay still: one second later, they sit where they were', async ({ page }) => {
  /* The visitor asks for reduced motion. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const list = page.getByRole('list', { name: 'Ils me font confiance' });
    await expect(list).toBeVisible();
    const namesLeft = () =>
      Promise.all(CLIENTS.map(async (client) => (await list.getByRole('listitem').filter({ hasText: client }).boundingBox())!.x));
    const namesBefore = await namesLeft();
    /* One second later, as the visitor lives it: the page's own time runs, untouched. */
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    const namesAfter = await namesLeft();
    CLIENTS.forEach((client, index) => {
      expect.soft(Math.abs(namesAfter[index] - namesBefore[index]), `at ${width} px, horizontal shift of "${client}" over one second (from ${namesBefore[index]} px)`)
        .toBeLessThanOrEqual(1);
    });
  }
});

test('under prefers-reduced-motion: reduce, on a phone, down to 320 px wide, and on a desktop, every client name is shown at once, each exactly once, whole, on as many lines as needed', async ({ page }) => {
  /* The visitor asks for reduced motion. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { width, height } of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('list', { name: 'Ils me font confiance' })).toBeVisible();
    /* Every piece of text on the page that reads exactly as a client name, whatever the markup
       and whether assistive technologies get it or not: its box, and the part of it the visitor
       sees, once cut by every box that clips its overflow and by the window's width. */
    const occurrences = await page.locator('body').evaluate((body, clients) => {
      const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
      const found: { name: string; box: DOMRect; seen: { left: number; right: number; top: number; bottom: number } }[] = [];
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const name = normalize(node.textContent ?? '');
        const parent = node.parentElement;
        if (!clients.includes(name) || !parent) continue;
        if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        let { left, right, top, bottom } = box;
        for (let ancestor: Element | null = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          if (getComputedStyle(ancestor).overflow === 'visible') continue;
          const clip = ancestor.getBoundingClientRect();
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
        left = Math.max(left, 0);
        right = Math.min(right, document.documentElement.clientWidth);
        found.push({ name, box, seen: { left, right, top, bottom } });
      }
      return found.map(({ name, box, seen }) => ({
        name,
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        shown: seen.right > seen.left && seen.bottom > seen.top,
        whole:
          seen.left <= box.left + 1 && seen.right >= box.right - 1 && seen.top <= box.top + 1 && seen.bottom >= box.bottom - 1,
      }));
    }, CLIENTS);
    const shown = occurrences.filter((occurrence) => occurrence.shown);
    for (const client of CLIENTS) {
      const copies = shown.filter((occurrence) => occurrence.name === client);
      /* Shown once: no copy of the name peeks in, even partly. */
      expect.soft(copies.length, `at ${width} px, number of times "${client}" shows on screen`).toBe(1);
      /* Shown whole: nothing of it is cut by the band or the window's edge. */
      for (const copy of copies) {
        expect.soft(copy.whole, `at ${width} px, "${client}" shows whole (box: ${copy.left}–${copy.right} × ${copy.top}–${copy.bottom} px)`).toBe(true);
      }
    }
    /* The names wrap onto as many lines as needed rather than pile up: no two overlap. */
    for (const [index, first] of shown.entries()) {
      for (const second of shown.slice(index + 1)) {
        const overlap = first.left < second.right - 1 && second.left < first.right - 1 && first.top < second.bottom - 1 && second.top < first.bottom - 1;
        expect.soft(overlap, `at ${width} px, "${first.name}" and "${second.name}" overlap`).toBe(false);
      }
    }
  }
});

test('under prefers-reduced-motion: reduce, on a phone and on a desktop, the client band starts below the fold: on arrival, the hero alone fills the window below the header, and the band begins at the bottom edge of the window', async ({ page }) => {
  /* The visitor asks for reduced motion. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const size = `${width} × ${height}`;
    await page.setViewportSize({ width, height });
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const hero = heroRegion(page);
    await expect(hero.getByRole('heading', { level: 1 }), `heading at ${size}`).toBeVisible();
    const band = await clientBandBox(page);
    expect.soft(band, `at ${size}, a strip holding the list "Ils me font confiance" spans the page width`).not.toBeNull();
    if (!band) continue;
    /* Page scrolled to the top, on arrival: the hero runs from the bottom of the header to the
       bottom of the window… */
    const headerBox = (await page.locator('header').boundingBox())!;
    const headerBottom = headerBox.y + headerBox.height;
    const heroBox = (await hero.boundingBox())!;
    const heroBottom = heroBox.y + heroBox.height;
    expect.soft(Math.abs(heroBox.y - headerBottom), `at ${size}, top of the hero (${heroBox.y} px) against the bottom of the header (${headerBottom} px)`)
      .toBeLessThanOrEqual(1);
    expect.soft(Math.abs(heroBottom - height), `at ${size}, bottom of the hero (${heroBottom} px) against the bottom of the window (${height} px)`)
      .toBeLessThanOrEqual(1);
    /* …and the band only begins there, out of sight until the visitor scrolls. */
    expect.soft(band.top, `at ${size}, top of the client band against the bottom of the window (${height} px)`)
      .toBeGreaterThanOrEqual(height - 1);
  }
});

test('on a phone, down to 320 px wide, and on a desktop, the client band never makes the page scroll horizontally, at any moment of its loop', async ({ page }) => {
  for (const { width, height } of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const list = page.getByRole('list', { name: 'Ils me font confiance' });
    await expect(list).toBeVisible();
    /* The page's animations are frozen, then set to chosen moments of their loop, as a fraction of its length. */
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.pause()));
    for (const fraction of [0, 0.25, 0.5, 0.75, 0.999]) {
      const pageWidth = await page.evaluate((fraction) => {
        for (const animation of document.getAnimations()) {
          animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * fraction;
        }
        return document.documentElement.scrollWidth;
      }, fraction);
      expect.soft(pageWidth, `at ${width} px, at ${fraction * 100} % of the loop, width of the page content`)
        .toBeLessThanOrEqual(width);
    }
  }
});

test('on a phone and on a desktop, where the clients do not fit in the band, the band scrolls without ever showing the same name twice at once: at any moment of its loop, each client name shows on screen at most once, even partly', async ({ page }) => {
  /* The example site's five clients are wider than the band on a phone and on a 1280 px desktop. */
  for (const { width, height } of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const where = `at ${width} px`;
    await page.setViewportSize({ width, height });
    await page.goto('/fr/');
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

    for (const fraction of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.999]) {
      const at = `${where}, at ${fraction * 100} % of the loop`;
      /* Every piece of text on the page that reads exactly as a client name, whatever the markup
         and whether assistive technologies get it or not, that the visitor sees, wholly or partly,
         once cut by every box that clips its overflow and by the window's width. */
      const shown = await list.evaluate((ul, { fraction, clients }) => {
        let window: Element | null = ul.parentElement;
        while (window && getComputedStyle(window).overflow === 'visible') window = window.parentElement;
        for (const animation of document.getAnimations()) {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          if (!window || !target || !window.contains(target)) continue;
          animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * fraction;
        }
        const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
        const found: { name: string; left: number; right: number }[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const name = normalize(node.textContent ?? '');
          const parent = node.parentElement;
          if (!clients.includes(name) || !parent) continue;
          if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const box = range.getBoundingClientRect();
          let { left, right, top, bottom } = box;
          for (let ancestor: Element | null = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            if (getComputedStyle(ancestor).overflow === 'visible') continue;
            const clip = ancestor.getBoundingClientRect();
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
          left = Math.max(left, 0);
          right = Math.min(right, document.documentElement.clientWidth);
          if (right > left && bottom > top) found.push({ name, left: box.left, right: box.right });
        }
        return found;
      }, { fraction, clients: CLIENTS });
      for (const client of CLIENTS) {
        const copies = shown.filter((occurrence) => occurrence.name === client);
        /* At most once: no second copy of the name peeks in, even partly, while one shows. */
        expect.soft(copies.length, `${at}, number of times "${client}" shows on screen (${copies.map((copy) => `${copy.left}–${copy.right} px`).join(', ')})`)
          .toBeLessThanOrEqual(1);
      }
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

  test('with few clients or many, on a phone and on a desktop, wherever the list is wider than the band, the band never shows a gap: at any moment of the loop, names cover its whole width, and the end of a loop looks like its start', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_CLIENTS, siteDirectory);
    /* This site's three clients, wider than the band on a phone and on a 768 px tablet (from
       1024 px wide, they fit in it)… */
    await expectBandWithoutGap(page, `${SITE_WITH_OTHER_CLIENTS.origin}/fr/`, [{ width: 390, height: 844 }, { width: 768, height: 1024 }]);
    /* …and the example site's five, wider than the band on a phone and on a 1280 px desktop. */
    await expectBandWithoutGap(page, '/fr/', [{ width: 390, height: 844 }, { width: 1280, height: 900 }]);
  });
});

test.describe('home page of another site, with a single short client', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_SINGLE_SHORT_CLIENT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('when all the clients fit in the band — a single short client on a phone and on a desktop, the example site’s five on a 1920 px screen — the names stay still, and each is shown once, whole: no copy of a name shows on screen', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_SINGLE_SHORT_CLIENT, siteDirectory);
    const cases = [
      /* tests/fixtures/single-short-client/content/_index.md declares a single client, "Oko". */
      { homePage: `${SITE_WITH_A_SINGLE_SHORT_CLIENT.origin}/fr/`, clients: ['Oko'], width: 390, height: 844 },
      { homePage: `${SITE_WITH_A_SINGLE_SHORT_CLIENT.origin}/fr/`, clients: ['Oko'], width: 1280, height: 900 },
      /* The example site's five clients fit in the band of a 1920 px wide screen. */
      { homePage: '/fr/', clients: CLIENTS, width: 1920, height: 1080 },
    ];
    for (const { homePage, clients, width, height } of cases) {
      const where = `on ${homePage} at ${width} px`;
      await page.setViewportSize({ width, height });
      await page.goto(homePage);
      await page.evaluate(() => document.fonts.ready);
      const list = page.getByRole('list', { name: 'Ils me font confiance' });
      await expect(list).toBeVisible();

      /* Still: one second later, as the visitor lives it (the page's own time runs, untouched),
         every name sits where it was. */
      const namesLeft = () =>
        Promise.all(clients.map(async (client) => (await list.getByRole('listitem').filter({ hasText: client }).boundingBox())!.x));
      const namesBefore = await namesLeft();
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      const namesAfter = await namesLeft();
      clients.forEach((client, index) => {
        expect.soft(Math.abs(namesAfter[index] - namesBefore[index]), `${where}, horizontal shift of "${client}" over one second (from ${namesBefore[index]} px)`)
          .toBeLessThanOrEqual(1);
      });

      /* Every piece of text on the page that reads exactly as a client name, whatever the markup
         and whether assistive technologies get it or not: its box, and whether the visitor sees
         it, wholly or partly, once cut by every box that clips its overflow and by the window. */
      const occurrences = await page.locator('body').evaluate((body, clients) => {
        const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
        const found: { name: string; left: number; right: number; shown: boolean; whole: boolean }[] = [];
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const name = normalize(node.textContent ?? '');
          const parent = node.parentElement;
          if (!clients.includes(name) || !parent) continue;
          if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const box = range.getBoundingClientRect();
          let { left, right, top, bottom } = box;
          for (let ancestor: Element | null = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            if (getComputedStyle(ancestor).overflow === 'visible') continue;
            const clip = ancestor.getBoundingClientRect();
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
          left = Math.max(left, 0);
          right = Math.min(right, document.documentElement.clientWidth);
          found.push({
            name,
            left: box.left,
            right: box.right,
            shown: right > left && bottom > top,
            whole: left <= box.left + 1 && right >= box.right - 1 && top <= box.top + 1 && bottom >= box.bottom - 1,
          });
        }
        return found;
      }, clients);
      for (const client of clients) {
        const copies = occurrences.filter((occurrence) => occurrence.shown && occurrence.name === client);
        /* Shown once: no copy of the name peeks in, even partly. */
        expect.soft(copies.length, `${where}, number of times "${client}" shows on screen`).toBe(1);
        /* Shown whole: nothing of it is cut by the band or the window's edge. */
        for (const copy of copies) {
          expect.soft(copy.whole, `${where}, "${client}" shows whole (from ${copy.left} to ${copy.right} px)`).toBe(true);
        }
      }
    }
  });
});

/* Checks, at each of the `viewports` sizes (where the list is wider than the band), that the
   client band of the home page at `homePage` never shows a gap: at any moment of the loop, names
   cover its whole width, and the end of a loop looks like its start. */
async function expectBandWithoutGap(page: Page, homePage: string, viewports: { width: number; height: number }[]) {
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
