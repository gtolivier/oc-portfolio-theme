import { type Locator } from '@playwright/test';

/* The computed style of the element that directly holds a piece of text. */
export interface TextPieceStyle {
  text: string;
  fontFamily: string;
  fontSize: string;
  letterSpacing: string;
  color: string;
}

/* Each non-blank text node of the element, in document order, trimmed, with the computed
   style of the element that directly holds it. */
export async function textPieceStyles(element: Locator): Promise<TextPieceStyle[]> {
  return element.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const pieces: TextPieceStyle[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent!.trim();
      if (text === '') continue;
      const style = getComputedStyle(node.parentElement!);
      pieces.push({
        text,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        letterSpacing: style.letterSpacing,
        color: style.color,
      });
    }
    return pieces;
  });
}
