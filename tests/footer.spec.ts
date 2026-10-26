import { test, expect } from '@playwright/test';
import { characterWeights } from './helpers/character-weights';

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
