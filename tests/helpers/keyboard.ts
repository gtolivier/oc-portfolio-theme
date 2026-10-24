import { type Locator } from '@playwright/test';

/* WebKit does not move through links with Tab alone (a Safari setting). */
export function tabKey(browserName: string): string {
  return browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
}

/* Tabs from the start of the page until the element receives focus, like a
   keyboard visitor, without exceeding a reasonable number of tabs. Throws
   if the element is never reached. */
export async function tabUntilFocused(element: Locator, browserName: string, maximum = 30): Promise<void> {
  const page = element.page();
  const tab = tabKey(browserName);
  for (let i = 0; i < maximum; i++) {
    await page.keyboard.press(tab);
    if (await element.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`element not reached after ${maximum} tabs`);
}
