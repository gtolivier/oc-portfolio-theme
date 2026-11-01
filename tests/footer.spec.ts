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

test('the footer logo is styled like the header logo: same font, size, letter-spacing, color and character weights', async ({
  page,
}) => {
  await page.goto('/fr/');
  const headerLogo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true })
    .locator('[aria-hidden="true"]');
  const logo = footerLogoText(page);
  await expect(headerLogo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveText('| E ||| | X |||');
  /* The computed style of every element that directly holds a piece of each logo's text, the bold bars included. */
  const looks = async (element: Locator) =>
    (await textPieceStyles(element)).map(({ text, fontFamily, fontSize, letterSpacing, color }) => ({
      text,
      fontFamily,
      fontSize,
      letterSpacing,
      color,
    }));
  expect(await looks(logo)).toEqual(await looks(headerLogo));
  expect(await characterWeights(logo)).toEqual(await characterWeights(headerLogo));
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
