import { expect, type Locator, type Page } from '@playwright/test';

/* The hero of the French home page: the main content region named by its main heading (a
   section labeled by the h1). */
export function heroRegion(page: Page): Locator {
  return page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
}

/* The list of clients of the French home page, named by the client band's label. */
export function clientList(page: Page): Locator {
  return page.getByRole('list', { name: 'Ils me font confiance' });
}

/* The box, in the window, of the client band of the open home page: the visible strip that holds
   the list "Ils me font confiance", that is the list itself or its nearest ancestor that spans the
   page width (the document's client width, within 1 px) without holding the hero's heading.
   Null when no such strip exists. */
export async function clientBandBox(page: Page): Promise<{ left: number; right: number; top: number; bottom: number } | null> {
  const list = clientList(page);
  await expect(list).toBeVisible();
  return list.evaluate((element) => {
    const pageWidth = document.documentElement.clientWidth;
    const heading = document.querySelector('main h1');
    for (let candidate: Element | null = element; candidate && candidate !== document.body; candidate = candidate.parentElement) {
      if (heading && candidate.contains(heading)) return null;
      const { left, right, top, bottom } = candidate.getBoundingClientRect();
      if (Math.abs(left) <= 1 && Math.abs(right - pageWidth) <= 1) return { left, right, top, bottom };
    }
    return null;
  });
}
