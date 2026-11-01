import { test, expect, type Locator } from '@playwright/test';
import { tabKey } from './helpers/keyboard';

/* What a sighted visitor perceives: a box of real size (more than one pixel
   on each side) that lies within the viewport. */
async function isVisibleOnScreen(element: Locator): Promise<boolean> {
  const box = await element.boundingBox();
  if (!box || box.width <= 1 || box.height <= 1) return false;
  const viewport = element.page().viewportSize()!;
  return box.x + box.width > 0 && box.y + box.height > 0 && box.x < viewport.width && box.y < viewport.height;
}

test('on a French page, the first Tab focuses an "Aller au contenu" link, invisible until then, which appears on screen', async ({
  page,
  browserName,
}) => {
  await page.goto('/fr/');
  const link = page.getByRole('link', { name: 'Aller au contenu', exact: true });
  await expect(link).toBeAttached();
  expect(await isVisibleOnScreen(link)).toBe(false);

  await page.keyboard.press(tabKey(browserName));

  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
  await expect.poll(() => isVisibleOnScreen(link)).toBe(true);
});

test('activating "Aller au contenu" with the Enter key moves focus to the main content, and the next Tab reaches the first hero action button, "Voir les projets"', async ({
  page,
  browserName,
}) => {
  await page.goto('/fr/');
  const link = page.getByRole('link', { name: 'Aller au contenu', exact: true });
  const tab = tabKey(browserName);

  await page.keyboard.press(tab);
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');

  const content = page.getByRole('main');
  await expect(content).toBeFocused();

  await page.keyboard.press(tab);
  /* The hero, placed before the home page text, starts with its action
     buttons: the first one is the "Voir les projets" link. */
  await expect(content.getByRole('link', { name: 'Voir les projets', exact: true })).toBeFocused();
});
