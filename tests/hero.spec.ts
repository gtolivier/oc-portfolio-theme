import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  SITE_UNDER_PORTFOLIO_WITH_A_URL_FROM_THE_ROOT,
  SITE_UNDER_PORTFOLIO_WITH_A_URL_STARTING_WITH_THE_SUBPATH,
  SITE_WITHOUT_HERO,
  SITE_WITH_ANOTHER_HERO,
  SITE_WITH_A_BUTTON_WITHOUT_DESTINATION,
  SITE_WITH_A_BUTTON_WITHOUT_LABEL,
  SITE_WITH_A_BUTTON_WITH_URL_AND_PAGE_REF,
  SITE_WITH_A_HERO_WITHOUT_AUTHOR,
  SITE_WITH_A_HERO_WITH_LONG_WORDS,
  SITE_WITH_A_HERO_WITHOUT_TITLE,
  SITE_WITH_A_LONG_MENU,
  SITE_WITH_A_PAGE_REF_NOT_FOUND,
  SITE_WITH_A_SINGLE_LANGUAGE,
  buildSite,
  removeDirectory,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import { tabUntilFocused } from './helpers/keyboard';
import { clickOrTap } from './helpers/pointer';
import {
  type Rectangle,
  bandsWithoutDrawnPixels,
  meanLuminanceGainedInRectangle,
  brightnessKeptUnderLayerInRectangle,
  canvasOpacityOverBackgroundAt,
  drawnStrokesInRectangle,
  extentOfDrawnTicks,
  pixelsChangedPerColumnInRectangle,
  pixelsNotOfBackgroundPerRow,
} from './helpers/pixels';
import { SIGNS, textOnScreen } from './helpers/text-on-screen';

/* Checks that each tagline line is visible in the area, and that each one starts below the
   previous one, in the given order. */
async function expectLinesInOrder(main: Locator, lines: string[]) {
  for (const line of lines) {
    await expect(main.getByText(line)).toBeVisible();
  }
  /* On-screen position of the start and end of each line, however the template separates
     them. A long line may itself wrap on a phone: the start of a line is compared to the end
     of the previous one. */
  const positions = await main.evaluate((root, texts) => {
    return texts.map((text) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const start = (node.textContent ?? '').indexOf(text);
        if (start === -1) continue;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + text.length);
        const boxes = Array.from(range.getClientRects()).filter((box) => box.height > 0);
        const first = boxes[0];
        const last = boxes[boxes.length - 1];
        return { top: first.top, lastTop: last.top, lastHeight: last.height };
      }
      return null;
    });
  }, lines);
  for (let i = 1; i < lines.length; i++) {
    const previous = positions[i - 1];
    const current = positions[i];
    expect(previous, `line not found: ${lines[i - 1]}`).not.toBeNull();
    expect(current, `line not found: ${lines[i]}`).not.toBeNull();
    expect(current!.top - previous!.lastTop, `"${lines[i]}" starts below "${lines[i - 1]}"`)
      .toBeGreaterThanOrEqual(previous!.lastHeight / 2);
  }
}

/* Text an element displays on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements (without the alternative text of a
   `content: "…" / "…"`), hidden elements excluded. Independent of the chosen markup. */
async function displayedText(element: Locator): Promise<string> {
  const text = await element.evaluate((root) => {
    const generated = (el: Element, pseudo: '::before' | '::after') => {
      const content = getComputedStyle(el, pseudo).content;
      const strings = content.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
      return strings.map((string) => JSON.parse(string) as string).join('');
    };
    const walk = (el: Element): string => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return '';
      let result = generated(el, '::before');
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) result += child.textContent ?? '';
        else if (child.nodeType === Node.ELEMENT_NODE) result += walk(child as Element);
      }
      return result + generated(el, '::after');
    };
    return walk(root);
  });
  return text.replace(/\s+/g, ' ').trim();
}

/* Components of a computed color, however the browser serializes it (`rgb(…)`, `rgba(…)` or
   `color(srgb …)`): red, green and blue from 0 to 255 rounded to the unit, alpha from 0 to 1
   rounded to the hundredth. */
function colorComponents(color: string) {
  const number = '([\\d.]+%?)';
  const toUnit = (value: string) => (value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value));
  const rgb = color.match(new RegExp(`^rgba?\\(\\s*${number}[\\s,]+${number}[\\s,]+${number}(?:\\s*[,/]\\s*${number})?\\s*\\)$`));
  const srgb = color.match(new RegExp(`^color\\(srgb\\s+${number}\\s+${number}\\s+${number}(?:\\s*/\\s*${number})?\\s*\\)$`));
  const match = rgb ?? srgb;
  if (!match) throw new Error(`unrecognized color: ${color}`);
  const scale = rgb ? 1 : 255;
  const [red, green, blue] = match.slice(1, 4).map((value) =>
    Math.round(value.endsWith('%') ? toUnit(value) * 255 : parseFloat(value) * scale));
  const alpha = match[4] === undefined ? 1 : Math.round(toUnit(match[4]) * 100) / 100;
  return { red, green, blue, alpha };
}

/* Computed styles that decide how a button looks: text color, background, underline, and
   border on each side. Colors as components. */
async function buttonStyle(button: Locator) {
  const { color, background, textDecoration, borders } = await button.evaluate((link) => {
    const style = getComputedStyle(link);
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    return {
      color: style.color,
      background: style.backgroundColor,
      textDecoration: style.textDecorationLine,
      borders: sides.map((side) => ({
        side,
        width: style.getPropertyValue(`border-${side}-width`),
        style: style.getPropertyValue(`border-${side}-style`),
        color: style.getPropertyValue(`border-${side}-color`),
      })),
    };
  });
  return {
    color: colorComponents(color),
    background: colorComponents(background),
    textDecoration,
    borders: borders.map((border) => ({ ...border, color: colorComponents(border.color) })),
  };
}

/* Text color of a button and color of its border on each side, as components. */
async function textAndBorderColors(button: Locator) {
  const { color, borders } = await buttonStyle(button);
  return {
    color,
    borders: borders.map(({ side, color: sideColor }) => ({ side, color: sideColor })),
  };
}

/* Displayed horizontal extent of an element, in px from the left edge of the window: the box
   of the element and that of its content (a text that is too long can overflow its box
   without widening it). */
async function displayedExtent(element: Locator): Promise<{ left: number; right: number }> {
  return element.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const boxes = [el.getBoundingClientRect(), range.getBoundingClientRect()];
    return { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)) };
  });
}

/* The hero comes before the home page text: its action buttons are, in order, the first
   links of the main content. They are looked up there, and not in the whole page, because
   the header has its own links, including a "Contact" one. */
function firstHeroButton(page: Page): Locator {
  return page.getByRole('main').getByRole('link').first();
}

function secondHeroButton(page: Page): Locator {
  return page.getByRole('main').getByRole('link').nth(1);
}

function mainContentHeading(page: Page): Locator {
  return page.getByRole('main').getByRole('heading', { level: 1 });
}

/* The two desktop windows the hero's layout is checked at: a wide one, 1280 × 900, and one
   768 px wide, 768 × 1024, where the desktop spacing starts. */
const DESKTOP_VIEWPORTS = [{ width: 1280, height: 900 }, { width: 768, height: 1024 }];

/* The windows tall enough to leave the hero free space around its text, where its height is
   checked against the header's: a tall phone window, 412 × 1100, and the two desktop windows. */
const TALL_VIEWPORTS = [{ width: 412, height: 1100 }, ...DESKTOP_VIEWPORTS];

/* Sizes the window to `viewport`, then opens the French home page and waits for its fonts: that
   of the example site, or of the test site served at `origin`. */
async function openHomeAt(page: Page, viewport: { width: number; height: number }, origin = ''): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(`${origin}/fr/`);
  await page.evaluate(() => document.fonts.ready);
}

/* The y, in the window, of the bottom edge of the lowest of `buttons`' boxes. */
async function bottomOfButtons(buttons: Locator[]): Promise<number> {
  return Math.max(
    ...(await Promise.all(buttons.map(async (button) => {
      const box = (await button.boundingBox())!;
      return box.y + box.height;
    }))),
  );
}

/* The open home page's hero, the main content region named by its main heading, with that
   heading and its two buttons, all three checked visible in the window of the given `size`. */
async function heroHeadingAndButtons(page: Page, size: string): Promise<{ hero: Locator; heading: Locator; buttons: Locator[] }> {
  const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
  const heading = hero.getByRole('heading', { level: 1 });
  const buttons = [hero.getByRole('link', { name: 'Voir les projets' }), hero.getByRole('link', { name: 'Contact' })];
  await expect(heading, `heading at ${size}`).toBeVisible();
  for (const button of buttons) await expect(button, `button at ${size}`).toBeVisible();
  return { hero, heading, buttons };
}

/* The height the open home page's hero must have in a window of `viewport` tall enough for its
   content, the window height minus the header height, with that header height. Page scrolled
   to the top: the hero starts right below the header. Checks first that the window is tall
   enough: the hero's text, from the top of its `heading` to the bottom of its `buttons`,
   leaves at least 150 px of free height, so the content does not set the hero's height. */
async function heightBelowHeader(
  page: Page,
  viewport: { width: number; height: number },
  { heading, buttons }: { heading: Locator; buttons: Locator[] },
  size: string,
): Promise<{ expectedHeight: number; headerHeight: number }> {
  const headerBox = (await page.locator('header').boundingBox())!;
  const expectedHeight = viewport.height - headerBox.height;
  const textHeight = (await bottomOfButtons(buttons)) - (await heading.boundingBox())!.y;
  expect(textHeight, `at ${size}, height of the hero's text, against ${Math.round(expectedHeight)} px`)
    .toBeLessThanOrEqual(expectedHeight - 150);
  return { expectedHeight, headerHeight: headerBox.height };
}

/* Checks that the open home page's hero, in a window of `viewport` tall enough for its content,
   ends exactly at the bottom of the window: its height is the window height minus the header
   height, within 1 px. */
async function expectHeroToEndAtWindowBottom(page: Page, viewport: { width: number; height: number }, size: string): Promise<void> {
  const { hero, heading, buttons } = await heroHeadingAndButtons(page, size);
  const { expectedHeight } = await heightBelowHeader(page, viewport, { heading, buttons }, size);
  const heroBox = (await hero.boundingBox())!;
  expect.soft(
    Math.abs(heroBox.height - expectedHeight),
    `at ${size}, hero height (${heroBox.height} px) against the window height minus the header height (${expectedHeight} px)`,
  ).toBeLessThanOrEqual(1);
}

test('on the French home page, the main heading shows the author name, then the professional title on a new line below it', async ({ page }) => {
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  /* The name comes from params.author, the title from the front matter of
     exampleSite/content/_index.md, [params.hero] block, title key. DOM text, as written there:
     the uppercase display is up to CSS. */
  await expect(mainHeading).toHaveText(/^\s*Jean Exemple/);
  await expect(mainHeading).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);
  /* On a new line: the professional title starts at least half a line below the name. */
  const professionalTitle = mainHeading.getByText('Horloger indépendant', { exact: true });
  await expect(professionalTitle).toBeVisible();
  const mainHeadingBox = await mainHeading.boundingBox();
  const professionalTitleBox = await professionalTitle.boundingBox();
  expect(professionalTitleBox!.y - mainHeadingBox!.y).toBeGreaterThanOrEqual(professionalTitleBox!.height / 2);
});

test('on the French home page, the hero heading decodes: right after load, its author name and professional title are scrambled, and 1.5 s later both are in clear', async ({ page }) => {
  /* Animations are allowed, and time stands still from before the page loads, until the
     test advances it: animation frames and timers then run as they would in that time. */
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  await expect(mainHeading).toHaveCount(1);
  /* What the visitor sees in the heading, whitespace excluded: the name, from params.author,
     and the title, from the [params.hero] block of exampleSite/content/_index.md. */
  const inClear = 'Jean Exemple Horloger indépendant'.replace(/\s+/g, '');
  /* Right after load, none of their letters is shown: one sign in place of each one. */
  const shown = await textOnScreen(mainHeading);
  expect(Array.from(shown), `"${shown}" shows one sign per letter of the name and the title`).toHaveLength(Array.from(inClear).length);
  for (const character of Array.from(shown)) {
    expect(SIGNS, `"${character}", shown in "${shown}" right after load, is one of the signs`).toContain(character);
  }
  /* Design reference: the name and the title decode in about 1.1 s at most, both starting at
     load, so both are in clear well before 1.5 s, and stay so. */
  await page.clock.runFor(1500);
  expect(await textOnScreen(mainHeading), '1.5 s after load').toBe(inClear);
  await page.clock.runFor(2500);
  expect(await textOnScreen(mainHeading), '4 s after load').toBe(inClear);
});

test('on the French home page, the hero displays the tagline, one line per entry: the three lines, in order, each below the previous one', async ({ page }) => {
  await page.goto('/fr/');
  const main = page.getByRole('main');
  /* The tagline comes from the front matter of exampleSite/content/_index.md, [params.hero]
     block, tagline key (a list of strings, one per line). */
  const lines = [
    'Montres mécaniques sur mesure — 20 ans d’atelier.',
    'Conception, réparation et entretien',
    'de pendules et de montres anciennes.',
  ];
  await expectLinesInOrder(main, lines);
});

test('on the French home page, the hero displays the stack on one line, entries separated by "·"', async ({ page }) => {
  await page.goto('/fr/');
  const main = page.getByRole('main');
  /* The stack comes from the front matter of exampleSite/content/_index.md, [params.hero]
     block, stack key (a list of strings: 'Laiton', 'Acier', 'Rubis', 'Émail'). They are
     displayed in one piece, separated by a middle dot surrounded by spaces. */
  await expect(main.getByText('Laiton · Acier · Rubis · Émail', { exact: true })).toBeVisible();
});

test('on the French home page, the first hero button, "Voir les projets", leads to the French Projets page', async ({ page }) => {
  await page.goto('/fr/');
  /* The buttons come from the front matter of exampleSite/content/_index.md,
     [[params.hero.actions]] blocks; the first one has pageRef = '/projets'. */
  const firstButton = firstHeroButton(page);
  await expect(firstButton).toHaveText('Voir les projets');
  await expect(firstButton).toHaveAttribute('href', '/fr/projets/');
  await firstButton.click();
  await expect(page).toHaveURL('/fr/projets/');
});

test('on the French home page, the first hero button displays an arrow "→" after "Voir les projets", which screen readers do not read', async ({ page }) => {
  await page.goto('/fr/');
  /* On screen, the arrow follows the label; the accessible name of the link stays the label
     alone. */
  const firstButton = firstHeroButton(page);
  await expect(firstButton).toHaveAccessibleName('Voir les projets');
  expect(await displayedText(firstButton)).toMatch(/^Voir les projets ?→$/);
});

test('the first hero button is filled, the second outlined', async ({ page }) => {
  await page.goto('/fr/');
  const firstButton = firstHeroButton(page);
  const secondButton = secondHeroButton(page);
  await expect(firstButton).toHaveText(/^\s*Voir les projets/);
  await expect(secondButton).toHaveText('Contact');
  const first = await buttonStyle(firstButton);
  const second = await buttonStyle(secondButton);
  /* Filled: an opaque background. */
  expect(first.background.alpha, 'opacity of the first button’s background').toBeGreaterThan(0.5);
  expect(first.textDecoration, 'underline of the first button').toBe('none');
  const firstFamily = await firstButton.evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
  expect(firstFamily, 'font family of the first button').toBe('IBM Plex Mono');
  /* Outlined: no background, a visible border on all four sides. */
  expect(second.background.alpha, 'opacity of the second button’s background').toBe(0);
  expect(second.textDecoration, 'underline of the second button').toBe('none');
  for (const { side, width, style, color } of second.borders) {
    expect.soft(parseFloat(width), `width of the second button’s ${side} border`).toBeGreaterThan(0);
    expect.soft(style, `style of the second button’s ${side} border`).not.toMatch(/^(none|hidden)$/);
    expect.soft(color.alpha, `opacity of the second button’s ${side} border colour`).toBeGreaterThan(0);
  }
});

test('on the French home page, the second hero button, placed after "Voir les projets", is "Contact" and leads to #contact', async ({ page }) => {
  await page.goto('/fr/');
  /* The buttons come from the front matter of exampleSite/content/_index.md,
     [[params.hero.actions]] blocks; the second one has url = '#contact'. */
  await expect(firstHeroButton(page)).toHaveText('Voir les projets');
  const secondButton = secondHeroButton(page);
  await expect(secondButton).toHaveText('Contact');
  await expect(secondButton).toHaveAttribute('href', '#contact');
});

test('on phone as on desktop, the second hero button, "Contact", reached by keyboard turns accent-colored: text and border on all four sides', async ({ page, browserName }) => {
  await page.goto('/fr/');
  /* Design reference: on keyboard focus, as on hover, text and border in accent #2A888D,
     opaque. Focus comes from the Tab key, as for a keyboard visitor. The colors are waited on
     to settle, in case a transition comes with the focus. */
  await expect(firstHeroButton(page)).toHaveText(/^\s*Voir les projets/);
  const secondButton = secondHeroButton(page);
  await expect(secondButton).toHaveText('Contact');
  await tabUntilFocused(secondButton, browserName);
  await expect(secondButton).toBeFocused();
  const accent = { red: 42, green: 136, blue: 141, alpha: 1 };
  await expect.poll(() => textAndBorderColors(secondButton), {
    message: 'style of the second button reached by keyboard',
  }).toEqual({
    color: accent,
    borders: (['top', 'right', 'bottom', 'left'] as const).map((side) => ({ side, color: accent })),
  });
});

test('on phone as on desktop, the hero starts right below the header and ends at the bottom of the window', async ({ page }) => {
  await page.goto('/fr/');
  /* The hero is the main content region named by its main heading (a section labeled by the
     h1): it groups the heading, the tagline, the stack and the buttons. */
  const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
  await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(hero.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.')).toBeVisible();
  await expect(hero.getByText('Laiton · Acier · Rubis · Émail', { exact: true })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Voir les projets' })).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Contact' })).toBeVisible();
  /* Design reference: minimum height "100vh minus the header height". Page scrolled to the
     top: the top of the hero touches the bottom of the header, its bottom reaches at least
     the bottom of the window. */
  const viewportHeight = page.viewportSize()!.height;
  const headerBox = (await page.locator('header').boundingBox())!;
  const heroBox = (await hero.boundingBox())!;
  const headerBottom = headerBox.y + headerBox.height;
  expect(Math.abs(heroBox.y - headerBottom), 'the top of the hero is right below the header').toBeLessThanOrEqual(1);
  expect(heroBox.y + heroBox.height, 'the bottom of the hero is at the bottom of the window, or lower')
    .toBeGreaterThanOrEqual(viewportHeight - 1);

  /* In a window tall enough for its content, it ends exactly there. The header is two rows on
     a phone and one row from 768 px wide: checked at a phone window and at both desktop ones. */
  for (const viewport of TALL_VIEWPORTS) {
    const size = `${viewport.width} × ${viewport.height}`;
    await openHomeAt(page, viewport);
    await expectHeroToEndAtWindowBottom(page, viewport, size);
  }
});

test('on phone as on desktop, the hero’s text block is centred vertically: the middle of the hero lies between the top of its heading and the bottom of its buttons', async ({ page }) => {
  /* Windows set whatever the project's own window, all tall enough to leave the hero at least
     150 px of free height around its text, so the centring shows: the two desktop ones and
     three under 768 px wide. */
  const viewports = [...DESKTOP_VIEWPORTS, { width: 375, height: 1000 }, { width: 412, height: 1100 }, { width: 767, height: 1024 }];
  for (const viewport of viewports) {
    const size = `${viewport.width} × ${viewport.height}`;
    await openHomeAt(page, viewport);
    const { hero, heading, buttons } = await heroHeadingAndButtons(page, size);

    const heroBox = (await hero.boundingBox())!;
    const headingBox = (await heading.boundingBox())!;
    const buttonsBottom = await bottomOfButtons(buttons);
    expect(buttonsBottom - headingBox.y, `at ${size}, height of the hero's text, against a ${Math.round(heroBox.height)} px hero`)
      .toBeLessThanOrEqual(heroBox.height - 150);

    const heroMiddle = heroBox.y + heroBox.height / 2;
    expect.soft(heroMiddle, `at ${size}, middle of the hero, below the top of the heading (${Math.round(headingBox.y)} px)`)
      .toBeGreaterThanOrEqual(headingBox.y);
    expect.soft(heroMiddle, `at ${size}, middle of the hero, above the bottom of the buttons (${Math.round(buttonsBottom)} px)`)
      .toBeLessThanOrEqual(buttonsBottom);
  }
});

test('on a phone, under 768 px wide, when the hero’s content is taller than the room it has, its heading stays below the header and its buttons inside the hero: at 320 × 568 and at 667 × 375 (landscape)', async ({ page }) => {
  /* The two phone windows, set here whatever the project's own window, are too short for the
     hero's text: from the top of its heading to the bottom of its buttons, it is taller than
     the window less the header, so the hero grows past the bottom of the window. */
  const SHORT_PHONE_VIEWPORTS = [{ width: 320, height: 568 }, { width: 667, height: 375 }];
  for (const viewport of SHORT_PHONE_VIEWPORTS) {
    const size = `${viewport.width} × ${viewport.height}`;
    await openHomeAt(page, viewport);
    const { hero, heading, buttons } = await heroHeadingAndButtons(page, size);

    /* Page scrolled to the top: the header sits above the hero. */
    const headerBox = (await page.locator('header').boundingBox())!;
    const headerBottom = headerBox.y + headerBox.height;
    const room = viewport.height - headerBottom;
    const headingBox = (await heading.boundingBox())!;
    const buttonsBottom = await bottomOfButtons(buttons);
    expect(buttonsBottom - headingBox.y, `at ${size}, height of the hero's text, against ${Math.round(room)} px of window below the header`)
      .toBeGreaterThan(room);

    const heroBox = (await hero.boundingBox())!;
    expect.soft(headingBox.y, `at ${size}, top of the heading, below the bottom of the header (${Math.round(headerBottom)} px)`)
      .toBeGreaterThan(headerBottom);
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      expect.soft(
        box.y >= heroBox.y && box.y + box.height <= heroBox.y + heroBox.height,
        `at ${size}, button "${await button.textContent()}" inside the hero`,
      ).toBe(true);
    }
  }
});

test('on phone as on desktop, the hero content lines up on the left with the header logo', async ({ page }) => {
  await page.goto('/fr/');
  /* The logo is the header link named after the site title. */
  const logo = page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toBeVisible();
  const logoLeft = (await logo.boundingBox())!.x;
  /* The hero elements: name and professional title in the h1, tagline, stack and first
     button. */
  const main = page.getByRole('main');
  const mainHeading = mainContentHeading(page);
  const elements = {
    'author name (h1)': mainHeading,
    'professional title': mainHeading.getByText('Horloger indépendant', { exact: true }),
    'tagline': main.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    'stack': main.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    'first button': firstHeroButton(page),
  };
  await expect(elements['first button']).toHaveText(/^\s*Voir les projets/);
  for (const [name, element] of Object.entries(elements)) {
    await expect(element, name).toBeVisible();
    const box = (await element.boundingBox())!;
    expect.soft(Math.abs(box.x - logoLeft), `left edge of the ${name} (${box.x} px) against the logo’s (${logoLeft} px)`)
      .toBeLessThanOrEqual(1);
  }
});

test('on a phone, the hero fits within the screen width: no horizontal scrolling, name, title, tagline, stack and buttons fully visible', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone-specific behavior');
  await page.goto('/fr/');
  const width = page.viewportSize()!.width;

  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth, 'no horizontal scrolling').toBeLessThanOrEqual(width);

  /* The hero elements: name and professional title in the h1, the three tagline lines, the
     stack and the two buttons. */
  const main = page.getByRole('main');
  const mainHeading = mainContentHeading(page);
  const elements = {
    'author name (h1)': mainHeading,
    'professional title': mainHeading.getByText('Horloger indépendant', { exact: true }),
    'tagline, line 1': main.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    'tagline, line 2': main.getByText('Conception, réparation et entretien'),
    'tagline, line 3': main.getByText('de pendules et de montres anciennes.'),
    'stack': main.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    'first button': firstHeroButton(page),
    'second button': secondHeroButton(page),
  };
  await expect(elements['first button']).toHaveText(/^\s*Voir les projets/);
  await expect(elements['second button']).toHaveText('Contact');
  for (const [name, element] of Object.entries(elements)) {
    await expect(element, name).toBeVisible();
    const { left, right } = await displayedExtent(element);
    expect.soft(left, `left edge within the window: ${name}`).toBeGreaterThanOrEqual(0);
    expect.soft(right, `right edge within the window: ${name}`).toBeLessThanOrEqual(width);
  }
});

test('on phone as on desktop, each hero button offers a target of at least 24 × 24 px (WCAG 2.5.8)', async ({ page }) => {
  await page.goto('/fr/');
  const buttons = {
    'first button, "Voir les projets"': firstHeroButton(page),
    'second button, "Contact"': secondHeroButton(page),
  };
  await expect(buttons['first button, "Voir les projets"']).toHaveText(/^\s*Voir les projets/);
  await expect(buttons['second button, "Contact"']).toHaveText('Contact');
  for (const [name, button] of Object.entries(buttons)) {
    await expect(button, name).toBeVisible();
    const box = (await button.boundingBox())!;
    expect.soft(box.width, `target width: ${name}`).toBeGreaterThanOrEqual(24);
    expect.soft(box.height, `target height: ${name}`).toBeGreaterThanOrEqual(24);
  }
});

test('on phone as on desktop, the hero is a tick field drawn across its whole width, behind its text, even where its ticks are faintest: 2 s after load, every vertical band of the empty strip below its buttons, from the left edge, whose bottom-left ticks are almost invisible, to the right edge, shows pixels that changed at all since right after load, and at the middle of the heading, the tagline, the stack and each button, the element under the pointer is that element, so a click lands on the button', { tag: '@pixels' }, async ({ page }) => {
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  /* The hero is the main content region named by its main heading. */
  const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
  await expect(hero).toBeVisible();
  const elements = {
    'heading': hero.getByRole('heading', { level: 1 }),
    'tagline': hero.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    'stack': hero.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    'first button, "Voir les projets"': hero.getByRole('link', { name: 'Voir les projets' }),
    'second button, "Contact"': hero.getByRole('link', { name: 'Contact' }),
  };
  for (const [name, element] of Object.entries(elements)) await expect(element, name).toBeVisible();

  /* Right after load: the first animation frame has run, before the field starts its reveal.
     Then 2 s, long after the reveal, which sweeps the width in about 1.1 s, has reached the
     right edge. */
  await page.clock.runFor(16);
  const rightAfterLoad = await hero.screenshot();
  await page.clock.runFor(2000 - 16);
  const twoSecondsLater = await hero.screenshot();

  /* The strip of the hero below its buttons, the last of its content, down to its bottom
     edge, across its whole width: no text shows there, and the heading's decoding does not
     reach it, so a pixel that changed there shows the field. Its bottom-left corner is the
     field's faintest, under the veil too: the ticks of the leftmost band change their pixels
     by only a few colour levels, fewer in some renderings than the rounding error other
     comparisons allow. Since the screenshots are lossless and only the field changes between
     them there, any change at all counts as drawn. */
  const heroBox = (await hero.boundingBox())!;
  const buttonsBottom = await bottomOfButtons([elements['first button, "Voir les projets"'], elements['second button, "Contact"']]);
  const strip = { x: 0, y: buttonsBottom - heroBox.y + 4, width: heroBox.width, height: heroBox.y + heroBox.height - buttonsBottom - 4 };
  expect(strip.height, 'height of the empty strip of the hero below its buttons').toBeGreaterThanOrEqual(16);
  const ANY_CHANGE = 0;
  const { columns, scale } = await pixelsChangedPerColumnInRectangle(hero, rightAfterLoad, twoSecondsLater, strip, ANY_CHANGE);
  expect(
    bandsWithoutDrawnPixels(columns, scale, heroBox.width),
    `bands of the ${Math.round(heroBox.width)}px-wide hero, in the strip below its buttons, with no pixel changed at all since right after load`,
  ).toEqual([]);

  /* Behind the text: at the middle of the first line box of each element (rather than of its
     bounding box, so that the point stays on it even if it wraps), the element under the
     pointer is that element or one of its descendants, not the field drawn over the hero. */
  for (const [name, element] of Object.entries(elements)) {
    const isUnderThePointer = await element.evaluate((el) => {
      const firstLineBox = el.getClientRects()[0];
      if (!firstLineBox) return false;
      const hit = document.elementFromPoint(
        firstLineBox.left + firstLineBox.width / 2,
        firstLineBox.top + firstLineBox.height / 2,
      );
      return hit !== null && el.contains(hit);
    });
    expect.soft(isUnderThePointer, `at the middle of the ${name}, the element under the pointer is the ${name}`).toBe(true);
  }
});

test('on phone as on desktop, a click (a tap on mobile) on the hero’s professional title starts a ripple around that point: once revealed, 300 ms after the click, zones all around the click point, about 84px from it, got brighter since just before the click, while the zone at the click point did not', { tag: '@pixels' }, async ({ page, hasTouch }) => {
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  /* The hero is the main content region named by its main heading. */
  const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
  await expect(hero).toBeVisible();
  /* The professional title, below the author name, high in the hero: there, towards the top
     edge of the veil, the veil lets most of the field show, ripple included. */
  const title = hero.getByRole('heading', { level: 1 }).getByText('Horloger indépendant', { exact: true });
  await expect(title).toBeVisible();
  await title.scrollIntoViewIfNeeded();
  /* Long after the field's reveal (about 1.1 s) and the heading's decoding (in clear 4 s after
     load): from then on, nothing but the ripple changes what the hero shows. */
  await page.clock.runFor(5000);

  /* The click point: the middle of the first line box of the title's text (rather than of its
     element's box, which may span the hero's width, so that the point stays on its letters even
     if it wraps), relative to the hero. */
  const heroBox = (await hero.boundingBox())!;
  const onScreen = await title.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const box = range.getClientRects()[0];
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });
  const point = { x: onScreen.x - heroBox.x, y: onScreen.y - heroBox.y };
  const isOnTheTitle = await title.evaluate((el, { x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return hit !== null && el.contains(hit);
  }, onScreen);
  expect(isOnTheTitle, 'the click point is on the professional title’s text').toBe(true);

  /* The middle of the field's highest row of ticks, relative to the hero, whatever margin the
     field leaves along the hero's top edge: on a screenshot of the hero with its text and veil
     hidden, without moving anything, the first run of rows that show drawn pixels over the
     page's background. */
  const hideAllButTheField = (visibility: string) =>
    hero.evaluate((el, value) => {
      for (const child of Array.from(el.children)) {
        if (child.localName !== 'canvas') (child as HTMLElement).style.visibility = value;
      }
    }, visibility);
  await hideAllButTheField('hidden');
  const fieldOnly = await hero.screenshot();
  await hideAllButTheField('');
  const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const { rows, scale } = await pixelsNotOfBackgroundPerRow(hero, fieldOnly, undefined, pageBackground);
  const firstDrawnRow = rows.findIndex((count) => count > 0);
  expect(firstDrawnRow, 'rows of the hero that show ticks').toBeGreaterThanOrEqual(0);
  let lastRowOfHighestTicks = firstDrawnRow;
  while (rows[lastRowOfHighestTicks + 1] > 0) lastRowOfHighestTicks += 1;
  const highestTicksMiddle = (firstDrawnRow + lastRowOfHighestTicks + 1) / 2 / scale;

  /* The ring grows about 0.28px per ms: 300 ms after the click, it is about 84px from the click
     point. Four zones straddle the ring, 20px deep across it and 40px long along it, to its
     right, left, top and bottom; the top one lies straight above the click point, or, where the
     ring passes above the field's highest row of ticks, where the ring crosses that row, up and
     to the right of the click point. One 30px square sits at the click point, well inside the
     ring. All of them are far enough from the click point for the ring alone to light them, not
     the glow of a pointer hovering the click point. Text lies in some of them: what each zone
     gained is measured between two screenshots, where unchanged text adds nothing. */
  const RADIUS = 84;
  const DEPTH = 20;
  const LENGTH = 40;
  const topY = Math.max(point.y - RADIUS, highestTicksMiddle);
  const top = { x: point.x + Math.sqrt(Math.max(0, RADIUS ** 2 - (point.y - topY) ** 2)), y: topY };
  const ringZones = [
    { name: 'right', rectangle: { x: point.x + RADIUS - DEPTH / 2, y: point.y - LENGTH / 2, width: DEPTH, height: LENGTH } },
    { name: 'left', rectangle: { x: point.x - RADIUS - DEPTH / 2, y: point.y - LENGTH / 2, width: DEPTH, height: LENGTH } },
    { name: 'top', rectangle: { x: top.x - LENGTH / 2, y: top.y - DEPTH / 2, width: LENGTH, height: DEPTH } },
    { name: 'bottom', rectangle: { x: point.x - LENGTH / 2, y: point.y + RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH } },
  ];
  for (const zone of ringZones) {
    const { x, y, width, height } = zone.rectangle;
    expect(
      x >= 0 && y >= 0 && x + width <= heroBox.width && y + height <= heroBox.height,
      `the ${zone.name} zone about ${RADIUS}px from the click point lies inside the ${Math.round(heroBox.width)} × ${Math.round(heroBox.height)}px hero`,
    ).toBe(true);
  }
  const HALF_SIDE = 15;
  const centre = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };

  /* With a fine pointer, a click first brings the pointer over the click point, which lights
     the ticks under it: the pointer hovers it already before the click, so that both
     screenshots show the same hover and differ by the ripple alone. */
  if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
  await page.clock.runFor(300);
  const before = await hero.screenshot();

  await clickOrTap(page, hasTouch, onScreen);
  await page.clock.runFor(300);
  const after = await hero.screenshot();

  /* Lit by the ring: on average, each pixel of the zone at least 0.15 luma level (out of 255)
     brighter than just before the click; without a click, the zones gain nothing. The gain is
     small: the ring crosses a fifth of each zone's depth, the text over it (the author name's
     bold letters above the title, the tagline below it) hides part of it, and the ring's
     accent, darker than the field's cream, lies there under the hero's dark veil. */
  const MIN_RING_GAIN = 0.15;
  const gains = await Promise.all(
    ringZones.map(async (zone) => ({ zone, gain: await meanLuminanceGainedInRectangle(hero, before, after, zone.rectangle) })),
  );
  const dimRingZones = gains
    .filter(({ gain }) => !(gain >= MIN_RING_GAIN))
    .map(({ zone, gain }) => `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: +${gain.toFixed(2)}`);
  expect(
    dimRingZones,
    `zones about ${RADIUS}px around the click point on the professional title at (${Math.round(point.x)}, ${Math.round(point.y)})px whose pixels did not get, on average, at least ${MIN_RING_GAIN} luma levels brighter, 300 ms after the click`,
  ).toEqual([]);

  /* The click point itself: on average, each pixel at most half a luma level brighter. */
  const centreGain = await meanLuminanceGainedInRectangle(hero, before, after, centre);
  expect(
    centreGain,
    `mean luma gained by the pixels of the 30px square at the click point on the professional title (${Math.round(point.x)}, ${Math.round(point.y)})px, 300 ms after the click`,
  ).toBeLessThanOrEqual(0.5);
});

/* The hero of the French home page, still: the visitor asks for reduced motion, so the field is
   drawn once, complete, and stays still; time stands still from before the page loads, then
   runs a few animation frames, which draw the field. With its text (heading, tagline, stack
   and buttons), visible. */
async function stillHero(page: Page): Promise<{ hero: Locator; text: Record<string, Locator> }> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  /* The hero is the main content region named by its main heading. */
  const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
  await expect(hero).toBeVisible();
  const text = {
    'heading': hero.getByRole('heading', { level: 1 }),
    'tagline': hero.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
    'stack': hero.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
    'first button, "Voir les projets"': hero.getByRole('link', { name: 'Voir les projets' }),
    'second button, "Contact"': hero.getByRole('link', { name: 'Contact' }),
  };
  for (const [name, element] of Object.entries(text)) await expect(element, name).toBeVisible();
  await page.clock.runFor(100);
  return { hero, text };
}

/* What the hero's veil lets show of the field: two screenshots of the still hero, its text
   hidden from them without moving anything, so that only the field and the veil laid over it
   show — `veiled`, as the visitor sees it, and `bare`, the same hero with its veil hidden.
   Both hold the same ticks at the same places: only the veil tells them apart. The share of
   the field's brightness a zone of `veiled` keeps (brightnessKeptUnderLayerInRectangle) is what
   the veil lets through there, whatever the field's own brightness. The hero has no background
   colour of its own: the page's (`background`) shows through it. */
async function heroWithAndWithoutVeil(
  page: Page,
  hero: Locator,
  text: Record<string, Locator>,
): Promise<{ veiled: Buffer; bare: Buffer; background: string }> {
  for (const element of Object.values(text)) {
    await element.evaluate((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  }
  const veiled = await hero.screenshot();
  /* The veil: decorative, hidden from assistive technologies, it has no role or name. */
  const veil = hero.locator('.veil');
  await expect(veil).toHaveCount(1);
  await veil.evaluate((el) => {
    (el as HTMLElement).style.visibility = 'hidden';
  });
  const bare = await hero.screenshot();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  return { veiled, bare, background };
}

test('on phone as on desktop, the hero’s veil darkens its text zone: with the field still (reduced motion), compared with the same hero without its veil, the field behind the middle of the text zone keeps at most 0.8 times the share of its brightness it keeps in the same columns at the hero’s top edge, above the text', { tag: '@pixels' }, async ({ page }) => {
  /* A window at least 800px high, the project's own when it already is (phones): the hero is
     as high as the window less the header, and its vertically centred content needs room
     above the heading for the strip along the hero's top edge measured below. */
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width, height: Math.max(height, 800) });
  const { hero, text } = await stillHero(page);

  /* The text zone: from the top of the heading to the bottom of the buttons, the last of the
     hero's content, across the heading's width. */
  const heroBox = (await hero.boundingBox())!;
  const headingBox = (await text.heading.boundingBox())!;
  const buttonsBottom = await bottomOfButtons([text['first button, "Voir les projets"'], text['second button, "Contact"']]);
  const textTop = headingBox.y - heroBox.y;
  const textBottom = buttonsBottom - heroBox.y;
  const textMiddle = headingBox.x - heroBox.x + headingBox.width / 2;

  /* Two zones 32px wide, in the columns at the middle of the text zone: a 32px square at the
     middle of its height, and, above the heading, the strip along the hero's top edge, at
     most 32px high. The field is brighter at the top than at the bottom: what each zone keeps
     of the field's brightness is measured against the same hero without its veil. */
  const SIDE = 32;
  const atText: Rectangle = { x: textMiddle - SIDE / 2, y: (textTop + textBottom) / 2 - SIDE / 2, width: SIDE, height: SIDE };
  const atTop: Rectangle = { x: textMiddle - SIDE / 2, y: 0, width: SIDE, height: Math.min(SIDE, textTop) };
  expect(atTop.height, 'height of the strip along the hero’s top edge, above the heading').toBeGreaterThanOrEqual(24);

  const { veiled, bare, background } = await heroWithAndWithoutVeil(page, hero, text);
  const keptAtText = await brightnessKeptUnderLayerInRectangle(hero, bare, veiled, atText, background);
  const keptAtTop = await brightnessKeptUnderLayerInRectangle(hero, bare, veiled, atTop, background);
  expect(keptAtText.drawn, 'brightness above the background of the field behind the middle of the text zone: ticks are drawn there').toBeGreaterThan(0);
  expect(keptAtTop.drawn, 'brightness above the background of the field at the hero’s top edge: ticks are drawn there').toBeGreaterThan(0);
  expect(
    keptAtText.kept,
    `share of the field’s brightness kept behind the middle of the text zone, at (${Math.round(atText.x)}, ${Math.round(atText.y)})px, at most 0.8 times that kept in the same columns at the top edge of the ${Math.round(heroBox.width)} × ${Math.round(heroBox.height)}px hero, ${keptAtTop.kept.toFixed(2)}`,
  ).toBeLessThanOrEqual(0.8 * keptAtTop.kept);
});

/* Leaves only the still hero's field showing: its text and its veil are hidden without moving
   anything, and the hero is given the page's background colour, which shows through it, so
   that the pixels that differ from the hero's background are the ticks'. The site header is
   hidden too, still without moving anything: the hero starts right below it at a fractional
   position, and a screenshot of the hero rounded out to whole device pixels (WebKit at a
   device pixel ratio of 3) holds the header's bottom border on its first row, which would
   look like ticks drawn in every column. */
async function showOnlyTheField(hero: Locator, text: Record<string, Locator>): Promise<void> {
  const veil = hero.locator('.veil');
  await expect(veil).toHaveCount(1);
  const header = hero.page().locator('.site-header');
  await expect(header).toHaveCount(1);
  for (const element of [...Object.values(text), veil, header]) {
    await element.evaluate((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  }
  await hero.evaluate((el) => {
    (el as HTMLElement).style.backgroundColor = getComputedStyle(document.body).backgroundColor;
  });
}

/* The bands the still field's leftmost and rightmost columns of ticks are measured in, as for
   any tick-field: each from 6px outside the matching edge of the drawn ticks, `extent`, to 8px
   inside it, over the `heroHeight` px high hero's whole height. */
function outermostColumnBands(extent: { left: number; right: number }, heroHeight: number): { left: Rectangle; right: Rectangle } {
  return {
    left: { x: extent.left - 6, y: 0, width: 14, height: heroHeight },
    right: { x: extent.right - 8, y: 0, width: 14, height: heroHeight },
  };
}

/* The phone windows the field's corner ticks are checked at, set whatever the project's own
   window, up to the widest under 768px. */
const CORNER_TICKS_PHONE_VIEWPORTS = [
  { width: 320, height: 699 },
  { width: 375, height: 801 },
  { width: 412, height: 849 },
  { width: 767, height: 1024 },
];

/* Where the corner ticks of the still field are, in `screenshot` of the `heroHeight` px high
   hero, at the window `size`. The field's ticks, measured as for any tick-field, give the
   left edge of its leftmost column. Its rightmost column, whose ticks are among the most
   opaque at the top as at the bottom, is found tick by tick in a band from 6px outside its
   edge to 8px inside it: its first and last ticks give the field's first and last rows, the
   ticks of a row all starting at the same height. */
async function cornerTicks(
  hero: Locator,
  screenshot: Buffer,
  heroHeight: number,
  size: string,
): Promise<{ columns: { left: number; right: number }; firstRow: number; lastRow: number; tickWidth: number }> {
  const extent = await extentOfDrawnTicks(hero, screenshot);
  expect(extent.left, `drawn ticks in the ${size}px hero`).not.toBeNaN();
  const rightColumn = await drawnStrokesInRectangle(hero, screenshot, outermostColumnBands(extent, heroHeight).right);
  expect(rightColumn.length, `ticks drawn whole in the rightmost column of the ${size}px hero`).toBeGreaterThanOrEqual(2);
  return {
    columns: { left: extent.left, right: rightColumn[0].x },
    firstRow: rightColumn[0].y,
    lastRow: rightColumn[rightColumn.length - 1].y,
    tickWidth: rightColumn[0].width,
  };
}

/* The points a corner tick is read at, the tick `tickWidth` px wide and its top left corner at
   (x, y): 2px down the tick, inside even the shortest, across it every quarter of a CSS pixel,
   so that at least one falls on a pixel the tick covers fully. */
function pointsAcrossTick(x: number, y: number, tickWidth: number): { x: number; y: number }[] {
  const STEP = 0.25;
  return Array.from({ length: Math.ceil(tickWidth / STEP) }, (_, step) => ({ x: x + (step + 0.5) * STEP, y: y + 2.5 }));
}

test('on a phone, under 768 px wide, the hero’s tick field is faintest at the top left and most opaque at the bottom right: at 320 × 699, 375 × 801, 412 × 849 and 767 × 1024, with the field still (reduced motion), of its four corner ticks, the top left one shows the least of its colour over the background, and the bottom right one the most', { tag: '@pixels' }, async ({ page }) => {
  await page.setViewportSize(CORNER_TICKS_PHONE_VIEWPORTS[0]);
  const { hero, text } = await stillHero(page);
  await showOnlyTheField(hero, text);

  const problems: string[] = [];
  const measured: string[] = [];
  for (const viewport of CORNER_TICKS_PHONE_VIEWPORTS) {
    const size = `${viewport.width} × ${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.clock.runFor(100);
    const box = (await hero.boundingBox())!;
    expect(box.width, `width of the hero in a ${size}px window`).toBeCloseTo(viewport.width, 0);
    const screenshot = await hero.screenshot();

    const { columns, firstRow, lastRow, tickWidth } = await cornerTicks(hero, screenshot, box.height, size);

    /* A tick's opacity, read as in the opacity test of any tick-field: a pixel the tick covers
       fully shows the background plus the tick's opacity times (its colour − the background),
       whichever colour the tick has. Of the points across the tick, the most opaque reading is
       that of a fully covered pixel. */
    const opacityOfTick = async (x: number, y: number): Promise<number> => {
      const measures = await canvasOpacityOverBackgroundAt(hero, screenshot, pointsAcrossTick(x, y, tickWidth));
      return Math.max(...measures.map(({ opacity }) => opacity).filter((opacity) => !Number.isNaN(opacity)));
    };
    const corners = {
      'top left': await opacityOfTick(columns.left, firstRow),
      'top right': await opacityOfTick(columns.right, firstRow),
      'bottom left': await opacityOfTick(columns.left, lastRow),
      'bottom right': await opacityOfTick(columns.right, lastRow),
    };
    const describe = `${size}px: ${Object.entries(corners).map(([corner, opacity]) => `${corner} ${(100 * opacity).toFixed(1)}%`).join(', ')}`;
    measured.push(describe);
    const others = (corner: keyof typeof corners): number[] =>
      Object.entries(corners).filter(([name]) => name !== corner).map(([, opacity]) => opacity);
    if (!others('top left').every((opacity) => corners['top left'] < opacity)) {
      problems.push(`${describe}: the top left tick is not the faintest`);
    }
    if (!others('bottom right').every((opacity) => corners['bottom right'] > opacity)) {
      problems.push(`${describe}: the bottom right tick is not the most opaque`);
    }
  }
  expect(problems, `share of its colour each corner tick of the hero shows over the background (${measured.join('; ')})`).toEqual([]);
});

test('served under /portfolio/, the first hero button of the French home page, "Voir les projets", leads to /portfolio/fr/projets/', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/fr/');
  const firstButton = firstHeroButton(page);
  await expect(firstButton).toHaveText('Voir les projets');
  await expect(firstButton).toHaveAttribute('href', '/portfolio/fr/projets/');
  await firstButton.click();
  await expect(page).toHaveURL('http://localhost:1315/portfolio/fr/projets/');
});

test('served under /portfolio/, the second hero button of the French home page, declared by the anchor "#contact", still leads to "#contact", without a prefix', async ({ page }) => {
  await page.goto('http://localhost:1315/portfolio/fr/');
  /* The second button of exampleSite/content/_index.md declares url = '#contact': an anchor
     of the current page, which the site publication path must not prefix. */
  await expect(firstHeroButton(page)).toHaveText('Voir les projets');
  const secondButton = secondHeroButton(page);
  await expect(secondButton).toHaveText('Contact');
  await expect(secondButton).toHaveAttribute('href', '#contact');
});

test('on the English home page, the hero shows the English title, tagline and stack, and its first button, "View projects", leads to the English Projects page', async ({ page }) => {
  await page.goto('/en/');
  const main = page.getByRole('main');
  /* The hero comes from the front matter of exampleSite/content/_index.en.md, [params.hero]
     block: title, tagline (one line per entry) and stack. DOM text, as written there: the
     uppercase display is up to CSS. */
  await expect(mainContentHeading(page).getByText('Independent clockmaker', { exact: true })).toBeVisible();
  await expectLinesInOrder(main, [
    'Custom mechanical watches — 20 years at the bench.',
    'Design, repair and servicing',
    'of antique clocks and watches.',
  ]);
  await expect(main.getByText('Brass · Steel · Ruby · Enamel', { exact: true })).toBeVisible();
  /* The English Projects page has the slug 'projects' (exampleSite/content/projets/_index.en.md). */
  const firstButton = firstHeroButton(page);
  await expect(firstButton).toHaveText('View projects');
  await expect(firstButton).toHaveAttribute('href', '/en/projects/');
  await firstButton.click();
  await expect(page).toHaveURL('/en/projects/');
});


test.describe('home page without JavaScript', () => {
  /* The theme rule: no JavaScript is required to read the content. Animations (the decoding
     heading, the tick field behind the hero) are an enhancement. */
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, the hero of the French home page is complete and readable: the heading shows the author name and the professional title in clear, with the tagline, the stack and both buttons, nothing left transparent', async ({ page }) => {
    await page.goto('/fr/');
    const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
    const mainHeading = hero.getByRole('heading', { level: 1 });
    /* In clear: the heading displays the name and the title themselves, not scrambled signs,
       whether in its text or in generated content. */
    await expect(mainHeading).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);
    expect(await displayedText(mainHeading), 'text displayed by the heading').toBe('Jean Exemple Horloger indépendant');
    const elements = {
      'author name (h1)': mainHeading,
      'professional title': mainHeading.getByText('Horloger indépendant', { exact: true }),
      'tagline, line 1': hero.getByText('Montres mécaniques sur mesure — 20 ans d’atelier.'),
      'tagline, line 2': hero.getByText('Conception, réparation et entretien'),
      'tagline, line 3': hero.getByText('de pendules et de montres anciennes.'),
      'stack': hero.getByText('Laiton · Acier · Rubis · Émail', { exact: true }),
      'first button': hero.getByRole('link', { name: 'Voir les projets' }),
      'second button': hero.getByRole('link', { name: 'Contact' }),
    };
    for (const [name, element] of Object.entries(elements)) {
      await expect(element, name).toBeVisible();
      /* Readable: no element is left transparent, waiting for a script to reveal it. The
         effective opacity multiplies those of the element and of its ancestors. */
      const opacity = await element.evaluate((el) => {
        let product = 1;
        for (let node: Element | null = el; node; node = node.parentElement) {
          product *= parseFloat(getComputedStyle(node).opacity);
        }
        return product;
      });
      expect.soft(opacity, `effective opacity: ${name}`).toBe(1);
    }
  });
});

test.describe('home page without a hero', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITHOUT_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a home page whose front matter has no [params.hero] block displays no main heading, no tagline and no action buttons: only the header and its content', async ({ page, context }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    await page.goto(`${SITE_WITHOUT_HERO.origin}/fr/`);
    /* The header is displayed as usual. */
    await expect(page.locator('header').getByRole('link', { name: 'Exemple', exact: true })).toBeVisible();
    /* The home page content (tests/fixtures/without-hero/content/_index.md) is displayed… */
    const main = page.getByRole('main');
    const homePageText = 'Accueil fictif sans hero : seul ce texte occupe le corps de la page.';
    await expect(main.getByText(homePageText)).toBeVisible();
    /* …without a hero: no main heading (h1, not even the author name), no tagline, no action
       buttons. The main content displays only the home page text. */
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
    await expect(main.getByText('Jean Exemple')).toHaveCount(0);
    await expect(main.getByRole('link')).toHaveCount(0);
    await expect(main).toHaveText(homePageText);
  });

  test('on a home page without a hero and on another page, the theme’s script runs to its end without raising any error', async ({ page, context }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));
    for (const address of ['/fr/', '/fr/page-longue/']) {
      await page.goto(`${SITE_WITHOUT_HERO.origin}${address}`);
      /* The script defines its two custom elements last: once both are defined, it has run
         to its end, so the absence of errors does not come from a script that did not run. */
      await page.waitForFunction(
        () => customElements.get('scramble-text') !== undefined && customElements.get('tick-field') !== undefined,
      );
    }
    expect(errors).toEqual([]);
  });
});

/* Blocks the font files of the site served at `origin`: a page route takes precedence over the
   context route that serves the site, so the browser renders the fallback fonts of the stacks.
   Returns the list, filled as the page asks for them, of the blocked font URLs. */
async function blockFontFiles(page: Page, origin: string): Promise<string[]> {
  const blockedFonts: string[] = [];
  await page.route(`${origin}/**/*.{woff,woff2,ttf,otf}`, async (route) => {
    blockedFonts.push(route.request().url());
    await route.abort();
  });
  return blockedFonts;
}

/* Sizes the window to `viewport`, then opens the French home page of the test site served at
   `origin`, JavaScript off, and waits for its fonts. Not through `document.fonts.ready`: with
   JavaScript off, Firefox can leave it pending, whether the font files are served or blocked.
   Waits instead until the page has asked for IBM Plex Mono and none of its web fonts is still
   loading: each one ended loaded or in error, and the fonts displayed are the final ones. */
async function openHomeWithoutScriptAt(page: Page, viewport: { width: number; height: number }, origin: string): Promise<void> {
  const size = `${viewport.width} × ${viewport.height}`;
  await page.setViewportSize(viewport);
  await page.goto(`${origin}/fr/`);
  await expect.poll(() => page.evaluate(() => {
    const faces = [...document.fonts];
    return {
      monoAskedFor: faces.some((face) => /mono/i.test(face.family) && face.status !== 'unloaded'),
      stillLoading: faces.filter((face) => face.status === 'loading').map((face) => face.family),
    };
  }), { message: `web fonts settled at ${size}`, timeout: 10_000 }).toEqual({ monoAskedFor: true, stillLoading: [] });
}

test.describe('home page of a single-language site', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_SINGLE_LANGUAGE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test.describe('without JavaScript and with the fallback font', () => {
    /* Without JavaScript, the hero's height relies on CSS alone: the header's estimated
       height, which must also hold when the web fonts never arrive. */
    test.use({ javaScriptEnabled: false });

    test('on a single-language site, without JavaScript and with the web font files blocked, in a window tall enough for its content, the hero ends exactly at the bottom of the window: its height is the window height minus the header height, within 1 px, on a phone as on desktop', async ({ page, context }) => {
      await serveSite(context, SITE_WITH_A_SINGLE_LANGUAGE, siteDirectory);
      const blockedFonts = await blockFontFiles(page, SITE_WITH_A_SINGLE_LANGUAGE.origin);
      for (const viewport of TALL_VIEWPORTS) {
        const size = `${viewport.width} × ${viewport.height}`;
        await openHomeWithoutScriptAt(page, viewport, SITE_WITH_A_SINGLE_LANGUAGE.origin);
        /* The fonts really were blocked: the page asked for IBM Plex Mono, used by the
           header and the heading, and no web font ended up loaded. */
        expect(blockedFonts.some((url) => /mono/i.test(url)), `blocked font requests at ${size}: ${blockedFonts.join(', ')}`).toBe(true);
        const loadedFonts = await page.evaluate(() =>
          [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family));
        expect(loadedFonts, `web fonts loaded at ${size}`).toEqual([]);
        /* The site is single-language: the header shows no language switcher. */
        await expect(page.locator('header').getByRole('group', { name: 'Langue' }), `language switcher at ${size}`).toHaveCount(0);
        await expectHeroToEndAtWindowBottom(page, viewport, size);
      }
    });
  });
});

/* The top edge of each link of the header menu, in document order, and the number of lines
   they sit on: the distinct top edges, rounded to the pixel. All the links are measured in a
   single round trip to the page, which keeps a measure taken at many widths fast on every
   browser. */
async function menuLines(links: Locator): Promise<{ linkTops: number[]; lineCount: number }> {
  const linkTops = await links.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().y));
  return { linkTops, lineCount: new Set(linkTops.map((top) => Math.round(top))).size };
}

test.describe('home page of a site with a long menu', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_LONG_MENU);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a phone, when the menu wraps onto two lines, in a window tall enough for its content, the hero still ends exactly at the bottom of the window: at 412 × 1100, its height is the window height minus the header height, within 1 px', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_LONG_MENU, siteDirectory);
    const viewport = { width: 412, height: 1100 };
    const size = `${viewport.width} × ${viewport.height}`;
    await openHomeAt(page, viewport, SITE_WITH_A_LONG_MENU.origin);

    /* The menu is too long for a single line at 412 px: its links sit on two lines (three
       at 320 px). */
    const links = page.locator('header nav').getByRole('link');
    await expect(links).toHaveText(['Accueil', 'Projets', 'Parcours', 'Compétences', 'Publications', 'Contact']);
    const { linkTops, lineCount } = await menuLines(links);
    expect(lineCount, `at ${size}, lines of the menu (top edges of its links: ${linkTops.join(', ')})`).toBe(2);

    const { hero, heading, buttons } = await heroHeadingAndButtons(page, size);
    const { expectedHeight } = await heightBelowHeader(page, viewport, { heading, buttons }, size);
    const heroBox = (await hero.boundingBox())!;
    expect(
      Math.abs(heroBox.height - expectedHeight),
      `at ${size}, hero height (${heroBox.height} px) against the window height minus the header height (${expectedHeight} px)`,
    ).toBeLessThanOrEqual(1);
  });
});

test.describe('home page of another site, with a different hero', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ANOTHER_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the hero shows this site’s author, title and only button, "Écrire à Camille", to its mailto: address, and not those of the example site', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_ANOTHER_HERO, siteDirectory);
    await page.goto(`${SITE_WITH_ANOTHER_HERO.origin}/fr/`);
    /* The author comes from params.author (tests/fixtures/other-hero/hugo.toml), the title and
       the single [[params.hero.actions]] block from tests/fixtures/other-hero/content/_index.md.
       DOM text, as written there: the uppercase display is up to CSS. */
    await expect(mainContentHeading(page)).toHaveText(/^\s*Camille Fictive\s*Relieuse d’art\s*$/);
    /* The text of this home page has no link: the only link of the main content is this
       button (the header has its own links). */
    const main = page.getByRole('main');
    const links = main.getByRole('link');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText('Écrire à Camille');
    await expect(links.first()).toHaveAttribute('href', 'mailto:camille@example.org');
    await expect(main.getByRole('link', { name: 'Voir les projets' })).toHaveCount(0);
    await expect(main.getByRole('link', { name: 'Contact' })).toHaveCount(0);
  });
});

test.describe('home page of a site whose hero has no title', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_HERO_WITHOUT_TITLE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the hero heading, which holds the author name only, decodes: right after load, the name is scrambled, and 4 s later it is in clear', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it: animation frames and timers then run as they would in 4 s. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await serveSite(context, SITE_WITH_A_HERO_WITHOUT_TITLE, siteDirectory);
    await page.goto(`${SITE_WITH_A_HERO_WITHOUT_TITLE.origin}/fr/`);
    const mainHeading = mainContentHeading(page);
    await expect(mainHeading).toHaveCount(1);
    /* What the visitor sees in the heading, whitespace excluded: the name, from params.author,
       alone, since the [params.hero] block of tests/fixtures/untitled-hero/content/_index.md
       has no title. */
    const inClear = 'Jean Exemple'.replace(/\s+/g, '');
    /* Right after load, none of its letters is shown: one sign in place of each one. */
    const shown = await textOnScreen(mainHeading);
    expect(Array.from(shown), `"${shown}" shows one sign per letter of the name`).toHaveLength(Array.from(inClear).length);
    for (const character of Array.from(shown)) {
      expect(SIGNS, `"${character}", shown in "${shown}" right after load, is one of the signs`).toContain(character);
    }
    /* 4 s after load, the name is in clear. */
    await page.clock.runFor(4000);
    expect(await textOnScreen(mainHeading), '4 s after load').toBe(inClear);
  });
});

test.describe('home page of a site whose hero has long words, on a 320 px wide phone', () => {
  /* 320 px: the smallest common phone width (WCAG 1.4.10, reflow). */
  test.use({ viewport: { width: 320, height: 640 } });
  /* Only the mobile-chrome and mobile-safari projects emulate a phone (mobile viewport, touch
     screen, phone user agent): on the desktop projects, a 320 px window would only be a
     shrunken desktop browser. The condition reads the project's isMobile option rather than
     the isMobile fixture, which belongs to each test: without a test fixture, Playwright
     evaluates it before the beforeAll, and the desktop projects do not build the site for
     nothing. */
  test.skip(() => !test.info().project.use.isMobile, 'phone-specific behavior');
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_HERO_WITH_LONG_WORDS);
  });
  /* The test.skip above skips the beforeAll, but not the afterAll: on desktop, no site was
     built. */
  test.afterAll(() => {
    if (siteDirectory) removeDirectory(siteDirectory);
  });

  test('on a 320 px wide phone, a hero whose author name and title each contain a word of 12 characters or more never scrolls horizontally: every 250 ms while its heading decodes, then in clear, within 6 s, the name and the title stay within the width', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await serveSite(context, SITE_WITH_A_HERO_WITH_LONG_WORDS, siteDirectory);
    await page.goto(`${SITE_WITH_A_HERO_WITH_LONG_WORDS.origin}/fr/`);
    const width = page.viewportSize()!.width;
    expect(width, 'window width').toBe(320);

    /* The author comes from params.author (tests/fixtures/hero-with-long-words/hugo.toml), the
       title from the [params.hero] block, title key, of
       tests/fixtures/hero-with-long-words/content/_index.md. "Vanderkerckhove-Fictive" and
       "Horlogère-restauratrice" have more than 12 characters. Both are in clear within 6 s
       of load. */
    const mainHeading = mainContentHeading(page);
    await expect(mainHeading).toHaveCount(1);
    const elements = {
      'author name (h1)': mainHeading,
      /* While it decodes, the title shows signs: it is found by the name it keeps for
         assistive technologies. */
      'professional title': mainHeading.getByLabel('Horlogère-restauratrice', { exact: true }),
    };
    const inClear = 'Apolline Vanderkerckhove-Fictive Horlogère-restauratrice'.replace(/\s+/g, '');
    const holdsASign = (text: string) => Array.from(text).some((character) => SIGNS.includes(character));
    /* Every 250 ms from load, while the heading still shows a sign, and at the first moment
       it shows none, the page does not scroll horizontally and the name and the title stay
       within the width. */
    let shown = '';
    let elapsedMs = 0;
    for (; elapsedMs <= 6000; elapsedMs += 250) {
      if (elapsedMs > 0) await page.clock.runFor(250);
      const moment = `${elapsedMs} ms after load`;
      shown = await textOnScreen(mainHeading);
      /* Right after load, the heading is scrambled: the test sees it while it decodes. */
      if (elapsedMs === 0) expect(holdsASign(shown), `"${shown}", shown right after load, holds a sign`).toBe(true);

      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect.soft(pageWidth, `no horizontal scrolling ${moment}`).toBeLessThanOrEqual(width);
      for (const [name, element] of Object.entries(elements)) {
        const { left, right } = await displayedExtent(element);
        expect.soft(left, `left edge within the window ${moment}: ${name}`).toBeGreaterThanOrEqual(0);
        expect.soft(right, `right edge within the window ${moment}: ${name}`).toBeLessThanOrEqual(width);
      }
      if (!holdsASign(shown)) break;
    }
    /* The decoding ends: the heading is in clear, within 6 s of load, and fully visible. */
    expect(shown, `heading shown ${elapsedMs} ms after load, in clear`).toBe(inClear);
    await expect(mainHeading).toHaveText(/^\s*Apolline Vanderkerckhove-Fictive\s*Horlogère-restauratrice\s*$/);
    await expect(mainHeading, 'author name (h1)').toBeVisible();
    await expect(mainHeading.getByText('Horlogère-restauratrice', { exact: true }), 'professional title').toBeVisible();
  });
});

test.describe('home page of a site served under /portfolio/, with a button declared by a url from the site root', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_UNDER_PORTFOLIO_WITH_A_URL_FROM_THE_ROOT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('served under /portfolio/, a hero button declared by url = "/fr/page-longue/", relative to the site root, leads to /portfolio/fr/page-longue/', async ({ page, context }) => {
    const site = SITE_UNDER_PORTFOLIO_WITH_A_URL_FROM_THE_ROOT;
    await serveSite(context, site, siteDirectory);
    await page.goto(`${site.origin}/portfolio/fr/`);
    /* The single button of tests/fixtures/url-from-the-root/content/_index.md declares
       url = '/fr/page-longue/': the page exampleSite/content/page-longue.md, from the site
       root. Served under /portfolio/, this site publishes it at /portfolio/fr/page-longue/. */
    const button = firstHeroButton(page);
    await expect(button).toHaveText('Lire la page longue');
    await expect(button).toHaveAttribute('href', '/portfolio/fr/page-longue/');
    await button.click();
    await expect(page).toHaveURL(`${site.origin}/portfolio/fr/page-longue/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page longue');
  });
});

test.describe('home page of a site served under /portfolio/, with a button declared by a url from the site root that starts with the same word as the subpath', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_UNDER_PORTFOLIO_WITH_A_URL_STARTING_WITH_THE_SUBPATH);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('served under /portfolio/, a hero button declared by url = "/portfolio/galerie/", relative to the site root and starting with the same word as the subpath, still gets the prefix: it leads to /portfolio/portfolio/galerie/', async ({ page, context }) => {
    const site = SITE_UNDER_PORTFOLIO_WITH_A_URL_STARTING_WITH_THE_SUBPATH;
    await serveSite(context, site, siteDirectory);
    await page.goto(`${site.origin}/portfolio/fr/`);
    /* The single button of tests/fixtures/url-starting-with-the-subpath/content/_index.md
       declares url = '/portfolio/galerie/': the galerie.md page of the same fixture, published
       at /portfolio/galerie/ from the site root. Served under /portfolio/, this site publishes
       it at /portfolio/portfolio/galerie/. */
    const button = firstHeroButton(page);
    await expect(button).toHaveText('Voir la galerie');
    await expect(button).toHaveAttribute('href', '/portfolio/portfolio/galerie/');
    await button.click();
    await expect(page).toHaveURL(`${site.origin}/portfolio/portfolio/galerie/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Galerie');
  });
});

/* These tests only run hugo build, without a browser: running them in every Playwright
   project would repeat the same build five times. */
const BUILD_TESTS_PROJECT = 'chromium';

test.describe('hero content errors: build failure', () => {
  test.skip(
    () => test.info().project.name !== BUILD_TESTS_PROJECT,
    `build without a browser, identical in every project: run in ${BUILD_TESTS_PROJECT} only`,
  );

  test('a home page where a hero button declares a pageRef to a page that does not exist makes the site build fail with only the message that cites this pageRef, without the "ni champ url ni champ pageRef" message', () => {
    /* The first button of tests/fixtures/page-ref-not-found/content/_index.md declares
       pageRef = '/page-fictive-introuvable', which the site does not contain. Rather than a
       button without a destination, the person building the site must get a failure that
       names this pageRef. Also blaming them for having neither url nor pageRef would mislead
       them: only this message must appear, whatever wording is chosen for the other one. */
    const build = tryToBuildSite(SITE_WITH_A_PAGE_REF_NOT_FOUND);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toContain('/page-fictive-introuvable');
    expect(build.errors).not.toMatch(/\bni\s+(?:de\s+)?(?:champ\s+)?url\b/i);
  });

  test('a home page where a hero button has no label makes the site build fail, with an error message that cites the missing label field', () => {
    /* The second button of tests/fixtures/unlabeled-button/content/_index.md has a valid
       url = '#contact' but no label. Rather than an empty link, the person building the site
       must get a failure whose message names the label field of the front matter, whatever
       wording is chosen. */
    const build = tryToBuildSite(SITE_WITH_A_BUTTON_WITHOUT_LABEL);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toMatch(/\blabel\b/);
  });

  test('a home page where a hero button has neither url nor pageRef makes the site build fail, with an error message that cites both fields', () => {
    /* The second button of tests/fixtures/button-without-destination/content/_index.md has a
       label but neither url nor pageRef. Rather than a link that leads nowhere, the person
       building the site must get a failure whose message names the url and pageRef fields of
       the front matter, whatever wording is chosen. */
    const build = tryToBuildSite(SITE_WITH_A_BUTTON_WITHOUT_DESTINATION);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toMatch(/\burl\b/);
    expect(build.errors).toMatch(/\bpageRef\b/);
  });

  test('a home page where a hero button declares both a url and a pageRef makes the site build fail, with an error message that cites both fields, and not the "ni champ url ni champ pageRef" message', () => {
    /* The second button of tests/fixtures/button-with-two-destinations/content/_index.md has a
       label and declares both url = '#contact' and pageRef = '/projets', two valid
       destinations. Rather than a link where one of the two destinations would be silently
       ignored, the person building the site must get a failure whose message names the url
       and pageRef fields of the front matter, whatever wording is chosen; blaming them for
       having neither would mislead them. */
    const build = tryToBuildSite(SITE_WITH_A_BUTTON_WITH_URL_AND_PAGE_REF);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toMatch(/\burl\b/);
    expect(build.errors).toMatch(/\bpageRef\b/);
    expect(build.errors).not.toMatch(/\bni\s+(?:de\s+)?(?:champ\s+)?url\b/i);
  });

  test('a site whose home page declares a hero without params.author being set makes the site build fail, with an error message that cites the author field', () => {
    /* tests/fixtures/authorless-hero/hugo.toml empties the example site's params.author,
       and its home page declares a complete hero. Rather than a hero heading without a name,
       the person building the site must get a failure whose message names the author
       parameter of the configuration, whatever wording is chosen. */
    const build = tryToBuildSite(SITE_WITH_A_HERO_WITHOUT_AUTHOR);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors).toMatch(/\bauthor\b/);
  });
});
