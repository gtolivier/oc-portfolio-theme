import { test, expect, type Locator } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';

/* The signs a scrambled letter can be replaced with. */
const SIGNS = '|/\\<>[]{}=+#·';

/* Text an element shows on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements (without the alternative text of a
   `content: "…" / "…"`), whitespace excluded. Text that only assistive technologies get is
   left out: under an element that is not displayed, invisible, fully transparent, clipped,
   or reduced to a box of at most 1px with its overflow hidden. Independent of the chosen
   markup. */
async function textOnScreen(element: Locator): Promise<string> {
  return (await textOnScreenWithSpaces(element)).replace(/ /g, '');
}

/* Same as textOnScreen, but with its spaces kept: every run of whitespace becomes a single
   space, as the browser renders it, and leading and trailing whitespace is dropped. */
async function textOnScreenWithSpaces(element: Locator): Promise<string> {
  const text = await element.evaluate((root) => {
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
    const generated = (el: Element, pseudo: '::before' | '::after') => {
      const content = getComputedStyle(el, pseudo).content;
      const strings = content.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
      return strings.map((string) => JSON.parse(string) as string).join('');
    };
    const walk = (el: Element): string => {
      if (hides(el)) return '';
      let result = generated(el, '::before');
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) result += child.textContent ?? '';
        else if (child.nodeType === Node.ELEMENT_NODE) result += walk(child as Element);
      }
      return result + generated(el, '::after');
    };
    return walk(root);
  });
  return text.replace(/\s+/g, ' ').trim();
}

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

  test('right after load, a scramble-text shows none of the letters of its text: each one is replaced by a sign from | / \\ < > [ ] { } = + # ·', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads: no
       animation frame runs and no timer with a delay fires, the page stays as it is right
       after load. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`);
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

  test('1.5 s after load, a short scramble-text shows its text in clear', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 1.5 s. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`);
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is a single short word: "Échappement". */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    await page.clock.runFor(1500);
    expect(await textOnScreen(scrambleText)).toBe('Échappement');
  });

  test('a scramble-text decodes left to right: midway, its first letters are in clear and its last ones still scrambled', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`);
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the text during the delay and after it. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text-delay/`);
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 1.5 s. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text-lengths/`);
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

  test('while a scramble-text decodes, the accessible name of the heading that contains it is its final text', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text-heading/`);
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

  test('while a scramble-text decodes, its spaces stay spaces, at the same positions', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text-lengths/`);
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

  test('while a scramble-text decodes, the box it takes on screen keeps the width and height of its final text', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`);
    /* The size of a text depends on its font: the theme's fonts are loaded before measuring. */
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement". */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    const size = () =>
      scrambleText.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      });
    /* From load until the text is in clear (1.5 s), every 25 ms: the size of the box,
       along with what is shown at that moment. */
    const sizes: { elapsed: number; shown: string; width: number; height: number }[] = [];
    for (let elapsed = 0; elapsed < 1500; elapsed += 25) {
      if (elapsed > 0) await page.clock.runFor(25);
      sizes.push({ elapsed, shown: await textOnScreen(scrambleText), ...(await size()) });
    }
    await page.clock.runFor(25);
    expect(await textOnScreen(scrambleText)).toBe('Échappement');
    const final = await size();
    /* At every moment of the decoding, the box is as wide and as high as once the text is
       in clear, to within half a pixel: the layout around it does not move. */
    for (const { elapsed, shown, width, height } of sizes) {
      expect(
        Math.abs(width - final.width),
        `at ${elapsed} ms, while "${shown}" is shown, the box is ${width}px wide, the final text ${final.width}px`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(height - final.height),
        `at ${elapsed} ms, while "${shown}" is shown, the box is ${height}px high, the final text ${final.height}px`,
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test('a long scramble-text wraps like plain text in a narrow container: while it decodes and once in clear, it spans several lines and stays within the container width', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step, to watch the decoding as it goes. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text-wrap/`);
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
    /* From load until the sentence is in clear (about 10 s for its letters), every 500 ms:
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

  test('under prefers-reduced-motion: reduce, a scramble-text shows its text in clear from load', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* The visitor asks for reduced motion, and time stands still from before the page
       loads: no animation frame runs and no timer with a delay fires, the page stays as it
       is right after load. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`);
    /* The only scramble-text of the page (tests/fixtures/catalog/content/scramble-text.md),
       whose text is "Échappement". */
    const scrambleText = page.getByRole('main').locator('scramble-text');
    await expect(scrambleText).toHaveCount(1);
    expect(await textOnScreen(scrambleText)).toBe('Échappement');
  });

  test('if the visitor turns on reduced motion while a scramble-text decodes, its text is in clear at once', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it to the middle of the decoding. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/scramble-text/`);
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
