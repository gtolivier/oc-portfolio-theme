import { test, expect, type Locator, type Page } from '@playwright/test';
import { characterWeights } from './helpers/character-weights';
import { textPieceStyles } from './helpers/text-piece-styles';

/* The visible text of the footer logo, hidden from screen readers. */
function footerLogoText(page: Page): Locator {
  return page.locator('footer [aria-hidden="true"]');
}

/* A phone window, narrower than the desktop breakpoint. */
const PHONE_VIEWPORT = { width: 390, height: 844 };

/* The box of the first visible character of the element, as rendered: where its text starts,
   even when an inline element runs over several lines. */
async function firstCharacterBox(element: Locator): Promise<{ left: number; top: number }> {
  return element.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent!;
      for (let index = 0; index < text.length; index++) {
        if (text[index].trim() === '') continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const { left, top } = range.getBoundingClientRect();
        return { left, top };
      }
    }
    throw new Error('the element shows no character');
  });
}

test('on a phone, the footer starts at the page gutter, its logo lined up with the header logo, and the footer note starts on its own line below the © line, lined up with the logo', async ({
  page,
}) => {
  await page.setViewportSize(PHONE_VIEWPORT);
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  const headerLogo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true })
    .locator('[aria-hidden="true"]');
  const logo = footerLogoText(page);
  const copyright = page.locator('footer').getByText(`© ${year} Jean Exemple`, { exact: true });
  const note = page.locator('footer').getByText('Horloger de démonstration', { exact: true });
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

/* A wide window, past the desktop breakpoint. */
const WIDE_VIEWPORT = { width: 1280, height: 800 };

/* The right edge of the last visible character of the element, as rendered: where its text ends. */
async function lastCharacterRight(element: Locator): Promise<number> {
  return element.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let right: number | undefined;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent!;
      for (let index = 0; index < text.length; index++) {
        if (text[index].trim() === '') continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        right = range.getBoundingClientRect().right;
      }
    }
    if (right === undefined) throw new Error('the element shows no character');
    return right;
  });
}

test("on a wide screen, the footer note shares the line of the logo and the © text, and ends at the page's right gutter, lined up with the right edge of the header's content", async ({
  page,
}) => {
  await page.setViewportSize(WIDE_VIEWPORT);
  await page.goto('/fr/');
  const year = new Date().getFullYear();
  /* With a language switcher, it is the header's last item: it ends at the page's right gutter. */
  const switcher = page.locator('header').getByRole('group', { name: 'Langue', exact: true });
  const logo = footerLogoText(page);
  const copyright = page.locator('footer').getByText(`© ${year} Jean Exemple`, { exact: true });
  const note = page.locator('footer').getByText('Horloger de démonstration', { exact: true });
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
  const year = new Date().getFullYear();
  const headerLogo = page
    .locator('header')
    .getByRole('link', { name: 'Exemple', exact: true })
    .locator('[aria-hidden="true"]');
  const logo = footerLogoText(page);
  const copyright = page.locator('footer').getByText(`© ${year} Jean Exemple`, { exact: true });
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
