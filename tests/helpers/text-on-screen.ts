import { type Locator } from '@playwright/test';

/* The signs a scrambled letter can be replaced with. */
export const SIGNS = '|/\\<>[]{}=+#·';

/* Text an element shows on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements that show (without the alternative text
   of a `content: "…" / "…"`), whitespace excluded. Text that only assistive technologies get is
   left out: under an element that is not displayed, invisible, fully transparent, clipped,
   or reduced to a box of at most 1px with its overflow hidden. Independent of the chosen
   markup. */
export async function textOnScreen(element: Locator): Promise<string> {
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
      const style = getComputedStyle(el, pseudo);
      /* A pseudo-element that is not displayed, invisible or fully transparent shows nothing,
         whatever its content. */
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return '';
      const content = style.content;
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

/* Text an element displays on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements (without the alternative text of a
   `content: "…" / "…"`), hidden elements excluded. Independent of the chosen markup. Unlike
   textOnScreen, its spaces are kept (every run of whitespace becomes a single space, leading and
   trailing whitespace dropped) and only elements that are not displayed or invisible are left
   out. */
export async function displayedText(element: Locator): Promise<string> {
  const text = await element.evaluate((root) => {
    const generated = (el: Element, pseudo: '::before' | '::after') => {
      const content = getComputedStyle(el, pseudo).content;
      const strings = content.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
      return strings.map((string) => JSON.parse(string) as string).join('');
    };
    const walk = (el: Element): string => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return '';
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
