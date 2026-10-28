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
import { heroRegion } from './helpers/hero';

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

/* Every header item: the logo, each navigation link, then the language switcher of a French page. */
async function headerItems(page: Page): Promise<NamedItem[]> {
  return [...(await logoAndNavigationLinks(page)), ['language switcher', languageSwitcher(page, 'Langue')]];
}

/* The box of each element the locator matches, in document order. */
async function boxesOf(elements: Locator): Promise<{ x: number; y: number; width: number; height: number }[]> {
  return Promise.all((await elements.all()).map(async (element) => (await element.boundingBox())!));
}

/* The vertical position at which each visible character of the element is rendered. */
async function characterTops(element: Locator): Promise<number[]> {
  return element.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
}

/* The top edge of the header's 1 px bottom border, given the header's box. */
function bottomBorderTop(headerBox: { y: number; height: number }): number {
  return headerBox.y + headerBox.height - 1;
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

test('served under /portfolio/, the "Contact" link of the header leads to /portfolio/{lang}/#contact, in French and in English', async ({ page }) => {
  for (const lang of ['fr', 'en']) {
    await page.goto(`http://localhost:1315/portfolio/${lang}/`);
    const contact = page.locator('header nav').getByRole('link', { name: 'Contact', exact: true });
    await expect(contact).toHaveAttribute('href', `/portfolio/${lang}/#contact`);
  }
});

test('only the navigation link of the current page is marked as the current page, on the home page and on the Projets page', async ({ page }) => {
  for (const { url, current } of [
    { url: '/fr/', current: 'Accueil' },
    { url: '/fr/projets/', current: 'Projets' },
  ]) {
    await page.goto(url);
    const nav = page.locator('header nav');
    for (const name of ['Accueil', 'Projets', 'Contact']) {
      const link = nav.getByRole('link', { name, exact: true });
      if (name === current) await expect(link, `${name} on ${url}`).toHaveAttribute('aria-current', 'page');
      else await expect(link, `${name} on ${url}`).not.toHaveAttribute('aria-current');
    }
  }
});

test('the navigation link marked as the current page is underlined with an accent-colored line', async ({ page }) => {
  await page.goto('/fr/');
  const current = page.locator('header nav').getByRole('link', { name: 'Accueil', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(current).toHaveCSS('border-bottom-style', 'solid');
  await expect(current).toHaveCSS('border-bottom-color', 'rgb(42, 136, 141)');
  await expect(current).not.toHaveCSS('border-bottom-width', '0px');
});

test('in English, the header logo leads to the English home page and the navigation lists the English main menu', async ({ page }) => {
  await page.goto('/en/');
  await expect(headerLogo(page)).toHaveAttribute('href', '/en/');
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Home', 'Projects', 'Contact']);
  await expect(links.nth(0)).toHaveAttribute('href', '/en/');
  await expect(links.nth(1)).toHaveAttribute('href', '/en/projects/');
  await expect(links.nth(2)).toHaveAttribute('href', '/en/#contact');
});

test('the header "EN" and "FR" links lead to the translated page', async ({ page }) => {
  for (const { url, name, href } of [
    { url: '/fr/', name: 'EN', href: '/en/' },
    { url: '/fr/projets/', name: 'EN', href: '/en/projects/' },
    { url: '/en/projects/', name: 'FR', href: '/fr/projets/' },
  ]) {
    await page.goto(url);
    const link = page.locator('header').getByRole('link', { name, exact: true });
    await expect(link, `${name} link on ${url}`).toBeVisible();
    await expect(link, `${name} link on ${url}`).toHaveAttribute('href', href);
  }
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

test('on a French page, the header displays the current language "FR" next to the "EN" link, without a link, marked as current', async ({ page }) => {
  await page.goto('/fr/');
  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'EN', exact: true })).toBeVisible();
  const currentLanguage = header.getByText('FR', { exact: true });
  await expect(currentLanguage).toBeVisible();
  await expect(currentLanguage).toHaveAttribute('aria-current');
  await expect(header.getByRole('link', { name: 'FR', exact: true })).toHaveCount(0);
});

test('the header language switcher is a group named "Langue" on a French page, "Language" on an English page', async ({ page }) => {
  for (const { url, name, current, other, href } of [
    { url: '/fr/', name: 'Langue', current: 'FR', other: 'EN', href: '/en/' },
    { url: '/en/', name: 'Language', current: 'EN', other: 'FR', href: '/fr/' },
  ]) {
    await page.goto(url);
    const group = languageSwitcher(page, name);
    await expect(group, `switcher on ${url}`).toBeVisible();
    await expect(group.getByText(current, { exact: true })).toHaveAttribute('aria-current');
    await expect(group.getByRole('link', { name: other, exact: true })).toHaveAttribute('href', href);
  }
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

test('in the header language switcher, the link to the other language offers a target of at least 24 × 24 px (WCAG 2.5.8)', async ({ page }) => {
  await page.goto('/fr/');
  const otherLanguage = languageSwitcher(page, 'Langue').getByRole('link', { name: 'EN', exact: true });
  await expect(otherLanguage).toBeVisible();
  const box = (await otherLanguage.boundingBox())!;
  expect.soft(box.width, 'target width').toBeGreaterThanOrEqual(24);
  expect.soft(box.height, 'target height').toBeGreaterThanOrEqual(24);
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

test('on a phone, down to 320 px wide, the header fits within the screen width: no horizontal scrolling, logo, links and language switcher fully visible', async ({ page }) => {
  for (const viewport of [PHONE_VIEWPORT, NARROWEST_PHONE_VIEWPORT]) {
    const { width } = viewport;
    await page.setViewportSize(viewport);
    await page.goto('/fr/');

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth, `width of the page content at ${width} px`).toBeLessThanOrEqual(width);

    await expect(page.locator('header').getByRole('link')).toHaveCount(5);
    await expect(navigationLinks(page)).toHaveText(['Accueil', 'Projets', 'Contact']);
    const items: NamedItem[] = [
      ...(await headerItems(page)),
      ['language switch link', languageSwitcher(page, 'Langue').getByRole('link', { name: 'EN', exact: true })],
    ];
    for (const [name, item] of items) {
      await expect(item, `${name} at ${width} px`).toBeVisible();
      const box = (await item.boundingBox())!;
      /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
      expect(box.x, `left edge of the ${name} at ${width} px`).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width, `right edge of the ${name} at ${width} px`).toBeLessThanOrEqual(width + 0.5);
    }
  }
});

test('on a phone, the header logo and the language switcher share the first row, and the navigation links sit on a row below it, lined up on the left with the logo', async ({ page }) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto('/fr/');
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
  const logoBox = (await headerLogo(page).boundingBox())!;
  const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;
  const linkBoxes = await boxesOf(links);

  const logoCentre = logoBox.y + logoBox.height / 2;
  const switcherCentre = switcherBox.y + switcherBox.height / 2;
  expect(Math.abs(logoCentre - switcherCentre), 'gap between the vertical centres of the logo and the switcher').toBeLessThanOrEqual(1);
  const firstRowBottom = Math.max(logoBox.y + logoBox.height, switcherBox.y + switcherBox.height);
  /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    linkBoxes.every((box) => box.y >= firstRowBottom - 0.5),
    `link tops ${linkBoxes.map((box) => box.y).join(', ')}, first row bottom ${firstRowBottom}`,
  ).toBe(true);
  expect(Math.abs(linkBoxes[0].x - logoBox.x), 'horizontal offset between the logo and the first link').toBeLessThanOrEqual(1);
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
    for (const [name, item] of await headerItems(page)) {
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

test('from 768 px wide, the header sits on a single row, vertically centred: the logo on the left, then the navigation links, then the language switcher on the right, without overlap (at 768 and 1280 px)', async ({ page }) => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    const links = navigationLinks(page);
    await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);
    const items = await headerItems(page);
    expectCentredOnLogo(await verticalCentres(items), viewport.width);
    /* Each item ends before the next one starts, in document order, from left to right. */
    const overlaps: string[] = [];
    for (let index = 1; index < items.length; index++) {
      const [previousName, previous] = items[index - 1];
      const [name, item] = items[index];
      const previousBox = (await previous.boundingBox())!;
      const box = (await item.boundingBox())!;
      /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
      if (previousBox.x + previousBox.width > box.x + 0.5) {
        overlaps.push(`${previousName} ends at ${previousBox.x + previousBox.width}, ${name} starts at ${box.x}`);
      }
    }
    expect(overlaps, `items out of order or overlapping at ${viewport.width} px`).toEqual([]);

    /* The switcher on the right: the header leaves as much space after it, up to the right
       edge of the page, as before the logo, from the left edge. */
    const logoBox = (await headerLogo(page).boundingBox())!;
    const switcherBox = (await languageSwitcher(page, 'Langue').boundingBox())!;
    const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const spaceAfterSwitcher = pageWidth - (switcherBox.x + switcherBox.width);
    expect(
      Math.abs(spaceAfterSwitcher - logoBox.x),
      `at ${viewport.width} px, space after the switcher ${spaceAfterSwitcher}, before the logo ${logoBox.x}`,
    ).toBeLessThanOrEqual(1);
  }
});

test('after the window is widened from 375 px to 1280 px on the same page, the hero still ends at the bottom of the window, within 1 px', async ({ page }) => {
  /* 900 px high: tall enough for the hero's content at 375 px as at 1280 px, so the hero's
     height is the window height minus the header height. */
  const height = 900;
  await page.setViewportSize({ width: 375, height });
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const links = navigationLinks(page);
  await expect(links).toHaveText(['Accueil', 'Projets', 'Contact']);

  /* Widened without reloading: the page lays itself out again. */
  await page.setViewportSize({ width: WIDE_DESKTOP_VIEWPORT.width, height });
  const hero = heroRegion(page);
  await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();

  /* How far the hero's bottom sits from the window's bottom; measured again until the layout settles. */
  const heroBottomOffset = async (): Promise<number> => {
    const heroBox = (await hero.boundingBox())!;
    return heroBox.y + heroBox.height - height;
  };
  await expect
    .poll(async () => Math.abs(await heroBottomOffset()), { message: 'hero bottom against the window bottom after widening to 1280 px' })
    .toBeLessThanOrEqual(1);
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
  const tops = await characterTops(logo);
  expect(tops).toHaveLength(10);
  /* On a single line, every character shares the vertical position of the first one. */
  expect(
    tops.every((top) => Math.abs(top - tops[0]) <= 1),
    `vertical positions: ${tops.join(', ')}`,
  ).toBe(true);
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
    const borderTop = bottomBorderTop(headerBox);
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

  test('from 768 px wide, with a menu too long to fit on the header line, the links wrap between the logo and the language switcher without overlapping them or going past the header, and the logo stays on a single line (at 768, 1024 and 1280 px)', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_LONG_MENU, siteDirectory);
    await page.setViewportSize(NARROW_DESKTOP_VIEWPORT);
    await page.goto(`${SITE_WITH_A_LONG_MENU.origin}/fr/`);
    const links = navigationLinks(page);
    await expect(links).toHaveText(['Accueil', 'Projets', 'Parcours', 'Compétences', 'Publications', 'Contact']);
    const logo = headerLogo(page);
    await expect(logo).toHaveText('| E ||| | X |||');
    const switcher = languageSwitcher(page, 'Langue');
    const header = page.locator('header');

    const problems: string[] = [];
    for (const width of [DESKTOP_MIN_WIDTH, 1024, WIDE_DESKTOP_VIEWPORT.width]) {
      /* Resized without reloading: the page lays itself out again at each width. */
      await page.setViewportSize({ width, height: NARROW_DESKTOP_VIEWPORT.height });
      const headerBox = (await header.boundingBox())!;
      const logoBox = (await logo.boundingBox())!;
      const switcherBox = (await switcher.boundingBox())!;
      const linkBoxes = await boxesOf(links);

      if (width === DESKTOP_MIN_WIDTH) {
        /* The menu is too long for a single line here: its links sit on more than one line. */
        const linkTops = linkBoxes.map((box) => box.y);
        expect(new Set(linkTops.map(Math.round)).size, `top edges of the links at ${width} px: ${linkTops.join(', ')}`)
          .toBeGreaterThan(1);
      }

      /* Compared with a small tolerance: rendered box positions may carry sub-pixel rounding. */
      for (const [index, box] of linkBoxes.entries()) {
        const name = `at ${width} px, navigation link ${index + 1}`;
        if (box.x < logoBox.x + logoBox.width - 0.5) problems.push(`${name} starts at ${box.x}, before the logo ends`);
        if (box.x + box.width > switcherBox.x + 0.5) problems.push(`${name} ends at ${box.x + box.width}, after the switcher starts`);
        if (box.y < headerBox.y - 0.5 || box.y + box.height > bottomBorderTop(headerBox) + 0.5) {
          problems.push(`${name} goes past the header: ${JSON.stringify(box)}`);
        }
      }
      const tops = await characterTops(logo);
      if (tops.length !== 10) problems.push(`at ${width} px, the logo renders ${tops.length} characters`);
      /* On a single line, every character shares the vertical position of the first one. */
      if (!tops.every((top) => Math.abs(top - tops[0]) <= 1)) {
        problems.push(`at ${width} px, the logo characters sit at ${tops.join(', ')}`);
      }
    }
    expect(problems, 'links outside the space between the logo and the switcher, or logo on several lines').toEqual([]);
  });
});
