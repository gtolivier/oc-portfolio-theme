import { test, expect, type JSHandle, type Locator, type Page } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_A_SINGLE_SHORT_CLIENT,
  SITE_WITH_LONG_CLIENT_NAMES,
  SITE_WITH_A_ONE_WORD_CLIENT_NAME,
  SITE_WITH_OTHER_CLIENTS,
  SITE_WITH_CLIENTS_AS_TEXT,
  SITE_WITH_A_CLIENT_AS_MAP,
  buildSite,
  removeDirectory,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import { clientBandBox, clientList } from './helpers/clients';
import { blockRequests, holdRequests, themeScriptUrl, themeStylesheetUrl } from './helpers/held-requests';
import { heroRegion } from './helpers/hero';
import { textOnScreen } from './helpers/text-on-screen';

/* The clients the example site's home pages declare, in their order (proper names, the same in every language). */
const CLIENTS = [
  'Bijouterie Valmont',
  'Antiquités Roussel',
  'Château de Mirevent',
  'Galerie Aubertin',
  'Maison Delorme',
];

/* A common phone window and a desktop one. */
const PHONE_AND_DESKTOP_VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];

/* A narrow phone window, 320 px wide, then a common phone window and a desktop one. */
const NARROW_PHONE_TO_DESKTOP_VIEWPORTS = [{ width: 320, height: 568 }, ...PHONE_AND_DESKTOP_VIEWPORTS];

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

/* Opens the home page at `homePage`, waits for its fonts to finish loading, and returns its client
   list, once visible. It polls `document.fonts.status` rather than awaiting `document.fonts.ready`:
   without JavaScript, Firefox never resolves a page promise awaited from the test. */
async function openClientList(page: Page, homePage = '/fr/'): Promise<Locator> {
  await page.goto(homePage);
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  const list = clientList(page);
  await expect(list).toBeVisible();
  return list;
}

/* The left edge, in the window, of each of `clients` in the client list `list`, in their order. */
function namesLeft(list: Locator, clients: string[]): Promise<number[]> {
  return Promise.all(clients.map(async (client) => (await list.getByRole('listitem').filter({ hasText: client }).boundingBox())!.x));
}

/* Freezes the page's animations, so that the moments the test reads are set by the test, whatever
   its own pace. */
async function freezeAnimations(page: Page): Promise<void> {
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.pause()));
}

/* Checks that each of `clients` sits further left one second later (`namesAfter`) than before
   (`namesBefore`), as measured by namesLeft. `where` opens each message. */
function expectNamesMovedLeft(clients: string[], namesBefore: number[], namesAfter: number[], where: string): void {
  clients.forEach((client, index) => {
    expect.soft(namesAfter[index], `${where}, left of "${client}" one second later, against before (${namesBefore[index]} px)`)
      .toBeLessThan(namesBefore[index] - 1);
  });
}

/* Checks that each of `clients` sits one second later (`namesAfter`) where it was before
   (`namesBefore`), as measured by namesLeft. `where` opens each message. */
function expectNamesStill(clients: string[], namesBefore: number[], namesAfter: number[], where: string): void {
  clients.forEach((client, index) => {
    expect.soft(Math.abs(namesAfter[index] - namesBefore[index]), `${where}, horizontal shift of "${client}" over one second (from ${namesBefore[index]} px)`)
      .toBeLessThanOrEqual(1);
  });
}

interface ClientNameOnScreen {
  name: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  shown: boolean;
  whole: boolean;
}

/* Every piece of text on the open page that reads exactly as one of `clients`, whatever the markup
   and whether assistive technologies get it or not: its box, in the window, and whether the visitor
   sees it, wholly or partly (`shown`), and whole (`whole`), once cut by every box that clips its
   overflow and by the window's width. */
function clientNamesOnScreen(page: Page, clients: string[]): Promise<ClientNameOnScreen[]> {
  return page.locator('body').evaluate((body, clients) => {
    const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
    const found: ClientNameOnScreen[] = [];
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
        top: box.top,
        bottom: box.bottom,
        shown: right > left && bottom > top,
        whole: left <= box.left + 1 && right >= box.right - 1 && top <= box.top + 1 && bottom >= box.bottom - 1,
      });
    }
    return found;
  }, clients);
}

/* The pieces of text found by clientNamesOnScreen that the visitor sees, wholly or partly. */
async function clientNamesShown(page: Page, clients: string[]): Promise<ClientNameOnScreen[]> {
  return (await clientNamesOnScreen(page, clients)).filter((occurrence) => occurrence.shown);
}

/* Checks, on the client names the visitor sees (`shown`, from clientNamesShown), that each of
   `clients` shows exactly once and whole. `where` opens each message. */
function expectEachNameShownOnceAndWhole(shown: ClientNameOnScreen[], clients: string[], where: string): void {
  for (const client of clients) {
    const copies = shown.filter((occurrence) => occurrence.name === client);
    /* Shown once: no copy of the name peeks in, even partly. */
    expect.soft(copies.length, `${where}, number of times "${client}" shows on screen`).toBe(1);
    /* Shown whole: nothing of it is cut by the band or the window's edge. */
    for (const copy of copies) {
      expect.soft(copy.whole, `${where}, "${client}" shows whole (box: ${copy.left}–${copy.right} × ${copy.top}–${copy.bottom} px)`).toBe(true);
    }
  }
}

/* Checks that no two of the client names the visitor sees (`shown`, from clientNamesShown)
   overlap: they wrap onto as many lines as needed rather than pile up. `where` opens each message. */
function expectNoTwoNamesOverlap(shown: ClientNameOnScreen[], where: string): void {
  for (const [index, first] of shown.entries()) {
    for (const second of shown.slice(index + 1)) {
      const overlap = first.left < second.right - 1 && second.left < first.right - 1 && first.top < second.bottom - 1 && second.top < first.bottom - 1;
      expect.soft(overlap, `${where}, "${first.name}" and "${second.name}" overlap`).toBe(false);
    }
  }
}

/* The loop of the client band whose list is `list`, on the open page, its animations frozen: the
   box that clips the names (the list's nearest ancestor that clips its overflow), the number of
   animations the loop is made of (those of that box or of what it holds), and a way to set them at
   a moment of the loop, as a fraction of its length. */
async function bandLoop(list: Locator): Promise<{
  window: JSHandle<Element | null>;
  animationCount: () => Promise<number>;
  setAt: (fraction: number) => Promise<void>;
}> {
  const window = await list.evaluateHandle((ul) => {
    let window: Element | null = ul.parentElement;
    while (window && getComputedStyle(window).overflow === 'visible') window = window.parentElement;
    return window;
  });
  const animations = await window.evaluateHandle((window) =>
    document.getAnimations().filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return !!window && !!target && window.contains(target);
    }),
  );
  return {
    window,
    animationCount: () => animations.evaluate((animations) => animations.length),
    setAt: (fraction) =>
      animations.evaluate((animations, fraction) => {
        for (const animation of animations) {
          animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * fraction;
        }
      }, fraction),
  };
}

/* Moves the page's frozen animations one second further. */
async function advanceAnimationsOneSecond(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.getAnimations().forEach((animation) => {
      animation.currentTime = Number(animation.currentTime ?? 0) + 1000;
    }),
  );
}

/* Lets one second pass on the page, as the visitor lives it: the page's own time runs, untouched. */
async function letOneSecondPass(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
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
  const list = await openClientList(page);
  const labelBox = await labelExtent(page, 'Ils me font confiance');
  expect(labelBox, 'the label "Ils me font confiance" is shown on screen').not.toBeNull();
  /* Vertical positions only: the names may slide sideways, but they stay below the label. */
  for (const client of CLIENTS) {
    const box = (await list.getByRole('listitem').filter({ hasText: client }).boundingBox())!;
    expect.soft(box.y, `top of "${client}" against the bottom of the label (${labelBox!.bottom} px)`)
      .toBeGreaterThanOrEqual(labelBox!.bottom - 1);
  }
});

test('on a 320 px wide phone, with the band’s label in a much larger font (a visitor who enlarged the text), the label "Ils me font confiance" is shown whole, on several lines if needed, instead of being cut', async ({ page }) => {
  const { width, height } = { width: 320, height: 568 };
  await page.setViewportSize({ width, height });
  await openClientList(page);
  /* The visitor enlarged the text: the label shows at twice its usual size, too wide for one line
     of the band. */
  const band = page.locator('.clients');
  const usualSize = await band.evaluate((element) => parseFloat(getComputedStyle(element, '::before').fontSize));
  await page.addStyleTag({ content: `.clients::before { font-size: ${usualSize * 2}px; }` });
  const labelBox = await labelExtent(page, 'Ils me font confiance');
  expect(labelBox, 'the label "Ils me font confiance" is shown on screen').not.toBeNull();
  const bandBox = await clientBandBox(page);
  expect(bandBox, 'the client band spans the page width').not.toBeNull();
  const windowWidth = await page.evaluate(() => document.documentElement.clientWidth);
  /* The label's box stays inside the band and the window. */
  expect.soft(labelBox!.left, `at ${width} × ${height}, left of the label against the left of the band (${bandBox!.left} px)`)
    .toBeGreaterThanOrEqual(Math.max(bandBox!.left, 0) - 1);
  expect.soft(labelBox!.right, `at ${width} × ${height}, right of the label against the right of the band (${bandBox!.right} px) and of the window (${windowWidth} px)`)
    .toBeLessThanOrEqual(Math.min(bandBox!.right, windowWidth) + 1);
  /* Its text does not run past the band's edge either, where the band would hide it: the band
     holds nothing wider than itself. */
  const { scrollWidth, clientWidth } = await band.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
  expect.soft(scrollWidth, `at ${width} × ${height}, width of what the band holds against its own width (${clientWidth} px)`)
    .toBeLessThanOrEqual(clientWidth + 1);
});

test('from 768 px wide, the label "Ils me font confiance" sits to the left of the client names, on their line', async ({ page }) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const list = await openClientList(page);
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
  for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width, height });
    const list = await openClientList(page);
    await freezeAnimations(page);
    const namesBefore = await namesLeft(list, CLIENTS);
    const labelBefore = await labelExtent(page, 'Ils me font confiance');
    expect(labelBefore, `at ${width} px, the label "Ils me font confiance" is shown on screen`).not.toBeNull();
    await advanceAnimationsOneSecond(page);
    const namesAfter = await namesLeft(list, CLIENTS);
    expectNamesMovedLeft(CLIENTS, namesBefore, namesAfter, `at ${width} px`);
    /* Only the names move: the label keeps its place. */
    const labelAfter = await labelExtent(page, 'Ils me font confiance');
    expect.soft(Math.abs(labelAfter!.left - labelBefore!.left), `at ${width} px, horizontal shift of the label`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(labelAfter!.top - labelBefore!.top), `at ${width} px, vertical shift of the label`).toBeLessThanOrEqual(1);
  }
});

test('under prefers-reduced-motion: reduce, on a phone and on a desktop, the client names stay still: one second later, they sit where they were', async ({ page }) => {
  /* The visitor asks for reduced motion. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width, height });
    const list = await openClientList(page);
    const namesBefore = await namesLeft(list, CLIENTS);
    await letOneSecondPass(page);
    const namesAfter = await namesLeft(list, CLIENTS);
    expectNamesStill(CLIENTS, namesBefore, namesAfter, `at ${width} px`);
  }
});

test('on a desktop, while the pointer rests on the scrolling client band, the names stop moving: one second later, they sit where they were; once the pointer leaves the band, they move left again', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'resting the pointer on the band needs a fine pointer; touch screens have none');
  /* At 1280 px wide, the example site's five clients do not all fit: the band scrolls. */
  await page.setViewportSize({ width: 1280, height: 900 });
  const list = await openClientList(page);
  /* The band starts at the bottom of the first screen: it is brought into view to be pointed at.
     Scrolled from the page: Playwright's own scrolling waits for the list to stop moving. */
  await list.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const band = await clientBandBox(page);
  expect(band, 'the client band spans the page width').not.toBeNull();

  /* The pointer rests in the middle of the band. */
  await page.mouse.move((band!.left + band!.right) / 2, (band!.top + band!.bottom) / 2);
  const namesWhileHovered = await namesLeft(list, CLIENTS);
  await letOneSecondPass(page);
  expectNamesStill(CLIENTS, namesWhileHovered, await namesLeft(list, CLIENTS), 'with the pointer resting on the band');

  /* The pointer leaves the band, for a point above it. */
  await page.mouse.move((band!.left + band!.right) / 2, band!.top / 2);
  const namesOnceLeft = await namesLeft(list, CLIENTS);
  await letOneSecondPass(page);
  expectNamesMovedLeft(CLIENTS, namesOnceLeft, await namesLeft(list, CLIENTS), 'once the pointer has left the band');
});

test('on a touch screen, after a tap on the scrolling client band, the names keep moving: one second later, they sit further left', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'a tap needs a touch screen');
  /* At the phone's own width, the example site's five clients do not all fit: the band scrolls. */
  const list = await openClientList(page);
  /* The band starts at the bottom of the first screen: it is brought into view to be tapped.
     Scrolled from the page: Playwright's own scrolling waits for the list to stop moving. */
  await list.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const band = await clientBandBox(page);
  expect(band, 'the client band spans the page width').not.toBeNull();

  /* The visitor taps the middle of the band. */
  await page.touchscreen.tap((band!.left + band!.right) / 2, (band!.top + band!.bottom) / 2);
  const namesAfterTap = await namesLeft(list, CLIENTS);
  await letOneSecondPass(page);
  expectNamesMovedLeft(CLIENTS, namesAfterTap, await namesLeft(list, CLIENTS), 'after a tap on the band');
});

test('on a phone and on a desktop, when the client names grow wider while they scroll (their font gets larger, as when a web font swaps in), they do not jump: the first name stays where it was, modulo one loop', async ({ page }) => {
  for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width, height });
    const list = await openClientList(page);
    /* Frozen well into the loop, so that a jump would show: the moment is set by the test. */
    await freezeAnimations(page);
    await (await bandLoop(list)).setAt(0.4);
    const listWidthBefore = (await list.boundingBox())!.width;
    const [firstNameBefore] = await namesLeft(list, [CLIENTS[0]]);

    /* The names' font gets larger, as when a wider web font swaps in; the page then renders it. */
    await page.addStyleTag({ content: '.clients li { font-size: 26px !important; }' });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const loopWidth = (await list.boundingBox())!.width;
    expect(loopWidth, `at ${width} px, the list grows wider with its font (from ${listWidthBefore} px)`).toBeGreaterThan(listWidthBefore * 1.2);
    const [firstNameAfter] = await namesLeft(list, [CLIENTS[0]]);

    /* The band loops by one list: a shift by a whole number of lists shows the same picture. */
    const shift = (((firstNameAfter - firstNameBefore) % loopWidth) + loopWidth) % loopWidth;
    expect.soft(Math.min(shift, loopWidth - shift), `at ${width} px, shift of "${CLIENTS[0]}" (from ${firstNameBefore} px to ${firstNameAfter} px), modulo one loop (${loopWidth} px)`)
      .toBeLessThanOrEqual(3);
  }
});

test('on a phone and on a desktop, when the theme’s script arrives after the page is first shown, the client band keeps the height it had before the script ran, while the names start to scroll', async ({ page }) => {
  for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
    const where = `at ${width} px`;
    await page.setViewportSize({ width, height });
    /* The theme's bundle is held back, as on a very slow connection: the page is parsed and shown
       before it arrives. */
    const script = await holdRequests(page, themeScriptUrl());
    try {
      await page.goto('/fr/', { waitUntil: 'commit' });
      await script.requested;
      const list = clientList(page);
      await expect(list).toBeVisible();
      /* The band's font is the final one. Not through `document.fonts.status`: Firefox keeps it
         loading while the page waits for its deferred script. Waits instead until the page has
         asked for IBM Plex Mono, the band's font, and none of its web fonts is still loading. */
      await expect.poll(() => page.evaluate(() => {
        const faces = [...document.fonts];
        return {
          monoAskedFor: faces.some((face) => /mono/i.test(face.family) && face.status !== 'unloaded'),
          stillLoading: faces.filter((face) => face.status === 'loading').map((face) => face.family),
        };
      }), { message: `${where}, web fonts settled before the script runs` }).toEqual({ monoAskedFor: true, stillLoading: [] });
      /* The page renders what the visitor sees before the script runs. */
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const bandBefore = await clientBandBox(page);
      expect(bandBefore, `${where}, before the script runs, the client band spans the page width`).not.toBeNull();

      /* The script arrives and runs: the names, wider than the band, start to scroll. */
      script.release();
      await page.waitForLoadState('domcontentloaded');
      const namesBefore = await namesLeft(list, CLIENTS);
      await letOneSecondPass(page);
      expectNamesMovedLeft(CLIENTS, namesBefore, await namesLeft(list, CLIENTS), `${where}, once the script has run`);

      const bandAfter = await clientBandBox(page);
      expect(bandAfter, `${where}, once the script has run, the client band spans the page width`).not.toBeNull();
      expect.soft(Math.abs((bandAfter!.bottom - bandAfter!.top) - (bandBefore!.bottom - bandBefore!.top)), `${where}, change in the band's height once the script has run (from ${bandBefore!.bottom - bandBefore!.top} px to ${bandAfter!.bottom - bandAfter!.top} px)`)
        .toBeLessThanOrEqual(1);
    } finally {
      await script.end();
    }
  }
});

test('under prefers-reduced-motion: reduce, on a phone, down to 320 px wide, and on a desktop, every client name is shown at once, each exactly once, whole, on as many lines as needed', async ({ page }) => {
  /* The visitor asks for reduced motion. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { width, height } of NARROW_PHONE_TO_DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await openClientList(page);
    const shown = await clientNamesShown(page, CLIENTS);
    expectEachNameShownOnceAndWhole(shown, CLIENTS, `at ${width} px`);
    expectNoTwoNamesOverlap(shown, `at ${width} px`);
  }
});

test.describe('home page without JavaScript', () => {
  /* The theme rule: no JavaScript is required to read the content. The band's loop is an
     enhancement: without the script that tells whether the list fits, the names must stay readable. */
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, on a phone, down to 320 px wide, and on a desktop, the client names stay still, and every one is shown at once, exactly once, whole, on as many lines as needed', async ({ page }) => {
    for (const { width, height } of NARROW_PHONE_TO_DESKTOP_VIEWPORTS) {
      const where = `without JavaScript, at ${width} px`;
      await page.setViewportSize({ width, height });
      const list = await openClientList(page);

      /* Still: one second later, as the visitor lives it (the page's own time runs, untouched;
         without JavaScript, the page's timers never fire, so the test waits on its side), every
         name sits where it was. */
      const namesBefore = await namesLeft(list, CLIENTS);
      await page.waitForTimeout(1000);
      const namesAfter = await namesLeft(list, CLIENTS);
      expectNamesStill(CLIENTS, namesBefore, namesAfter, where);

      const shown = await clientNamesShown(page, CLIENTS);
      expectEachNameShownOnceAndWhole(shown, CLIENTS, where);
      expectNoTwoNamesOverlap(shown, where);
    }
  });

  test('without JavaScript, on a phone and on a desktop, the client band starts below the fold: on arrival, the hero alone fills the window below the header, and the band begins at the bottom edge of the window', async ({ page }) => {
    /* The names wrap, so the band grows taller: it must not shrink the hero above it. */
    await expectBandBelowTheFold(page);
  });
});

test('when JavaScript is on but the theme’s script does not load, on a phone, down to 320 px wide, and on a desktop, the client names stay still, and every one is shown at once, exactly once, whole, on as many lines as needed', async ({ page }) => {
  /* The theme's bundle fails to load (a network or an extension refuses it); the page's inline
     scripts still run. Without the script that tells whether the list fits, the names must stay
     readable, as without JavaScript. */
  const blockedScripts = await blockRequests(page, themeScriptUrl());
  for (const { width, height } of NARROW_PHONE_TO_DESKTOP_VIEWPORTS) {
    const where = `without the theme’s script, at ${width} px`;
    await page.setViewportSize({ width, height });
    const list = await openClientList(page);
    expect(blockedScripts, 'theme script request blocked').not.toEqual([]);

    /* Still: one second later, as the visitor lives it (the page's own time runs, untouched), every
       name sits where it was. */
    const namesBefore = await namesLeft(list, CLIENTS);
    await page.waitForTimeout(1000);
    const namesAfter = await namesLeft(list, CLIENTS);
    expectNamesStill(CLIENTS, namesBefore, namesAfter, where);

    const shown = await clientNamesShown(page, CLIENTS);
    expectEachNameShownOnceAndWhole(shown, CLIENTS, where);
    expectNoTwoNamesOverlap(shown, where);
  }
});

test('when JavaScript is on but the theme’s script does not load, on a phone and on a desktop, the client band starts below the fold: on arrival, the hero alone fills the window below the header, and the band begins at the bottom edge of the window', async ({ page }) => {
  /* The theme's bundle fails to load; the names wrap, as without JavaScript, so the band grows
     taller: it must not shrink the hero above it. */
  const blockedScripts = await blockRequests(page, themeScriptUrl());
  await expectBandBelowTheFold(page);
  expect(blockedScripts, 'theme script request blocked').not.toEqual([]);
});

test('when the theme’s stylesheet does not load, each client name appears once on the page', async ({ page }) => {
  /* The stylesheet fails to load (a network or an extension refuses it), or the visitor reads the
     page unstyled (reader mode, text browser): the copy of the list that makes the band loop must
     not show, so that each name reads once. */
  const blockedStylesheets = await blockRequests(page, themeStylesheetUrl());
  await openClientList(page);
  expect(blockedStylesheets, 'theme stylesheet request blocked').not.toEqual([]);

  const shown = await clientNamesShown(page, CLIENTS);
  for (const client of CLIENTS) {
    expect.soft(shown.filter((occurrence) => occurrence.name === client).length, `number of times "${client}" shows on the unstyled page`).toBe(1);
  }
});

test('under prefers-reduced-motion: reduce, on a phone and on a desktop, the client band starts below the fold: on arrival, the hero alone fills the window below the header, and the band begins at the bottom edge of the window', async ({ page }) => {
  /* The visitor asks for reduced motion. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectBandBelowTheFold(page);
});

/* Checks, on a phone and on a desktop, that on arrival on the French home page the hero alone fills
   the window below the header, and the client band begins at the bottom edge of the window. */
async function expectBandBelowTheFold(page: Page) {
  for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
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
}

test('under prefers-reduced-motion: reduce, on a phone held in landscape (844 × 390), a hero taller than the window below the header grows with its content and pushes the client band down: all of the hero’s content ends above the band', async ({ page }) => {
  /* The visitor asks for reduced motion, on a phone turned sideways: a window too short for the
     hero's content. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { width, height } = { width: 844, height: 390 };
  const size = `${width} × ${height}`;
  await page.setViewportSize({ width, height });
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const hero = heroRegion(page);
  /* The hero's content, from its heading down to its buttons, the last thing it shows. */
  const content = [
    hero.getByRole('heading', { level: 1 }),
    hero.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    hero.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    hero.getByRole('link', { name: 'Voir les projets' }),
    hero.getByRole('link', { name: 'Contact' }),
  ];
  for (const part of content) await expect(part, `hero content at ${size}`).toBeVisible();
  const band = await clientBandBox(page);
  expect(band, `at ${size}, a strip holding the list "Ils me font confiance" spans the page width`).not.toBeNull();

  /* Page scrolled to the top: the hero's content is taller than the window below the header. */
  const headerBox = (await page.locator('header').boundingBox())!;
  const headerBottom = headerBox.y + headerBox.height;
  const boxes = await Promise.all(content.map(async (part) => (await part.boundingBox())!));
  const contentTop = Math.min(...boxes.map((box) => box.y));
  const contentBottom = Math.max(...boxes.map((box) => box.y + box.height));
  expect(contentBottom - contentTop, `at ${size}, height of the hero's content, against ${Math.round(height - headerBottom)} px of window below the header`)
    .toBeGreaterThan(height - headerBottom);

  /* The band follows the hero's content instead of being drawn over it. */
  expect(contentBottom, `at ${size}, bottom of the hero's content against the top of the client band (${band!.top} px)`)
    .toBeLessThanOrEqual(band!.top);
});

test('on a phone, down to 320 px wide, and on a desktop, the client band never makes the page scroll horizontally, at any moment of its loop', async ({ page }) => {
  for (const { width, height } of NARROW_PHONE_TO_DESKTOP_VIEWPORTS) {
    await page.setViewportSize({ width, height });
    const list = await openClientList(page);
    /* The page's animations are frozen, then set to chosen moments of their loop, as a fraction of its length. */
    await freezeAnimations(page);
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
  for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
    const where = `at ${width} px`;
    await page.setViewportSize({ width, height });
    const list = await openClientList(page);
    /* The page's animations are frozen; the band's loop (the animations of the box that clips
       the names, or of what it holds) is then set to chosen moments, as a fraction of its length. */
    await freezeAnimations(page);
    const loop = await bandLoop(list);
    expect(await loop.animationCount(), `${where}, the band loops`).toBeGreaterThan(0);

    for (const fraction of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.999]) {
      const at = `${where}, at ${fraction * 100} % of the loop`;
      await loop.setAt(fraction);
      const shown = await clientNamesShown(page, CLIENTS);
      for (const client of CLIENTS) {
        const copies = shown.filter((occurrence) => occurrence.name === client);
        /* At most once: no second copy of the name peeks in, even partly, while one shows. */
        expect.soft(copies.length, `${at}, number of times "${client}" shows on screen (${copies.map((copy) => `${copy.left}–${copy.right} px`).join(', ')})`)
          .toBeLessThanOrEqual(1);
      }
    }
  }
});

test('on the French home page, the client band follows a resize of the window without reloading: the names scroll at 1280 px wide, stay still, each shown once, once the window widens to 1920 px, and scroll again once it narrows back to 1280 px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const list = await openClientList(page);
  /* The window is resized without reloading the page; the page gets a couple of frames to lay
     itself out again. */
  const resizeTo = async (width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };

  /* Scrolling: with the page's animations frozen, so that "now" and "one second later" are read
     at known times, the names sit further left one second later. They are let run again after. */
  const expectNamesScroll = async (where: string) => {
    await freezeAnimations(page);
    const namesBefore = await namesLeft(list, CLIENTS);
    await advanceAnimationsOneSecond(page);
    const namesAfter = await namesLeft(list, CLIENTS);
    expectNamesMovedLeft(CLIENTS, namesBefore, namesAfter, where);
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.play()));
  };

  await expectNamesScroll('at 1280 px, on arrival');

  /* Widened to 1920 px, where the example site's five clients fit in the band. */
  await resizeTo(1920, 1080);
  const where = 'widened to 1920 px';
  /* Still: one second later, as the visitor lives it (the page's own time runs, untouched),
     every name sits where it was. */
  const namesBefore = await namesLeft(list, CLIENTS);
  await letOneSecondPass(page);
  const namesAfter = await namesLeft(list, CLIENTS);
  expectNamesStill(CLIENTS, namesBefore, namesAfter, where);
  const shown = await clientNamesShown(page, CLIENTS);
  for (const client of CLIENTS) {
    const copies = shown.filter((occurrence) => occurrence.name === client);
    /* Shown once: no copy of the name peeks in, even partly. */
    expect.soft(copies.length, `${where}, number of times "${client}" shows on screen (${copies.map((copy) => `${copy.left}–${copy.right} px`).join(', ')})`)
      .toBe(1);
  }

  /* Narrowed back to 1280 px, where they no longer fit: the band scrolls again. */
  await resizeTo(1280, 900);
  await expectNamesScroll('narrowed back to 1280 px');
});

test('on the English home page, assistive technologies get the same clients once each, in order, as the list "Trusted by"', async ({ page }) => {
  await page.goto('/en/');
  await expectClientList(page, 'Trusted by');
});

test('in French and in English, the client list keeps its list semantics in every browser: with its bullets removed, the list exposed to assistive technologies declares itself a list, alongside its label', async ({ page }) => {
  /* WebKit drops the list role of a list without bullets unless the list declares it: a computed
     role in Chromium would not show that, so the test checks what the page declares. */
  for (const [homePage, name] of [
    ['/fr/', 'Ils me font confiance'],
    ['/en/', 'Trusted by'],
  ]) {
    await page.goto(homePage);
    const list = page.getByRole('list', { name });
    await expect(list, `${homePage}: the list "${name}"`).toHaveAttribute('role', 'list');
    await expect(list, `${homePage}: the list "${name}"`).toHaveAttribute('aria-label', name);
  }
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
    await expectBandWithoutGap(page, '/fr/', PHONE_AND_DESKTOP_VIEWPORTS);
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
      const list = await openClientList(page, homePage);

      /* Still: one second later, as the visitor lives it (the page's own time runs, untouched),
         every name sits where it was. */
      const namesBefore = await namesLeft(list, clients);
      await letOneSecondPass(page);
      const namesAfter = await namesLeft(list, clients);
      expectNamesStill(clients, namesBefore, namesAfter, where);

      const occurrences = await clientNamesOnScreen(page, clients);
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

  test('when the client names stay still because they all fit — a single short client on a phone and on a desktop, the example site’s five on a 1920 px screen — the last name is not followed by a "|||" separator: one separates each name from the next, and none ends the list', async ({ page, context }) => {
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
      const list = await openClientList(page, homePage);

      /* The names stay still: one second later, as the visitor lives it, every name sits where it was. */
      const namesBefore = await namesLeft(list, clients);
      await letOneSecondPass(page);
      expectNamesStill(clients, namesBefore, await namesLeft(list, clients), where);

      /* On screen, in reading order, the names with a "|||" between two of them, and nothing after
         the last one (textOnScreen drops whitespace). */
      expect.soft(await textOnScreen(list), `${where}, text the client list shows on screen`)
        .toBe(clients.map((client) => client.replace(/ /g, '')).join('|||'));
    }
  });
});

test.describe('home page of another site, with few clients with long names', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_LONG_CLIENT_NAMES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a phone and on a desktop, the client names scroll at the same pace whatever the clients: a few long names move about as many pixels per second as the example site’s five shorter ones', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_LONG_CLIENT_NAMES, siteDirectory);
    /* tests/fixtures/long-client-names/content/_index.md declares three clients with long names,
       wider together than the band on a phone and on a 1280 px desktop, like the example site's five. */
    const sites = [
      { homePage: '/fr/', clients: CLIENTS },
      {
        homePage: `${SITE_WITH_LONG_CLIENT_NAMES.origin}/fr/`,
        clients: [
          'Manufacture de porcelaine Vercors-Aubrac',
          'Fonderie Castellane et fils associés',
          'Ateliers réunis de lutherie Sainte-Odile',
        ],
      },
    ];
    for (const { width, height } of PHONE_AND_DESKTOP_VIEWPORTS) {
      await page.setViewportSize({ width, height });
      /* The pace of each site's names, in pixels per second: how far left they move in one second. */
      const paces: number[] = [];
      for (const { homePage, clients } of sites) {
        const list = await openClientList(page, homePage);
        await freezeAnimations(page);
        const namesBefore = await namesLeft(list, clients);
        await advanceAnimationsOneSecond(page);
        const namesAfter = await namesLeft(list, clients);
        /* All the names of a site move together: their mean shift is the site's pace. */
        const shifts = namesBefore.map((before, index) => before - namesAfter[index]);
        paces.push(shifts.reduce((sum, shift) => sum + shift, 0) / shifts.length);
      }
      const [examplePace, longNamesPace] = paces;
      expect.soft(examplePace, `at ${width} px, the example site's names move left`).toBeGreaterThan(1);
      /* About as fast: room for rounding, not for another pace. */
      expect.soft(longNamesPace, `at ${width} px, pace of the long names (${longNamesPace} px/s) against the example site's (${examplePace} px/s)`)
        .toBeGreaterThanOrEqual(examplePace * 0.85);
      expect.soft(longNamesPace, `at ${width} px, pace of the long names (${longNamesPace} px/s) against the example site's (${examplePace} px/s)`)
        .toBeLessThanOrEqual(examplePace * 1.15);
    }
  });

  test('under prefers-reduced-motion: reduce, on a 320 × 568 phone, a client name wider than the band wraps onto several lines instead of being cut: every long name is shown whole, inside the window', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_LONG_CLIENT_NAMES, siteDirectory);
    /* The visitor asks for reduced motion, on a narrow phone. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { width, height } = { width: 320, height: 568 };
    await page.setViewportSize({ width, height });
    /* tests/fixtures/long-client-names/content/_index.md declares three clients whose names are
       each wider than the band of a 320 px phone. */
    const clients = [
      'Manufacture de porcelaine Vercors-Aubrac',
      'Fonderie Castellane et fils associés',
      'Ateliers réunis de lutherie Sainte-Odile',
    ];
    await openClientList(page, `${SITE_WITH_LONG_CLIENT_NAMES.origin}/fr/`);
    /* Shown whole: nothing of a name is cut by the band or runs past the window's right edge. */
    const shown = await clientNamesShown(page, clients);
    expectEachNameShownOnceAndWhole(shown, clients, `at ${width} × ${height}`);
  });

  test('under prefers-reduced-motion: reduce, on a phone, down to 320 px wide, and on a desktop, where long names wrap onto several lines, no line of the band starts with a "|||" separator: each separator stays on the line where its name ends', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_LONG_CLIENT_NAMES, siteDirectory);
    /* The visitor asks for reduced motion. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    const list = await openClientList(page, `${SITE_WITH_LONG_CLIENT_NAMES.origin}/fr/`);
    /* A narrow phone, a common phone, a tablet and a desktop: widths where a name's last
       characters fill its line, so that a separator allowed to break off would drop onto a line
       of its own. */
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      /* For each name: the box of the last line its text covers, and the box of its whole item,
         separator included. The separator is drawn after the name's text, inside the item: if it
         dropped alone onto a line of its own, the item would end a whole line below the name's
         last line. */
      const names = await list.getByRole('listitem').evaluateAll((items) =>
        items.map((item) => {
          const range = document.createRange();
          range.selectNodeContents(item);
          const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
          const lastLine = lines.reduce((last, rect) => (rect.bottom > last.bottom ? rect : last), lines[0]);
          const box = item.getBoundingClientRect();
          return {
            name: item.textContent ?? '',
            lineCount: new Set(lines.map((rect) => Math.round(rect.top))).size,
            lastLineBottom: lastLine.bottom,
            lastLineHeight: lastLine.height,
            itemBottom: box.bottom,
          };
        }),
      );
      for (const name of names) {
        /* Within half a line: room for rounding, not for one more line. */
        expect.soft(name.itemBottom, `at ${width} px, bottom of the item of "${name.name}" (separator included, its text on ${name.lineCount} line(s)) against the bottom of the name's last line (${name.lastLineBottom} px)`)
          .toBeLessThanOrEqual(name.lastLineBottom + name.lastLineHeight / 2);
      }
    }
  });
});

test.describe('home page of another site, with a client name made of a single long word', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_ONE_WORD_CLIENT_NAME);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('under prefers-reduced-motion: reduce, on a 320 × 568 phone, a client name made of a single word wider than the band breaks onto several lines instead of being cut: every name is shown whole, inside the window', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_ONE_WORD_CLIENT_NAME, siteDirectory);
    /* The visitor asks for reduced motion, on a narrow phone. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { width, height } = { width: 320, height: 568 };
    await page.setViewportSize({ width, height });
    /* tests/fixtures/one-word-client-name/content/_index.md declares a client whose name is a
       single word of 36 letters, without space or hyphen, wider than the band of a 320 px phone,
       and a short one. */
    const clients = ['Kunstschmiedewerkstattgenossenschaft', 'Atelier Bonnefoy'];
    await openClientList(page, `${SITE_WITH_A_ONE_WORD_CLIENT_NAME.origin}/fr/`);
    /* Shown whole: nothing of a name is cut by the band or runs past the window's right edge. */
    const shown = await clientNamesShown(page, clients);
    expectEachNameShownOnceAndWhole(shown, clients, `at ${width} × ${height}`);
  });
});

/* Checks, at each of the `viewports` sizes (where the list is wider than the band), that the
   client band of the home page at `homePage` never shows a gap: at any moment of the loop, names
   cover its whole width, and the end of a loop looks like its start. */
async function expectBandWithoutGap(page: Page, homePage: string, viewports: { width: number; height: number }[]) {
  for (const { width, height } of viewports) {
    const where = `on ${homePage} at ${width} px`;
    await page.setViewportSize({ width, height });
    const list = await openClientList(page, homePage);
    /* The page's animations are frozen; the band's loop (the animations of the box that clips
       the names, or of what it holds) is then set to chosen moments, as a fraction of its length. */
    await freezeAnimations(page);
    const loop = await bandLoop(list);
    expect(await loop.animationCount(), `${where}, the band loops`).toBeGreaterThan(0);

    /* At a moment of the loop (a fraction of its length, or that length minus a fraction), the
       part of the window that clips the names, as the visitor sees it, and the box of every name
       in it, separator included, from left to right, with whether it shows in the window. */
    const bandAt = async ({ fraction, fromEnd }: { fraction: number; fromEnd?: boolean }) => {
      await loop.setAt(fromEnd ? 1 - fraction : fraction);
      return loop.window.evaluate((window) => {
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
      });
    };

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

/* These tests only run hugo build, without a browser: running them in every Playwright
   project would repeat the same build five times. */
const BUILD_TESTS_PROJECT = 'chromium';

test.describe('client content errors: build failure', () => {
  test.skip(
    () => test.info().project.name !== BUILD_TESTS_PROJECT,
    `build without a browser, identical in every project: run in ${BUILD_TESTS_PROJECT} only`,
  );

  test('a home page whose clients parameter is a text instead of a list makes the site build fail, with a French error message that names the clients parameter', () => {
    /* tests/fixtures/name-as-text/content/_index.md declares clients = 'Maison Delorme', a
       text rather than a list of names. Rather than a band built from that text, the person
       building the site must get a failure whose French message names the clients parameter
       of the front matter, in the style of the hero's messages ("le paramètre author…"),
       whatever the rest of the wording. Requiring "paramètre clients" also keeps a template
       execution error that merely quotes $clients or .Params.clients from passing. */
    const build = tryToBuildSite(SITE_WITH_CLIENTS_AS_TEXT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toMatch(/\bparamètre\s+clients\b/);
  });

  test('a home page whose clients list holds an entry that is not a name makes the site build fail, with a French error message that names the clients parameter', () => {
    /* tests/fixtures/name-as-map/content/_index.md declares clients as a list, so the check
       that clients is a list lets it through, but its second entry is a table,
       { name = 'Maison Delorme' }, rather than a name. Rather than a band showing that table
       as raw text, the person building the site must get a failure whose French message names
       the clients parameter of the front matter, whatever the rest of the wording. */
    const build = tryToBuildSite(SITE_WITH_A_CLIENT_AS_MAP);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toMatch(/\bparamètre\s+clients\b/);
  });
});
