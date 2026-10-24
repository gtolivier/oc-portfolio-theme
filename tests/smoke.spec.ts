import { test, expect } from '@playwright/test';

// Environment test: the example site is served in both languages.
test('the home page is served in French', async ({ page }) => {
  const response = await page.goto('/fr/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
});

test('the home page is served in English', async ({ page }) => {
  const response = await page.goto('/en/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
});
