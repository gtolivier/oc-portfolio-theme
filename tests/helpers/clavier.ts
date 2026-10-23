import { type Locator } from '@playwright/test';

/* WebKit ne parcourt pas les liens avec Tab seule (réglage de Safari). */
export function toucheDeTabulation(browserName: string): string {
  return browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
}

/* Tabule depuis le début de la page jusqu'à ce que l'élément reçoive le focus, comme un
   visiteur au clavier, sans dépasser un nombre de tabulations raisonnable. Lève une erreur
   si l'élément n'est jamais atteint. */
export async function tabulerJusqua(element: Locator, browserName: string, maximum = 30): Promise<void> {
  const page = element.page();
  const tabulation = toucheDeTabulation(browserName);
  for (let i = 0; i < maximum; i++) {
    await page.keyboard.press(tabulation);
    if (await element.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`élément non atteint après ${maximum} tabulations`);
}
