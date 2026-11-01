import { test, expect } from '@playwright/test';
import { SITE_WITHOUT_HERO, buildSite, removeDirectory, serveSite } from './helpers/built-site';

test.describe('home page of another site, without background', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITHOUT_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a home page whose front matter declares no background shows no section "Parcours": no such heading, no empty region', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    await page.goto(`${SITE_WITHOUT_HERO.origin}/fr/`);
    /* tests/fixtures/without-hero/content/_index.md declares no params.background: its text is
       displayed… */
    const main = page.getByRole('main');
    await expect(main.getByText('Accueil fictif sans hero')).toBeVisible();
    /* …with no background section, named or not, even empty. */
    await expect(page.getByRole('region', { name: 'Parcours' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Parcours' })).toHaveCount(0);
    await expect(page.getByText('Parcours', { exact: true })).toHaveCount(0);
    await expect(main.getByRole('region')).toHaveCount(0);
    await expect(main.getByRole('heading')).toHaveCount(0);
  });
});
