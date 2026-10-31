import { type Locator, type Page } from '@playwright/test';

/* The time the test lets pass on the page's fake clock once the page is rendered on the new
   screen: a redraw at the new density waits for nothing else. */
export const DELAY_AFTER_MOVE_MS = 100;

/* The window on a screen with another pixel density, at the same size in CSS pixels, as Chromium
   emulates it through the DevTools protocol. */
export type ScreenOfDensity = {
  /* Waits until the browser has rendered the page on the screen: a resize observer reports the
     element's box, as it does once it starts observing it. Then lets DELAY_AFTER_MOVE_MS pass on
     the page's fake clock. */
  waitForRender(element: Locator): Promise<void>;
  /* A screenshot of the element at the screen's density, taken through the same protocol:
     Playwright's own screenshot would bring back the density it emulates. Its clip is rounded out
     to whole CSS pixels, as Playwright's element screenshots are, so that the pixel helpers read
     it. */
  screenshot(element: Locator): Promise<Buffer>;
};

/* Moves the window to a screen with the given pixel density, at its current size in CSS pixels,
   and waits until the element is rendered there (see waitForRender). The page's clock must be a
   fake one (page.clock). */
export async function moveToScreenOfDensity(
  page: Page,
  { density, isMobile, rendered }: { density: number; isMobile: boolean; rendered: Locator },
): Promise<ScreenOfDensity> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('the page has no viewport size');
  const session = await page.context().newCDPSession(page);
  const screen: ScreenOfDensity = {
    async waitForRender(element) {
      await element.evaluate(
        (el) =>
          new Promise<void>((resolve) => {
            const observer = new ResizeObserver(() => {
              observer.disconnect();
              resolve();
            });
            observer.observe(el);
          }),
      );
      await page.clock.runFor(DELAY_AFTER_MOVE_MS);
    },
    async screenshot(element) {
      await element.scrollIntoViewIfNeeded();
      const clip = await element.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const left = Math.floor(box.left + window.scrollX);
        const top = Math.floor(box.top + window.scrollY);
        const right = Math.ceil(box.right + window.scrollX);
        const bottom = Math.ceil(box.bottom + window.scrollY);
        return { x: left, y: top, width: right - left, height: bottom - top, scale: 1 };
      });
      const { data } = await session.send('Page.captureScreenshot', { format: 'png', clip });
      return Buffer.from(data, 'base64');
    },
  };
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: density,
    mobile: isMobile,
  });
  await screen.waitForRender(rendered);
  return screen;
}
