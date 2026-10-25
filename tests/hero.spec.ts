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
  SITE_WITH_A_PAGE_REF_NOT_FOUND,
  buildSite,
  removeDirectory,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import { tabUntilFocused } from './helpers/keyboard';
import {
  type Rectangle,
  bandsWithoutDrawnPixels,
  meanLuminanceGainedInRectangle,
  brightnessKeptUnderLayerInRectangle,
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

/* Computed styles that decide how a text looks: displayed case, first font of the stack,
   weight and color. */
async function textStyle(element: Locator) {
  return element.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      textTransform: style.textTransform,
      family: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
      weight: style.fontWeight,
      color: style.color,
    };
  });
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

test('on the French home page, the main heading starts with the site author name', async ({ page }) => {
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  /* The DOM text, as written in params.author: the uppercase display is up to CSS. */
  await expect(mainHeading).toHaveText(/^\s*Jean Exemple/);
});

test('on the French home page, the main heading displays, on a new line below the author name, their professional title', async ({ page }) => {
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  /* The title comes from the front matter of exampleSite/content/_index.md, [params.hero]
     block, title key. DOM text, as written in the front matter: the uppercase display is up
     to CSS. */
  await expect(mainHeading).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);
  /* On a new line: the professional title starts at least half a line below the name. */
  const professionalTitle = mainHeading.getByText('Horloger indépendant', { exact: true });
  await expect(professionalTitle).toBeVisible();
  const mainHeadingBox = await mainHeading.boundingBox();
  const professionalTitleBox = await professionalTitle.boundingBox();
  expect(professionalTitleBox!.y - mainHeadingBox!.y).toBeGreaterThanOrEqual(professionalTitleBox!.height / 2);
});

test('on the French home page, the author name is displayed in uppercase, in IBM Plex Mono bold (700), paper color, larger than the professional title that follows it', async ({ page }) => {
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  await expect(mainHeading).toHaveText(/^\s*Jean Exemple/);
  const professionalTitle = mainHeading.getByText('Horloger indépendant', { exact: true });
  await expect(professionalTitle).toBeVisible();
  /* The name is a direct text node of the h1: it takes the computed styles of the h1. Design
     reference: name in clamp(44px, 6.4vw, 100px), title in clamp(22px, 3vw, 46px). */
  const nameStyle = await textStyle(mainHeading);
  expect(nameStyle).toEqual({
    textTransform: 'uppercase',
    family: 'IBM Plex Mono',
    weight: '700',
    color: 'rgb(227, 223, 204)',
  });
  const nameSize = await mainHeading.evaluate((h1) => parseFloat(getComputedStyle(h1).fontSize));
  const titleSize = await professionalTitle.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(nameSize, 'the name is larger than the professional title').toBeGreaterThan(titleSize);
});

test('on the French home page, the professional title that follows the author name is displayed in uppercase, in IBM Plex Mono semibold (600), accent color', async ({ page }) => {
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  /* The title is a separate element in the h1: its own computed styles decide how it looks.
     Design reference: accent #2A888D. */
  const professionalTitle = mainHeading.getByText('Horloger indépendant', { exact: true });
  await expect(professionalTitle).toBeVisible();
  expect(await textStyle(professionalTitle)).toEqual({
    textTransform: 'uppercase',
    family: 'IBM Plex Mono',
    weight: '600',
    color: 'rgb(42, 136, 141)',
  });
});

test('on phone as on desktop, the hero heading follows the design’s spacing: name with a line height of 1.02, professional title with a line height of 1.3, both letter-spaced by -0.64 px within 0.02 px, and the title line starting 36 px below the name line from 768 px wide, 24 px on a phone, within 1.5 px', async ({ page, isMobile }) => {
  /* Design reference: letter-spacing -0.02em set on the h1 itself, whose font size is the
     browser default for an h1 (2em of 16 px = 32 px): both lines inherit -0.64 px. Name
     line-height 1.02; title line-height 1.3 and margin-top 36px (24px on a phone). Desktop
     projects are checked at a wide window and at 768 px wide, where the desktop spacing
     starts; phone projects at their own size. */
  const viewports = isMobile ? [page.viewportSize()!] : [{ width: 1280, height: 900 }, { width: 768, height: 1024 }];
  const expectedGap = isMobile ? 24 : 36;
  for (const viewport of viewports) {
    const size = `${viewport.width} × ${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const mainHeading = mainContentHeading(page);
    /* Both lines in clear: the decoding is over. */
    await expect(mainHeading).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);

    /* For each line: computed size, line height and letter spacing of the element holding its
       text, and the top and bottom of its line boxes. A text's client rects cover its glyphs'
       content area (or its line box); the line box extends it by half the leading on each
       side, centred on it. */
    const lines = await mainHeading.evaluate((root, texts) => texts.map((text) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const start = (node.textContent ?? '').indexOf(text);
        if (start === -1) continue;
        const style = getComputedStyle(node.parentElement!);
        const fontSize = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + text.length);
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);
        const first = rects[0];
        const last = rects[rects.length - 1];
        return {
          fontSize,
          rawLineHeight: style.lineHeight,
          lineHeight,
          rawLetterSpacing: style.letterSpacing,
          letterSpacing: parseFloat(style.letterSpacing),
          lineTop: first.top - (lineHeight - first.height) / 2,
          lineBottom: last.bottom + (lineHeight - last.height) / 2,
        };
      }
      return null;
    }), ['Jean Exemple', 'Horloger indépendant']);
    const [name, title] = lines;
    expect(name, `at ${size}, author name found`).not.toBeNull();
    expect(title, `at ${size}, professional title found`).not.toBeNull();

    expect.soft(name!.lineHeight / name!.fontSize, `at ${size}, name line height (${name!.rawLineHeight} for ${name!.fontSize}px)`).toBeCloseTo(1.02, 2);
    expect.soft(title!.lineHeight / title!.fontSize, `at ${size}, title line height (${title!.rawLineHeight} for ${title!.fontSize}px)`).toBeCloseTo(1.3, 2);
    /* Distance to -0.64 px; NaN while the letter spacing is `normal`. */
    expect.soft(Math.abs(name!.letterSpacing + 0.64), `at ${size}, name letter spacing (${name!.rawLetterSpacing}) differs from -0.64px by`).toBeLessThanOrEqual(0.02);
    expect.soft(Math.abs(title!.letterSpacing + 0.64), `at ${size}, title letter spacing (${title!.rawLetterSpacing}) differs from -0.64px by`).toBeLessThanOrEqual(0.02);
    const gap = title!.lineTop - name!.lineBottom;
    expect.soft(gap, `at ${size}, space between the bottom of the name line and the top of the title line`).toBeGreaterThanOrEqual(expectedGap - 1.5);
    expect.soft(gap, `at ${size}, space between the bottom of the name line and the top of the title line`).toBeLessThanOrEqual(expectedGap + 1.5);
  }
});

test('on phone as on desktop, the hero tagline follows the design’s spacing: 20 px with a line height of 1.55, at most 600 px wide, starting 165 px below the heading from 768 px wide; 18 px, 40 px below the heading on a phone; within 1.5 px', async ({ page, isMobile }) => {
  /* Design reference: tagline in 20px, line-height 1.55, max-width 600px, margin-top 165px
     below the heading, which has no margin of its own. On a phone, where the design has no
     layout, 18px and 40px below the heading; the line height and the maximum width stay.
     Desktop projects are checked at a wide window and at 768 px wide, where the desktop
     spacing starts; phone projects at their own size. */
  const viewports = isMobile ? [page.viewportSize()!] : [{ width: 1280, height: 900 }, { width: 768, height: 1024 }];
  const expectedFontSize = isMobile ? 18 : 20;
  const expectedGap = isMobile ? 40 : 165;
  for (const viewport of viewports) {
    const size = `${viewport.width} × ${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const mainHeading = mainContentHeading(page);
    /* Both heading lines in clear: the decoding is over. */
    await expect(mainHeading).toHaveText(/^\s*Jean Exemple\s*Horloger indépendant\s*$/);
    /* The tagline: the element holding its first line, which holds the other two as well. */
    const tagline = page.getByRole('main').getByText('Montres mécaniques sur mesure — 20 ans d’atelier.');
    await expect(tagline).toBeVisible();
    await expect(tagline).toContainText('de pendules et de montres anciennes.');

    const style = await tagline.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        fontSize: parseFloat(computed.fontSize),
        rawLineHeight: computed.lineHeight,
        lineHeight: parseFloat(computed.lineHeight),
        maxWidth: computed.maxWidth,
        width: el.getBoundingClientRect().width,
      };
    });
    expect.soft(style.fontSize, `at ${size}, tagline font size`).toBeCloseTo(expectedFontSize, 1);
    expect.soft(style.lineHeight / style.fontSize, `at ${size}, tagline line height (${style.rawLineHeight} for ${style.fontSize}px)`).toBeCloseTo(1.55, 2);
    expect.soft(style.maxWidth, `at ${size}, tagline maximum width`).toBe('600px');
    expect.soft(style.width, `at ${size}, tagline width`).toBeLessThanOrEqual(600.5);

    /* The gap between the bottom of the heading's own box (its title line included) and the
       top of the tagline's box. */
    const headingBox = (await mainHeading.boundingBox())!;
    const taglineBox = (await tagline.boundingBox())!;
    const gap = taglineBox.y - (headingBox.y + headingBox.height);
    expect.soft(gap, `at ${size}, space between the bottom of the heading and the top of the tagline`).toBeGreaterThanOrEqual(expectedGap - 1.5);
    expect.soft(gap, `at ${size}, space between the bottom of the heading and the top of the tagline`).toBeLessThanOrEqual(expectedGap + 1.5);
  }
});

test('on the French home page, the hero heading decodes: right after load, its author name and professional title are scrambled, and 4 s later both are in clear', async ({ page }) => {
  /* Animations are allowed, and time stands still from before the page loads, until the
     test advances it: animation frames and timers then run as they would in 4 s. */
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
  /* 4 s after load, the name and the title are both in clear. */
  await page.clock.runFor(4000);
  expect(await textOnScreen(mainHeading), '4 s after load').toBe(inClear);
});

test('on the French home page, the hero title line decodes after the name: when the first letters of the author name are in clear, the professional title is still fully scrambled', async ({ page }) => {
  /* Design reference: the title line starts decoding where the name ends, as if both lines
     were one text with the title placed after the name. Animations are allowed, and time
     stands still from before the page loads, until the test advances it. */
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  await expect(mainHeading).toHaveCount(1);
  /* What the visitor sees in the heading, whitespace excluded: the name, from params.author,
     then the title, from the [params.hero] block of exampleSite/content/_index.md. */
  const name = Array.from('Jean Exemple'.replace(/\s+/g, ''));
  const title = Array.from('Horloger indépendant'.replace(/\s+/g, ''));
  /* Time advances in small steps until the first word of the name, "Jean", is in clear. */
  let shown = Array.from(await textOnScreen(mainHeading));
  for (let elapsedMs = 0; elapsedMs < 4000 && !shown.join('').startsWith('Jean'); elapsedMs += 25) {
    await page.clock.runFor(25);
    shown = Array.from(await textOnScreen(mainHeading));
  }
  expect(shown.join(''), 'the name starts with "Jean" in clear within 4 s of load').toMatch(/^Jean/);
  expect(shown, `"${shown.join('')}" shows one character per letter of the name and the title`).toHaveLength(name.length + title.length);
  /* At that moment, none of the title letters is shown: one sign in place of each one. */
  const titleShown = shown.slice(name.length).join('');
  for (const character of Array.from(titleShown)) {
    expect(SIGNS, `"${character}", shown in the title "${titleShown}" when the name starts with "Jean" in clear, is one of the signs`).toContain(character);
  }
});

test('on the French home page, the hero heading decodes at the design’s pace: 1.5 s after load, its author name and professional title are both in clear', async ({ page }) => {
  /* Design reference: the name and the title decode in about 1.1 s in total, the title
     continuing where the name ends, so both are in clear well before 1.5 s. Animations are
     allowed, and time stands still from before the page loads, until the test advances it. */
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const mainHeading = mainContentHeading(page);
  await expect(mainHeading).toHaveCount(1);
  /* What the visitor sees in the heading, whitespace excluded: the name, from params.author,
     and the title, from the [params.hero] block of exampleSite/content/_index.md. */
  const inClear = 'Jean Exemple Horloger indépendant'.replace(/\s+/g, '');
  await page.clock.runFor(1500);
  expect(await textOnScreen(mainHeading), '1.5 s after load').toBe(inClear);
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

test('on the French home page, the hero tagline is displayed in IBM Plex Sans, paper color at 88% opacity, and the stack in IBM Plex Mono, accent color', async ({ page }) => {
  await page.goto('/fr/');
  const main = page.getByRole('main');
  /* Design reference: paper #E3DFCC at 88% opacity for the tagline, accent #2A888D for the
     stack. */
  const lines = [
    'Montres mécaniques sur mesure — 20 ans d’atelier.',
    'Conception, réparation et entretien',
    'de pendules et de montres anciennes.',
  ];
  for (const line of lines) {
    const element = main.getByText(line);
    await expect(element).toBeVisible();
    const { family, color } = await textStyle(element);
    expect({ family, color: colorComponents(color) }, `style of "${line}"`).toEqual({
      family: 'IBM Plex Sans',
      color: { red: 227, green: 223, blue: 204, alpha: 0.88 },
    });
  }
  const stack = main.getByText('Laiton · Acier · Rubis · Émail', { exact: true });
  await expect(stack).toBeVisible();
  const { family, color } = await textStyle(stack);
  expect({ family, color: colorComponents(color) }, 'style of the stack').toEqual({
    family: 'IBM Plex Mono',
    color: { red: 42, green: 136, blue: 141, alpha: 1 },
  });
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

test('on the French home page, the first hero button, "Voir les projets", is filled: ink text on a paper background, in IBM Plex Mono semibold (600), not underlined', async ({ page }) => {
  await page.goto('/fr/');
  /* Design reference: ink #013549, paper #E3DFCC. */
  const firstButton = firstHeroButton(page);
  await expect(firstButton).toHaveText(/^\s*Voir les projets/);
  const { family, weight } = await textStyle(firstButton);
  const { color, background, textDecoration } = await buttonStyle(firstButton);
  expect({ family, weight, color, background, textDecoration }, 'style of the first button').toEqual({
    family: 'IBM Plex Mono',
    weight: '600',
    color: { red: 1, green: 53, blue: 73, alpha: 1 },
    background: { red: 227, green: 223, blue: 204, alpha: 1 },
    textDecoration: 'none',
  });
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

test('on the French home page, the second hero button, "Contact", is outlined: paper text, solid 1 px paper border at 50% opacity on all four sides, transparent background, not underlined', async ({ page }) => {
  await page.goto('/fr/');
  /* Design reference: paper #E3DFCC, 1px solid border at 50% opacity. */
  await expect(firstHeroButton(page)).toHaveText(/^\s*Voir les projets/);
  const secondButton = secondHeroButton(page);
  await expect(secondButton).toHaveText('Contact');
  const { color, background, textDecoration, borders } = await buttonStyle(secondButton);
  expect({ color, backgroundAlpha: background.alpha, textDecoration, borders }, 'style of the second button').toEqual({
    color: { red: 227, green: 223, blue: 204, alpha: 1 },
    backgroundAlpha: 0,
    textDecoration: 'none',
    borders: (['top', 'right', 'bottom', 'left'] as const).map((side) => ({
      side,
      width: '1px',
      style: 'solid',
      color: { red: 227, green: 223, blue: 204, alpha: 0.5 },
    })),
  });
});

test('on desktop, the hovered second hero button, "Contact", turns accent-colored: text and border on all four sides', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'mouse hover does not exist on a touch screen');
  await page.goto('/fr/');
  /* Design reference: on hover, text and border in accent #2A888D, opaque. The colors are
     waited on to settle, in case a transition comes with the hover. */
  await expect(firstHeroButton(page)).toHaveText(/^\s*Voir les projets/);
  const secondButton = secondHeroButton(page);
  await expect(secondButton).toHaveText('Contact');
  await secondButton.hover();
  const accent = { red: 42, green: 136, blue: 141, alpha: 1 };
  await expect.poll(() => textAndBorderColors(secondButton), {
    message: 'style of the hovered second button',
  }).toEqual({
    color: accent,
    borders: (['top', 'right', 'bottom', 'left'] as const).map((side) => ({ side, color: accent })),
  });
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

test('on the French home page, the hero fills at least the full window height below the header: it starts right below the header and ends at the bottom of the window, or lower', async ({ page }) => {
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
});

test('from 768 px wide, the hero’s text block is centred vertically in the hero, as in the design: at 1280 × 900 and at 768 × 1024, the space between its buttons and the bottom of the hero is the space between the top of the hero and its heading plus 40 px, within 4 px', async ({ page }) => {
  /* Design reference: the text block (heading, tagline, stack, buttons) sits in the middle of
     the hero, with 40 px of padding below it. Both windows are tall enough to leave the hero
     free space around its text. */
  for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }]) {
    const size = `${viewport.width} × ${viewport.height}`;
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    /* The hero is the main content region named by its main heading. */
    const hero = page.getByRole('main').getByRole('region', { name: /^\s*Jean Exemple/ });
    const heading = hero.getByRole('heading', { level: 1 });
    const buttons = [hero.getByRole('link', { name: 'Voir les projets' }), hero.getByRole('link', { name: 'Contact' })];
    await expect(heading, `heading at ${size}`).toBeVisible();
    for (const button of buttons) await expect(button, `button at ${size}`).toBeVisible();

    const heroBox = (await hero.boundingBox())!;
    const headingBox = (await heading.boundingBox())!;
    const buttonsBottom = Math.max(
      ...(await Promise.all(buttons.map(async (button) => {
        const box = (await button.boundingBox())!;
        return box.y + box.height;
      }))),
    );
    const spaceAbove = headingBox.y - heroBox.y;
    const spaceBelow = heroBox.y + heroBox.height - buttonsBottom;
    expect.soft(
      spaceBelow - spaceAbove,
      `at ${size}, space below the buttons (${Math.round(spaceBelow)} px) minus space above the heading (${Math.round(spaceAbove)} px)`,
    ).toBeGreaterThanOrEqual(36);
    expect.soft(
      spaceBelow - spaceAbove,
      `at ${size}, space below the buttons (${Math.round(spaceBelow)} px) minus space above the heading (${Math.round(spaceAbove)} px)`,
    ).toBeLessThanOrEqual(44);
  }
});

test('the hero content is aligned with the header logo: 16 px from the left edge on a phone, 48 px on desktop', async ({ page, isMobile }) => {
  await page.goto('/fr/');
  /* Design reference: 16 px side margin on a phone, 48 px on desktop, like the header. The
     logo is the header link named after the site title. */
  const logo = page.locator('header').getByRole('link', { name: 'Exemple', exact: true });
  await expect(logo).toBeVisible();
  const expectedLeftEdge = isMobile ? 16 : 48;
  expect((await logo.boundingBox())!.x, 'left edge of the logo').toBeCloseTo(expectedLeftEdge, 0);
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
    expect.soft(box.x, `left edge: ${name}`).toBeCloseTo(expectedLeftEdge, 0);
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

test('on phone as on desktop, the hero is a tick field drawn across its whole width, behind its text: 2 s after load, every vertical band of the empty strip below its buttons, from the left edge to the right edge, shows pixels that changed since right after load, and at the middle of the heading, the tagline, the stack and each button, the element under the pointer is that element, so a click lands on the button', async ({ page }) => {
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
     reach it, so a pixel that changed there shows the field. */
  const heroBox = (await hero.boundingBox())!;
  const buttonsBottom = Math.max(
    ...(await Promise.all(
      [elements['first button, "Voir les projets"'], elements['second button, "Contact"']].map(async (button) => {
        const box = (await button.boundingBox())!;
        return box.y + box.height;
      }),
    )),
  );
  const strip = { x: 0, y: buttonsBottom - heroBox.y + 4, width: heroBox.width, height: heroBox.y + heroBox.height - buttonsBottom - 4 };
  expect(strip.height, 'height of the empty strip of the hero below its buttons').toBeGreaterThanOrEqual(16);
  const { columns, scale } = await pixelsChangedPerColumnInRectangle(hero, rightAfterLoad, twoSecondsLater, strip);
  expect(
    bandsWithoutDrawnPixels(columns, scale, heroBox.width),
    `bands of the ${Math.round(heroBox.width)}px-wide hero, in the strip below its buttons, with no pixel changed since right after load`,
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

test('on phone as on desktop, a click (a tap on mobile) on the hero’s professional title starts a ripple around that point: once revealed, 300 ms after the click, zones all around the click point, about 84px from it, got brighter since just before the click, while the zone at the click point did not', async ({ page, hasTouch }) => {
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

  if (hasTouch) await page.touchscreen.tap(onScreen.x, onScreen.y);
  else await page.mouse.click(onScreen.x, onScreen.y);
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

test('on phone as on desktop, the hero’s veil darkens its text zone: with the field still (reduced motion), compared with the same hero without its veil, the field behind the middle of the text zone keeps at most 0.8 times the share of its brightness it keeps in the same columns at the hero’s top edge, above the text', async ({ page }) => {
  const { hero, text } = await stillHero(page);

  /* The text zone: from the top of the heading to the bottom of the buttons, the last of the
     hero's content, across the heading's width. */
  const heroBox = (await hero.boundingBox())!;
  const headingBox = (await text.heading.boundingBox())!;
  const buttonsBottom = Math.max(
    ...(await Promise.all(
      [text['first button, "Voir les projets"'], text['second button, "Contact"']].map(async (button) => {
        const box = (await button.boundingBox())!;
        return box.y + box.height;
      }),
    )),
  );
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

test('on phone as on desktop, the hero’s veil follows the design: with the field still (reduced motion), compared with the same hero without its veil, it hides the field most at about 38 % of the hero’s width and 55 % of its height, and less and less towards the edges: the zone there keeps at most 0.8 times the share of the field’s brightness each zone 10 % of the width or height to its left, right, top and bottom keeps, and from each of these, towards its edge, the zone halfway to the edge, then the zone against it, each keeps at least 1.1 times what the previous one keeps', async ({ page }) => {
  const { hero, text } = await stillHero(page);
  const heroBox = (await hero.boundingBox())!;
  const { width, height } = heroBox;

  /* 32px squares, given by their centres, relative to the hero. One where the veil is at its
     densest in the design, at 38 % of the width and 55 % of the height. From it, towards each
     edge of the hero, in a straight line: one 10 % of the hero's width (or height) away, one
     halfway between that centre and the edge, one 24px from the edge, where the field, which
     leaves a margin along its edges, still draws ticks. */
  const SIDE = 32;
  const INSET = 24 + SIDE / 2;
  const centre = { x: 0.38 * width, y: 0.55 * height };
  const towardsEdges = [
    { name: 'left', points: [{ x: centre.x - 0.1 * width, y: centre.y }, { x: (centre.x + INSET) / 2, y: centre.y }, { x: INSET, y: centre.y }] },
    { name: 'right', points: [{ x: centre.x + 0.1 * width, y: centre.y }, { x: (centre.x + width - INSET) / 2, y: centre.y }, { x: width - INSET, y: centre.y }] },
    { name: 'top', points: [{ x: centre.x, y: centre.y - 0.1 * height }, { x: centre.x, y: (centre.y + INSET) / 2 }, { x: centre.x, y: INSET }] },
    { name: 'bottom', points: [{ x: centre.x, y: centre.y + 0.1 * height }, { x: centre.x, y: (centre.y + height - INSET) / 2 }, { x: centre.x, y: height - INSET }] },
  ];
  const square = ({ x, y }: { x: number; y: number }): Rectangle => ({ x: x - SIDE / 2, y: y - SIDE / 2, width: SIDE, height: SIDE });
  const where = ({ x, y }: { x: number; y: number }): string => `(${Math.round(x)}, ${Math.round(y)})px`;

  /* The field is brighter on the right than on the left, and at the top than at the bottom:
     what each zone keeps of the field's brightness is measured against the same hero without
     its veil. */
  const { veiled, bare, background } = await heroWithAndWithoutVeil(page, hero, text);
  const keptAt = async (point: { x: number; y: number }): Promise<number> => {
    const { drawn, kept } = await brightnessKeptUnderLayerInRectangle(hero, bare, veiled, square(point), background);
    expect(drawn, `brightness above the background of the field around ${where(point)}: ticks are drawn there`).toBeGreaterThan(0);
    return kept;
  };

  const keptAtCentre = await keptAt(centre);
  const notAsDesigned: string[] = [];
  for (const { name, points } of towardsEdges) {
    const kept = await Promise.all(points.map(keptAt));
    const [near, halfway, atEdge] = kept;
    if (!(keptAtCentre <= 0.8 * near)) {
      notAsDesigned.push(`${name}: 10 % away, at ${where(points[0])}, keeps ${near.toFixed(2)}, less than 1.25 times the centre`);
    }
    if (!(halfway >= 1.1 * near)) {
      notAsDesigned.push(`${name}: halfway to the edge, at ${where(points[1])}, keeps ${halfway.toFixed(2)}, less than 1.1 times ${near.toFixed(2)} 10 % away`);
    }
    if (!(atEdge >= 1.1 * halfway)) {
      notAsDesigned.push(`${name}: against the edge, at ${where(points[2])}, keeps ${atEdge.toFixed(2)}, less than 1.1 times ${halfway.toFixed(2)} halfway`);
    }
  }
  expect(
    notAsDesigned,
    `zones of the ${Math.round(width)} × ${Math.round(height)}px hero where the veil does not hide the field less and less from ${where(centre)}, which keeps ${keptAtCentre.toFixed(2)} of the field’s brightness, towards the edges`,
  ).toEqual([]);
});

test('on phone as on desktop, the hero’s veil spreads as wide as the design’s: with the field still (reduced motion), compared with the same hero without its veil, halfway along the horizontal line from its densest point, at 38 % of the hero’s width and 55 % of its height, to the hero’s right edge, the field keeps at most 0.63 of its brightness', async ({ page }) => {
  const { hero, text } = await stillHero(page);
  const { width, height } = (await hero.boundingBox())!;

  /* A 32px square centred halfway between the veil's densest point in the design, at 38 % of
     the width and 55 % of the height, and the hero's right edge, on the same row: at 69 % of
     the width. The design's veil, an ellipse reaching 70 % of the width on each side of that
     point, still hides more than 40 % of the field there; a veil reaching less than half the
     width fades out sooner and lets most of the field show. */
  const SIDE = 32;
  const point = { x: (0.38 * width + width) / 2, y: 0.55 * height };
  const halfway: Rectangle = { x: point.x - SIDE / 2, y: point.y - SIDE / 2, width: SIDE, height: SIDE };

  /* The field is brighter on the right than on the left: what the zone keeps of the field's
     brightness is measured against the same hero without its veil. */
  const { veiled, bare, background } = await heroWithAndWithoutVeil(page, hero, text);
  const { drawn, kept } = await brightnessKeptUnderLayerInRectangle(hero, bare, veiled, halfway, background);
  expect(drawn, `brightness above the background of the field around (${Math.round(point.x)}, ${Math.round(point.y)})px: ticks are drawn there`).toBeGreaterThan(0);
  expect(
    kept,
    `share of the field’s brightness kept around (${Math.round(point.x)}, ${Math.round(point.y)})px, halfway from the veil’s densest point to the right edge of the ${Math.round(width)} × ${Math.round(height)}px hero`,
  ).toBeLessThanOrEqual(0.63);
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

test('on the English home page, the title below the author name is the English professional title', async ({ page }) => {
  await page.goto('/en/');
  const mainHeading = mainContentHeading(page);
  /* The title comes from the front matter of exampleSite/content/_index.en.md, [params.hero]
     block, title key. DOM text, as written in the front matter: the uppercase display is up
     to CSS. */
  await expect(mainHeading.getByText('Independent clockmaker', { exact: true })).toBeVisible();
});

test('on the English home page, the hero displays the three lines of the English tagline, in order, each below the previous one', async ({ page }) => {
  await page.goto('/en/');
  const main = page.getByRole('main');
  /* The tagline comes from the front matter of exampleSite/content/_index.en.md,
     [params.hero] block, tagline key (a list of strings, one per line). */
  const lines = [
    'Custom mechanical watches — 20 years at the bench.',
    'Design, repair and servicing',
    'of antique clocks and watches.',
  ];
  await expectLinesInOrder(main, lines);
});

test('on the English home page, the hero displays the English stack, entries separated by "·"', async ({ page }) => {
  await page.goto('/en/');
  const main = page.getByRole('main');
  /* The stack comes from the front matter of exampleSite/content/_index.en.md, [params.hero]
     block, stack key (a list of strings: 'Brass', 'Steel', 'Ruby', 'Enamel'). They are
     displayed in one piece, separated by a middle dot surrounded by spaces. */
  await expect(main.getByText('Brass · Steel · Ruby · Enamel', { exact: true })).toBeVisible();
});

test('on the English home page, the first hero button, "View projects", leads to the English Projects page', async ({ page }) => {
  await page.goto('/en/');
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

test.describe('home page of another site, with a different hero', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ANOTHER_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the main heading displays the name of this site’s author, then the title of its hero, and not those of the example site', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_ANOTHER_HERO, siteDirectory);
    await page.goto(`${SITE_WITH_ANOTHER_HERO.origin}/fr/`);
    const mainHeading = mainContentHeading(page);
    /* The author comes from params.author (tests/fixtures/other-hero/hugo.toml), the title
       from the [params.hero] block, title key, of tests/fixtures/other-hero/content/_index.md.
       DOM text, as written in the configuration: the uppercase display is up to CSS. */
    await expect(mainHeading).toHaveText(/^\s*Camille Fictive\s*Relieuse d’art\s*$/);
  });

  test('the hero displays the only button declared by this site, "Écrire à Camille", to its mailto: address, and not the buttons of the example site', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_ANOTHER_HERO, siteDirectory);
    await page.goto(`${SITE_WITH_ANOTHER_HERO.origin}/fr/`);
    /* The button comes from tests/fixtures/other-hero/content/_index.md, single
       [[params.hero.actions]] block, with an external url. The text of this home page has no
       link: the only link of the main content is this button (the header has its own links). */
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

  test('on a 320 px wide phone, a hero whose author name and title each contain a word of 12 characters or more fits within the width: no horizontal scrolling, h1 fully visible', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_HERO_WITH_LONG_WORDS, siteDirectory);
    await page.goto(`${SITE_WITH_A_HERO_WITH_LONG_WORDS.origin}/fr/`);
    const width = page.viewportSize()!.width;
    expect(width, 'window width').toBe(320);

    /* The author comes from params.author (tests/fixtures/hero-with-long-words/hugo.toml), the
       title from the [params.hero] block, title key, of
       tests/fixtures/hero-with-long-words/content/_index.md. "Vanderkerckhove-Fictive" and
       "Horlogère-restauratrice" have more than 12 characters. */
    const mainHeading = mainContentHeading(page);
    await expect(mainHeading).toHaveText(/^\s*Apolline Vanderkerckhove-Fictive\s*Horlogère-restauratrice\s*$/);

    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect.soft(pageWidth, 'no horizontal scrolling').toBeLessThanOrEqual(width);

    const elements = {
      'author name (h1)': mainHeading,
      'professional title': mainHeading.getByText('Horlogère-restauratrice', { exact: true }),
    };
    for (const [name, element] of Object.entries(elements)) {
      await expect(element, name).toBeVisible();
      const { left, right } = await displayedExtent(element);
      expect.soft(left, `left edge within the window: ${name}`).toBeGreaterThanOrEqual(0);
      expect.soft(right, `right edge within the window: ${name}`).toBeLessThanOrEqual(width);
    }
  });

  test('on a 320 px wide phone, while the heading of a hero with long words decodes, the page never scrolls horizontally: every 250 ms from load, while the heading is still scrambled at load, until it is in clear, within 6 s, the name and the title stay within the width', async ({ page, context }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it, step by step. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await serveSite(context, SITE_WITH_A_HERO_WITH_LONG_WORDS, siteDirectory);
    await page.goto(`${SITE_WITH_A_HERO_WITH_LONG_WORDS.origin}/fr/`);
    const width = page.viewportSize()!.width;
    expect(width, 'window width').toBe(320);

    /* The name, "Apolline Vanderkerckhove-Fictive", from params.author
       (tests/fixtures/hero-with-long-words/hugo.toml), decodes first; the title,
       "Horlogère-restauratrice", from tests/fixtures/hero-with-long-words/content/_index.md,
       decodes when the name is done. Both are in clear within 6 s of load. */
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
    /* The decoding ends: the heading is in clear, within 6 s of load. */
    expect(shown, `heading shown ${elapsedMs} ms after load, in clear`).toBe(inClear);
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
