import { test, expect, type Locator } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';

/* The signs a scrambled letter can be replaced with. */
const SIGNS = '|/\\<>[]{}=+#·';

/* Text an element shows on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements (without the alternative text of a
   `content: "…" / "…"`), whitespace excluded. Text that only assistive technologies get is
   left out: under an element that is not displayed, invisible, fully transparent, clipped,
   or reduced to a box of at most 1px with its overflow hidden. Independent of the chosen
   markup. */
async function textOnScreen(element: Locator): Promise<string> {
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
  return text.replace(/\s+/g, '');
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
    await page.clock.install({ time: new Date('2026-01-01T09:00:00') });
    await page.clock.pauseAt(new Date('2026-01-01T09:00:00'));
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
    await page.clock.install({ time: new Date('2026-01-01T09:00:00') });
    await page.clock.pauseAt(new Date('2026-01-01T09:00:00'));
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
    await page.clock.install({ time: new Date('2026-01-01T09:00:00') });
    await page.clock.pauseAt(new Date('2026-01-01T09:00:00'));
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
    await page.clock.install({ time: new Date('2026-01-01T09:00:00') });
    await page.clock.pauseAt(new Date('2026-01-01T09:00:00'));
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
    await page.clock.install({ time: new Date('2026-01-01T09:00:00') });
    await page.clock.pauseAt(new Date('2026-01-01T09:00:00'));
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
});
