import { test, expect, type Locator, type Page } from '@playwright/test';
import { SITE_WITH_A_SINGLE_LANGUAGE, buildSite, serveSite, removeDirectory } from './helpers/built-site';

/* The logo is the header link named after the site title. */
function headerLogo(page: Page): Locator {
  return page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
}

/* The language switcher is the header group named in the page language. */
function languageSwitcher(page: Page, name: string): Locator {
  return page.locator('header').getByRole('group', { name: name, exact: true });
}

test('the header logo displays the initials and leads to the home page', async ({ page }) => {
  await page.goto('/fr/');
  const logo = headerLogo(page);
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveAttribute('href', '/fr/');
});

test('the header navigation lists the entries of the site main menu', async ({ page }) => {
  await page.goto('/fr/');
  const links = page.locator('header nav').getByRole('link');
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  await expect(links.nth(0)).toHaveAttribute('href', '/fr/');
  await expect(links.nth(1)).toHaveAttribute('href', '/fr/projets/');
  await expect(links.nth(2)).toHaveAttribute('href', '/fr/#contact');
});

test('served under /portfolio/, the "Contact" link of the French header leads to /portfolio/fr/#contact', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/fr/');
  const contact = page.locator('header nav').getByRole('link', { name: 'Contact', exact: true });
  await expect(contact).toHaveAttribute('href', '/portfolio/fr/#contact');
});

test('served under /portfolio/, the "Contact" link of the English header leads to /portfolio/en/#contact', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/en/');
  const contact = page.locator('header nav').getByRole('link', { name: 'Contact', exact: true });
  await expect(contact).toHaveAttribute('href', '/portfolio/en/#contact');
});

test('on the home page, only the "Accueil" navigation link is marked as the current page', async ({ page }) => {
  await page.goto('/fr/');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Projets', exact: true })).not.toHaveAttribute('aria-current');
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).not.toHaveAttribute('aria-current');
});

test('on the Projets page, only the "Projets" navigation link is marked as the current page', async ({ page }) => {
  await page.goto('/fr/projets/');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Projets', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).not.toHaveAttribute('aria-current');
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).not.toHaveAttribute('aria-current');
});

test('the navigation link marked as the current page is underlined with an accent-colored line', async ({ page }) => {
  await page.goto('/fr/');
  const current = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(current).toHaveCSS('border-bottom-style', 'solid');
  await expect(current).toHaveCSS('border-bottom-color', 'rgb(42, 136, 141)');
  await expect(current).not.toHaveCSS('border-bottom-width', '0px');
});

test('in English, the header navigation lists the entries of the English main menu', async ({ page }) => {
  await page.goto('/en/');
  const links = page.locator('header nav').getByRole('link');
  await expect(links).toHaveText(['Home', 'Projects', 'Contact']);
  await expect(links.nth(0)).toHaveAttribute('href', '/en/');
  await expect(links.nth(1)).toHaveAttribute('href', '/en/projects/');
  await expect(links.nth(2)).toHaveAttribute('href', '/en/#contact');
});

test('in English, the header logo leads to the English home page', async ({ page }) => {
  await page.goto('/en/');
  const logo = headerLogo(page);
  await expect(logo).toHaveAttribute('href', '/en/');
});

test('on the French home page, the header offers an "EN" link to the English home page', async ({ page }) => {
  await page.goto('/fr/');
  const enLink = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await expect(enLink).toBeVisible();
  await expect(enLink).toHaveAttribute('href', '/en/');
});

test('on the French Projets page, the header "EN" link leads to the English Projects page', async ({ page }) => {
  await page.goto('/fr/projets/');
  const enLink = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await expect(enLink).toBeVisible();
  await expect(enLink).toHaveAttribute('href', '/en/projects/');
});

test('on a French page without a translation, the header "EN" link leads to the English home page', async ({ page }) => {
  await page.goto('/fr/page-longue/');
  const enLink = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await expect(enLink).toBeVisible();
  await expect(enLink).toHaveAttribute('href', '/en/');
  await enLink.click();
  await expect(page).toHaveURL('/en/');
});

test('on a French page, the header "EN" link announces its language: hreflang="en" and lang="en"', async ({ page }) => {
  await page.goto('/fr/');
  const enLink = page.locator('header').getByRole('link', { name: 'EN', exact: true });
  await expect(enLink).toHaveAttribute('hreflang', 'en');
  await expect(enLink).toHaveAttribute('lang', 'en');
});

test('on the English Projects page, the header "FR" link leads to the French Projets page', async ({ page }) => {
  await page.goto('/en/projects/');
  const frLink = page.locator('header').getByRole('link', { name: 'FR', exact: true });
  await expect(frLink).toBeVisible();
  await expect(frLink).toHaveAttribute('href', '/fr/projets/');
});

test('on a French page, the header displays the current language "FR" next to the "EN" link, without a link, marked as current', async ({ page }) => {
  await page.goto('/fr/');
  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'EN', exact: true })).toBeVisible();
  const currentLanguage = header.getByText('FR', { exact: true });
  await expect(currentLanguage).toBeVisible();
  await expect(currentLanguage).toHaveAttribute('aria-current');
  await expect(header.getByRole('link', { name: 'FR', exact: true })).toHaveCount(0);
});

test('on a French page, the header language switcher is a group named "Langue"', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  await expect(group).toBeVisible();
  await expect(group.getByText('FR', { exact: true })).toHaveAttribute('aria-current');
  await expect(group.getByRole('link', { name: 'EN', exact: true })).toHaveAttribute('href', '/en/');
});

test('in English, the header language switcher is a group named "Language"', async ({ page }) => {
  await page.goto('/en/');
  const group = languageSwitcher(page, 'Language');
  await expect(group).toBeVisible();
  await expect(group.getByText('EN', { exact: true })).toHaveAttribute('aria-current');
  await expect(group.getByRole('link', { name: 'FR', exact: true })).toHaveAttribute('href', '/fr/');
});

test.describe('single-language site', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_SINGLE_LANGUAGE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a single-language site, the header displays no language switcher', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_SINGLE_LANGUAGE, siteDirectory);
    await page.goto(`${SITE_WITH_A_SINGLE_LANGUAGE.origin}/fr/`);
    /* The header is displayed, in French… */
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
    await expect(headerLogo(page)).toBeVisible();
    /* …without a language switcher, nor the current language alone. */
    await expect(languageSwitcher(page, 'Langue')).toHaveCount(0);
    await expect(page.locator('header').getByText('FR', { exact: true })).toHaveCount(0);
  });
});

test('in the header language switcher, the current language is ink text on a paper background', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const currentLanguage = group.getByText('FR', { exact: true });
  await expect(currentLanguage).toHaveAttribute('aria-current');
  await expect(currentLanguage).toHaveCSS('color', 'rgb(1, 53, 73)');
  await expect(currentLanguage).toHaveCSS('background-color', 'rgb(227, 223, 204)');
});

test('in the header language switcher, the link to the other language is cream at 70% opacity, on a transparent background', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const otherLanguage = group.getByRole('link', { name: 'EN', exact: true });
  await expect(otherLanguage).toBeVisible();
  await expect(otherLanguage).toHaveCSS('color', 'rgba(227, 223, 204, 0.7)');
  await expect(otherLanguage).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('the header language switcher is surrounded by a 1 px cream border at 35% opacity', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  await expect(group).toBeVisible();
  for (const side of ['top', 'right', 'bottom', 'left']) {
    await expect(group).toHaveCSS(`border-${side}-style`, 'solid');
    await expect(group).toHaveCSS(`border-${side}-width`, '1px');
    await expect(group).toHaveCSS(`border-${side}-color`, 'rgba(227, 223, 204, 0.35)');
  }
});

test('the border of the header language switcher surrounds only its FR and EN entries, without spanning the full width of the header', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const groupBox = (await group.boundingBox())!;
  const frBox = (await group.getByText('FR', { exact: true }).boundingBox())!;
  const enBox = (await group.getByRole('link', { name: 'EN', exact: true }).boundingBox())!;
  const entriesLeft = Math.min(frBox.x, enBox.x);
  const entriesRight = Math.max(frBox.x + frBox.width, enBox.x + enBox.width);
  /* The border surrounds both entries… */
  expect(groupBox.x).toBeLessThanOrEqual(entriesLeft);
  expect(groupBox.x + groupBox.width).toBeGreaterThanOrEqual(entriesRight);
  /* …tightly: beyond the entries, only the 1 px border on each side and a small gap. */
  expect(groupBox.width - (entriesRight - entriesLeft)).toBeLessThanOrEqual(10);
});

test('the header language switcher is in IBM Plex Mono 12 px, weight 600', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const entries = group.getByText('FR', { exact: true }).or(group.getByRole('link', { name: 'EN', exact: true }));
  await expect(entries).toHaveCount(2);
  const styles = await entries.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
        size: style.fontSize,
        weight: style.fontWeight,
      };
    }),
  );
  const expected = { family: 'IBM Plex Mono', size: '12px', weight: '600' };
  expect(styles).toEqual([expected, expected]);
});

test('the header logo and the navigation links are in IBM Plex Mono 14 px', async ({ page }) => {
  await page.goto('/fr/');
  /* The logo and the navigation links, without the language switch link (12 px, tested above). */
  const links = headerLogo(page).or(page.locator('header nav').getByRole('link'));
  await expect(links).toHaveCount(4);
  const styles = await links.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        family: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
        size: style.fontSize,
      };
    }),
  );
  const expected = { family: 'IBM Plex Mono', size: '14px' };
  expect(styles).toEqual([expected, expected, expected, expected]);
});

test('the header logo text has a letter-spacing of 0.06em (0.84 px at 14 px)', async ({ page }) => {
  await page.goto('/fr/');
  const logo = headerLogo(page);
  await expect(logo).toHaveText('| E ||| | X |||');
  /* The computed letter-spacing of every element that directly holds a piece of the logo text. */
  const spacings = await logo.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const values: string[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.textContent!.trim() !== '') values.push(getComputedStyle(node.parentElement!).letterSpacing);
    }
    return values;
  });
  expect(spacings.length).toBeGreaterThan(0);
  /* Compared numerically: browsers may serialize the value differently ("0.84px", "0.840000px"); "normal" gives NaN and fails. */
  expect(
    spacings.every((spacing) => Math.abs(parseFloat(spacing) - 0.84) <= 0.01),
    `letter-spacings: ${spacings.join(', ')}`,
  ).toBe(true);
});

test('in the header language switcher, the link to the other language offers a target of at least 24 × 24 px (WCAG 2.5.8)', async ({ page }) => {
  await page.goto('/fr/');
  const otherLanguage = languageSwitcher(page, 'Langue').getByRole('link', { name: 'EN', exact: true });
  await expect(otherLanguage).toBeVisible();
  const box = (await otherLanguage.boundingBox())!;
  expect.soft(box.width, 'target width').toBeGreaterThanOrEqual(24);
  expect.soft(box.height, 'target height').toBeGreaterThanOrEqual(24);
});

test('in the header language switcher, the current language has the same height as the link to the other language', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const currentLanguage = group.getByText('FR', { exact: true });
  const otherLanguage = group.getByRole('link', { name: 'EN', exact: true });
  await expect(currentLanguage).toHaveAttribute('aria-current');
  await expect(otherLanguage).toBeVisible();
  const frBox = (await currentLanguage.boundingBox())!;
  const enBox = (await otherLanguage.boundingBox())!;
  expect(frBox.height, 'height of the current language').toBeCloseTo(enBox.height, 0);
});

test('on desktop, a hovered navigation link is underlined in the accent color, the line offset below the text', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'mouse hover does not exist on a touch screen');
  await page.goto('/fr/');
  const link = page.locator('header nav').getByRole('link', { name: 'Projets', exact: true });
  await expect(link).not.toHaveAttribute('aria-current');
  await link.hover();
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
  await expect(link).toHaveCSS('text-decoration-color', 'rgb(42, 136, 141)');
  await expect(link).toHaveCSS('text-underline-offset', '5px');
});

test('on desktop, the hovered current page link keeps a single accent-colored line (no underline on top of its border)', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'mouse hover does not exist on a touch screen');
  await page.goto('/fr/');
  const current = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await current.hover();
  await expect(current).toHaveCSS('border-bottom-style', 'solid');
  await expect(current).toHaveCSS('border-bottom-color', 'rgb(42, 136, 141)');
  await expect(current).toHaveCSS('border-bottom-width', '2px');
  await expect(current).toHaveCSS('text-decoration-line', 'none');
});

test('after scrolling a long page, the header stays stuck to the top of the window and visible', async ({ page }) => {
  await page.goto('/fr/page-longue/');
  const viewport = page.viewportSize()!;
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(pageHeight).toBeGreaterThan(viewport.height * 2);

  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const header = page.locator('header');
  await expect(header).toBeInViewport();
  const box = await header.boundingBox();
  expect(box?.y).toBeCloseTo(0, 0);
});

test('the sticky header stays above positioned content that scrolls under it: logo and links stay clickable', async ({ page }) => {
  await page.goto('/fr/page-longue/');
  const insert = page.getByText('Encart positionné', { exact: false });
  await expect(insert).toHaveCount(1);

  /* Scrolls the page until the top of the insert is at the top of the window, under the header. */
  await insert.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const links = page.locator('header').getByRole('link');
  await expect(links).toHaveCount(5);
  for (const link of await links.all()) {
    const box = (await link.boundingBox())!;
    const insertUnderTheLink = await insert.evaluate(
      (el, { x, y }) => { const r = el.getBoundingClientRect(); return r.top <= y && y <= r.bottom && r.left <= x && x <= r.right; },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(insertUnderTheLink).toBe(true);
    const reachesTheLink = await link.evaluate(
      (el, { x, y }) => { const hit = document.elementFromPoint(x, y); return hit !== null && el.contains(hit); },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(reachesTheLink).toBe(true);
  }
});

test('on arriving at an anchor of a long page, the targeted element is not hidden by the sticky header', async ({ page }) => {
  await page.goto('/fr/page-longue/#quatrième-chapitre');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const target = page.getByRole('heading', { name: 'Quatrième chapitre', level: 2 });
  await expect(target).toHaveAttribute('id', 'quatrième-chapitre');
  await expect(target).toBeInViewport();

  const headerBox = (await page.locator('header').boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  expect(targetBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
});

test('on a phone, the header fits within the screen width: no horizontal scrolling, logo and links fully visible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone-specific behavior');
  await page.goto('/fr/');
  const width = page.viewportSize()!.width;

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(width);

  const links = page.locator('header').getByRole('link');
  await expect(links).toHaveCount(5);
  for (const link of await links.all()) {
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }
});

test('the header logo is 16 px from the left edge of the window on a phone, 48 px on desktop', async ({ page, isMobile }) => {
  await page.goto('/fr/');
  const logo = headerLogo(page);
  const box = (await logo.boundingBox())!;
  expect(box.x).toBeCloseTo(isMobile ? 16 : 48, 0);
});

test('the header is separated from the page by a 1 px solid paper-colored bottom border at 12% opacity', async ({ page }) => {
  await page.goto('/fr/');
  const header = page.locator('header');
  await expect(header).toBeVisible();
  await expect(header).toHaveCSS('border-bottom-style', 'solid');
  await expect(header).toHaveCSS('border-bottom-width', '1px');
  await expect(header).toHaveCSS('border-bottom-color', 'rgba(227, 223, 204, 0.12)');
});

test('the header links are paper-colored and not underlined', async ({ page }) => {
  await page.goto('/fr/');
  /* The logo and the navigation links, without the language switch link. */
  const links = headerLogo(page).or(page.locator('header nav').getByRole('link'));
  await expect(links).toHaveCount(4);
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('color', 'rgb(227, 223, 204)');
    await expect(link).toHaveCSS('text-decoration-line', 'none');
  }
});
