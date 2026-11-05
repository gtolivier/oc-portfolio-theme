import { test, expect, type Locator, type Page } from '@playwright/test';
import { characterWeights } from './helpers/character-weights';
import { textPieceStyles } from './helpers/text-piece-styles';

/* The visible text of the footer logo, hidden from screen readers. */
function footerLogoText(page: Page): Locator {
  return page.locator('footer [aria-hidden="true"]');
}

test('the footer displays the site logo followed by "© <current year> <site author>"', async ({ page }) => {
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  const footer = page.locator('footer');
  await expect(footer).toHaveText(new RegExp(`\\| E \\|\\|\\| \\| X \\|\\|\\|\\s*(—\\s*)?© ${year} Jean Exemple`));
});

test('screen readers do not read the decorative bars of the footer logo', async ({ page }) => {
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  const accessibilityTree = await page.locator('footer').ariaSnapshot();
  expect(accessibilityTree).toContain(`© ${year} Jean Exemple`);
  expect(accessibilityTree).not.toContain('|');
});

test("the footer logo is plain footer text: in the header logo's font, with the size, letter-spacing, color and weight of the © line, and no bold bar", async ({
  page,
}) => {
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  const headerLogo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true })
    .locator('[aria-hidden="true"]');
  const logo = footerLogoText(page);
  const copyright = page.locator('footer').getByText(`© ${year} Jean Exemple`, { exact: true });
  await expect(headerLogo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(copyright).toBeVisible();

  const [copyrightStyle] = await textPieceStyles(copyright);
  const headerFontFamilies = new Set((await textPieceStyles(headerLogo)).map(({ fontFamily }) => fontFamily));
  expect(headerFontFamilies.size).toBe(1);
  const [headerFontFamily] = headerFontFamilies;

  /* Every piece of the footer logo's text, the bars included, looks like the © line, in the header logo's font. */
  const pieces = await textPieceStyles(logo);
  expect(pieces.length).toBeGreaterThan(0);
  expect(
    pieces.map(({ text, fontFamily, fontSize, letterSpacing, color }) => ({
      text,
      fontFamily,
      fontSize,
      letterSpacing,
      color,
    })),
  ).toEqual(
    pieces.map(({ text }) => ({
      text,
      fontFamily: headerFontFamily,
      fontSize: copyrightStyle.fontSize,
      letterSpacing: copyrightStyle.letterSpacing,
      color: copyrightStyle.color,
    })),
  );
  /* No character stands out in bold: each has the weight of the © line. */
  const visibleCharacters = [...'| E ||| | X |||'].filter((character) => character.trim() !== '');
  expect(await characterWeights(logo)).toEqual(
    visibleCharacters.map((character) => `${character} ${copyrightStyle.fontWeight}`),
  );
});

test('the footer displays the site footer note in the page language', async ({ page }) => {
  await page.goto('/fr/');
  const frenchFooter = page.locator('footer');
  await expect(frenchFooter).toContainText('Horloger de démonstration');
  await expect(frenchFooter).not.toContainText('Sample clockmaker');

  await page.goto('/en/');
  const englishFooter = page.locator('footer');
  await expect(englishFooter).toContainText('Sample clockmaker');
  await expect(englishFooter).not.toContainText('Horloger de démonstration');
});
