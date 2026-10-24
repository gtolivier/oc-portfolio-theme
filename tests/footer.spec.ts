import { test, expect } from '@playwright/test';

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

test('the footer displays the site tagline in the page language', async ({ page }) => {
  await page.goto('/fr/');
  const frenchFooter = page.locator('footer');
  await expect(frenchFooter).toContainText('Horloger de démonstration');
  await expect(frenchFooter).not.toContainText('Sample clockmaker');

  await page.goto('/en/');
  const englishFooter = page.locator('footer');
  await expect(englishFooter).toContainText('Sample clockmaker');
  await expect(englishFooter).not.toContainText('Horloger de démonstration');
});
