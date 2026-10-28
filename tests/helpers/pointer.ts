import { type Locator, type Page } from '@playwright/test';

/* The middle of the first line box of an element's text, in px from the top left corner of the
   window: rather than the middle of the element's box, which may span the whole width, a point
   that stays on its letters even if the text wraps. */
export async function middleOfFirstLine(element: Locator): Promise<{ x: number; y: number }> {
  return element.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const box = range.getClientRects()[0];
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
}

/* A press at a point of the page, as the device makes it: a tap on a touch screen, a click
   with a mouse otherwise. */
export async function clickOrTap(page: Page, hasTouch: boolean, point: { x: number; y: number }): Promise<void> {
  if (hasTouch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
