import { test, expect, type Locator, type Page } from '@playwright/test';
import { SITE_WITH_UNWRITTEN_HOME_PAGES, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { characterWeights } from './helpers/character-weights';
import { textPieceStyles } from './helpers/text-piece-styles';

/* The visible text of the footer logo, hidden from screen readers. */
function footerLogoText(page: Page): Locator {
  return page.locator('footer [aria-hidden="true"]');
}

/* The visible text of the header logo, hidden from screen readers. */
function headerLogoText(page: Page): Locator {
  return page.locator('header').getByRole('link', { name: 'Exemple', exact: true }).locator('[aria-hidden="true"]');
}

/* The footer's © line, for the current year. */
function copyrightLine(page: Page): Locator {
  const year = new Date().getFullYear();
  return page.locator('footer').getByText(`© ${year} Jean Exemple`, { exact: true });
}

/* The French footer note. */
function footerNote(page: Page): Locator {
  return page.locator('footer').getByText('Horloger de démonstration', { exact: true });
}

/* A phone window, narrower than the desktop breakpoint. */
const PHONE_VIEWPORT = { width: 390, height: 844 };

/* A wide window, past the desktop breakpoint. */
const WIDE_VIEWPORT = { width: 1280, height: 800 };

type CharacterBox = { left: number; top: number; right: number };

/* The box of every visible character of the element, as rendered, in text order: they follow its
   text even when an inline element runs over several lines. */
async function characterBoxes(element: Locator): Promise<CharacterBox[]> {
  const boxes = await element.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const found: CharacterBox[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent!;
      for (let index = 0; index < text.length; index++) {
        if (text[index].trim() === '') continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const { left, top, right } = range.getBoundingClientRect();
        found.push({ left, top, right });
      }
    }
    return found;
  });
  if (boxes.length === 0) throw new Error('the element shows no character');
  return boxes;
}

/* The box of the first visible character of the element: where its text starts. */
async function firstCharacterBox(element: Locator): Promise<CharacterBox> {
  return (await characterBoxes(element))[0];
}

/* The right edge of the last visible character of the element: where its text ends. */
async function lastCharacterRight(element: Locator): Promise<number> {
  return (await characterBoxes(element)).at(-1)!.right;
}

test('on a phone, the footer starts at the page gutter, its logo lined up with the header logo, and the footer note starts on its own line below the © line, lined up with the logo', async ({
  page,
}) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto('/fr/');
  const headerLogo = headerLogoText(page);
  const logo = footerLogoText(page);
  const copyright = copyrightLine(page);
  const note = footerNote(page);
  await expect(headerLogo).toHaveText('| E ||| | X |||');
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(copyright).toBeVisible();
  await expect(note).toBeVisible();

  const headerLogoStart = await firstCharacterBox(headerLogo);
  const logoStart = await firstCharacterBox(logo);
  /* Compared with a 1 px tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    Math.abs(logoStart.left - headerLogoStart.left),
    `footer logo starts at ${logoStart.left} px, header logo at ${headerLogoStart.left} px`,
  ).toBeLessThanOrEqual(1);

  const copyrightBox = (await copyright.boundingBox())!;
  const noteStart = await firstCharacterBox(note);
  expect(
    noteStart.top,
    `top of the footer note against the bottom of the © line (${copyrightBox.y + copyrightBox.height} px)`,
  ).toBeGreaterThanOrEqual(copyrightBox.y + copyrightBox.height - 0.5);
  expect(
    Math.abs(noteStart.left - logoStart.left),
    `footer note starts at ${noteStart.left} px, footer logo at ${logoStart.left} px`,
  ).toBeLessThanOrEqual(1);
});

test("on a wide screen, the footer note shares the line of the logo and the © text, and ends at the page's right gutter, lined up with the right edge of the header's content", async ({
  page,
}) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await page.goto('/fr/');
  /* With a language switcher, it is the header's last item: it ends at the page's right gutter. */
  const switcher = page.locator('header').getByRole('group', { name: 'Langue', exact: true });
  const logo = footerLogoText(page);
  const copyright = copyrightLine(page);
  const note = footerNote(page);
  await expect(switcher).toBeVisible();
  await expect(logo).toHaveText('| E ||| | X |||');
  await expect(copyright).toBeVisible();
  await expect(note).toBeVisible();

  /* On the same line: the middle of the note's box lies within the logo's box and the © line's box. */
  const noteBox = (await note.boundingBox())!;
  const noteMiddle = noteBox.y + noteBox.height / 2;
  for (const [name, box] of [
    ['footer logo', (await logo.boundingBox())!],
    ['© line', (await copyright.boundingBox())!],
  ] as const) {
    expect(noteMiddle, `middle of the footer note against the top of the ${name} (${box.y} px)`).toBeGreaterThanOrEqual(
      box.y,
    );
    expect(
      noteMiddle,
      `middle of the footer note against the bottom of the ${name} (${box.y + box.height} px)`,
    ).toBeLessThanOrEqual(box.y + box.height);
  }

  const switcherBox = (await switcher.boundingBox())!;
  const noteEnd = await lastCharacterRight(note);
  /* Compared with a 1 px tolerance: rendered box positions may carry sub-pixel rounding. */
  expect(
    Math.abs(noteEnd - (switcherBox.x + switcherBox.width)),
    `footer note ends at ${noteEnd} px, header content at ${switcherBox.x + switcherBox.width} px`,
  ).toBeLessThanOrEqual(1);
});

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
  const headerLogo = headerLogoText(page);
  const logo = footerLogoText(page);
  const copyright = copyrightLine(page);
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

test("on every page but the home page, the footer has a link back to the home page of its language; the home page's footer has none", async ({
  page,
}) => {
  /* The link's arrow may be decorative: its name is the word alone, or the word after the arrow. */
  const homeLinkNames = { fr: /^(←\s*)?Accueil$/, en: /^(←\s*)?Home$/ };
  for (const { url, lang } of [
    { url: '/fr/projets/', lang: 'fr' },
    { url: '/en/projects/', lang: 'en' },
    { url: '/fr/projets/horloge-astronomique/', lang: 'fr' },
    { url: '/en/projects/astronomical-clock/', lang: 'en' },
    { url: '/fr/page-longue/', lang: 'fr' },
  ] as const) {
    await page.goto(url);
    const homeLink = page.locator('footer').getByRole('link', { name: homeLinkNames[lang] });
    await expect(homeLink, `footer home link on ${url}`).toBeVisible();
    await expect(homeLink, `footer home link on ${url}`).toHaveAttribute('href', `/${lang}/`);
  }

  for (const lang of ['fr', 'en'] as const) {
    await page.goto(`/${lang}/`);
    await expect(
      page.locator('footer').getByRole('link', { name: homeLinkNames[lang] }),
      `footer home link on /${lang}/`,
    ).toHaveCount(0);
  }
});

test.describe('site whose home pages are not written', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_UNWRITTEN_HOME_PAGES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test("when a language's home page is not written (render = 'never' or 'link'), the footer of its other pages has no link back to it", async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_UNWRITTEN_HOME_PAGES, siteDirectory);
    /* Same names as the link of the site whose home pages are written. */
    const homeLinkNames = { fr: /^(←\s*)?Accueil$/, en: /^(←\s*)?Home$/ };
    for (const { url, lang } of [
      { url: '/fr/projets/', lang: 'fr' },
      { url: '/fr/projets/horloge-astronomique/', lang: 'fr' },
      { url: '/fr/page-longue/', lang: 'fr' },
      { url: '/en/projects/', lang: 'en' },
      { url: '/en/projects/astronomical-clock/', lang: 'en' },
    ] as const) {
      await page.goto(`${SITE_WITH_UNWRITTEN_HOME_PAGES.origin}${url}`);
      const footer = page.locator('footer');
      /* The page and its footer are displayed… */
      await expect(copyrightLine(page), `footer on ${url}`).toBeVisible();
      /* …without a link to the home page, which does not exist. */
      const homeLink = footer.getByRole('link', { name: homeLinkNames[lang] });
      await expect(homeLink, `footer home link on ${url}`).toHaveCount(0);
    }
  });
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
