import { type Locator, type Page } from '@playwright/test';

/* The hero of the French home page: the main content region named by its main heading (a
   section labeled by the h1). */
export function heroRegion(page: Page): Locator {
  return page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
}
