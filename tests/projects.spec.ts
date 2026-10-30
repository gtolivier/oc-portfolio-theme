import { test, expect, type Locator } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND,
  SITE_WITH_OTHER_PROJECTS,
  SITE_WITH_PROJECTS_IN_ANOTHER_SECTION,
  SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES,
  buildSite,
  removeDirectory,
  runBuildTestsInOneProjectOnly,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import {
  type Rectangle,
  canvasOpacityOverBackgroundAt,
  drawnStrokesInRectangle,
  horizontalBandsWithoutDrawnPixels,
  luminanceAboveBackgroundInRectangle,
  pixelsNotOfBackgroundPerRow,
  verticalBands,
} from './helpers/pixels';

/* The projects the example site's French home page features, in the order its front matter lists
   them (params.projects, page references to content/projets/<slug>). The order is neither
   alphabetical nor reverse alphabetical, so that a sorted listing cannot pass for it. Each entry
   holds what the project's page declares in its front matter: title and description, and under
   [params] role, years and stack. Every value differs from one project to the next, so that a
   card showing another project's text cannot pass. The slug is the page's file name, which sets
   its address: /fr/projets/<slug>/. */
const FEATURED_PROJECTS = [
  {
    slug: 'restauration-pendule',
    title: 'Restauration d’une pendule de cheminée',
    description: 'Remise en marche d’une pendule Empire en bronze doré : mouvement nettoyé, suspension refaite, cadran retouché.',
    role: 'Restaurateur',
    years: '2019 – 2020',
    stack: ['Bronze doré', 'Laiton', 'Soie'],
  },
  {
    slug: 'montre-grande-complication',
    title: 'Montre de poche à grande complication',
    description: 'Calibre à quantième perpétuel et répétition minutes, dessiné puis assemblé pièce par pièce.',
    role: 'Concepteur du mouvement',
    years: '2021 – 2023',
    stack: ['Or rose', 'Acier trempé', 'Rubis', 'Émail grand feu'],
  },
  {
    slug: 'horloge-astronomique',
    title: 'Horloge astronomique de l’atelier',
    description: 'Horloge murale qui affiche les phases de la lune, l’équation du temps et le lever du soleil à la latitude de l’atelier.',
    role: 'Horloger principal',
    years: '2016 – 2018',
    stack: ['Laiton', 'Acier', 'Verre'],
  },
  {
    slug: 'regulateur-noyer',
    title: 'Régulateur de parquet en noyer',
    description: 'Régulateur à balancier compensé, logé dans une caisse en noyer massif sculptée à la main.',
    role: 'Ébéniste et horloger',
    years: '2022 – 2024',
    stack: ['Noyer', 'Invar', 'Laiton'],
  },
];

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

type Rgb = { red: number; green: number; blue: number };

/* Components of a computed color, however the browser serializes it (`rgb(…)`, `rgba(…)` or
   `color(srgb …)`): red, green and blue from 0 to 255, alpha from 0 to 1. */
function colorComponents(color: string): Rgb & { alpha: number } {
  const number = '([\\d.]+%?)';
  const toUnit = (value: string) => (value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value));
  const rgb = color.match(new RegExp(`^rgba?\\(\\s*${number}[\\s,]+${number}[\\s,]+${number}(?:\\s*[,/]\\s*${number})?\\s*\\)$`));
  const srgb = color.match(new RegExp(`^color\\(srgb\\s+${number}\\s+${number}\\s+${number}(?:\\s*/\\s*${number})?\\s*\\)$`));
  const match = rgb ?? srgb;
  if (!match) throw new Error(`unrecognized color: ${color}`);
  const scale = rgb ? 1 : 255;
  const [red, green, blue] = match.slice(1, 4).map((value) => (value.endsWith('%') ? toUnit(value) * 255 : parseFloat(value) * scale));
  const alpha = match[4] === undefined ? 1 : toUnit(match[4]);
  return { red, green, blue, alpha };
}

/* A color painted over an opaque one, with its alpha. */
function paintOver(color: string, below: Rgb): Rgb {
  const { red, green, blue, alpha } = colorComponents(color);
  const mix = (top: number, bottom: number) => alpha * top + (1 - alpha) * bottom;
  return { red: mix(red, below.red), green: mix(green, below.green), blue: mix(blue, below.blue) };
}

/* Opaque color behind an element, from the background colors of the element and its ancestors,
   nearest first: each painted over the next, over the browser's white canvas. */
function effectiveBackground(backgrounds: string[]): Rgb {
  return [...backgrounds].reverse().reduce<Rgb>((below, color) => paintOver(color, below), { red: 255, green: 255, blue: 255 });
}

/* Relative luminance of an opaque color, as WCAG defines it: from 0 (black) to 1 (white). */
function relativeLuminance({ red, green, blue }: Rgb): number {
  const [r, g, b] = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* Contrast ratio between two opaque colors, as WCAG defines it: from 1 (same luminance) to 21
   (black on white). */
function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/* Light: it contrasts more with black than with white. */
function isLight(color: Rgb): boolean {
  const black = { red: 0, green: 0, blue: 0 };
  const white = { red: 255, green: 255, blue: 255 };
  return contrastRatio(color, black) > contrastRatio(color, white);
}

/* Background colors of an element and its ancestors, nearest first. */
async function backgroundChain(element: Locator): Promise<string[]> {
  return element.evaluate((el) => {
    const chain: string[] = [];
    for (let current: Element | null = el; current; current = current.parentElement) chain.push(getComputedStyle(current).backgroundColor);
    return chain;
  });
}

/* Every text an element displays — its text nodes and the generated content of the ::before and
   ::after pseudo-elements of it and its descendants — hidden elements excluded, each with its
   text color and the background colors behind it, nearest first. */
async function displayedTexts(root: Locator): Promise<{ text: string; color: string; backgrounds: string[] }[]> {
  return root.evaluate((rootElement) => {
    const chainOf = (el: Element) => {
      const chain: string[] = [];
      for (let current: Element | null = el; current; current = current.parentElement) chain.push(getComputedStyle(current).backgroundColor);
      return chain;
    };
    const texts: { text: string; color: string; backgrounds: string[] }[] = [];
    const walk = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      for (const pseudo of ['::before', '::after'] as const) {
        const pseudoStyle = getComputedStyle(el, pseudo);
        const strings = pseudoStyle.content.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
        const text = strings.map((string) => JSON.parse(string) as string).join('').trim();
        if (text) texts.push({ text: `${pseudo} ${text}`, color: pseudoStyle.color, backgrounds: [pseudoStyle.backgroundColor, ...chainOf(el)] });
      }
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text) texts.push({ text, color: style.color, backgrounds: chainOf(el) });
        } else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
      }
    };
    walk(rootElement);
    return texts;
  });
}

/* The pixels drawn inside a rectangle of an element (CSS pixels, relative to its box), sorted by
   the colour drawn there over the element's background. In the element's screenshot, a pixel is
   drawn when it differs from the background colour by more than a rounding error on a channel.
   It is drawn in one of `colours` (CSS colours) when it lies on the way from the background
   towards that colour, whatever opacity or anti-aliasing keeps it short of it: the direction from
   the background to the pixel within `maxAngle` degrees of the direction from the background to
   that colour, and nearer to it than to the direction to any other of `colours`, at least
   `minShareOfTheWay` of the way there. Returns the number of drawn pixels and, for each colour,
   in the order given, the number drawn in it. Decoded in the page, so that the colours are read
   through the same colour handling as the screenshot. */
async function drawnPixelsByColourInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
  colours: string[],
  maxAngle: number,
  minShareOfTheWay: number,
): Promise<{ drawn: number; inColour: number[] }> {
  return element.evaluate(
    async (el, [base64, zone, cssColours, angle, minShare]) => {
      const TOLERANCE = 2;
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const scale = image.width / el.getBoundingClientRect().width;
      const fromColumn = Math.max(0, Math.round(zone.x * scale));
      const toColumn = Math.min(image.width, Math.round((zone.x + zone.width) * scale));
      const fromRow = Math.max(0, Math.round(zone.y * scale));
      const toRow = Math.min(image.height, Math.round((zone.y + zone.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      const read = (colour: string): number[] => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };
      const background = read(getComputedStyle(el).backgroundColor);
      const ways = cssColours.map((colour) => read(colour).map((value, channel) => value - background[channel]));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const minCosine = Math.cos((angle * Math.PI) / 180);
      let drawn = 0;
      const inColour = cssColours.map(() => 0);
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const i = 4 * (row * image.width + column);
          const offset = [0, 1, 2].map((channel) => pixels[i + channel] - background[channel]);
          if (!offset.some((value) => Math.abs(value) > TOLERANCE)) continue;
          drawn += 1;
          const cosines = ways.map((way) => dot(offset, way) / Math.sqrt(dot(offset, offset) * dot(way, way)));
          const nearest = cosines.indexOf(Math.max(...cosines));
          const way = ways[nearest];
          if (cosines[nearest] >= minCosine && dot(offset, way) / dot(way, way) >= minShare) inColour[nearest] += 1;
        }
      }
      return { drawn, inColour };
    },
    [screenshot.toString('base64'), rectangle, colours, maxAngle, minShareOfTheWay] as const,
  );
}

test('on the French home page, the heading of the section "Projets sélectionnés" shows the section number "01 //" before its title, while assistive technologies get the title alone', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const heading = section.getByRole('heading', { level: 2 });
  await expect(heading).toBeVisible();
  /* On screen: the decorative number, then the title, and nothing else, whether the number is
     text in the page or generated by the stylesheet. */
  await expect.poll(() => displayedText(heading), 'text displayed by the heading').toMatch(/^01 ?\/\/ ?Projets sélectionnés$/);
  /* For assistive technologies: the title alone, for the heading and the region it names. */
  await expect(heading).toHaveAccessibleName('Projets sélectionnés');
  await expect(section).toHaveAccessibleName('Projets sélectionnés');
});

test('on the French home page, the section "Projets sélectionnés" shows one card per featured project, in the order the home page lists them, each headed by the project’s title', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  await expect(section.getByRole('heading', { level: 2, name: 'Projets sélectionnés' })).toBeVisible();
  /* An array makes the match exact: a missing, extra, repeated or misplaced project fails it. */
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(FEATURED_PROJECTS.map((project) => project.title));
});

test('on the French home page, each featured project’s card gives the role, years, description and stack its page declares, the description as a paragraph and the stack on one line, items separated by " · "', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  for (const project of FEATURED_PROJECTS) {
    /* The card is the article headed by the project's title: its texts must be in it, not just
       somewhere in the section. */
    const card = section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: project.title, exact: true }) });
    await expect(card).toHaveCount(1);
    const stack = project.stack.join(' · ');
    for (const text of [project.years, project.role, stack]) {
      await expect(card.getByText(text, { exact: true })).toBeVisible();
      /* Shown once in the section: in this card only. */
      await expect(section.getByText(text, { exact: true })).toHaveCount(1);
    }
    const description = card.getByText(project.description, { exact: true });
    await expect(description).toBeVisible();
    await expect(description).toHaveRole('paragraph');
    await expect(section.getByText(project.description, { exact: true })).toHaveCount(1);
  }
});

test('on the French home page, each featured project’s card ends with a "Voir le détail" link, separate from its title, whose accessible name names the project; following it opens the project’s page, at the site root and under /portfolio/', async ({ page }) => {
  /* The example site served at the root of its origin, then under a subpath (playwright.config.ts). */
  for (const siteRoot of ['http://localhost:1314/', 'http://localhost:1315/portfolio/']) {
    for (const project of FEATURED_PROJECTS) {
      await page.goto(`${siteRoot}fr/`);
      const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
      const card = section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: project.title, exact: true }) });
      await expect(card).toHaveCount(1);
      /* The title is not itself the link. */
      await expect(card.getByRole('heading', { level: 3 }).getByRole('link')).toHaveCount(0);
      const link = card.getByRole('link', { name: 'Voir le détail' });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toContainText('Voir le détail');
      /* Every card shows the same text: the accessible name also names the project, so that a
         list of the page's links tells them apart. The arrow is decorative: not in the name. */
      await expect(link).toHaveAccessibleName(new RegExp(project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(link).not.toHaveAccessibleName(/→/);
      await link.click();
      await expect(page).toHaveURL(`${siteRoot}fr/projets/${project.slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    }
  }
});

test('on the French home page, the cards of the section "Projets sélectionnés" are readable: dark cards on the section’s light background, and every text of the section, its heading’s number included, contrasts at least 4.5:1 with what is behind it', async ({ page }) => {
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  /* Light behind the section, dark behind each card, whatever the exact colors. */
  const sectionBackground = effectiveBackground(await backgroundChain(section));
  expect.soft(isLight(sectionBackground), `the section's background ${JSON.stringify(sectionBackground)} is light`).toBe(true);
  for (const card of await cards.all()) {
    const cardBackground = effectiveBackground(await backgroundChain(card));
    expect.soft(isLight(cardBackground), `the background ${JSON.stringify(cardBackground)} of the card "${await card.getByRole('heading', { level: 3 }).textContent()}" is dark`).toBe(false);
  }
  /* Every text displayed in the section, against the background behind it: the card's in a
     card, the section's elsewhere. WCAG AA for normal text: 4.5:1. */
  const texts = await displayedTexts(section);
  /* At least the heading, its number and each card's title. */
  expect(texts.length, 'texts displayed in the section').toBeGreaterThanOrEqual(FEATURED_PROJECTS.length + 2);
  for (const { text, color, backgrounds } of texts) {
    const background = effectiveBackground(backgrounds);
    const ratio = contrastRatio(paintOver(color, background), background);
    expect.soft(ratio, `contrast of "${text}" (${color}) with what is behind it`).toBeGreaterThanOrEqual(4.5);
  }
});

test('on a phone, the cards of the section "Projets sélectionnés" are stacked in a single column, each as wide as the section’s content, and the page does not scroll horizontally', async ({ page }) => {
  const phone = { width: 390, height: 844 };
  await page.setViewportSize(phone);
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  /* The section's content box: its box without its horizontal padding. */
  const content = await section.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
  });
  const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return { left, right, top, bottom };
  }));
  boxes.forEach((box, index) => {
    const card = `card ${index + 1} ("${FEATURED_PROJECTS[index].title}")`;
    expect.soft(Math.abs(box.left - content.left), `${card}: left edge ${box.left} px against the section's content left edge ${content.left} px`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(box.right - content.right), `${card}: right edge ${box.right} px against the section's content right edge ${content.right} px`).toBeLessThanOrEqual(1);
    if (index > 0) {
      expect.soft(box.top, `${card}: top against the bottom of the card above (${boxes[index - 1].bottom} px)`).toBeGreaterThanOrEqual(boxes[index - 1].bottom - 1);
    }
  });
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect.soft(pageWidth, 'width of the page content').toBeLessThanOrEqual(phone.width);
});

test('on a wide window, the cards of the section "Projets sélectionnés" sit two per row, of equal width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/fr/');
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  const boxes = await cards.evaluateAll((elements) => elements.map((element) => {
    const { left, right, top, bottom, width } = element.getBoundingClientRect();
    return { left, right, top, bottom, width };
  }));
  const name = (index: number) => `card ${index + 1} ("${FEATURED_PROJECTS[index].title}")`;
  /* Rows of two, in order: cards 1 and 2, then cards 3 and 4 below them. Within a row, both cards
     share a top edge and the second sits to the right of the first. */
  for (let first = 0; first < boxes.length; first += 2) {
    const second = first + 1;
    if (second >= boxes.length) break;
    expect.soft(Math.abs(boxes[second].top - boxes[first].top), `${name(second)}: top ${boxes[second].top} px against the top of ${name(first)} (${boxes[first].top} px)`).toBeLessThanOrEqual(1);
    expect.soft(boxes[second].left, `${name(second)}: left edge against the right edge of ${name(first)} (${boxes[first].right} px)`).toBeGreaterThanOrEqual(boxes[first].right - 1);
    if (first >= 2) {
      const rowAboveBottom = Math.max(boxes[first - 2].bottom, boxes[first - 1].bottom);
      expect.soft(boxes[first].top, `${name(first)}: top against the bottom of the row above (${rowAboveBottom} px)`).toBeGreaterThanOrEqual(rowAboveBottom - 1);
    }
  }
  /* Equal width: every card as wide as the first, whatever the length of its description. */
  boxes.forEach((box, index) => {
    expect.soft(Math.abs(box.width - boxes[0].width), `${name(index)}: width ${box.width} px against the width of ${name(0)} (${boxes[0].width} px)`).toBeLessThanOrEqual(1);
  });
});

test('on the French home page, with JavaScript and without, each card of the section "Projets sélectionnés" shows a decorative vignette above its title, across the card’s width (its full width or its content box), hidden from assistive technologies', async ({ page, browser, baseURL }) => {
  /* The vignette is a static drawing: the page must show it whether or not scripts run. */
  const withoutJavaScript = await browser.newContext({ baseURL, viewport: page.viewportSize(), javaScriptEnabled: false });
  try {
    for (const [mode, tab] of [['with JavaScript', page], ['without JavaScript', await withoutJavaScript.newPage()]] as const) {
      await tab.goto('/fr/');
      const section = tab.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
      const cards = section.getByRole('article');
      await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
      for (const [index, project] of FEATURED_PROJECTS.entries()) {
        const where = `${mode}, card ${index + 1} ("${project.title}")`;
        const card = cards.nth(index);
        await expect(card.getByRole('heading', { level: 3 })).toHaveText(project.title);
        /* The vignette: an element of the card that comes before the title in the page (not one
           that holds it), displayed, at least a few pixels tall, ending at or above the title's
           top, and spanning the card's width: its full width, or its content box (the width
           without the horizontal padding), within a pixel. Whatever its tag or class. */
        const vignettePath = await card.evaluate((article) => {
          const title = article.querySelector('h3')!;
          const titleTop = title.getBoundingClientRect().top;
          const box = article.getBoundingClientRect();
          const style = getComputedStyle(article);
          const spans = (left: number, right: number) =>
            (Math.abs(left - box.left) <= 1 && Math.abs(right - box.right) <= 1) ||
            (Math.abs(left - (box.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth))) <= 1 &&
              Math.abs(right - (box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth))) <= 1);
          const found = Array.from(article.querySelectorAll('*')).find((element) => {
            if (element.contains(title) || !(element.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
            const elementStyle = getComputedStyle(element);
            if (elementStyle.display === 'none' || elementStyle.visibility === 'hidden' || parseFloat(elementStyle.opacity) === 0) return false;
            const { left, right, top, bottom } = element.getBoundingClientRect();
            return bottom - top >= 8 && bottom <= titleTop + 1 && spans(left, right);
          });
          if (!found) return null;
          /* Its path from the card, as an XPath, so that a locator can reach it. */
          const steps: string[] = [];
          for (let element: Element = found; element !== article; element = element.parentElement!) {
            const sameName = Array.from(element.parentElement!.children).filter((sibling) => sibling.localName === element.localName);
            steps.unshift(`*[local-name()="${element.localName}"][${sameName.indexOf(element) + 1}]`);
          }
          return `xpath=./${steps.join('/')}`;
        });
        expect.soft(vignettePath, `${where}: an element above the title, at least a few pixels tall, across the card's width`).not.toBeNull();
        if (vignettePath === null) continue;
        const vignette = card.locator(vignettePath);
        await expect.soft(vignette, `${where}: the vignette is visible`).toBeVisible();
        /* Hidden from assistive technologies: the vignette contributes nothing to the
           accessibility tree, and the card's accessible content opens with its title. */
        expect.soft(await vignette.ariaSnapshot(), `${where}: what assistive technologies get from the vignette`).toBe('');
        const cardTree = (await card.ariaSnapshot()).split('\n').slice(1).map((line) => line.trim());
        expect.soft(cardTree[0], `${where}: first entry of the card's accessibility tree`).toMatch(/^- heading\b.*\[level=3\]/);
      }
    }
  } finally {
    await withoutJavaScript.close();
  }
});

test('on the French home page, with JavaScript, each card’s vignette is made of short ticks in rows: inside it, away from its edges, between two rows of drawn pixels, a horizontal band across its width shows only the card’s background, and several rows are each made of many separate short strokes', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  /* Measured inside the vignette, this far from each edge of its box, so that a border, a
     frame or the card's edges cannot count as ticks. */
  const INSET = 4;
  /* A blank band between two rows of ticks: at least this high, in CSS pixels. */
  const MIN_BAND_HEIGHT = 2;
  /* A row of ticks: a row of drawn pixels made of at least this many separate strokes. */
  const MIN_STROKES_PER_ROW = 5;
  const MIN_ROWS_OF_TICKS = 3;
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  for (const [index, project] of FEATURED_PROJECTS.entries()) {
    const where = `card ${index + 1} ("${project.title}")`;
    const card = cards.nth(index);
    /* The vignette: the card's first element hidden from assistive technologies. */
    const vignette = card.locator('[aria-hidden="true"]').first();
    await expect(vignette, `${where}: the vignette is visible`).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const cardBox = await card.boundingBox();
    const vignetteBox = await vignette.boundingBox();
    expect(cardBox && vignetteBox, `${where}: the card and its vignette have a box on screen`).toBeTruthy();
    /* Inside the vignette, relative to the card's box: the card's screenshot is measured
       against the card's background. */
    const inside = {
      x: vignetteBox!.x - cardBox!.x + INSET,
      y: vignetteBox!.y - cardBox!.y + INSET,
      width: vignetteBox!.width - 2 * INSET,
      height: vignetteBox!.height - 2 * INSET,
    };
    const screenshot = await card.screenshot();
    const { rows, scale } = await pixelsNotOfBackgroundPerRow(card, screenshot, inside);
    const bands = horizontalBandsWithoutDrawnPixels(rows, scale, MIN_BAND_HEIGHT);
    /* The separate strokes inside, each counted in the row of drawn pixels (a run of
       adjacent screenshot rows that each show some) its middle lies in. */
    const strokes = await drawnStrokesInRectangle(card, screenshot, inside);
    const drawnRows: { from: number; to: number; strokes: number }[] = [];
    rows.forEach((count, row) => {
      if (count === 0) return;
      const last = drawnRows[drawnRows.length - 1];
      if (last && last.to === row) last.to = row + 1;
      else drawnRows.push({ from: row, to: row + 1, strokes: 0 });
    });
    for (const stroke of strokes) {
      const middle = (stroke.y + stroke.height / 2) * scale;
      const drawnRow = drawnRows.find(({ from, to }) => middle >= from && middle < to);
      if (drawnRow) drawnRow.strokes += 1;
    }
    const rowsOfTicks = drawnRows.filter((drawnRow) => drawnRow.strokes >= MIN_STROKES_PER_ROW);
    const describeRows = drawnRows.map(({ from, to, strokes: count }) => `${(from / scale).toFixed(1)}–${(to / scale).toFixed(1)}px: ${count}`).join(', ') || 'none';
    expect.soft(
      bands.length,
      `${where}: horizontal bands at least ${MIN_BAND_HEIGHT}px high showing only the card's background between two rows of drawn pixels, inside the ${Math.round(vignetteBox!.width)}×${Math.round(vignetteBox!.height)}px vignette (${INSET}px from its edges): ${bands.join(', ') || 'none'}`,
    ).toBeGreaterThanOrEqual(MIN_ROWS_OF_TICKS - 1);
    expect.soft(
      rowsOfTicks.length,
      `${where}: rows of drawn pixels inside the vignette (${INSET}px from its edges) made of at least ${MIN_STROKES_PER_ROW} separate strokes; separate strokes per row (relative to the card): ${describeRows}`,
    ).toBeGreaterThanOrEqual(MIN_ROWS_OF_TICKS);
  }
});

test('on the French home page, inside the first card’s vignette, the ticks are not all the same length: several of its separate strokes are clearly longer than several others', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  /* Measured inside the vignette, this far from each edge of its box, so that a border, a
     frame or the card's edges cannot count as ticks. */
  const INSET = 4;
  /* Several strokes on each side: the shortest of the STROKES_EACH_SIDE longest strokes is
     compared with the longest of the STROKES_EACH_SIDE shortest, so that one stray speck or one
     pair of merged ticks cannot decide the outcome. */
  const STROKES_EACH_SIDE = 3;
  /* Clearly longer: at least this many times as long. The mockup's ticks range from 8 to 12 px.
     Anti-aliasing at both ends of a tick can add up to a screenshot pixel to each, yet ticks of a
     single length of 8 px or more never measure more than 1.25 times as long as one another. */
  const MIN_LENGTH_RATIO = 1.3;
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  const where = `card 1 ("${FEATURED_PROJECTS[0].title}")`;
  const card = cards.first();
  /* The vignette: the card's first element hidden from assistive technologies. */
  const vignette = card.locator('[aria-hidden="true"]').first();
  await expect(vignette, `${where}: the vignette is visible`).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const vignetteBox = await vignette.boundingBox();
  expect(cardBox && vignetteBox, `${where}: the card and its vignette have a box on screen`).toBeTruthy();
  /* Inside the vignette, relative to the card's box: the card's screenshot is measured against
     the card's background. */
  const inside = {
    x: vignetteBox!.x - cardBox!.x + INSET,
    y: vignetteBox!.y - cardBox!.y + INSET,
    width: vignetteBox!.width - 2 * INSET,
    height: vignetteBox!.height - 2 * INSET,
  };
  const strokes = await drawnStrokesInRectangle(card, await card.screenshot(), inside);
  const lengths = strokes.map((stroke) => stroke.height).sort((a, b) => a - b);
  expect(
    lengths.length,
    `${where}: separate strokes inside the vignette (${INSET}px from its edges)`,
  ).toBeGreaterThanOrEqual(2 * STROKES_EACH_SIDE);
  const short = lengths[STROKES_EACH_SIDE - 1];
  const long = lengths[lengths.length - STROKES_EACH_SIDE];
  const counts = new Map<string, number>();
  for (const length of lengths) counts.set(length.toFixed(1), (counts.get(length.toFixed(1)) ?? 0) + 1);
  const describeLengths = [...counts].map(([length, count]) => `${length}px × ${count}`).join(', ');
  expect(
    long / short,
    `${where}: length of the shortest of the ${STROKES_EACH_SIDE} longest separate strokes inside the vignette (${long.toFixed(1)}px) over that of the longest of the ${STROKES_EACH_SIDE} shortest (${short.toFixed(1)}px); stroke lengths: ${describeLengths}`,
  ).toBeGreaterThanOrEqual(MIN_LENGTH_RATIO);
});

test('on the French home page, inside the first card’s vignette, the ticks come in two colours: many of the pixels drawn there are teal, the accent colour, and many others light, the paper colour, either possibly see-through over the card’s background', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  /* Measured inside the vignette, this far from each edge of its box, so that a border, a
     frame or the card's edges cannot count as ticks. */
  const INSET = 4;
  /* A drawn pixel shows a colour when it lies on the way from the card's background towards it,
     however far (see-through ticks, anti-aliased edges): its direction from the background
     within MAX_ANGLE degrees of that colour's, nearer to it than to the other's. From the card's
     ink, teal raises green and blue far more than red, and the paper raises all three, red the
     most: their directions lie about 25° apart. A faint edge, less than MIN_SHARE_OF_THE_WAY of
     the way there, shows no colour clearly and does not count. */
  const MAX_ANGLE = 12;
  const MIN_SHARE_OF_THE_WAY = 0.2;
  /* Many: at least this share of the pixels drawn inside the vignette, for each colour. */
  const MIN_SHARE_OF_DRAWN = 0.1;
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  const where = `card 1 ("${FEATURED_PROJECTS[0].title}")`;
  const card = cards.first();
  /* The vignette: the card's first element hidden from assistive technologies. */
  const vignette = card.locator('[aria-hidden="true"]').first();
  await expect(vignette, `${where}: the vignette is visible`).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const vignetteBox = await vignette.boundingBox();
  expect(cardBox && vignetteBox, `${where}: the card and its vignette have a box on screen`).toBeTruthy();
  /* Inside the vignette, relative to the card's box: the card's screenshot is measured against
     the card's background. */
  const inside = {
    x: vignetteBox!.x - cardBox!.x + INSET,
    y: vignetteBox!.y - cardBox!.y + INSET,
    width: vignetteBox!.width - 2 * INSET,
    height: vignetteBox!.height - 2 * INSET,
  };
  /* The site's accent (teal) and paper colours, as its stylesheet declares them. */
  const [teal, paper] = await page.evaluate(() =>
    ['--color-accent', '--color-paper'].map((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()),
  );
  const { drawn, inColour } = await drawnPixelsByColourInRectangle(card, await card.screenshot(), inside, [teal, paper], MAX_ANGLE, MIN_SHARE_OF_THE_WAY);
  const [inTeal, inPaper] = inColour;
  const counts = `${drawn} screenshot pixels drawn inside the vignette (${INSET}px from its edges): ${inTeal} teal, ${inPaper} light, paper-coloured, ${drawn - inTeal - inPaper} neither clearly`;
  expect.soft(inTeal / drawn, `${where}: share of the pixels drawn inside the vignette that are teal (${teal}); ${counts}`).toBeGreaterThanOrEqual(MIN_SHARE_OF_DRAWN);
  expect.soft(inPaper / drawn, `${where}: share of the pixels drawn inside the vignette that are light, paper-coloured (${paper}); ${counts}`).toBeGreaterThanOrEqual(MIN_SHARE_OF_DRAWN);
});

/* Comparing the vignettes of two cards. Measured inside each vignette, this far from each edge
   of its box, so that a border, a frame or the card's edges cannot count as ticks. */
const COMPARISON_INSET = 4;
/* Two cards sit at different, possibly fractional, positions: the browser may draw two copies of
   one pattern up to a pixel or two apart, relative to their vignettes, and anti-aliasing and the
   rounding of the screenshots move each edge a little more. So the ticks of the second vignette
   are compared with those of the first moved by up to MAX_SHIFT CSS pixels, across and down, the
   shift that matches most; two ticks stand at the same place when each edge of one lies within
   SAME_PLACE CSS pixels of the same edge of the other. */
const MAX_SHIFT = 2;
const SHIFT_STEP = 0.25;
const SAME_PLACE = 1;
/* Only the ticks this far inside their vignette count, so that a tick whose copy the shift would
   bring across the measured edge (and leave out) cannot count as unmatched. */
const CORE = COMPARISON_INSET + MAX_SHIFT + SAME_PLACE + 1;
/* The share of the ticks of both vignettes that have no tick at the same place in the other:
   two copies of one pattern show next to none; two patterns a visitor tells apart, many. */
const MIN_SHARE_UNMATCHED = 0.25;

type TicksOfVignette = { ticks: Rectangle[]; core: Rectangle[] };

/* The ticks of a card's vignette (the card's first element hidden from assistive technologies):
   the separate strokes drawn inside it, as boxes relative to its vignette's box, and among them
   those at least CORE CSS pixels inside it. */
async function ticksOfVignette(card: Locator, where: string): Promise<TicksOfVignette> {
  const vignette = card.locator('[aria-hidden="true"]').first();
  await expect(vignette, `${where}: the vignette is visible`).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const vignetteBox = await vignette.boundingBox();
  expect(cardBox && vignetteBox, `${where}: the card and its vignette have a box on screen`).toBeTruthy();
  const offset = { x: vignetteBox!.x - cardBox!.x, y: vignetteBox!.y - cardBox!.y };
  const inside = {
    x: offset.x + COMPARISON_INSET,
    y: offset.y + COMPARISON_INSET,
    width: vignetteBox!.width - 2 * COMPARISON_INSET,
    height: vignetteBox!.height - 2 * COMPARISON_INSET,
  };
  const strokes = await drawnStrokesInRectangle(card, await card.screenshot(), inside);
  const ticks = strokes.map((stroke) => ({ ...stroke, x: stroke.x - offset.x, y: stroke.y - offset.y }));
  const core = ticks.filter(
    (tick) =>
      tick.x >= CORE && tick.y >= CORE && tick.x + tick.width <= vignetteBox!.width - CORE && tick.y + tick.height <= vignetteBox!.height - CORE,
  );
  return { ticks, core };
}

/* How two vignettes' ticks match at best: with the first vignette's ticks moved by up to
   MAX_SHIFT CSS pixels, the shift that leaves the fewest core ticks of either vignette with no
   tick at the same place in the other (the smallest such shift on a tie), those unmatched core
   ticks in each, and their share of the core ticks of both. */
function bestMatchOfTicks(first: TicksOfVignette, second: TicksOfVignette): { dx: number; dy: number; inFirst: number; inSecond: number; shareUnmatched: number } {
  const samePlace = (a: Rectangle, b: Rectangle, dx: number, dy: number): boolean =>
    Math.abs(a.x + dx - b.x) <= SAME_PLACE &&
    Math.abs(a.y + dy - b.y) <= SAME_PLACE &&
    Math.abs(a.x + a.width + dx - (b.x + b.width)) <= SAME_PLACE &&
    Math.abs(a.y + a.height + dy - (b.y + b.height)) <= SAME_PLACE;
  /* For each core tick, the ticks of the other vignette that some shift could bring to its
     place: only those need comparing once the shift is chosen. */
  const reachable = (tick: Rectangle, others: Rectangle[]) =>
    others.filter((other) => Math.abs(tick.x - other.x) <= MAX_SHIFT + SAME_PLACE && Math.abs(tick.y - other.y) <= MAX_SHIFT + SAME_PLACE);
  const candidatesInFirst = first.core.map((tick) => reachable(tick, second.ticks));
  const candidatesInSecond = second.core.map((tick) => reachable(tick, first.ticks));
  /* For a shift of the first vignette's ticks, the core ticks of each vignette with no tick at
     the same place in the other. */
  const unmatched = (dx: number, dy: number) => ({
    inFirst: first.core.filter((tick, index) => !candidatesInFirst[index].some((other) => samePlace(tick, other, dx, dy))).length,
    inSecond: second.core.filter((tick, index) => !candidatesInSecond[index].some((other) => samePlace(other, tick, dx, dy))).length,
  });
  const shifts: number[] = [];
  for (let shift = -MAX_SHIFT; shift <= MAX_SHIFT; shift += SHIFT_STEP) shifts.push(shift);
  const best = shifts
    .flatMap((dx) => shifts.map((dy) => ({ dx, dy, ...unmatched(dx, dy) })))
    .reduce((a, b) => {
      const [missesOfA, missesOfB] = [a.inFirst + a.inSecond, b.inFirst + b.inSecond];
      return missesOfB < missesOfA || (missesOfB === missesOfA && Math.hypot(b.dx, b.dy) < Math.hypot(a.dx, a.dy)) ? b : a;
    });
  return { ...best, shareUnmatched: (best.inFirst + best.inSecond) / (first.core.length + second.core.length) };
}

test('on the French home page, with JavaScript, each card’s vignette is its own: the vignettes of the first two cards differ, many of the ticks drawn in one having no tick at the same place in the other', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  /* The ticks of the vignettes of the first two cards. */
  const ticksOfVignettes: TicksOfVignette[] = [];
  for (const index of [0, 1]) {
    ticksOfVignettes.push(await ticksOfVignette(cards.nth(index), `card ${index + 1} ("${FEATURED_PROJECTS[index].title}")`));
  }
  const [first, second] = ticksOfVignettes;
  const { shareUnmatched, ...best } = bestMatchOfTicks(first, second);
  expect.soft(
    shareUnmatched,
    `share of the ticks of the first two cards' vignettes (at least ${CORE}px inside them) with no tick at the same place (each edge within ${SAME_PLACE}px) in the other vignette, with the first moved by up to ${MAX_SHIFT}px the way that matches most (${best.dx}px across, ${best.dy}px down); ticks: ${first.core.length} in the first, ${best.inFirst} of them unmatched, ${second.core.length} in the second, ${best.inSecond} of them unmatched`,
  ).toBeGreaterThanOrEqual(MIN_SHARE_UNMATCHED);
});

test('on the French home page, the vignettes of the four cards all differ from one another: for each pair of cards, many of the ticks drawn in one have no tick at the same place in the other', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  const name = (index: number) => `card ${index + 1} ("${FEATURED_PROJECTS[index].title}")`;
  const ticksOfVignettes: TicksOfVignette[] = [];
  for (const index of FEATURED_PROJECTS.keys()) ticksOfVignettes.push(await ticksOfVignette(cards.nth(index), name(index)));
  /* Every pair of cards, not only neighbours: a pattern repeated two cards further fails too. */
  for (let a = 0; a < ticksOfVignettes.length; a++) {
    for (let b = a + 1; b < ticksOfVignettes.length; b++) {
      const [first, second] = [ticksOfVignettes[a], ticksOfVignettes[b]];
      const { shareUnmatched, ...best } = bestMatchOfTicks(first, second);
      expect.soft(
        shareUnmatched,
        `${name(a)} and ${name(b)}: share of the ticks of their vignettes (at least ${CORE}px inside them) with no tick at the same place (each edge within ${SAME_PLACE}px) in the other vignette, with the first moved by up to ${MAX_SHIFT}px the way that matches most (${best.dx}px across, ${best.dy}px down); ticks: ${first.core.length} in the first, ${best.inFirst} of them unmatched, ${second.core.length} in the second, ${best.inSecond} of them unmatched`,
      ).toBeGreaterThanOrEqual(MIN_SHARE_UNMATCHED);
    }
  }
});

test('on the French home page, the tick pattern is drawn anew at every load: after a reload, the first card’s tick pattern differs from the one it showed before, many of the ticks drawn in one having no tick at the same place in the other', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const name = `card 1 ("${FEATURED_PROJECTS[0].title}")`;
  /* The ticks of the first card's tick pattern, on a fresh load of the page. */
  const ticksOfFirstCardOnLoad = async (load: () => Promise<unknown>, when: string): Promise<TicksOfVignette> => {
    await load();
    await page.evaluate(() => document.fonts.ready);
    const cards = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' }).getByRole('article');
    await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
    return ticksOfVignette(cards.first(), `${name}, ${when}`);
  };
  const before = await ticksOfFirstCardOnLoad(() => page.goto('/fr/'), 'before the reload');
  const after = await ticksOfFirstCardOnLoad(() => page.reload(), 'after the reload');
  const { shareUnmatched, ...best } = bestMatchOfTicks(before, after);
  expect.soft(
    shareUnmatched,
    `${name}: share of the ticks of its tick pattern before and after a reload (at least ${CORE}px inside it) with no tick at the same place (each edge within ${SAME_PLACE}px) in the other load's pattern, with the first moved by up to ${MAX_SHIFT}px the way that matches most (${best.dx}px across, ${best.dy}px down); ticks: ${before.core.length} before the reload, ${best.inFirst} of them unmatched, ${after.core.length} after it, ${best.inSecond} of them unmatched`,
  ).toBeGreaterThanOrEqual(MIN_SHARE_UNMATCHED);
});

test('on the French home page, with JavaScript, the ticks of each card’s tick pattern vary in intensity: most of them are faint, see-through over the card’s background, and a few, across the cards, nearly opaque', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  /* A tick's opacity: the share of the way from the card's background to the tick's own colour
     that a pixel it covers fully shows. Faint: well between the two, clearly drawn yet clearly
     see-through. Nearly opaque: close to the tick's own colour. */
  const FAINT = { min: 0.1, max: 0.7 };
  const NEARLY_OPAQUE = 0.85;
  /* Most: at least this share of the ticks of each card's tick pattern are faint. Nearly opaque
     ticks are rare, so they are counted across the four cards, where at least one is near
     certain. */
  const MIN_SHARE_FAINT = 0.75;
  const MIN_NEARLY_OPAQUE = 1;
  /* Across a tick, every quarter of a CSS pixel, so that at least one point falls on a pixel the
     tick covers fully. */
  const STEP = 0.25;
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  const described: string[] = [];
  let nearlyOpaque = 0;
  for (const [index, project] of FEATURED_PROJECTS.entries()) {
    const where = `card ${index + 1} ("${project.title}")`;
    const card = cards.nth(index);
    const { ticks } = await ticksOfVignette(card, where);
    /* The ticks' boxes are relative to the tick pattern's: the card's screenshot is read
       relative to the card's box. */
    const pattern = card.locator('[aria-hidden="true"]').first();
    const cardBox = await card.boundingBox();
    const patternBox = await pattern.boundingBox();
    expect(cardBox && patternBox, `${where}: the card and its tick pattern have a box on screen`).toBeTruthy();
    const offset = { x: patternBox!.x - cardBox!.x, y: patternBox!.y - cardBox!.y };
    const screenshot = await card.screenshot();
    /* Of the points across a tick, halfway down it, the most opaque reading is that of a fully
       covered pixel, whichever colour the tick has. */
    const opacities: number[] = [];
    for (const tick of ticks) {
      const points = Array.from({ length: Math.max(1, Math.ceil(tick.width / STEP)) }, (_, step) => ({
        x: offset.x + tick.x + (step + 0.5) * STEP,
        y: offset.y + tick.y + tick.height / 2,
      }));
      const measures = await canvasOpacityOverBackgroundAt(card, screenshot, points);
      opacities.push(Math.max(...measures.map(({ opacity }) => opacity).filter((opacity) => !Number.isNaN(opacity))));
    }
    const faint = opacities.filter((opacity) => opacity >= FAINT.min && opacity <= FAINT.max).length;
    const opaque = opacities.filter((opacity) => opacity >= NEARLY_OPAQUE).length;
    nearlyOpaque += opaque;
    const sorted = [...opacities].sort((a, b) => a - b);
    const percent = (opacity: number | undefined) => (opacity === undefined ? '–' : `${(100 * opacity).toFixed(0)}%`);
    const summary = `${ticks.length} ticks, ${faint} faint (${FAINT.min * 100}–${FAINT.max * 100}% of their colour), ${opaque} nearly opaque (at least ${NEARLY_OPAQUE * 100}%); opacities from ${percent(sorted[0])} to ${percent(sorted[sorted.length - 1])}, median ${percent(sorted[Math.floor(sorted.length / 2)])}`;
    described.push(`${where}: ${summary}`);
    expect.soft(ticks.length, `${where}: separate ticks inside its tick pattern`).toBeGreaterThan(0);
    expect.soft(faint / ticks.length, `${where}: share of the ticks of its tick pattern that are faint, see-through over the card's background; ${summary}`).toBeGreaterThanOrEqual(MIN_SHARE_FAINT);
  }
  expect.soft(nearlyOpaque, `nearly opaque ticks (at least ${NEARLY_OPAQUE * 100}% of their colour) across the tick patterns of the four cards; ${described.join('; ')}`).toBeGreaterThanOrEqual(MIN_NEARLY_OPAQUE);
});

test('on the French home page, each card’s vignette has no frame: along each of its four edges, inside it, a thin band shows only the card’s background', { tag: '@pixels' }, async ({ page }) => {
  /* Reduced motion, so that whatever could animate shows a still picture. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  /* The band along each edge, inside the vignette's box: this high (or wide), in CSS pixels.
     A border, an outline or a frame line drawn there would show in it. */
  const BAND = 2;
  /* Each band also reaches this far outside the box, over the card's padding and the space
     below the vignette, which show the card's background: a frame line the browser snaps to
     the pixel grid just outside a fractional box edge still shows in it. */
  const OUTSIDE = 1;
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  for (const [index, project] of FEATURED_PROJECTS.entries()) {
    const where = `card ${index + 1} ("${project.title}")`;
    const card = cards.nth(index);
    /* The vignette: the card's first element hidden from assistive technologies. */
    const vignette = card.locator('[aria-hidden="true"]').first();
    await expect(vignette, `${where}: the vignette is visible`).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const cardBox = await card.boundingBox();
    const vignetteBox = await vignette.boundingBox();
    expect(cardBox && vignetteBox, `${where}: the card and its vignette have a box on screen`).toBeTruthy();
    /* The vignette's box, relative to the card's: the card's screenshot is measured against the
       card's background. */
    const box = { x: vignetteBox!.x - cardBox!.x, y: vignetteBox!.y - cardBox!.y, width: vignetteBox!.width, height: vignetteBox!.height };
    const edges: [string, Rectangle][] = [
      ['top', { x: box.x - OUTSIDE, y: box.y - OUTSIDE, width: box.width + 2 * OUTSIDE, height: BAND + OUTSIDE }],
      ['bottom', { x: box.x - OUTSIDE, y: box.y + box.height - BAND, width: box.width + 2 * OUTSIDE, height: BAND + OUTSIDE }],
      ['left', { x: box.x - OUTSIDE, y: box.y - OUTSIDE, width: BAND + OUTSIDE, height: box.height + 2 * OUTSIDE }],
      ['right', { x: box.x + box.width - BAND, y: box.y - OUTSIDE, width: BAND + OUTSIDE, height: box.height + 2 * OUTSIDE }],
    ];
    const screenshot = await card.screenshot();
    const drawnAlongEdges: string[] = [];
    for (const [edge, band] of edges) {
      const { rows } = await pixelsNotOfBackgroundPerRow(card, screenshot, band);
      const drawn = rows.reduce((sum, count) => sum + count, 0);
      if (drawn > 0) drawnAlongEdges.push(`${edge}: ${drawn}`);
    }
    expect.soft(
      drawnAlongEdges,
      `${where}: screenshot pixels other than the card's background in the band along each edge (${BAND}px inside, ${OUTSIDE}px outside) of the ${Math.round(box.width)}×${Math.round(box.height)}px vignette`,
    ).toEqual([]);
  }
});

test('on the French home page, without JavaScript, each card’s tick pattern is an empty band in its place: inside it, no pixel is drawn, it shows only the card’s background', { tag: '@pixels' }, async ({ browser, baseURL, viewport }) => {
  /* The pattern is drawn by a script: without one, its band stays, with nothing in it. */
  const withoutJavaScript = await browser.newContext({ baseURL, viewport, javaScriptEnabled: false });
  try {
    const page = await withoutJavaScript.newPage();
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    const cards = section.getByRole('article');
    await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
    for (const [index, project] of FEATURED_PROJECTS.entries()) {
      const where = `without JavaScript, card ${index + 1} ("${project.title}")`;
      const card = cards.nth(index);
      /* The tick pattern: the card's first element hidden from assistive technologies. */
      const pattern = card.locator('[aria-hidden="true"]').first();
      await expect(pattern, `${where}: the tick pattern's band is visible`).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      const cardBox = await card.boundingBox();
      const patternBox = await pattern.boundingBox();
      expect(cardBox && patternBox, `${where}: the card and its tick pattern have a box on screen`).toBeTruthy();
      /* The pattern's whole box, relative to the card's: the card's screenshot is measured
         against the card's background. */
      const box = { x: patternBox!.x - cardBox!.x, y: patternBox!.y - cardBox!.y, width: patternBox!.width, height: patternBox!.height };
      const { rows } = await pixelsNotOfBackgroundPerRow(card, await card.screenshot(), box);
      const drawn = rows.reduce((sum, count) => sum + count, 0);
      expect.soft(
        drawn,
        `${where}: screenshot pixels other than the card's background inside the ${Math.round(box.width)}×${Math.round(box.height)}px tick pattern`,
      ).toBe(0);
    }
  } finally {
    await withoutJavaScript.close();
  }
});

test('under prefers-reduced-motion: reduce, on the French home page, each card’s vignette stays still: 2 s after load, every vertical band inside it, from its left edge to its right edge, shows the brightness it showed right after load', { tag: '@pixels' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  /* Measured inside the vignette, this far from each edge of its box, so that its border does
     not count. */
  const INSET = 4;
  /* The vignette's width split into adjacent vertical bands, at least this wide each. */
  const MIN_BAND_WIDTH = 40;
  /* What a band showed right after load, within this share, for rendering noise. */
  const TOLERANCE = 0.02;
  await page.goto('/fr/');
  await page.evaluate(() => document.fonts.ready);
  const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);

  /* For each card, the bands inside its vignette, relative to the card's box: the card's
     screenshot is measured against the card's background. */
  const bandsOfCards: Rectangle[][] = [];
  for (const [index, project] of FEATURED_PROJECTS.entries()) {
    const where = `card ${index + 1} ("${project.title}")`;
    const card = cards.nth(index);
    /* The vignette: the card's first element hidden from assistive technologies. */
    const vignette = card.locator('[aria-hidden="true"]').first();
    await expect(vignette, `${where}: the vignette is visible`).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const cardBox = await card.boundingBox();
    const vignetteBox = await vignette.boundingBox();
    expect(cardBox && vignetteBox, `${where}: the card and its vignette have a box on screen`).toBeTruthy();
    const inside = {
      x: vignetteBox!.x - cardBox!.x + INSET,
      y: vignetteBox!.y - cardBox!.y + INSET,
      width: vignetteBox!.width - 2 * INSET,
      height: vignetteBox!.height - 2 * INSET,
    };
    bandsOfCards.push(verticalBands(inside.width, inside.height, MIN_BAND_WIDTH).map((band) => ({ ...band, x: band.x + inside.x, y: inside.y })));
  }
  const brightness = async (): Promise<number[][]> => {
    const perCard: number[][] = [];
    for (const [index, bands] of bandsOfCards.entries()) {
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      const screenshot = await card.screenshot();
      perCard.push(await Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(card, screenshot, band))));
    }
    return perCard;
  };

  const rightAfterLoad = await brightness();
  /* Time passes, on the page's real clock: long enough for an animation to show. */
  await page.waitForTimeout(2000);
  const twoSecondsLater = await brightness();

  for (const [index, project] of FEATURED_PROJECTS.entries()) {
    const changedBands = bandsOfCards[index]
      .map((band, bandIndex) => ({ band, before: rightAfterLoad[index][bandIndex], after: twoSecondsLater[index][bandIndex] }))
      .filter(({ before, after }) => Math.abs(after - before) > TOLERANCE * before)
      .map(({ band, before, after }) => `${Math.round(band.x)}–${Math.round(band.x + band.width)}px: ${Math.round(before)} → ${Math.round(after)}`);
    expect.soft(
      changedBands,
      `card ${index + 1} ("${project.title}"): bands inside its vignette (${INSET}px from its edges, relative to the card) whose brightness above the card's background, under reduced motion, 2 s after load, differs by more than ${TOLERANCE * 100}% from what they showed right after load`,
    ).toEqual([]);
  }
});

test.describe('home page of another site, featuring other projects', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_OTHER_PROJECTS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" shows one card per project this site features, in its order, and none of the example site’s', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    /* Featured in tests/fixtures/other-projects/content/_index.md, in an order that is neither
       alphabetical nor reverse alphabetical. An array makes the match exact. */
    await expect(section.getByRole('heading', { level: 3 })).toHaveText([
      'Coucou de la Forêt-Noire',
      'Baromètre à mercure',
      'Chronomètre de marine',
    ]);
  });

  test('a featured project whose page declares only a title and a description gets a card with just those: no empty slot for the role, years or stack, no stray separator', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    /* tests/fixtures/other-projects/content/projets/barometre-mercure.md declares no [params]. */
    const title = 'Baromètre à mercure';
    const description = 'Baromètre à colonne de mercure remonté dans son cadre d’origine, avec une échelle regravée.';
    const card = section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
    await expect(card).toHaveCount(1);
    await expect(card.getByText(description, { exact: true })).toHaveRole('paragraph');
    /* Outside links (a link to the project's page may come later, with its own text), the title
       and the description are all the card shows: no role, years or stack text, no separator left
       alone… */
    const textOutsideLinks = () =>
      card.evaluate((article) => {
        const copy = article.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('a').forEach((link) => link.remove());
        return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      });
    await expect.poll(textOutsideLinks).toBe(`${title} ${description}`);
    /* …and no text element left empty, or holding only whitespace, where they would go. Other
       non-text elements (decoration, link) may come later: only text elements are checked. */
    const textElements = card.locator('p, span, li, dt, dd, time, small, strong, em, h1, h2, h3, h4, h5, h6');
    await expect(textElements.filter({ hasNotText: /\S/ })).toHaveCount(0);
  });

  test('the card of a featured project without a detail page has no link, while the other cards keep theirs, and the site publishes no page at that project’s address', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    const cardOf = (title: string) =>
      section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
    /* tests/fixtures/other-projects/content/projets/chronometre-marine.md declares
       [build] render = 'never': its card is still shown, with no link at all, not even an empty one. */
    const card = cardOf('Chronomètre de marine');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.locator('a')).toHaveCount(0);
    /* The projects that have a page keep their link to it. */
    for (const title of ['Coucou de la Forêt-Noire', 'Baromètre à mercure']) {
      await expect(cardOf(title).getByRole('link', { name: 'Voir le détail' })).toHaveCount(1);
    }
    /* Nothing is published where the project's page would be. */
    const response = await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/projets/chronometre-marine/`);
    expect(response?.status()).toBe(404);
  });
});

test.describe('home page of another site, featuring a project whose section gives it no detail page', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the card of a featured project that inherits render = "never" from its section’s cascade has no link, while the other card keeps its own, and the site publishes no page at that project’s address', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES, siteDirectory);
    await page.goto(`${SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES.origin}/fr/`);
    const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
    const cardOf = (title: string) =>
      section.getByRole('article').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
    /* tests/fixtures/section-without-detail-pages/content/esquisses/regulateur-de-parquet.md sets
       no [build] options: its section's _index.md declares [cascade.build] render = 'never'. Its
       card is still shown, with no link at all, not even an empty one. */
    const card = cardOf('Régulateur de parquet');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.locator('a')).toHaveCount(0);
    /* The project that has a page keeps its link to it. */
    await expect(cardOf('Restauration d’une pendule de cheminée').getByRole('link', { name: 'Voir le détail' })).toHaveCount(1);
    /* Nothing is published where the project's page would be. */
    const response = await page.goto(`${SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES.origin}/fr/esquisses/regulateur-de-parquet/`);
    expect(response?.status()).toBe(404);
  });
});

test.describe('home pages whose featured projects live in sections of different names', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_IN_ANOTHER_SECTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" has, once and after the cards, a "Tous les projets" link that opens the section holding the featured projects, at the site root and under /portfolio/', async ({ page, context }) => {
    await serveSite(context, SITE_WITH_PROJECTS_IN_ANOTHER_SECTION, siteDirectory);
    const sites = [
      /* The example site, whose featured projects are in content/projets/ (title "Projets"),
         served at the root of its origin, then under a subpath (playwright.config.ts)… */
      { home: 'http://localhost:1314/fr/', sectionAddress: 'http://localhost:1314/fr/projets/', sectionTitle: 'Projets' },
      { home: 'http://localhost:1315/portfolio/fr/', sectionAddress: 'http://localhost:1315/portfolio/fr/projets/', sectionTitle: 'Projets' },
      /* …and a site whose featured project is in content/realisations/, while projets/ still
         exists: a hard-coded /projets/ address cannot pass. */
      {
        home: `${SITE_WITH_PROJECTS_IN_ANOTHER_SECTION.origin}/fr/`,
        sectionAddress: `${SITE_WITH_PROJECTS_IN_ANOTHER_SECTION.origin}/fr/realisations/`,
        sectionTitle: 'Réalisations',
      },
    ];
    for (const site of sites) {
      await page.goto(site.home);
      const section = page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
      /* The arrow is decorative: the accessible name is the text alone. */
      const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toContainText('Tous les projets');
      await expect(link).toHaveAccessibleName('Tous les projets');
      /* It belongs to the section, not to a card, and comes after every card. */
      await expect(section.getByRole('article').getByRole('link', { name: 'Tous les projets' })).toHaveCount(0);
      const lastCard = section.getByRole('article').last();
      await expect(lastCard).toBeVisible();
      const followsLastCard = await link.evaluate(
        (anchor, card) => (card!.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        await lastCard.elementHandle(),
      );
      expect(followsLastCard).toBe(true);
      await link.click();
      await expect(page).toHaveURL(site.sectionAddress);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.sectionTitle);
    }
  });
});

test.describe('home page of another site, featuring no projects', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITHOUT_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a home page whose front matter features no projects shows no section "Projets sélectionnés": no such heading, no empty region, no project card', async ({ page, context }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    await page.goto(`${SITE_WITHOUT_HERO.origin}/fr/`);
    /* tests/fixtures/without-hero/content/_index.md declares no params.projects, while the example
       site's project pages are still built: its text is displayed… */
    const main = page.getByRole('main');
    const homePageText = 'Accueil fictif sans hero : seul ce texte occupe le corps de la page.';
    await expect(main.getByText(homePageText)).toBeVisible();
    /* …with no projects section, named or not, even empty, and none of the example site's projects. */
    await expect(page.getByRole('region', { name: 'Projets sélectionnés' })).toHaveCount(0);
    await expect(page.getByText('Projets sélectionnés')).toHaveCount(0);
    await expect(main.getByRole('region')).toHaveCount(0);
    await expect(main.getByRole('heading')).toHaveCount(0);
    for (const project of FEATURED_PROJECTS) {
      await expect(page.getByText(project.title)).toHaveCount(0);
    }
  });
});

test.describe('featured project content errors: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a home page that features a page that does not exist makes the site build fail, with a French error message that names the projects parameter and that page reference, without a template execution error after it', () => {
    /* tests/fixtures/featured-ref-without-page/content/_index.md features
       'projets/restauration-pendule', an existing page, then 'projets/sablier-introuvable', which
       no page answers. Rather than a section that silently drops that card, the person building
       the site must get a failure whose French message names the projects parameter, in the style
       of the clients messages ("le paramètre clients…"), and the reference as written in the front
       matter, whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the French message should name the projects parameter').toMatch(
      /\bparamètre\s+projects\b/,
    );
    expect(build.errors, 'the French message should name the missing page reference').toContain(
      'projets/sablier-introuvable',
    );
    expect(build.errors, 'no template execution error should follow the French message').not.toMatch(
      /execute of template failed|error calling/i,
    );
  });
});
