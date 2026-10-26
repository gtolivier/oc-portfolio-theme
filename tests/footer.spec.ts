import { test, expect } from '@playwright/test';
import { characterWeights } from './helpers/character-weights';
import { textPieceStyles } from './helpers/text-piece-styles';

test('the footer displays the site logo followed by "© <current year> <site author>"', async ({ page }) => {
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  const footer = page.locator('footer');
  await expect(footer).toHaveText(
    new RegExp(`\\| E \\|\\|\\| \\| X \\|\\|\\|\\s*(—\\s*)?© ${year} Jean Exemple`),
  );
});

test('screen readers do not read the decorative bars of the footer logo', async ({ page }) => {
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  const accessibilityTree = await page.locator('footer').ariaSnapshot();
  expect(accessibilityTree).toContain(`© ${year} Jean Exemple`);
  expect(accessibilityTree).not.toContain('|');
});

test('in the footer logo, the first "|" of each initial is bold (700), every other character stays at weight 400', async ({ page }) => {
  await page.goto('/fr/');
  const logo = page.locator('footer [aria-hidden="true"]');
  await expect(logo).toHaveText('| E ||| | X |||');
  const characters = await characterWeights(logo);
  expect(characters).toEqual([
    '| 700', 'E 400', '| 400', '| 400', '| 400',
    '| 700', 'X 400', '| 400', '| 400', '| 400',
  ]);
});

test('the footer logo is in IBM Plex Mono 14 px, like the header logo', async ({ page }) => {
  await page.goto('/fr/');
  const logo = page.locator('footer [aria-hidden="true"]');
  await expect(logo).toHaveText('| E ||| | X |||');
  /* The computed family and size of every element that directly holds a piece of the logo text, the bold bars included. */
  const styles = (await textPieceStyles(logo)).map(({ text, fontFamily, fontSize }) => {
    const family = fontFamily.split(',')[0].trim().replace(/["']/g, '');
    return `${text}: ${family} ${fontSize}`;
  });
  expect(styles).toEqual([
    '|: IBM Plex Mono 14px', 'E |||: IBM Plex Mono 14px',
    '|: IBM Plex Mono 14px', 'X |||: IBM Plex Mono 14px',
  ]);
});

test('the footer logo text has a letter-spacing of 0.06em (0.84 px at 14 px), like the header logo', async ({ page }) => {
  await page.goto('/fr/');
  const logo = page.locator('footer [aria-hidden="true"]');
  await expect(logo).toHaveText('| E ||| | X |||');
  /* The computed letter-spacing of every element that directly holds a piece of the logo text, the bold bars included. */
  const spacings = (await textPieceStyles(logo)).map(({ letterSpacing }) => letterSpacing);
  expect(spacings.length).toBeGreaterThan(0);
  /* Compared numerically: browsers may serialize the value differently ("0.84px", "0.840000px"); "normal" gives NaN and fails. */
  expect(
    spacings.every((spacing) => Math.abs(parseFloat(spacing) - 0.84) <= 0.01),
    `letter-spacings: ${spacings.join(', ')}`,
  ).toBe(true);
});

test('the footer logo text is the same cream color as the header logo', async ({ page }) => {
  await page.goto('/fr/');
  const headerLogo = page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
  await expect(headerLogo).toHaveCSS('color', 'rgb(227, 223, 204)');
  const headerColor = await headerLogo.evaluate((element) => getComputedStyle(element).color);
  const logo = page.locator('footer [aria-hidden="true"]');
  await expect(logo).toHaveText('| E ||| | X |||');
  /* The computed color of every element that directly holds a piece of the logo text, the bold bars included. */
  const colors = (await textPieceStyles(logo)).map(({ text, color }) => `${text}: ${color}`);
  expect(colors).toEqual([
    `|: ${headerColor}`, `E |||: ${headerColor}`,
    `|: ${headerColor}`, `X |||: ${headerColor}`,
  ]);
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
