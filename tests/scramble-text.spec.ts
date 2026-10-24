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
});
