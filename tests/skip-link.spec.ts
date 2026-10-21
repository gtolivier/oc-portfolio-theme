import { test, expect, type Locator } from '@playwright/test';

/* Ce qu'un visiteur voyant perçoit : une boîte de taille réelle (plus d'un
   pixel de côté) qui se trouve dans la fenêtre. */
async function estVisibleALEcran(element: Locator): Promise<boolean> {
  const boite = await element.boundingBox();
  if (!boite || boite.width <= 1 || boite.height <= 1) return false;
  const fenetre = element.page().viewportSize()!;
  return (
    boite.x + boite.width > 0 &&
    boite.y + boite.height > 0 &&
    boite.x < fenetre.width &&
    boite.y < fenetre.height
  );
}

/* WebKit ne parcourt pas les liens avec Tab seule (réglage de Safari). */
function toucheDeTabulation(browserName: string): string {
  return browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
}

test('sur une page française, la première tabulation focalise un lien « Aller au contenu » invisible jusque-là, qui apparaît à l’écran', async ({ page, browserName }) => {
  await page.goto('/');
  const lien = page.getByRole('link', { name: 'Aller au contenu', exact: true });
  await expect(lien).toBeAttached();
  expect(await estVisibleALEcran(lien)).toBe(false);

  await page.keyboard.press(toucheDeTabulation(browserName));

  await expect(lien).toBeFocused();
  await expect(lien).toBeInViewport();
  await expect.poll(() => estVisibleALEcran(lien)).toBe(true);
});

test('sur la page d’accueil anglaise, la première tabulation focalise un lien intitulé « Skip to content »', async ({ page, browserName }) => {
  await page.goto('/en/');
  const lien = page.getByRole('link', { name: 'Skip to content', exact: true });

  await page.keyboard.press(toucheDeTabulation(browserName));

  await expect(lien).toBeFocused();
});

test('activer « Aller au contenu » à la touche Entrée place le focus sur le contenu principal, et la tabulation suivante atteint le premier lien du contenu', async ({ page, browserName }) => {
  await page.goto('/');
  const lien = page.getByRole('link', { name: 'Aller au contenu', exact: true });
  const tabulation = toucheDeTabulation(browserName);

  await page.keyboard.press(tabulation);
  await expect(lien).toBeFocused();
  await page.keyboard.press('Enter');

  const contenu = page.getByRole('main');
  await expect(contenu).toBeFocused();

  await page.keyboard.press(tabulation);
  await expect(contenu.getByRole('link', { name: 'projets d’exemple', exact: true })).toBeFocused();
});
