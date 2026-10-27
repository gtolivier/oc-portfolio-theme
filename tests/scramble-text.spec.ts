import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import { SIGNS, textOnScreen, textOnScreenWithSpaces } from './helpers/text-on-screen';

/* Where the characters an element shows on screen are drawn: the box of each visible
   character of its text nodes, whitespace excluded, under the same visibility rules as
   textOnScreen. */
async function visibleCharacterBoxes(element: Locator): Promise<{ left: number; right: number; top: number; bottom: number }[]> {
  return element.evaluate((root) => {
    const hides = (el: Element) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        style.clipPath !== 'none' ||
        (style.clip !== '' && style.clip !== 'auto') ||
        (style.overflow !== 'visible' && (box.width <= 1 || box.height <= 1))
      );
    };
    const boxes: { left: number; right: number; top: number; bottom: number }[] = [];
    const walk = (el: Element) => {
      if (hides(el)) return;
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child as Element);
          continue;
        }
        if (child.nodeType !== Node.TEXT_NODE) continue;
        const text = child.textContent ?? '';
        let offset = 0;
        for (const character of Array.from(text)) {
          const end = offset + character.length;
          if (!/\s/.test(character)) {
            const range = document.createRange();
            range.setStart(child, offset);
            range.setEnd(child, end);
            for (const rect of Array.from(range.getClientRects())) {
              if (rect.width > 0 && rect.height > 0) {
                boxes.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
              }
            }
          }
          offset = end;
        }
      }
    };
    walk(root);
    return boxes;
  });
}

test.describe('catalog: scramble-text', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(CATALOG_SITE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  /* Serves the catalog and opens its French page `slug`, the visitor's motion preference
     emulated as `reducedMotion`, and time standing still from before the page loads, until
     the test advances it. */
  const openCatalogPage = async (
    page: Page,
    context: BrowserContext,
    slug: string,
    reducedMotion: 'reduce' | 'no-preference',
  ): Promise<void> => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await page.emulateMedia({ reducedMotion });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/${slug}/`);
  };

  test('right after load, a scramble-text shows none of the letters of its text: each one is replaced by a sign from | / \\ < > [ ] { } = + # ·', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads: no
       animation frame runs and no timer with a delay fires, the page stays as it is right
       after load. */
    await openCatalogPage(page, context, 'scramble-text', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement": 11 letters. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const shown = await textOnScreen(scrambleText);
    const word = 'Échappement';
    expect(Array.from(shown), `"${shown}" shows one sign per letter of "${word}"`).toHaveLength(word.length);
    for (const character of Array.from(shown)) {
      expect(SIGNS, `"${character}", shown in "${shown}", is one of the signs`).toContain(character);
    }
  });

  test('while the theme script is still loading, a scramble-text shows none of the letters of its text', async ({ page, context }) => {
    /* Animations are allowed. The theme script is held back, as on a slow connection: the
       page is parsed and painted before the script runs. */
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let releaseScript!: () => void;
    const scriptReleased = new Promise<void>((resolve) => {
      releaseScript = resolve;
    });
    let scriptRequested!: () => void;
    const scriptHeld = new Promise<void>((resolve) => {
      scriptRequested = resolve;
    });
    await page.route(`${CATALOG_SITE.origin}/js/main*.js`, async (route) => {
      scriptRequested();
      await scriptReleased;
      await route.fallback();
    });
    try {
      await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`, { waitUntil: 'commit' });
      await scriptHeld;
      /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
         whose text is "Échappement". */
      const scrambleText = page.getByRole('main').locator('scramble-text');
      await expect(scrambleText).toHaveCount(1);
      /* Two animation frames: the page, scramble-text included, has been painted at least
         once, while the script is still on its way. */
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      const shown = await textOnScreen(scrambleText);
      const letters = Array.from('Échappement');
      for (const character of Array.from(shown)) {
        expect(letters, `"${character}", shown in "${shown}" before the script has run, is not one of its letters`).not.toContain(character);
      }
    } finally {
      releaseScript();
    }
  });

  test('1.5 s after load, a short scramble-text shows its text in clear', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 1.5 s. */
    await openCatalogPage(page, context, 'scramble-text', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is a single short word: "Échappement". */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    await page.clock.runFor(1500);
    expect(await textOnScreen(scrambleText)).toBe('Échappement');
  });

  test('a scramble-text decodes left to right: midway, its first letters are in clear and its last ones still scrambled', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await openCatalogPage(page, context, 'scramble-text', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement": 11 letters. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const letters = Array.from('Échappement');
    /* From load until the text is in clear (1.5 s), every 25 ms: what is shown is always a
       run of the first letters in clear, followed by signs in place of the remaining ones. */
    const clearCounts: number[] = [];
    for (let elapsed = 0; elapsed <= 1500; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      const shown = Array.from(await textOnScreen(scrambleText));
      let clear = 0;
      while (clear < letters.length && shown[clear] === letters[clear]) clear += 1;
      const rest = shown.slice(clear);
      expect(shown, `at ${elapsed} ms, "${shown.join('')}" shows one character per letter`).toHaveLength(letters.length);
      for (const character of rest) {
        expect(SIGNS, `at ${elapsed} ms, "${character}", after the first ${clear} letters in clear of "${shown.join('')}", is one of the signs`).toContain(character);
      }
      clearCounts.push(clear);
    }
    /* Midway, the text is neither fully scrambled nor fully in clear. */
    expect(
      clearCounts.some((clear) => clear > 0 && clear < letters.length),
      `at some moment, the first letters are in clear and the last ones still scrambled (letters in clear, every 25 ms: ${clearCounts.join(', ')})`,
    ).toBe(true);
  });

  test('with a delay, a scramble-text stays fully scrambled until the delay is over, then decodes and ends in clear', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the text during the delay and after it. */
    await openCatalogPage(page, context, 'scramble-text-delay', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text-delay.md),
       whose text is "Échappement" (11 letters) and whose delay is 1000 ms. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const word = 'Échappement';
    /* From load until the delay is over, every 25 ms: every letter is replaced by a sign. */
    for (let elapsed = 0; elapsed < 1000; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      const shown = await textOnScreen(scrambleText);
      expect(Array.from(shown), `at ${elapsed} ms, "${shown}" shows one sign per letter of "${word}"`).toHaveLength(word.length);
      for (const character of Array.from(shown)) {
        expect(SIGNS, `at ${elapsed} ms, during the delay, "${character}", shown in "${shown}", is one of the signs`).toContain(character);
      }
    }
    /* Once the delay is over, the text decodes as it would without one: 1.5 s later, it
       is in clear. */
    await page.clock.runFor(25 + 1500);
    expect(await textOnScreen(scrambleText)).toBe(word);
  });

  test('a scramble-text takes longer to decode the longer its text: when a short one is in clear, a long one on the same page is still partly scrambled', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 1.5 s. */
    await openCatalogPage(page, context, 'scramble-text-lengths', 'no-preference');
    /* The two scramble-texts of the page (tests/fixtures/catalog/content/scramble-text-lengths.md):
       a short one, "Échappement" (11 letters), then a long sentence (over 90 letters). */
    const scrambleTexts = page.getByRole('main').locator('scramble-text');
    await expect(scrambleTexts).toHaveCount(2);
    const short = 'Échappement';
    const long = 'Un texte brouillé se décode de gauche à droite, une lettre après une autre, puis finit par se montrer entièrement en clair'.replace(/\s+/g, '');
    /* 1.5 s after load, the short text is in clear. */
    await page.clock.runFor(1500);
    expect(await textOnScreen(scrambleTexts.nth(0))).toBe(short);
    /* At that moment, the long one still shows signs in place of some of its letters. */
    const shown = Array.from(await textOnScreen(scrambleTexts.nth(1)));
    const letters = Array.from(long);
    expect(shown, `"${shown.join('')}" shows one character per letter of the long text`).toHaveLength(letters.length);
    expect(
      shown.some((character, index) => character !== letters[index] && SIGNS.includes(character)),
      `when the short text is in clear, the long one, "${shown.join('')}", still shows signs in place of some of its letters`,
    ).toBe(true);
  });

  test('however long its text, a scramble-text is in clear 2 s after it starts decoding: a sentence of over 90 letters is in clear 2.1 s after load', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 2.1 s. */
    await openCatalogPage(page, context, 'scramble-text-lengths', 'no-preference');
    /* The second scramble-text of the page (tests/fixtures/catalog/content/scramble-text-lengths.md),
       a long sentence (over 90 letters) without a delay: it starts decoding at load. At a
       tenth of a second per letter, it would still be decoding for more than 9 s. */
    const scrambleTexts = page.getByRole('main').locator('scramble-text');
    await expect(scrambleTexts).toHaveCount(2);
    const long = 'Un texte brouillé se décode de gauche à droite, une lettre après une autre, puis finit par se montrer entièrement en clair'.replace(/\s+/g, '');
    expect(Array.from(long).length, 'the sentence has over 90 letters').toBeGreaterThan(90);
    /* 2.1 s after load, a little more than the 2 s cap, the whole sentence is in clear. */
    await page.clock.runFor(2100);
    expect(await textOnScreen(scrambleTexts.nth(1))).toBe(long);
  });

  test('even when the main thread of the page is busy while it decodes, a scramble-text is in clear 2 s after it starts decoding: a sentence of over 90 letters, the page busy for 1 s midway, is in clear 2.1 s after load', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it. */
    await openCatalogPage(page, context, 'scramble-text-lengths', 'no-preference');
    /* The second scramble-text of the page (tests/fixtures/catalog/content/scramble-text-lengths.md),
       a long sentence (over 90 letters) without a delay: it starts decoding at load, and on an
       idle page it is in clear 2 s later. */
    const scrambleTexts = page.getByRole('main').locator('scramble-text');
    await expect(scrambleTexts).toHaveCount(2);
    const long = 'Un texte brouillé se décode de gauche à droite, une lettre après une autre, puis finit par se montrer entièrement en clair'.replace(/\s+/g, '');
    expect(Array.from(long).length, 'the sentence has over 90 letters').toBeGreaterThan(90);
    /* 0.5 s after load, while it decodes, the main thread of the page is busy for 1 s, as under
       heavy page scripts or on a slow device. For the page's timers, that is time jumping 1 s
       ahead: each timer due meanwhile fires at most once, at the end, the callbacks it missed
       skipped rather than replayed. */
    await page.clock.runFor(500);
    await page.clock.fastForward(1000);
    /* 2.1 s after load, a little more than the 2 s cap, the whole sentence is in clear all the
       same. */
    await page.clock.runFor(600);
    expect(await textOnScreen(scrambleTexts.nth(1))).toBe(long);
  });

  test('with a short duration (0.6 s), a long scramble-text is in clear 0.6 s after it starts decoding: a sentence of over 90 letters is in clear 1 s after load', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 1 s. */
    await openCatalogPage(page, context, 'scramble-text-duration', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text-duration.md),
       a long sentence (over 90 letters) without a delay, whose duration is 600 ms: it starts
       decoding at load. Without a duration, it would still be decoding until 2 s after load. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const long = 'Un texte brouillé se décode de gauche à droite, une lettre après une autre, puis finit par se montrer entièrement en clair'.replace(/\s+/g, '');
    expect(Array.from(long).length, 'the sentence has over 90 letters').toBeGreaterThan(90);
    /* 1 s after load, safely past the 0.6 s duration and well before the 2 s it takes
       without one, the whole sentence is in clear. */
    await page.clock.runFor(1000);
    expect(await textOnScreen(scrambleText)).toBe(long);
  });

  test('with a long duration (3 s), a short scramble-text is still partly scrambled 2 s after it starts decoding, and in clear 3 s after', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 2 s, then 3 s. */
    await openCatalogPage(page, context, 'scramble-text-long-duration', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text-long-duration.md),
       a single short word, "Échappement" (11 letters), without a delay, whose duration is
       3000 ms: it starts decoding at load. Without a duration, it would be in clear 1.5 s
       after load. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const word = 'Échappement';
    /* 2 s after load, past the 1.5 s it takes without a duration and well before the 3 s
       duration, some of its letters are still replaced by signs. */
    await page.clock.runFor(2000);
    const shown = Array.from(await textOnScreen(scrambleText));
    const letters = Array.from(word);
    expect(shown, `at 2 s, "${shown.join('')}" shows one character per letter of "${word}"`).toHaveLength(letters.length);
    expect(
      shown.some((character, index) => character !== letters[index] && SIGNS.includes(character)),
      `at 2 s, "${shown.join('')}" still shows signs in place of some of its letters`,
    ).toBe(true);
    /* 3 s after load, once the duration is over, the word is in clear. */
    await page.clock.runFor(1000);
    expect(await textOnScreen(scrambleText)).toBe(word);
  });

  test('while a scramble-text decodes, the accessible name of the heading that contains it is its final text', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await openCatalogPage(page, context, 'scramble-text-heading', 'no-preference');
    /* The only second-level heading of the page (tests/fixtures/catalog/content/scramble-text-heading.md),
       whose whole text is a scramble-text: "Échappement". */
    const heading = page.getByRole('main').getByRole('heading', { level: 2 });
    await expect(heading).toHaveCount(1);
    await expect(heading.locator('scramble-text')).toHaveCount(1);
    /* From load until the text is in clear (1.5 s), every 25 ms: assistive technologies
       name the heading "Échappement", never the signs shown on screen. */
    for (let elapsed = 0; elapsed < 1500; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      const shown = await textOnScreen(heading);
      await expect(heading, `at ${elapsed} ms, while "${shown}" is shown`).toHaveAccessibleName('Échappement');
      await expect(
        page.getByRole('main').getByRole('heading', { level: 2, name: 'Échappement', exact: true }),
        `at ${elapsed} ms, while "${shown}" is shown, the heading is found by its name`,
      ).toHaveCount(1);
    }
  });

  test('while a scramble-text decodes, assistive technologies are given only its final text: none of its signs is in the accessibility tree', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await openCatalogPage(page, context, 'scramble-text-heading', 'no-preference');
    /* The only second-level heading of the page (tests/fixtures/catalog/content/scramble-text-heading.md),
       whose whole text is a scramble-text: "Échappement". */
    const heading = page.getByRole('main').getByRole('heading', { level: 2 });
    await expect(heading).toHaveCount(1);
    await expect(heading.locator('scramble-text')).toHaveCount(1);
    /* From load until the text is in clear (1.5 s), every 25 ms: the accessibility tree of
       the heading — its role, its name and every text a screen reader can reach inside it,
       such as when it reads the page line by line — holds "Échappement" and none of the
       signs shown on screen. Its level, written "[level=2]", is not text and is left out. */
    for (let elapsed = 0; elapsed < 1500; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      const shown = await textOnScreen(heading);
      const accessibilityTree = await heading.ariaSnapshot();
      const exposed = accessibilityTree.replace('[level=2]', '');
      expect(exposed, `at ${elapsed} ms, while "${shown}" is shown, assistive technologies get the final text`).toContain('Échappement');
      for (const sign of Array.from(SIGNS)) {
        expect(
          exposed,
          `at ${elapsed} ms, while "${shown}" is shown, the accessibility tree of the heading holds no "${sign}":\n${accessibilityTree}`,
        ).not.toContain(sign);
      }
    }
  });

  test('while a scramble-text decodes, its spaces stay spaces, at the same positions', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await openCatalogPage(page, context, 'scramble-text-lengths', 'no-preference');
    /* The second scramble-text of the page (tests/fixtures/catalog/content/scramble-text-lengths.md),
       a long sentence with many spaces, still decoding 1.5 s after load. */
    const scrambleTexts = page.getByRole('main').locator('scramble-text');
    await expect(scrambleTexts).toHaveCount(2);
    const sentence = Array.from('Un texte brouillé se décode de gauche à droite, une lettre après une autre, puis finit par se montrer entièrement en clair');
    /* From load to 1.5 s later, every 25 ms: one character is shown per character of the
       sentence, a space exactly where the sentence has one, and no space elsewhere. */
    for (let elapsed = 0; elapsed <= 1500; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      const shown = Array.from(await textOnScreenWithSpaces(scrambleTexts.nth(1)));
      expect(shown, `at ${elapsed} ms, "${shown.join('')}" shows one character per character of the sentence`).toHaveLength(sentence.length);
      sentence.forEach((character, index) => {
        expect(
          shown[index] === ' ',
          `at ${elapsed} ms, in "${shown.join('')}", character ${index} is a space exactly when the sentence has one there`,
        ).toBe(character === ' ');
      });
    }
  });

  test('while a scramble-text decodes, it stays as wide as its final text, and the line that holds it as high as once in clear', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await openCatalogPage(page, context, 'scramble-text', 'no-preference');
    /* The size of a text depends on its font: the theme's fonts are loaded before measuring. */
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement", alone on the line of its paragraph. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const paragraph = page.getByRole('main').locator('p', { has: page.locator('scramble-text') });
    await expect(paragraph).toHaveCount(1);
    /* The width of the scramble-text itself, and the height of the paragraph that holds
       it: what the visitor sees of the line, whatever the box of the element alone, whose
       height depends on the font's metrics and on how it is laid out. */
    const size = async () => ({
      width: await scrambleText.evaluate((element) => element.getBoundingClientRect().width),
      lineHeight: await paragraph.evaluate((element) => element.getBoundingClientRect().height),
    });
    /* From load until the text is in clear (1.5 s), every 25 ms: those sizes, along with
       what is shown at that moment. */
    const sizes: { elapsed: number; shown: string; width: number; lineHeight: number }[] = [];
    for (let elapsed = 0; elapsed < 1500; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      sizes.push({ elapsed, shown: await textOnScreen(scrambleText), ...(await size()) });
    }
    await page.clock.runFor(25);
    expect(await textOnScreen(scrambleText)).toBe('Échappement');
    const final = await size();
    /* At every moment of the decoding, the scramble-text is as wide, and its line as high,
       as once the text is in clear, to within half a pixel: the layout around it does not
       move. */
    for (const { elapsed, shown, width, lineHeight } of sizes) {
      expect(
        Math.abs(width - final.width),
        `at ${elapsed} ms, while "${shown}" is shown, the scramble-text is ${width}px wide, the final text ${final.width}px`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(lineHeight - final.lineHeight),
        `at ${elapsed} ms, while "${shown}" is shown, the line that holds it is ${lineHeight}px high, ${final.lineHeight}px once in clear`,
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test('a long scramble-text wraps like plain text in a narrow container: while it decodes and once in clear, it spans several lines and stays within the container width', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await openCatalogPage(page, context, 'scramble-text-wrap', 'no-preference');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text-wrap.md):
       a long sentence, in a container 200px wide, much narrower than the sentence on one line. */
    const container = page.getByRole('main').getByTestId('narrow-container');
    const scrambleText = container.locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const sentence = 'Un texte brouillé se décode de gauche à droite, une lettre après une autre, puis finit par se montrer entièrement en clair'.replace(/\s+/g, '');
    const containerBox = await container.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    });
    /* From load until the sentence is in clear (2 s, however long it is), every 500 ms:
       the characters shown lie within the container's width and over several lines, as the
       same text would as plain text. Signs and letters may not have the same width, so the
       exact line breaks are not checked. */
    const checkWrapping = async (moment: string) => {
      const shown = await textOnScreen(scrambleText);
      const boxes = await visibleCharacterBoxes(scrambleText);
      expect(boxes.length, `${moment}, "${shown}" is drawn on screen`).toBeGreaterThan(0);
      const left = Math.min(...boxes.map((box) => box.left));
      const right = Math.max(...boxes.map((box) => box.right));
      const top = Math.min(...boxes.map((box) => box.top));
      const bottom = Math.max(...boxes.map((box) => box.bottom));
      const characterHeight = Math.max(...boxes.map((box) => box.bottom - box.top));
      expect(left, `${moment}, "${shown}" starts at ${left}px, the container at ${containerBox.left}px`).toBeGreaterThanOrEqual(containerBox.left - 0.5);
      expect(right, `${moment}, "${shown}" ends at ${right}px, the container at ${containerBox.right}px`).toBeLessThanOrEqual(containerBox.right + 0.5);
      expect(
        bottom - top,
        `${moment}, "${shown}" is ${bottom - top}px high, for characters ${characterHeight}px high: it spans several lines`,
      ).toBeGreaterThan(1.5 * characterHeight);
      return shown;
    };
    let shown = await checkWrapping('right after load');
    for (let elapsed = 500; elapsed <= 15000 && shown !== sentence; elapsed += 500) {
      await page.clock.runFor(500);
      shown = await checkWrapping(`at ${elapsed} ms`);
    }
    expect(shown, 'the sentence ends in clear').toBe(sentence);
  });

  test('once in clear, a scramble-text inside a paragraph wraps like plain text: its first word follows the text before it on the same line, and its words go on over the next lines', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it past the end of the decoding. */
    await openCatalogPage(page, context, 'scramble-text-in-paragraph', 'no-preference');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    /* The only paragraph of the page (tests/fixtures/catalog/content/scramble-text-in-paragraph.md),
       300px wide: a few words, "Au fil du texte,", then a scramble-text, a phrase much
       longer than what is left of the line, then more words. */
    const paragraph = page.getByRole('main').getByTestId('paragraph');
    const scrambleText = paragraph.locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const phrase = 'un texte brouillé se décode de gauche à droite puis se montre en clair';
    /* 2.1 s after load, a little more than the 2 s cap, the phrase is in clear. */
    await page.clock.runFor(2100);
    expect(await textOnScreen(scrambleText)).toBe(phrase.replace(/\s+/g, ''));
    /* Where the last character of the text before the scramble-text is drawn. */
    const before = await scrambleText.evaluate((element) => {
      const text = element.previousSibling;
      const content = text?.textContent ?? '';
      const end = content.trimEnd().length;
      const range = document.createRange();
      range.setStart(text as Node, end - 1);
      range.setEnd(text as Node, end);
      const box = range.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    });
    const boxes = await visibleCharacterBoxes(scrambleText);
    expect(boxes.length, 'the phrase is drawn on screen').toBeGreaterThan(0);
    const first = boxes[0];
    const last = boxes[boxes.length - 1];
    const middle = (box: { top: number; bottom: number }) => (box.top + box.bottom) / 2;
    const characterHeight = first.bottom - first.top;
    /* Its first word sits on the line of "Au fil du texte,", right after it. */
    expect(
      Math.abs(middle(first) - middle(before)),
      `the first letter of the phrase is drawn ${middle(first) - middle(before)}px below the text before it, for characters ${characterHeight}px high: on the same line`,
    ).toBeLessThan(characterHeight / 2);
    /* Its last word is on a line below: its words wrapped over more than one line. */
    expect(
      middle(last) - middle(first),
      `the last letter of the phrase is drawn ${middle(last) - middle(first)}px below its first one, for characters ${characterHeight}px high: on a later line`,
    ).toBeGreaterThan(characterHeight / 2);
  });

  test('a scramble-text in clear, removed from the page and inserted again, still shows its text, exactly once, and its accessible name is still that text', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it past the end of the decoding. */
    await openCatalogPage(page, context, 'scramble-text-heading', 'no-preference');
    /* The only second-level heading of the page (tests/fixtures/catalog/content/scramble-text-heading.md),
       whose whole text is a scramble-text: "Échappement", in clear 1.5 s after load. */
    const heading = page.getByRole('main').getByRole('heading', { level: 2 });
    await expect(heading).toHaveCount(1);
    const scrambleText = heading.locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const word = 'Échappement';
    await page.clock.runFor(1500);
    expect(await textOnScreen(scrambleText), 'before it is moved, the text is in clear').toBe(word);
    /* A page script moves it: removes it from the page, then inserts it again at the same
       place, as when a list is reordered. */
    await scrambleText.evaluate((element) => {
      const parent = element.parentNode as Node;
      const next = element.nextSibling;
      element.remove();
      parent.insertBefore(element, next);
    });
    await expect(scrambleText).toHaveCount(1);
    /* Right after it is inserted again, time still standing, then once 2 s have passed,
       longer than any decoding: the visitor sees "Échappement", once, and assistive
       technologies name the heading "Échappement". */
    for (const moment of ['right after it is inserted again', '2 s after it is inserted again']) {
      if (moment.startsWith('2 s')) await page.clock.runFor(2000);
      expect(await textOnScreen(scrambleText), `${moment}, the text is shown in clear, exactly once`).toBe(word);
      await expect(heading, moment).toHaveAccessibleName(word);
    }
  });

  test('under prefers-reduced-motion: reduce, a scramble-text shows its text in clear from load', async ({ page, context }) => {
    /* The visitor asks for reduced motion, and time stands still from before the page
       loads: no animation frame runs and no timer with a delay fires, the page stays as it
       is right after load. */
    await openCatalogPage(page, context, 'scramble-text', 'reduce');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement". */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    expect(await textOnScreen(scrambleText)).toBe('Échappement');
  });

  test('if the visitor turns on reduced motion while a scramble-text decodes, its text is in clear at once', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it to the middle of the decoding. */
    await openCatalogPage(page, context, 'scramble-text', 'no-preference');
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement": in clear 1.5 s after load. */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const word = 'Échappement';
    /* Halfway through the decoding, 750 ms after load, some letters are still scrambled. */
    await page.clock.runFor(750);
    const midway = await textOnScreen(scrambleText);
    expect(Array.from(midway), `at 750 ms, "${midway}" shows one character per letter of "${word}"`).toHaveLength(word.length);
    expect(
      Array.from(midway).some((character) => SIGNS.includes(character)),
      `at 750 ms, "${midway}" still shows signs in place of some letters`,
    ).toBe(true);
    /* The visitor then asks for reduced motion. Time moves by a single 25 ms step, far less
       than the 750 ms of decoding left, then stands still again: the text is in clear
       without waiting for the decoding to end. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(25);
    await expect
      .poll(() => textOnScreen(scrambleText), {
        message: 'once reduced motion is on, the text is in clear without the decoding going on',
        timeout: 2000,
      })
      .toBe(word);
  });
});
