import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  SITE_WITH_A_LONG_MENU,
  SITE_WITH_A_SINGLE_LANGUAGE,
  SITE_WITH_ENGLISH_BY_DEFAULT,
  buildSite,
  serveSite,
  removeDirectory,
} from './helpers/built-site';
import { characterWeights } from './helpers/character-weights';
import { textPieceStyles } from './helpers/text-piece-styles';

/* The logo is the header link named after the site title. */
function headerLogo(page: Page): Locator {
  return page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
}

/* The links of the header navigation, in document order. */
function navigationLinks(page: Page): Locator {
  return page.locator('header nav').getByRole('link');
}

/* The language switcher is the header group named in the page language. */
function languageSwitcher(page: Page, name: string): Locator {
  return page.locator('header').getByRole('group', { name: name, exact: true });
}

/* Checks that the language switcher of the page at `url` shows FR then EN, in reading order
   (its entries, in document order) as in visual order (FR's box left of EN's box). */
async function expectFrThenEn(group: Locator, url: string): Promise<void> {
  await expect(group.getByText(/^(FR|EN)$/), `reading order on ${url}`).toHaveText(['FR', 'EN']);
  const frBox = (await group.getByText('FR', { exact: true }).boundingBox())!;
  const enBox = (await group.getByText('EN', { exact: true }).boundingBox())!;
  expect(frBox.x + frBox.width, `FR left of EN on ${url}`).toBeLessThanOrEqual(enBox.x + 0.5);
}

/* A header item, with the name assertion messages give it. */
type NamedItem = [string, Locator];

/* The header logo, then each navigation link, numbered from 1. */
async function logoAndNavigationLinks(page: Page): Promise<NamedItem[]> {
  return [
    ['logo', headerLogo(page)],
    ...(await navigationLinks(page).all()).map((link, index): NamedItem => [`navigation link ${index + 1}`, link]),
  ];
}

/* The box of each element the locator matches, in document order. */
async function boxesOf(elements: Locator): Promise<{ x: number; y: number; width: number; height: number }[]> {
  return Promise.all((await elements.all()).map(async (element) => (await element.boundingBox())!));
}

/* The vertical centre of each item's box, by item name. */
async function verticalCentres(items: NamedItem[]): Promise<Record<string, number>> {
  const centres: Record<string, number> = {};
  for (const [name, item] of items) {
    const box = (await item.boundingBox())!;
    centres[name] = box.y + box.height / 2;
  }
  return centres;
}

/* Checks that the vertical centre of every item lies within 1 px of the logo's, in a window
   `width` px wide: the items are vertically centred on a single row. */
function expectCentredOnLogo(centres: Record<string, number>, width: number): void {
  const logoCentre = centres['logo'];
  /* Compared with a 1 px tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    Object.values(centres).every((centre) => Math.abs(centre - logoCentre) <= 1),
    `vertical centres at ${width} px: ${JSON.stringify(centres)}`,
  ).toBe(true);
}

/* A phone window, narrower than the desktop breakpoint. */
const PHONE_VIEWPORT = { width: 390, height: 844 };
/* The narrowest phone window the header must still fit in. */
const NARROWEST_PHONE_VIEWPORT = { width: 320, height: 640 };
/* From this window width, the header lays out its items on a single row. */
const DESKTOP_MIN_WIDTH = 768;
/* A desktop window right at the breakpoint, and a wide one. */
const NARROW_DESKTOP_VIEWPORT = { width: DESKTOP_MIN_WIDTH, height: 1024 };
const WIDE_DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const DESKTOP_VIEWPORTS = [NARROW_DESKTOP_VIEWPORT, WIDE_DESKTOP_VIEWPORT];

test('the header logo displays the initials and leads to the home page', async ({ page }) => {
  await page.goto('/fr/');
  const logo = headerLogo(page);
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveAttribute('href', '/fr/');
});

test('for screen readers, the header logo link holds only the site name, without the visible initials and bars', async ({ page }) => {
  await page.goto('/fr/');
  /* "/children: equal" makes the match exact: any text child (such as "| E |||") fails it. */
  await expect(headerLogo(page)).toMatchAriaSnapshot(`
    - link "Exemple":
      - /url: /fr/
      - /children: equal
  `);
});

test('the header navigation lists the entries of the site main menu', async ({ page }) => {
  await page.goto('/fr/');
  const links = navigationLinks(page);
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

test('the navigation link marked as the current page leaves 3 px between the bottom of its text and its accent underline', async ({ page }) => {
  await page.goto('/fr/');
  const current = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
  /* The gap between the bottom of the content box and the bottom border is the bottom padding. */
  const paddingBottom = await current.evaluate((element) => getComputedStyle(element).paddingBottom);
  /* Compared numerically: browsers may serialize the value differently ("3px", "3.000000px"). */
  expect(Math.abs(parseFloat(paddingBottom) - 3), `padding-bottom: ${paddingBottom}`).toBeLessThanOrEqual(0.01);
});

test('in English, the header navigation lists the entries of the English main menu', async ({ page }) => {
  await page.goto('/en/');
  const links = navigationLinks(page);
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

test('the header language switcher shows the languages in the site order, FR then EN, on a French page as on an English page, the current one highlighted', async ({ page }) => {
  for (const { url, name, current } of [
    { url: '/fr/', name: 'Langue', current: 'FR' },
    { url: '/en/', name: 'Language', current: 'EN' },
  ]) {
    await page.goto(url);
    const group = languageSwitcher(page, name);
    await expectFrThenEn(group, url);
    const fr = group.getByText('FR', { exact: true });
    const en = group.getByText('EN', { exact: true });
    /* The entry of the page language is still the highlighted one. */
    await expect(current === 'FR' ? fr : en).toHaveAttribute('aria-current');
    await expect(current === 'FR' ? en : fr).not.toHaveAttribute('aria-current');
  }
});

test.describe('site whose default language has the greatest weight', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ENGLISH_BY_DEFAULT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a site in English by default, with fr of weight 1 and en of weight 2, the header language switcher shows FR then EN', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_ENGLISH_BY_DEFAULT, siteDirectory);
    for (const { url, name } of [
      { url: '/en/', name: 'Language' },
      { url: '/fr/', name: 'Langue' },
    ]) {
      await page.goto(`${SITE_WITH_ENGLISH_BY_DEFAULT.origin}${url}`);
      await expectFrThenEn(languageSwitcher(page, name), url);
    }
  });
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

  test('on a phone, on a single-language site, the header leaves 12 px above the logo row, 8 px between the logo and the links row, and 12 px between the links row and its bottom border', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_SINGLE_LANGUAGE, siteDirectory);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(`${SITE_WITH_A_SINGLE_LANGUAGE.origin}/fr/`);
    await expect(languageSwitcher(page, 'Langue')).toHaveCount(0);
    const headerBox = (await page.locator('header').boundingBox())!;
    const logoBox = (await headerLogo(page).boundingBox())!;
    const links = navigationLinks(page);
    await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
    const linkBoxes = await boxesOf(links);

    /* The first row holds the logo alone. */
    const firstRowTop = logoBox.y;
    const firstRowBottom = logoBox.y + logoBox.height;
    const secondRowTop = Math.min(...linkBoxes.map((box) => box.y));
    const secondRowBottom = Math.max(...linkBoxes.map((box) => box.y + box.height));
    /* The top edge of the 1 px bottom border. */
    const borderTop = headerBox.y + headerBox.height - 1;
    /* The three gaps, by name, so a failure shows all of them. */
    const gaps: Record<string, number> = {
      'space above the logo row': firstRowTop - headerBox.y,
      'gap between the logo row and the links row': secondRowTop - firstRowBottom,
      'space below the links row': borderTop - secondRowBottom,
    };
    const expected: Record<string, number> = {
      'space above the logo row': 12,
      'gap between the logo row and the links row': 8,
      'space below the links row': 12,
    };
    /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
    expect(
      Object.keys(expected).every((name) => Math.abs(gaps[name] - expected[name]) <= 0.5),
      `gaps: ${JSON.stringify(gaps)}`,
    ).toBe(true);
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

test('the header language switcher leaves 2 px between the inside of its border and its entries, on every side', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const first = group.getByText('FR', { exact: true });
  const last = group.getByRole('link', { name: 'EN', exact: true });
  await expect(first).toHaveAttribute('aria-current');
  await expect(last).toBeVisible();
  const groupBox = (await group.boundingBox())!;
  const firstBox = (await first.boundingBox())!;
  const lastBox = (await last.boundingBox())!;
  const border = 1;
  /* The space between the inner edge of the 1 px border and the entries, side by side. */
  const spaces = {
    top: firstBox.y - groupBox.y - border,
    bottom: groupBox.y + groupBox.height - (firstBox.y + firstBox.height) - border,
    left: firstBox.x - groupBox.x - border,
    right: groupBox.x + groupBox.width - (lastBox.x + lastBox.width) - border,
  };
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    Object.values(spaces).every((space) => Math.abs(space - 2) <= 0.5),
    `spaces: ${JSON.stringify(spaces)}`,
  ).toBe(true);
});

test('in the header language switcher, the FR and EN entries are 2 px apart', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const first = group.getByText('FR', { exact: true });
  const second = group.getByRole('link', { name: 'EN', exact: true });
  await expect(first).toHaveAttribute('aria-current');
  await expect(second).toBeVisible();
  const firstBox = (await first.boundingBox())!;
  const secondBox = (await second.boundingBox())!;
  /* The horizontal distance between the right edge of the first entry and the left edge of the second one. */
  const gap = secondBox.x - (firstBox.x + firstBox.width);
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(Math.abs(gap - 2), `gap: ${gap}`).toBeLessThanOrEqual(0.5);
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
  const links = headerLogo(page).or(navigationLinks(page));
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
  const spacings = (await textPieceStyles(logo)).map(({ letterSpacing }) => letterSpacing);
  expect(spacings.length).toBeGreaterThan(0);
  /* Compared numerically: browsers may serialize the value differently ("0.84px", "0.840000px"); "normal" gives NaN and fails. */
  expect(
    spacings.every((spacing) => Math.abs(parseFloat(spacing) - 0.84) <= 0.01),
    `letter-spacings: ${spacings.join(', ')}`,
  ).toBe(true);
});

test('in the header logo, the first "|" of each initial is bold (700), every other character stays at weight 400', async ({ page }) => {
  await page.goto('/fr/');
  const logo = headerLogo(page);
  await expect(logo).toHaveText('| E ||| | X |||');
  const characters = await characterWeights(logo);
  expect(characters).toEqual([
    '| 700', 'E 400', '| 400', '| 400', '| 400',
    '| 700', 'X 400', '| 400', '| 400', '| 400',
  ]);
});

test('the header navigation links have a letter-spacing of 0.08em (1.12 px at 14 px)', async ({ page }) => {
  await page.goto('/fr/');
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const spacings = await links.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).letterSpacing));
  /* Compared numerically: browsers may serialize the value differently ("1.12px", "1.120000px"); "normal" gives NaN and fails. */
  expect(
    spacings.every((spacing) => Math.abs(parseFloat(spacing) - 1.12) <= 0.01),
    `letter-spacings: ${spacings.join(', ')}`,
  ).toBe(true);
});

test('the header navigation links are spaced 32 px apart', async ({ page }) => {
  await page.goto('/fr/');
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const boxes = await boxesOf(links);
  /* The horizontal distance between the right edge of each link and the left edge of the next one. */
  const gaps = boxes.slice(1).map((box, index) => box.x - (boxes[index].x + boxes[index].width));
  expect(gaps).toHaveLength(2);
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    gaps.every((gap) => Math.abs(gap - 32) <= 0.5),
    `gaps: ${gaps.join(', ')}`,
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

test('in the header language switcher, each entry has 4 px of padding at the top and bottom, 9 px on the left and right, and stays at least 24 px tall', async ({ page }) => {
  await page.goto('/fr/');
  const group = languageSwitcher(page, 'Langue');
  const currentLanguage = group.getByText('FR', { exact: true });
  const otherLanguage = group.getByRole('link', { name: 'EN', exact: true });
  await expect(currentLanguage).toHaveAttribute('aria-current');
  await expect(otherLanguage).toBeVisible();
  const expected = { top: 4, right: 9, bottom: 4, left: 9 };
  for (const [name, entry] of [['FR', currentLanguage], ['EN', otherLanguage]] as const) {
    const paddings = await entry.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        top: parseFloat(style.paddingTop),
        right: parseFloat(style.paddingRight),
        bottom: parseFloat(style.paddingBottom),
        left: parseFloat(style.paddingLeft),
      };
    });
    /* Compared numerically, with a small tolerance: browsers may serialize lengths differently. */
    expect.soft(
      (Object.keys(expected) as (keyof typeof expected)[]).every((side) => Math.abs(paddings[side] - expected[side]) <= 0.01),
      `${name} paddings: ${JSON.stringify(paddings)}`,
    ).toBe(true);
    const box = (await entry.boundingBox())!;
    expect.soft(box.height, `${name} target height`).toBeGreaterThanOrEqual(24);
  }
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

test('on a phone, the header logo and the language switcher share the first row, vertically centred, 16 px from the left and right edges', async ({ page }) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto('/fr/');
  const logoBox = (await headerLogo(page).boundingBox())!;
  const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;

  expect(logoBox.x, 'distance from the left edge to the logo').toBeCloseTo(16, 0);
  expect(PHONE_VIEWPORT.width - (switcherBox.x + switcherBox.width), 'distance from the switcher to the right edge').toBeCloseTo(16, 0);
  const logoCentre = logoBox.y + logoBox.height / 2;
  const switcherCentre = switcherBox.y + switcherBox.height / 2;
  expect(Math.abs(logoCentre - switcherCentre), 'gap between the vertical centres of the logo and the switcher').toBeLessThanOrEqual(1);
});

test('on a phone, the header navigation links sit on a second row, lined up on the left with the logo, 8 px below the first row', async ({ page }) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto('/fr/');
  const logoBox = (await headerLogo(page).boundingBox())!;
  const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;
  const firstLinkBox = (await navigationLinks(page).first().boundingBox())!;

  expect(firstLinkBox.x, 'horizontal offset between the logo and the first link').toBeCloseTo(logoBox.x, 0);
  const firstRowBottom = Math.max(logoBox.y + logoBox.height, switcherBox.y + switcherBox.height);
  expect(firstLinkBox.y - firstRowBottom, 'gap between the first row and the links row').toBeCloseTo(8, 0);
});

test('on a phone, the header leaves 12 px above its first row and 12 px between its links row and its bottom border', async ({ page }) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto('/fr/');
  const headerBox = (await page.locator('header').boundingBox())!;
  const logoBox = (await headerLogo(page).boundingBox())!;
  const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const linkBoxes = await boxesOf(links);

  const firstRowTop = Math.min(logoBox.y, switcherBox.y);
  const secondRowBottom = Math.max(...linkBoxes.map((box) => box.y + box.height));
  /* The top edge of the 1 px bottom border. */
  const borderTop = headerBox.y + headerBox.height - 1;
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(Math.abs(firstRowTop - headerBox.y - 12), `space above the first row: ${firstRowTop - headerBox.y}`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(borderTop - secondRowBottom - 12), `space below the links row: ${borderTop - secondRowBottom}`).toBeLessThanOrEqual(0.5);
});

test('on a phone, on a page where no menu link is current, the header keeps the home page layout: same height, logo, language switcher and navigation links in the same place', async ({ page }) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  /* The header height and the position of each item relative to the header's top-left corner. */
  const layouts: Record<string, Record<string, number>> = {};
  for (const url of ['/fr/', '/fr/page-longue/']) {
    await page.goto(url);
    const links = navigationLinks(page);
    await expect(links, `navigation links on ${url}`).toHaveText(['Accueil', 'Projets', 'Contact']);
    await expect(links.and(page.locator('[aria-current]')), `current navigation links on ${url}`)
      .toHaveCount(url === '/fr/' ? 1 : 0);
    const headerBox = (await page.locator('header').boundingBox())!;
    const layout: Record<string, number> = { 'header height': headerBox.height };
    const items: NamedItem[] = [...(await logoAndNavigationLinks(page)), ['language switcher', languageSwitcher(page, 'Langue')]];
    for (const [name, item] of items) {
      const box = (await item.boundingBox())!;
      layout[`${name} x`] = box.x - headerBox.x;
      layout[`${name} y`] = box.y - headerBox.y;
    }
    layouts[url] = layout;
  }
  const home = layouts['/fr/'];
  const other = layouts['/fr/page-longue/'];
  /* The measures that differ between the two pages, beyond a sub-pixel rounding tolerance. */
  const differences = Object.keys(home)
    .filter((measure) => !(Math.abs(other[measure] - home[measure]) <= 0.5))
    .map((measure) => `${measure}: ${home[measure]} on /fr/, ${other[measure]} on /fr/page-longue/`);
  expect(differences, 'measures that differ from the home page').toEqual([]);
});

test('from 768 px wide, the header logo, navigation links and language switcher sit on a single row, vertically centred (at 768 and 1280 px)', async ({ page }) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    const links = navigationLinks(page);
    await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
    const items: NamedItem[] = [...(await logoAndNavigationLinks(page)), ['language switcher', languageSwitcher(page, 'Langue')]];
    expectCentredOnLogo(await verticalCentres(items), viewport.width);
  }
});

test('from 768 px wide, the header logo sits on the left, the language switcher 48 px from the right edge, the navigation links right before it, 32 px from it', async ({ page }) => {
  await page.setViewportSize(WIDE_DESKTOP_VIEWPORT);
  await page.goto('/fr/');
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const logoBox = (await headerLogo(page).boundingBox())!;
  const lastLinkBox = (await links.last().boundingBox())!;
  const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;

  const spaces = {
    leftEdgeToLogo: logoBox.x,
    switcherToRightEdge: WIDE_DESKTOP_VIEWPORT.width - (switcherBox.x + switcherBox.width),
    lastLinkToSwitcher: switcherBox.x - (lastLinkBox.x + lastLinkBox.width),
  };
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect.soft(Math.abs(spaces.leftEdgeToLogo - 48), `spaces: ${JSON.stringify(spaces)}`).toBeLessThanOrEqual(0.5);
  expect.soft(Math.abs(spaces.switcherToRightEdge - 48), `spaces: ${JSON.stringify(spaces)}`).toBeLessThanOrEqual(0.5);
  expect.soft(Math.abs(spaces.lastLinkToSwitcher - 32), `spaces: ${JSON.stringify(spaces)}`).toBeLessThanOrEqual(0.5);
});

test('from 768 px wide, the language switcher is the tallest item of the header, 22 px below its top edge and 22 px above its bottom border', async ({ page }) => {
  await page.setViewportSize(WIDE_DESKTOP_VIEWPORT);
  await page.goto('/fr/');
  const headerBox = (await page.locator('header').boundingBox())!;
  const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const items = await logoAndNavigationLinks(page);

  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  for (const [name, item] of items) {
    const box = (await item.boundingBox())!;
    expect.soft(box.y, `top of the ${name}, against the switcher top ${switcherBox.y}`).toBeGreaterThanOrEqual(switcherBox.y - 0.5);
    expect.soft(box.y + box.height, `bottom of the ${name}, against the switcher bottom ${switcherBox.y + switcherBox.height}`)
      .toBeLessThanOrEqual(switcherBox.y + switcherBox.height + 0.5);
  }
  /* The top edge of the 1 px bottom border. */
  const borderTop = headerBox.y + headerBox.height - 1;
  const spaces = {
    headerTopToSwitcher: switcherBox.y - headerBox.y,
    switcherToBottomBorder: borderTop - (switcherBox.y + switcherBox.height),
  };
  expect.soft(Math.abs(spaces.headerTopToSwitcher - 22), `spaces: ${JSON.stringify(spaces)}`).toBeLessThanOrEqual(0.5);
  expect.soft(Math.abs(spaces.switcherToBottomBorder - 22), `spaces: ${JSON.stringify(spaces)}`).toBeLessThanOrEqual(0.5);
});

test('from 768 px wide, at least 24 px separate the header logo from the first navigation link, in French and in English (at 768 and 1280 px)', async ({ page }) => {
  const gaps: Record<string, number> = {};
  for (const { url, menu } of [
    { url: '/fr/', menu: ['Accueil', 'Projets', 'Contact'] },
    { url: '/en/', menu: ['Home', 'Projects', 'Contact'] },
  ]) {
    for (const viewport of DESKTOP_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto(url);
      const links = navigationLinks(page);
      await expect(links).toHaveText(menu);
      const logoBox = (await headerLogo(page).boundingBox())!;
      const firstLinkBox = (await links.first().boundingBox())!;
      /* The horizontal distance between the right edge of the logo and the left edge of the first link. */
      gaps[`${url} at ${viewport.width} px`] = firstLinkBox.x - (logoBox.x + logoBox.width);
    }
  }
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    Object.values(gaps).every((gap) => gap >= 24 - 0.5),
    `gaps: ${JSON.stringify(gaps)}`,
  ).toBe(true);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, the header is complete: logo, three links and language switcher visible and clickable, on a single row from 768 px wide', async ({ page }) => {
    for (const viewport of [PHONE_VIEWPORT, ...DESKTOP_VIEWPORTS]) {
      await page.setViewportSize(viewport);
      await page.goto('/fr/');
      const links = navigationLinks(page);
      await expect(links, `navigation links at ${viewport.width} px`).toHaveText(['Accueil', 'Projets', 'Contact']);
      const switcher = languageSwitcher(page, 'Langue');
      await expect(switcher, `language switcher at ${viewport.width} px`).toBeVisible();
      const items: NamedItem[] = [
        ...(await logoAndNavigationLinks(page)),
        ['language switch link', switcher.getByRole('link', { name: 'EN', exact: true })],
      ];
      for (const [name, item] of items) {
        await expect(item, `${name} at ${viewport.width} px`).toBeVisible();
        await expect(item, `${name} at ${viewport.width} px`).toBeEnabled();
      }
      /* Measured before the trial clicks: on WebKit without JavaScript, a trial click follows the link. */
      const centres =
        viewport.width < DESKTOP_MIN_WIDTH ? null : await verticalCentres([...items, ['language switcher', switcher]]);
      for (const [, item] of items) {
        /* A trial click only checks that a real click would land on the item. */
        await item.click({ trial: true, timeout: 2000 });
      }
      if (centres === null) continue;
      expectCentredOnLogo(centres, viewport.width);
    }
  });
});

test('in a 320 px wide window, the header logo stays on a single line', async ({ page }) => {
  await page.setViewportSize(NARROWEST_PHONE_VIEWPORT);
  await page.goto('/fr/');
  const logo = headerLogo(page);
  await expect(logo).toHaveText('| E ||| | X |||');
  /* The vertical position at which each visible character of the logo is rendered. */
  const tops = await logo.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const values: number[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent!;
      for (let index = 0; index < text.length; index++) {
        if (text[index].trim() === '') continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        values.push(range.getBoundingClientRect().top);
      }
    }
    return values;
  });
  expect(tops).toHaveLength(10);
  /* On a single line, every character shares the vertical position of the first one. */
  expect(
    tops.every((top) => Math.abs(top - tops[0]) <= 1),
    `vertical positions: ${tops.join(', ')}`,
  ).toBe(true);
});

test('in a 320 px wide window, the header still fits: no horizontal scrolling, logo, links and language switcher fully visible', async ({ page }) => {
  await page.setViewportSize(NARROWEST_PHONE_VIEWPORT);
  await page.goto('/fr/');

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth, 'width of the page content').toBeLessThanOrEqual(320);

  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const items: NamedItem[] = [...(await logoAndNavigationLinks(page)), ['language switcher', languageSwitcher(page, 'Langue')]];
  for (const [name, item] of items) {
    await expect(item, name).toBeVisible();
    const box = (await item.boundingBox())!;
    /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
    expect(box.x, `left edge of the ${name}`).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, `right edge of the ${name}`).toBeLessThanOrEqual(320.5);
  }
});

test.describe('site with a long menu', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_LONG_MENU);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('in a 320 px wide window, a menu too long for a single line wraps onto another line: no link goes past the header, no horizontal scrolling', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_LONG_MENU, siteDirectory);
    await page.setViewportSize(NARROWEST_PHONE_VIEWPORT);
    await page.goto(`${SITE_WITH_A_LONG_MENU.origin}/fr/`);

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, 'width of the page content').toBeLessThanOrEqual(NARROWEST_PHONE_VIEWPORT.width);

    const links = navigationLinks(page);
    await expect(links).toHaveText(['Accueil', 'Projets', 'Parcours', 'Compétences', 'Publications', 'Contact']);
    const headerBox = (await page.locator('header').boundingBox())!;
    /* The top edge of the 1 px bottom border. */
    const borderTop = headerBox.y + headerBox.height - 1;
    /* Inside the header, between its 16 px side gutters. */
    const contentLeft = headerBox.x + 16;
    const contentRight = headerBox.x + headerBox.width - 16;
    const linkTops: number[] = [];
    for (const [index, link] of (await links.all()).entries()) {
      const name = `navigation link ${index + 1}`;
      await expect(link, name).toBeVisible();
      const box = (await link.boundingBox())!;
      linkTops.push(box.y);
      /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
      expect(box.x, `left edge of the ${name}`).toBeGreaterThanOrEqual(contentLeft - 0.5);
      expect(box.x + box.width, `right edge of the ${name}`).toBeLessThanOrEqual(contentRight + 0.5);
      expect(box.y, `top edge of the ${name}`).toBeGreaterThanOrEqual(headerBox.y - 0.5);
      expect(box.y + box.height, `bottom edge of the ${name}`).toBeLessThanOrEqual(borderTop + 0.5);
    }
    /* Wrapped: the links sit on more than one line. */
    const lineCount = new Set(linkTops.map((top) => Math.round(top))).size;
    expect(lineCount, `top edges of the links: ${linkTops.join(', ')}`).toBeGreaterThan(1);
  });

  test('from 768 px wide, with a menu too long to fit beside the logo, at least 24 px still separate the logo from every link on its line, and no link overlaps it (at 768 and 900 px)', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_LONG_MENU, siteDirectory);
    const problems: string[] = [];
    for (const viewport of [NARROW_DESKTOP_VIEWPORT, { width: 900, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${SITE_WITH_A_LONG_MENU.origin}/fr/`);
      const links = navigationLinks(page);
      await expect(links).toHaveText(['Accueil', 'Projets', 'Parcours', 'Compétences', 'Publications', 'Contact']);
      const logoBox = (await headerLogo(page).boundingBox())!;
      const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;
      const linkBoxes = await boxesOf(links);

      /* The row the menu is too long for: 48 px gutters, the logo, 24 px, the links 32 px apart,
         32 px, the switcher. */
      const rowWidth =
        2 * 48 + logoBox.width + 24 + linkBoxes.reduce((sum, box) => sum + box.width, 0)
        + 32 * (linkBoxes.length - 1) + 32 + switcherBox.width;
      expect(rowWidth, `width the single row would need at ${viewport.width} px`).toBeGreaterThan(viewport.width);

      for (const [index, box] of linkBoxes.entries()) {
        const name = `navigation link ${index + 1} at ${viewport.width} px`;
        /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
        const sharesLogoLine = box.y < logoBox.y + logoBox.height - 0.5 && logoBox.y < box.y + box.height - 0.5;
        const overlapsLogo =
          sharesLogoLine && box.x < logoBox.x + logoBox.width - 0.5 && logoBox.x < box.x + box.width - 0.5;
        if (overlapsLogo) problems.push(`${name} overlaps the logo: ${JSON.stringify({ logo: logoBox, link: box })}`);
        if (!sharesLogoLine) continue;
        /* The horizontal distance between the right edge of the logo and the left edge of the link. */
        const gap = box.x - (logoBox.x + logoBox.width);
        if (gap < 24 - 0.5) problems.push(`${name} is ${gap} px from the logo`);
      }
    }
    expect(problems, 'links too close to the logo').toEqual([]);
  });
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
  const links = headerLogo(page).or(navigationLinks(page));
  await expect(links).toHaveCount(4);
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('color', 'rgb(227, 223, 204)');
    await expect(link).toHaveCSS('text-decoration-line', 'none');
  }
});
