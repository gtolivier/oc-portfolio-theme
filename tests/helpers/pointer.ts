import { type Page } from '@playwright/test';

/* A press at a point of the page, as the device makes it: a tap on a touch screen, a click
   with a mouse otherwise. */
export async function clickOrTap(page: Page, hasTouch: boolean, point: { x: number; y: number }): Promise<void> {
  if (hasTouch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
