import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  EXAMPLE_SITE_UNDER_PORTFOLIO,
  type BuildAttempt,
  SITE_WITHOUT_HERO,
  SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND,
  SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT,
  SITE_WITH_OTHER_PROJECTS,
  SITE_WITH_PROJECTS_IN_ANOTHER_SECTION,
  SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES,
  SITE_WITH_PROJECTS_WITHOUT_PUBLISHED_PAGES,
  SITE_WITH_AN_UNPUBLISHED_PROJECTS_SECTION,
  SITE_WITH_AN_UNPUBLISHED_SECTION_PAGE,
  SITE_WITH_PROJECTS_IN_TWO_SECTIONS,
  SITE_WITH_PROJECTS_AS_TEXT,
  SITE_WITH_PROJECTS_AS_AN_EMPTY_TEXT,
  SITE_WITH_PROJECTS_AS_FALSE,
  SITE_WITH_A_FEATURED_PROJECT_AS_MAP,
  SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF,
  SITE_WITH_A_WHITESPACE_ONLY_FEATURED_PROJECT_REF,
  SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE,
  SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT,
  SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT_WRITTEN_AS_A_DOT,
  SITE_WITH_A_SECTION_AS_FEATURED_PROJECT,
  SITE_WITH_TAXONOMY_PAGES_AS_FEATURED_PROJECTS,
  SITE_WITH_THE_404_PAGE_AS_FEATURED_PROJECT,
  SITE_WITH_A_FRENCH_HOME_FEATURING_AN_ENGLISH_ONLY_PROJECT,
  SITE_WITH_AN_ENGLISH_HOME_FEATURING_A_FRENCH_ONLY_PROJECT,
  SITE_WITH_A_DRAFT_FEATURED_PROJECT,
  SITE_WITH_LONG_PROJECT_WORDS,
  SITE_WITH_A_LONG_PROJECT_TITLE_WITHOUT_YEARS,
  SITE_WITH_UNUSUAL_RENDER_VALUES,
  SITE_WITH_A_BUILD_PARAM_AS_TEXT,
  SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
  type BuiltSite,
  buildSite,
  languageCodePattern,
  removeDirectory,
  runBuildTestsInOneProjectOnly,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import {
  type Rectangle,
  drawnStrokesInRectangle,
  horizontalBandsWithoutDrawnPixels,
  luminanceAboveBackgroundInRectangle,
  pixelsChangedPerColumnInRectangle,
  pixelsNotOfBackgroundPerRow,
  verticalBands,
} from './helpers/pixels';
import { type Rgb, colorComponents, contrastRatio } from './helpers/colors';
import { displayedText } from './helpers/text-on-screen';
import { tabUntilFocused } from './helpers/keyboard';
import { stopClockBeforeLoad } from './helpers/clock';
import { DELAY_AFTER_MOVE_MS, moveToScreenOfDensity } from './helpers/screen-density';

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
    description:
      'Remise en marche d’une pendule Empire en bronze doré : mouvement nettoyé, suspension refaite, cadran retouché.',
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
    description:
      'Horloge murale qui affiche les phases de la lune, l’équation du temps et le lever du soleil à la latitude de l’atelier.',
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

/* The same projects, as the English home page features them: the title and description their
   English pages (content/projets/<slug>.en.md) declare, each different from the French one. Their
   English pages live in the projets/ section's English address, /en/projects/<slug>/. */
const FEATURED_PROJECTS_IN_ENGLISH = [
  {
    slug: 'restauration-pendule',
    title: 'Restoration of a mantel clock',
    description:
      'An Empire gilt-bronze clock brought back to life: movement cleaned, suspension rebuilt, dial touched up.',
  },
  {
    slug: 'montre-grande-complication',
    title: 'Grand complication pocket watch',
    description: 'A perpetual calendar and minute repeater calibre, designed then assembled part by part.',
  },
  {
    slug: 'horloge-astronomique',
    title: 'The workshop’s astronomical clock',
    description:
      'A wall clock showing the phases of the moon, the equation of time and sunrise at the workshop’s latitude.',
  },
  {
    slug: 'regulateur-noyer',
    title: 'Walnut floor regulator',
    description: 'A regulator with a compensated pendulum, housed in a hand-carved solid walnut case.',
  },
];

/* The window sizes the layout is checked at: a phone's, and a wide window's, where the cards sit
   two per row. */
const PHONE = { width: 390, height: 844 };
const WIDE_WINDOW = { width: 1280, height: 800 };

/* The section's links come after every focusable element above the section: a keyboard visitor
   needs more tabs to reach them than tabUntilFocused allows by default. */
const TABS_TO_REACH_THE_PROJECTS_LINKS = 60;

/* The section "Projets sélectionnés" of the page's main content. */
function projectsSection(page: Page): Locator {
  return page.getByRole('main').getByRole('region', { name: 'Projets sélectionnés' });
}

/* The card of a section that is headed by the given project title. */
function cardTitled(section: Locator, title: string): Locator {
  return section
    .getByRole('article')
    .filter({ has: section.page().getByRole('heading', { level: 3, name: title, exact: true }) });
}

/* How the assertion messages name the card of the example site's featured project at `index`. */
function cardName(index: number): string {
  return `card ${index + 1} ("${FEATURED_PROJECTS[index].title}")`;
}

/* The text as a pattern that matches it as written: its special characters are escaped. */
function escapedForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* A pattern that matches the text as written, wherever it appears. */
function containing(text: string): RegExp {
  return new RegExp(escapedForRegExp(text));
}

/* The cards of the section "Projets sélectionnés" of the page just loaded, once its fonts are
   ready: one per project the example site features. */
async function cardsOnceLoaded(page: Page): Promise<Locator> {
  await page.evaluate(() => document.fonts.ready);
  const cards = projectsSection(page).getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  return cards;
}

/* A box on screen, in CSS pixels from the window's top left corner. */
type Box = { left: number; right: number; top: number; bottom: number };

/* The boxes of the text an element displays, one per line it is laid out on: an element's box
   may stretch beyond its text, a grid cell's to the whole row, a heading's across the whole
   section. */
async function textLineBoxes(element: Locator): Promise<Box[]> {
  return element.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()]
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map(({ left, right, top, bottom }) => ({ left, right, top, bottom }));
  });
}

/* The box around some lines of text, or null without any. */
function boxAround(lines: Box[]): Box | null {
  if (lines.length === 0) return null;
  return {
    left: Math.min(...lines.map((line) => line.left)),
    right: Math.max(...lines.map((line) => line.right)),
    top: Math.min(...lines.map((line) => line.top)),
    bottom: Math.max(...lines.map((line) => line.bottom)),
  };
}

/* The box around the text an element displays, or null when it shows none. */
async function textBox(element: Locator): Promise<Box | null> {
  return boxAround(await textLineBoxes(element));
}

/* The box of an element itself, whatever text it displays. */
function elementBox(locator: Locator): Promise<Box> {
  return locator.evaluate((element): Box => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return { left, right, top, bottom };
  });
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
  return [...backgrounds]
    .reverse()
    .reduce<Rgb>((below, color) => paintOver(color, below), { red: 255, green: 255, blue: 255 });
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
    for (let current: Element | null = el; current; current = current.parentElement)
      chain.push(getComputedStyle(current).backgroundColor);
    return chain;
  });
}

/* Every text an element displays — its text nodes and the generated content of the ::before and
   ::after pseudo-elements of it and its descendants — hidden elements excluded, each with its
   text color and the background colors behind it, nearest first. */
async function displayedTexts(root: Locator): Promise<{ text: string; color: string; backgrounds: string[] }[]> {
  return root.evaluate((rootElement) => {
    /* As backgroundChain, inside the page. */
    const chainOf = (el: Element) => {
      const chain: string[] = [];
      for (let current: Element | null = el; current; current = current.parentElement)
        chain.push(getComputedStyle(current).backgroundColor);
      return chain;
    };
    const texts: { text: string; color: string; backgrounds: string[] }[] = [];
    const walk = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      for (const pseudo of ['::before', '::after'] as const) {
        const pseudoStyle = getComputedStyle(el, pseudo);
        const strings = pseudoStyle.content.split(/\s+\/\s+/)[0].match(/"(?:[^"\\]|\\.)*"/g) ?? [];
        const text = strings
          .map((string) => JSON.parse(string) as string)
          .join('')
          .trim();
        if (text)
          texts.push({
            text: `${pseudo} ${text}`,
            color: pseudoStyle.color,
            backgrounds: [pseudoStyle.backgroundColor, ...chainOf(el)],
          });
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

/* Measured inside a card's tick pattern, this far from each edge of its box, so that a border, a
   frame or the card's edges cannot count as ticks. */
const INSET = 4;

/* The tick pattern of a card: the card's first element hidden from assistive technologies. */
function tickPatternOf(card: Locator): Locator {
  return card.locator('[aria-hidden="true"]').first();
}

/* The box of a card in its screenshot, and the box of its tick pattern relative to the card's box:
   the card's screenshot is read relative to the card's box. The screenshot starts at the whole CSS
   pixel at or above and left of the card's top-left corner (Playwright rounds an element
   screenshot's clip out to whole CSS pixels): a card at a fractional position starts that
   fraction, under a pixel, below and right of the screenshot's corner. */
async function cardAndTickPatternBoxes(
  card: Locator,
  where: string,
): Promise<{ cardInScreenshot: Rectangle; patternBox: Rectangle }> {
  const cardBox = await card.boundingBox();
  const patternBox = await tickPatternOf(card).boundingBox();
  expect(cardBox && patternBox, `${where}: the card and its tick pattern have a box on screen`).toBeTruthy();
  const scroll = await card.page().evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const fraction = (position: number): number => position - Math.floor(position);
  return {
    cardInScreenshot: {
      x: fraction(cardBox!.x + scroll.x),
      y: fraction(cardBox!.y + scroll.y),
      width: cardBox!.width,
      height: cardBox!.height,
    },
    patternBox: {
      x: patternBox!.x - cardBox!.x,
      y: patternBox!.y - cardBox!.y,
      width: patternBox!.width,
      height: patternBox!.height,
    },
  };
}

/* The box of a card's tick pattern, once it is visible and the card scrolled into view, relative
   to the card's box: the card's screenshot is measured against the card's background. */
async function tickPatternBoxInCard(card: Locator, where: string): Promise<Rectangle> {
  await expect(tickPatternOf(card), `${where}: the tick pattern is visible`).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  return (await cardAndTickPatternBoxes(card, where)).patternBox;
}

/* The part of a tick pattern's box that is measured: INSET CSS pixels in from each of its edges. */
function insideTickPattern(box: Rectangle): Rectangle {
  return { x: box.x + INSET, y: box.y + INSET, width: box.width - 2 * INSET, height: box.height - 2 * INSET };
}

/* How far inside the card's edges a rectangle measured in its screenshot stays, in CSS pixels. A
   card's box may lie at fractional coordinates: its outermost rows and columns of device pixels
   then blend its background with the section's around it, though nothing is drawn there. */
const CARD_EDGE = 1;

/* A rectangle relative to a card's box, cut to stay CARD_EDGE CSS pixels inside the card's edges
   as its screenshot shows them (`card`, from cardAndTickPatternBoxes): unchanged when it already
   does, trimmed where it reaches them (a tick pattern touching the card's edges). Above and left
   of the card's edges, the screenshot shows the section's background, up to a pixel of it. */
function withinCardEdges(rectangle: Rectangle, card: Rectangle): Rectangle {
  const left = Math.max(rectangle.x, card.x + CARD_EDGE);
  const top = Math.max(rectangle.y, card.y + CARD_EDGE);
  const right = Math.min(rectangle.x + rectangle.width, card.x + card.width - CARD_EDGE);
  const bottom = Math.min(rectangle.y + rectangle.height, card.y + card.height - CARD_EDGE);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

test('on the French home page, the heading of the section "Projets sélectionnés" shows the section number "01 //" before its title, while assistive technologies get the title alone', async ({
  page,
}) => {
  await page.goto('/fr/');
  const section = projectsSection(page);
  const heading = section.getByRole('heading', { level: 2 });
  await expect(heading).toBeVisible();
  /* On screen: the decorative number, then the title, and nothing else, whether the number is
     text in the page or generated by the stylesheet. */
  await expect
    .poll(() => displayedText(heading), 'text displayed by the heading')
    .toMatch(/^01 ?\/\/ ?Projets sélectionnés$/);
  /* For assistive technologies: the title alone, for the heading and the region it names. */
  await expect(heading).toHaveAccessibleName('Projets sélectionnés');
  await expect(section).toHaveAccessibleName('Projets sélectionnés');
});

test('on the French home page, the section "Projets sélectionnés" shows one card per featured project, in the order the home page lists them, each headed by the project’s title', async ({
  page,
}) => {
  await page.goto('/fr/');
  const section = projectsSection(page);
  await expect(section.getByRole('heading', { level: 2, name: 'Projets sélectionnés' })).toBeVisible();
  /* An array makes the match exact: a missing, extra, repeated or misplaced project fails it. */
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(
    FEATURED_PROJECTS.map((project) => project.title),
  );
});

test('on the French home page, each featured project’s card gives the role, description and stack its page declares, the description as a paragraph and the stack on one line, items separated by " · "', async ({
  page,
}) => {
  await page.goto('/fr/');
  const section = projectsSection(page);
  for (const project of FEATURED_PROJECTS) {
    /* The card is the article headed by the project's title: its texts must be in it, not just
       somewhere in the section. */
    const card = cardTitled(section, project.title);
    await expect(card).toHaveCount(1);
    const stack = project.stack.join(' · ');
    for (const text of [project.role, stack]) {
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

test('on the French home page, no featured project’s card shows the years its page declares', async ({ page }) => {
  await page.goto('/fr/');
  const section = projectsSection(page);
  for (const project of FEATURED_PROJECTS) {
    /* The card is there, headed by its title, so that a missing card cannot pass for one
       without years. */
    const card = cardTitled(section, project.title);
    await expect(card).toHaveCount(1);
    /* The card's whole text, hidden parts included: the years appear nowhere in it. */
    await expect(card).not.toContainText(project.years);
  }
  /* Nor anywhere else in the section. */
  for (const project of FEATURED_PROJECTS) await expect(section).not.toContainText(project.years);
});

test('on the French home page, each featured project’s card ends with a "Voir le détail" link, separate from its title, whose accessible name names the project; following it opens the project’s page, at the site root and under /portfolio/', async ({
  page,
}) => {
  /* The example site served at the root of its origin, then under a subpath (playwright.config.ts). */
  for (const siteRoot of ['/', EXAMPLE_SITE_UNDER_PORTFOLIO]) {
    for (const project of FEATURED_PROJECTS) {
      await page.goto(`${siteRoot}fr/`);
      const section = projectsSection(page);
      const card = cardTitled(section, project.title);
      await expect(card).toHaveCount(1);
      /* The title is not itself the link. */
      await expect(card.getByRole('heading', { level: 3 }).getByRole('link')).toHaveCount(0);
      const link = card.getByRole('link', { name: 'Voir le détail' });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toContainText('Voir le détail');
      /* Every card shows the same text: the accessible name also names the project, so that a
         list of the page's links tells them apart. The arrow is decorative: not in the name. */
      await expect(link).toHaveAccessibleName(containing(project.title));
      await expect(link).not.toHaveAccessibleName(/→/);
      await link.click();
      await expect(page).toHaveURL(`${siteRoot}fr/projets/${project.slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    }
  }
});

test('on the English home page, the section "Selected projects" shows the English title and description of each featured project, in the order the home page lists them, and each card’s "See details" link opens the project’s English page', async ({
  page,
}) => {
  await page.goto('/en/');
  const section = page.getByRole('main').getByRole('region', { name: 'Selected projects' });
  await expect(section.getByRole('heading', { level: 2, name: 'Selected projects' })).toBeVisible();
  /* An array makes the match exact: a French, missing, extra or misplaced title fails it. */
  await expect(section.getByRole('heading', { level: 3 })).toHaveText(
    FEATURED_PROJECTS_IN_ENGLISH.map((project) => project.title),
  );
  for (const project of FEATURED_PROJECTS_IN_ENGLISH) {
    const card = cardTitled(section, project.title);
    await expect(card).toHaveCount(1);
    await expect(card.getByText(project.description, { exact: true })).toBeVisible();
    const link = card.getByRole('link', { name: 'See details' });
    await expect(link).toHaveCount(1);
    await expect(link).toContainText('See details');
    await expect(link).toHaveAccessibleName(containing(project.title));
    await expect(link).toHaveAttribute('href', `/en/projects/${project.slug}/`);
  }
  /* Following a link lands on the English page of its project. */
  const [first] = FEATURED_PROJECTS_IN_ENGLISH;
  await cardTitled(section, first.title).getByRole('link', { name: 'See details' }).click();
  await expect(page).toHaveURL(`/en/projects/${first.slug}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.title);
});

test('on the French home page, the cards of the section "Projets sélectionnés" are readable: dark cards on the section’s light background, and every text of the section, its heading’s number included, contrasts at least 4.5:1 with what is behind it', async ({
  page,
}) => {
  await page.goto('/fr/');
  const section = projectsSection(page);
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  /* Light behind the section, dark behind each card, whatever the exact colors. */
  const sectionBackground = effectiveBackground(await backgroundChain(section));
  expect
    .soft(isLight(sectionBackground), `the section's background ${JSON.stringify(sectionBackground)} is light`)
    .toBe(true);
  for (const card of await cards.all()) {
    const cardBackground = effectiveBackground(await backgroundChain(card));
    expect
      .soft(
        isLight(cardBackground),
        `the background ${JSON.stringify(cardBackground)} of the card "${await card.getByRole('heading', { level: 3 }).textContent()}" is dark`,
      )
      .toBe(false);
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

test('on the French home page, the "Tous les projets" link and the "Voir le détail" link of each card show, while hovered with a fine pointer and while reached by keyboard, an underline in the accent colour thicker than their underline at rest, their text still contrasting at least 4.5:1 with what is behind it', async ({
  page,
  hasTouch,
  browserName,
}) => {
  await page.goto('/fr/');
  const cards = await cardsOnceLoaded(page);
  const section = projectsSection(page);
  /* In the order a keyboard visitor reaches them: the "Tous les projets" link comes before the
     cards. */
  const links: { name: string; link: Locator }[] = [
    { name: '"Tous les projets" link', link: section.getByRole('link', { name: 'Tous les projets', exact: true }) },
  ];
  for (const [index, card] of (await cards.all()).entries()) {
    links.push({
      name: `"Voir le détail" link of ${cardName(index)}`,
      link: card.getByRole('link', { name: 'Voir le détail' }),
    });
  }
  for (const { name, link } of links) await expect(link, name).toHaveCount(1);

  /* The accent colour, as the page defines it, resolved to a computed colour. */
  const accent = colorComponents(
    await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-accent)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }),
  );
  const isAccent = (color: string) => {
    const { red, green, blue, alpha } = colorComponents(color);
    return (
      alpha === 1 &&
      Math.abs(red - accent.red) <= 1 &&
      Math.abs(green - accent.green) <= 1 &&
      Math.abs(blue - accent.blue) <= 1
    );
  };

  /* A link's underline: the thickest of the visible lines drawn under its text, whether a bottom
     border or a text underline. Null without any. */
  type Underline = { width: number; color: string };
  const underlineOf = async (link: Locator): Promise<Underline | null> => {
    const lines = await link.evaluate((el) => {
      const style = getComputedStyle(el);
      const drawn: Underline[] = [];
      if (!['none', 'hidden'].includes(style.borderBottomStyle))
        drawn.push({ width: parseFloat(style.borderBottomWidth), color: style.borderBottomColor });
      if (style.textDecorationLine.includes('underline'))
        drawn.push({
          width: parseFloat(style.textDecorationThickness),
          color: style.textDecorationColor || style.color,
        });
      return drawn;
    });
    const visible = lines.filter(({ width, color }) => width > 0 && colorComponents(color).alpha > 0);
    if (visible.length === 0) return null;
    return visible.reduce((thickest, line) => (line.width > thickest.width ? line : thickest));
  };
  const describe = (underline: Underline | null) => (underline ? `${underline.width}px ${underline.color}` : 'none');

  /* At rest: before any pointer or keyboard interaction. */
  const atRest: (Underline | null)[] = [];
  for (const { name, link } of links) {
    const underline = await underlineOf(link);
    expect(underline, `${name}: underline at rest`).not.toBeNull();
    atRest.push(underline);
  }

  /* Thicker than at rest, in the accent colour, and the text still readable. WCAG AA for normal
     text: 4.5:1. */
  const expectHighlighted = async (index: number, state: string) => {
    const { name, link } = links[index];
    const rest = atRest[index]!;
    const underline = await underlineOf(link);
    expect.soft(underline, `${name}: underline ${state}`).not.toBeNull();
    if (underline) {
      expect
        .soft(
          underline.width,
          `${name}: thickness of its underline ${state} (${describe(underline)}) against its underline at rest (${describe(rest)})`,
        )
        .toBeGreaterThan(rest.width);
      expect
        .soft(
          isAccent(underline.color),
          `${name}: colour of its underline ${state} (${underline.color}) is the accent colour (${JSON.stringify(accent)})`,
        )
        .toBe(true);
    }
    const texts = await displayedTexts(link);
    expect(texts.length, `${name}: texts displayed ${state}`).toBeGreaterThan(0);
    for (const { text, color, backgrounds } of texts) {
      const background = effectiveBackground(backgrounds);
      const ratio = contrastRatio(paintOver(color, background), background);
      expect
        .soft(ratio, `${name}: contrast of "${text}" (${color}) ${state} with what is behind it`)
        .toBeGreaterThanOrEqual(4.5);
    }
  };

  /* Hovering needs a fine pointer; touch screens have none. */
  if (!hasTouch) {
    for (const [index, { name, link }] of links.entries()) {
      await link.hover();
      expect(await link.evaluate((el) => el.matches(':hover')), `${name}: it is hovered`).toBe(true);
      await expectHighlighted(index, 'while hovered');
    }
    /* The pointer leaves the links, so that only the focus remains below. */
    await page.mouse.move(0, 0);
  }

  /* A keyboard visitor tabs from one link to the next. */
  for (const [index, { name, link }] of links.entries()) {
    await tabUntilFocused(link, browserName, TABS_TO_REACH_THE_PROJECTS_LINKS);
    expect(await link.evaluate((el) => el.matches(':focus-visible')), `${name}: it shows the keyboard focus`).toBe(
      true,
    );
    await expectHighlighted(index, 'while focused by keyboard');
  }
});

test('on the French home page, the text of the "Tous les projets" link and of the "Voir le détail" link of each card stays where it is at rest while the link is hovered with a fine pointer and while it is reached by keyboard, as the header menu’s links do when their underline appears', async ({
  page,
  hasTouch,
  browserName,
}) => {
  await page.goto('/fr/');
  const cards = await cardsOnceLoaded(page);
  const section = projectsSection(page);
  /* In the order a keyboard visitor reaches them: the "Tous les projets" link comes before the
     cards. */
  const links: { name: string; link: Locator }[] = [
    { name: '"Tous les projets" link', link: section.getByRole('link', { name: 'Tous les projets', exact: true }) },
  ];
  for (const [index, card] of (await cards.all()).entries()) {
    links.push({
      name: `"Voir le détail" link of ${cardName(index)}`,
      link: card.getByRole('link', { name: 'Voir le détail' }),
    });
  }
  for (const { name, link } of links) await expect(link, name).toHaveCount(1);

  /* Where the link's text is drawn, in CSS pixels from the page's top left corner, so that the
     scrolling a hover or a tab may cause does not count: the box of its first line of text, the
     link's own box being free to change around it. */
  const textPosition = (link: Locator) =>
    link.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const line = [...range.getClientRects()].find((rect) => rect.width > 0 && rect.height > 0);
      if (!line) return null;
      return { left: line.left + window.scrollX, top: line.top + window.scrollY };
    });

  /* At rest: before any pointer or keyboard interaction. */
  const atRest: { left: number; top: number }[] = [];
  for (const { name, link } of links) {
    const position = await textPosition(link);
    expect(position, `${name}: its text at rest`).not.toBeNull();
    atRest.push(position!);
  }

  /* Compared with a sub-pixel tolerance: rendered positions may carry rounding, while a thicker
     underline pushing or pulling the text moves it by a whole pixel at least. */
  const expectInPlace = async (index: number, state: string) => {
    const { name, link } = links[index];
    const rest = atRest[index];
    const position = await textPosition(link);
    expect.soft(position, `${name}: its text ${state}`).not.toBeNull();
    if (position) {
      expect
        .soft(
          Math.abs(position.top - rest.top),
          `${name}: vertical shift of its text ${state} (top ${position.top} against ${rest.top} at rest)`,
        )
        .toBeLessThan(0.5);
      expect
        .soft(
          Math.abs(position.left - rest.left),
          `${name}: horizontal shift of its text ${state} (left ${position.left} against ${rest.left} at rest)`,
        )
        .toBeLessThan(0.5);
    }
  };

  /* Hovering needs a fine pointer; touch screens have none. */
  if (!hasTouch) {
    for (const [index, { name, link }] of links.entries()) {
      await link.hover();
      expect(await link.evaluate((el) => el.matches(':hover')), `${name}: it is hovered`).toBe(true);
      await expectInPlace(index, 'while hovered');
    }
    /* The pointer leaves the links, so that only the focus remains below. */
    await page.mouse.move(0, 0);
  }

  /* A keyboard visitor tabs from one link to the next. */
  for (const [index, { name, link }] of links.entries()) {
    await tabUntilFocused(link, browserName, TABS_TO_REACH_THE_PROJECTS_LINKS);
    expect(await link.evaluate((el) => el.matches(':focus-visible')), `${name}: it shows the keyboard focus`).toBe(
      true,
    );
    await expectInPlace(index, 'while focused by keyboard');
  }
});

test('on the French home page, on a phone and on a wide window, each card of the section "Projets sélectionnés" shows its role below its title and above its description', async ({
  page,
}) => {
  for (const viewport of [PHONE, WIDE_WINDOW]) {
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    await cardsOnceLoaded(page);
    const section = projectsSection(page);
    for (const [index, project] of FEATURED_PROJECTS.entries()) {
      const where = `${viewport.width}px wide, ${cardName(index)}`;
      const card = cardTitled(section, project.title);
      await expect(card).toHaveCount(1);
      const role = card.getByText(project.role, { exact: true });
      await expect(role).toBeVisible();
      const [title, roleBox, description] = await Promise.all([
        textBox(card.getByRole('heading', { level: 3 })),
        textBox(role),
        textBox(card.getByText(project.description, { exact: true })),
      ]);
      expect(
        title && roleBox && description,
        `${where}: the title, role and description each show text on screen`,
      ).toBeTruthy();
      /* Below the title: under its last line. */
      expect
        .soft(
          roleBox!.top,
          `${where}: top of the role "${project.role}" against the bottom of the title (${title!.bottom.toFixed(1)} px)`,
        )
        .toBeGreaterThanOrEqual(title!.bottom - 1);
      /* Above the description. */
      expect
        .soft(
          roleBox!.bottom,
          `${where}: bottom of the role "${project.role}" against the top of the description (${description!.top.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(description!.top + 1);
    }
  }
});

test('on a phone, the cards of the section "Projets sélectionnés" are stacked in a single column, each as wide as the section’s content, and the page does not scroll horizontally', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto('/fr/');
  const section = projectsSection(page);
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  /* The section's content box: its box without its horizontal padding. */
  const content = await section.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
  });
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    }),
  );
  boxes.forEach((box, index) => {
    const card = cardName(index);
    expect
      .soft(
        Math.abs(box.left - content.left),
        `${card}: left edge ${box.left} px against the section's content left edge ${content.left} px`,
      )
      .toBeLessThanOrEqual(1);
    expect
      .soft(
        Math.abs(box.right - content.right),
        `${card}: right edge ${box.right} px against the section's content right edge ${content.right} px`,
      )
      .toBeLessThanOrEqual(1);
    if (index > 0) {
      expect
        .soft(box.top, `${card}: top against the bottom of the card above (${boxes[index - 1].bottom} px)`)
        .toBeGreaterThanOrEqual(boxes[index - 1].bottom - 1);
    }
  });
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect.soft(pageWidth, 'width of the page content').toBeLessThanOrEqual(PHONE.width);
});

test('on a wide window, the cards of the section "Projets sélectionnés" sit two per row, of equal width', async ({
  page,
}) => {
  await page.setViewportSize(WIDE_WINDOW);
  await page.goto('/fr/');
  const section = projectsSection(page);
  await expect(section).toBeVisible();
  const cards = section.getByRole('article');
  await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right, top, bottom, width } = element.getBoundingClientRect();
      return { left, right, top, bottom, width };
    }),
  );
  /* Rows of two, in order: cards 1 and 2, then cards 3 and 4 below them. Within a row, both cards
     share a top edge and the second sits to the right of the first. */
  for (let first = 0; first < boxes.length; first += 2) {
    const second = first + 1;
    if (second >= boxes.length) break;
    expect
      .soft(
        Math.abs(boxes[second].top - boxes[first].top),
        `${cardName(second)}: top ${boxes[second].top} px against the top of ${cardName(first)} (${boxes[first].top} px)`,
      )
      .toBeLessThanOrEqual(1);
    expect
      .soft(
        boxes[second].left,
        `${cardName(second)}: left edge against the right edge of ${cardName(first)} (${boxes[first].right} px)`,
      )
      .toBeGreaterThanOrEqual(boxes[first].right - 1);
    if (first >= 2) {
      const rowAboveBottom = Math.max(boxes[first - 2].bottom, boxes[first - 1].bottom);
      expect
        .soft(boxes[first].top, `${cardName(first)}: top against the bottom of the row above (${rowAboveBottom} px)`)
        .toBeGreaterThanOrEqual(rowAboveBottom - 1);
    }
  }
  /* Equal width: every card as wide as the first, whatever the length of its description. */
  boxes.forEach((box, index) => {
    expect
      .soft(
        Math.abs(box.width - boxes[0].width),
        `${cardName(index)}: width ${box.width} px against the width of ${cardName(0)} (${boxes[0].width} px)`,
      )
      .toBeLessThanOrEqual(1);
  });
});

test('on the French home page, the "Tous les projets" link of the section "Projets sélectionnés" comes before the cards: on a wide window on the heading’s row, at the right end of the cards’ area; on a phone below the heading and above the first card', async ({
  page,
}) => {
  const span = (box: Box) =>
    `${box.left.toFixed(1)}–${box.right.toFixed(1)} px × ${box.top.toFixed(1)}–${box.bottom.toFixed(1)} px`;
  for (const viewport of [WIDE_WINDOW, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);
    const section = projectsSection(page);
    const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
    await expect(link).toBeVisible();
    const where = `${viewport.width}px wide`;
    const [heading, linkBox, firstCard, secondCard] = await Promise.all([
      textBox(section.getByRole('heading', { level: 2 })),
      textBox(link),
      elementBox(cards.nth(0)),
      elementBox(cards.nth(1)),
    ]);
    expect(heading && linkBox, `${where}: the heading and the link each show text on screen`).toBeTruthy();
    if (viewport.width >= 768) {
      /* On the heading's row: the link overlaps the heading vertically, to its right… */
      expect
        .soft(
          linkBox!.top < heading!.bottom && linkBox!.bottom > heading!.top,
          `${where}: the link (${span(linkBox!)}) overlaps vertically the heading (${span(heading!)})`,
        )
        .toBe(true);
      expect
        .soft(
          linkBox!.left,
          `${where}: the link's left edge against the heading's right edge (${heading!.right.toFixed(1)} px)`,
        )
        .toBeGreaterThanOrEqual(heading!.right);
      /* …at the right end of the cards' area: lined up with the second card's right edge. */
      expect
        .soft(
          Math.abs(linkBox!.right - secondCard.right),
          `${where}: the link's right edge (${linkBox!.right.toFixed(1)} px) against the second card's right edge (${secondCard.right.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(3);
    } else {
      /* Between the heading and the first card. */
      expect
        .soft(linkBox!.top, `${where}: the link's top against the heading's bottom (${heading!.bottom.toFixed(1)} px)`)
        .toBeGreaterThanOrEqual(heading!.bottom - 1);
      expect
        .soft(
          linkBox!.bottom,
          `${where}: the link's bottom against the first card's top (${firstCard.top.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(firstCard.top + 1);
    }
  }
});

test('on the French home page, on a phone and on a wide window, the "Voir le détail" link of each card and the "Tous les projets" link of the section "Projets sélectionnés" are each at least 24 px high (WCAG 2.5.8)', async ({
  page,
}) => {
  for (const viewport of [PHONE, WIDE_WINDOW]) {
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    await cardsOnceLoaded(page);
    const section = projectsSection(page);
    const where = `${viewport.width}px wide`;
    const links: Record<string, Locator> = {
      '"Tous les projets" link': section.getByRole('link', { name: 'Tous les projets', exact: true }),
    };
    FEATURED_PROJECTS.forEach((project, index) => {
      links[`"Voir le détail" link of ${cardName(index)}`] = cardTitled(section, project.title).getByRole('link', {
        name: 'Voir le détail',
      });
    });
    for (const [name, link] of Object.entries(links)) {
      await expect(link, `${where}: ${name}`).toBeVisible();
      const box = (await link.boundingBox())!;
      expect.soft(box.height, `${where}: target height of the ${name}`).toBeGreaterThanOrEqual(24);
    }
  }
});

test('on the French home page, with JavaScript and without, each card of the section "Projets sélectionnés" shows a decorative tick pattern above its title, across the card’s width (its full width or its content box), hidden from assistive technologies', async ({
  page,
  browser,
  baseURL,
}) => {
  /* The tick pattern's band is in the page whether or not scripts run. */
  const withoutJavaScript = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    javaScriptEnabled: false,
  });
  try {
    for (const [mode, tab] of [
      ['with JavaScript', page],
      ['without JavaScript', await withoutJavaScript.newPage()],
    ] as const) {
      await tab.goto('/fr/');
      const section = projectsSection(tab);
      const cards = section.getByRole('article');
      await expect(cards).toHaveCount(FEATURED_PROJECTS.length);
      for (const [index, project] of FEATURED_PROJECTS.entries()) {
        const where = `${mode}, ${cardName(index)}`;
        const card = cards.nth(index);
        await expect(card.getByRole('heading', { level: 3 })).toHaveText(project.title);
        /* The tick pattern: an element of the card that comes before the title in the page (not
           one that holds it), displayed, at least a few pixels tall, ending at or above the
           title's top, and spanning the card's width: its full width, or its content box (the
           width without the horizontal padding), within a pixel. Whatever its tag or class. */
        const patternPath = await card.evaluate((article) => {
          const title = article.querySelector('h3')!;
          const titleTop = title.getBoundingClientRect().top;
          const box = article.getBoundingClientRect();
          const style = getComputedStyle(article);
          const spans = (left: number, right: number) =>
            (Math.abs(left - box.left) <= 1 && Math.abs(right - box.right) <= 1) ||
            (Math.abs(left - (box.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth))) <= 1 &&
              Math.abs(right - (box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth))) <= 1);
          const found = Array.from(article.querySelectorAll('*')).find((element) => {
            if (element.contains(title) || !(element.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING))
              return false;
            const elementStyle = getComputedStyle(element);
            if (
              elementStyle.display === 'none' ||
              elementStyle.visibility === 'hidden' ||
              parseFloat(elementStyle.opacity) === 0
            )
              return false;
            const { left, right, top, bottom } = element.getBoundingClientRect();
            return bottom - top >= 8 && bottom <= titleTop + 1 && spans(left, right);
          });
          if (!found) return null;
          /* Its path from the card, as an XPath, so that a locator can reach it. */
          const steps: string[] = [];
          for (let element: Element = found; element !== article; element = element.parentElement!) {
            const sameName = Array.from(element.parentElement!.children).filter(
              (sibling) => sibling.localName === element.localName,
            );
            steps.unshift(`*[local-name()="${element.localName}"][${sameName.indexOf(element) + 1}]`);
          }
          return `xpath=./${steps.join('/')}`;
        });
        expect
          .soft(
            patternPath,
            `${where}: an element above the title, at least a few pixels tall, across the card's width`,
          )
          .not.toBeNull();
        if (patternPath === null) continue;
        const pattern = card.locator(patternPath);
        await expect.soft(pattern, `${where}: the tick pattern is visible`).toBeVisible();
        /* Hidden from assistive technologies: the tick pattern contributes nothing to the
           accessibility tree, and the card's accessible content opens with its title. */
        expect
          .soft(await pattern.ariaSnapshot(), `${where}: what assistive technologies get from the tick pattern`)
          .toBe('');
        const cardTree = (await card.ariaSnapshot())
          .split('\n')
          .slice(1)
          .map((line) => line.trim());
        expect
          .soft(cardTree[0], `${where}: first entry of the card's accessibility tree`)
          .toMatch(/^- heading\b.*\[level=3\]/);
      }
    }
  } finally {
    await withoutJavaScript.close();
  }
});

test('on the French home page, on a phone and on a wide window, each card of the section "Projets sélectionnés" shows its tick pattern edge to edge, across the card’s full width and touching its top edge, while its title is inset from the card’s left edge', async ({
  page,
}) => {
  /* Inset: the title starts more than this many CSS pixels right of the card's left edge. */
  const MIN_TITLE_INSET = 8;
  for (const viewport of [PHONE, WIDE_WINDOW]) {
    await page.setViewportSize(viewport);
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);
    for (const index of FEATURED_PROJECTS.keys()) {
      const where = `${viewport.width}px wide, ${cardName(index)}`;
      const card = cards.nth(index);
      const pattern = tickPatternOf(card);
      await expect(pattern, `${where}: the tick pattern is visible`).toBeVisible();
      const [cardBox, patternBox, titleBox] = await Promise.all([
        card.boundingBox(),
        pattern.boundingBox(),
        card.getByRole('heading', { level: 3 }).boundingBox(),
      ]);
      expect(
        cardBox && patternBox && titleBox,
        `${where}: the card, its tick pattern and its title have a box on screen`,
      ).toBeTruthy();
      const cardRight = cardBox!.x + cardBox!.width;
      const patternRight = patternBox!.x + patternBox!.width;
      /* Edge to edge: flush with the card's left, right and top edges, within a pixel. */
      expect
        .soft(
          Math.abs(patternBox!.x - cardBox!.x),
          `${where}: the tick pattern's left edge (${patternBox!.x.toFixed(1)} px) against the card's left edge (${cardBox!.x.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(1);
      expect
        .soft(
          Math.abs(patternRight - cardRight),
          `${where}: the tick pattern's right edge (${patternRight.toFixed(1)} px) against the card's right edge (${cardRight.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(1);
      expect
        .soft(
          Math.abs(patternBox!.y - cardBox!.y),
          `${where}: the tick pattern's top edge (${patternBox!.y.toFixed(1)} px) against the card's top edge (${cardBox!.y.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(1);
      /* The text below it stays inside the card: the title starts well right of its left edge. */
      expect
        .soft(
          titleBox!.x - cardBox!.x,
          `${where}: the title's inset from the card's left edge (title at ${titleBox!.x.toFixed(1)} px, card at ${cardBox!.x.toFixed(1)} px)`,
        )
        .toBeGreaterThan(MIN_TITLE_INSET);
    }
  }
});

test(
  'on the French home page, with JavaScript, each card’s tick pattern is made of short ticks in rows: inside it, away from its edges, between two rows of drawn pixels, a horizontal band across its width shows only the card’s background, and several rows are each made of many separate short strokes',
  { tag: '@pixels' },
  async ({ page }) => {
    /* Reduced motion, so that whatever could animate shows a still picture. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    /* A blank band between two rows of ticks: at least this high, in CSS pixels. */
    const MIN_BAND_HEIGHT = 2;
    /* A row of ticks: a row of drawn pixels made of at least this many separate strokes. */
    const MIN_STROKES_PER_ROW = 5;
    const MIN_ROWS_OF_TICKS = 3;
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);
    for (const index of FEATURED_PROJECTS.keys()) {
      const where = cardName(index);
      const card = cards.nth(index);
      const box = await tickPatternBoxInCard(card, where);
      const inside = insideTickPattern(box);
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
      const describeRows =
        drawnRows
          .map(({ from, to, strokes: count }) => `${(from / scale).toFixed(1)}–${(to / scale).toFixed(1)}px: ${count}`)
          .join(', ') || 'none';
      expect
        .soft(
          bands.length,
          `${where}: horizontal bands at least ${MIN_BAND_HEIGHT}px high showing only the card's background between two rows of drawn pixels, inside the ${Math.round(box.width)}×${Math.round(box.height)}px tick pattern (${INSET}px from its edges): ${bands.join(', ') || 'none'}`,
        )
        .toBeGreaterThanOrEqual(MIN_ROWS_OF_TICKS - 1);
      expect
        .soft(
          rowsOfTicks.length,
          `${where}: rows of drawn pixels inside the tick pattern (${INSET}px from its edges) made of at least ${MIN_STROKES_PER_ROW} separate strokes; separate strokes per row (relative to the card): ${describeRows}`,
        )
        .toBeGreaterThanOrEqual(MIN_ROWS_OF_TICKS);
    }
  },
);

/* Comparing the tick patterns of two cards, or of one card at two moments. Two cards sit at
   different, possibly fractional, positions: the browser may draw two copies of one pattern up to
   a pixel or two apart, relative to their boxes, and anti-aliasing and the rounding of the
   screenshots move each edge a little more. So the ticks of the second pattern are compared with
   those of the first moved by up to MAX_SHIFT CSS pixels, across and down, the shift that matches
   most; two ticks stand at the same place when each edge of one lies within SAME_PLACE CSS pixels
   of the same edge of the other. */
const MAX_SHIFT = 2;
const SHIFT_STEP = 0.25;
const SAME_PLACE = 1;
/* Only the ticks this far inside their tick pattern count, so that a tick whose copy the shift
   would bring across the measured edge (and leave out) cannot count as unmatched. */
const CORE = INSET + MAX_SHIFT + SAME_PLACE + 1;
/* The share of the ticks of both tick patterns that have no tick at the same place in the other:
   two copies of one pattern show next to none; two patterns a visitor tells apart, many. */
const MIN_SHARE_UNMATCHED = 0.25;

type TicksOfTickPattern = { ticks: Rectangle[]; core: Rectangle[] };

/* The ticks of a card's tick pattern: the separate strokes drawn inside it, as boxes relative to
   the tick pattern's box, and among them those at least CORE CSS pixels inside it. */
async function ticksOfTickPattern(card: Locator, where: string): Promise<TicksOfTickPattern> {
  const box = await tickPatternBoxInCard(card, where);
  const strokes = await drawnStrokesInRectangle(card, await card.screenshot(), insideTickPattern(box));
  const ticks = strokes.map((stroke) => ({ ...stroke, x: stroke.x - box.x, y: stroke.y - box.y }));
  const core = ticks.filter(
    (tick) =>
      tick.x >= CORE &&
      tick.y >= CORE &&
      tick.x + tick.width <= box.width - CORE &&
      tick.y + tick.height <= box.height - CORE,
  );
  return { ticks, core };
}

/* How the ticks of two tick patterns match at best: with the first pattern's ticks moved by up to
   MAX_SHIFT CSS pixels, the shift that leaves the fewest core ticks of either pattern with no
   tick at the same place in the other (the smallest such shift on a tie), those unmatched core
   ticks in each, and their share of the core ticks of both. */
function bestMatchOfTicks(
  first: TicksOfTickPattern,
  second: TicksOfTickPattern,
): { dx: number; dy: number; inFirst: number; inSecond: number; shareUnmatched: number } {
  const samePlace = (a: Rectangle, b: Rectangle, dx: number, dy: number): boolean =>
    Math.abs(a.x + dx - b.x) <= SAME_PLACE &&
    Math.abs(a.y + dy - b.y) <= SAME_PLACE &&
    Math.abs(a.x + a.width + dx - (b.x + b.width)) <= SAME_PLACE &&
    Math.abs(a.y + a.height + dy - (b.y + b.height)) <= SAME_PLACE;
  /* For each core tick, the ticks of the other pattern that some shift could bring to its
     place: only those need comparing once the shift is chosen. */
  const reachable = (tick: Rectangle, others: Rectangle[]) =>
    others.filter(
      (other) =>
        Math.abs(tick.x - other.x) <= MAX_SHIFT + SAME_PLACE && Math.abs(tick.y - other.y) <= MAX_SHIFT + SAME_PLACE,
    );
  const candidatesInFirst = first.core.map((tick) => reachable(tick, second.ticks));
  const candidatesInSecond = second.core.map((tick) => reachable(tick, first.ticks));
  /* For a shift of the first pattern's ticks, the core ticks of each pattern with no tick at
     the same place in the other. */
  const unmatched = (dx: number, dy: number) => ({
    inFirst: first.core.filter(
      (tick, index) => !candidatesInFirst[index].some((other) => samePlace(tick, other, dx, dy)),
    ).length,
    inSecond: second.core.filter(
      (tick, index) => !candidatesInSecond[index].some((other) => samePlace(other, tick, dx, dy)),
    ).length,
  });
  const shifts: number[] = [];
  for (let shift = -MAX_SHIFT; shift <= MAX_SHIFT; shift += SHIFT_STEP) shifts.push(shift);
  const best = shifts
    .flatMap((dx) => shifts.map((dy) => ({ dx, dy, ...unmatched(dx, dy) })))
    .reduce((a, b) => {
      const [missesOfA, missesOfB] = [a.inFirst + a.inSecond, b.inFirst + b.inSecond];
      return missesOfB < missesOfA || (missesOfB === missesOfA && Math.hypot(b.dx, b.dy) < Math.hypot(a.dx, a.dy))
        ? b
        : a;
    });
  return { ...best, shareUnmatched: (best.inFirst + best.inSecond) / (first.core.length + second.core.length) };
}

test(
  'on the French home page, the tick patterns of the four cards all differ from one another: for each pair of cards, many of the ticks drawn in one have no tick at the same place in the other',
  { tag: '@pixels' },
  async ({ page }) => {
    /* Reduced motion, so that whatever could animate shows a still picture. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);
    const ticksOfTickPatterns: TicksOfTickPattern[] = [];
    for (const index of FEATURED_PROJECTS.keys())
      ticksOfTickPatterns.push(await ticksOfTickPattern(cards.nth(index), cardName(index)));
    /* Every pair of cards, not only neighbours: a pattern repeated two cards further fails too. */
    for (let a = 0; a < ticksOfTickPatterns.length; a++) {
      for (let b = a + 1; b < ticksOfTickPatterns.length; b++) {
        const [first, second] = [ticksOfTickPatterns[a], ticksOfTickPatterns[b]];
        const { shareUnmatched, ...best } = bestMatchOfTicks(first, second);
        expect
          .soft(
            shareUnmatched,
            `${cardName(a)} and ${cardName(b)}: share of the ticks of their tick patterns (at least ${CORE}px inside them) with no tick at the same place (each edge within ${SAME_PLACE}px) in the other tick pattern, with the first moved by up to ${MAX_SHIFT}px the way that matches most (${best.dx}px across, ${best.dy}px down); ticks: ${first.core.length} in the first, ${best.inFirst} of them unmatched, ${second.core.length} in the second, ${best.inSecond} of them unmatched`,
          )
          .toBeGreaterThanOrEqual(MIN_SHARE_UNMATCHED);
      }
    }
  },
);

test(
  'on the French home page, the tick pattern is drawn anew at every load: after a reload, the first card’s tick pattern differs from the one it showed before, many of the ticks drawn in one having no tick at the same place in the other',
  { tag: '@pixels' },
  async ({ page }) => {
    /* Reduced motion, so that whatever could animate shows a still picture. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const name = cardName(0);
    /* The ticks of the first card's tick pattern, on a fresh load of the page. */
    const ticksOfFirstCardOnLoad = async (load: () => Promise<unknown>, when: string): Promise<TicksOfTickPattern> => {
      await load();
      const cards = await cardsOnceLoaded(page);
      return ticksOfTickPattern(cards.first(), `${name}, ${when}`);
    };
    const before = await ticksOfFirstCardOnLoad(() => page.goto('/fr/'), 'before the reload');
    const after = await ticksOfFirstCardOnLoad(() => page.reload(), 'after the reload');
    const { shareUnmatched, ...best } = bestMatchOfTicks(before, after);
    expect
      .soft(
        shareUnmatched,
        `${name}: share of the ticks of its tick pattern before and after a reload (at least ${CORE}px inside it) with no tick at the same place (each edge within ${SAME_PLACE}px) in the other load's pattern, with the first moved by up to ${MAX_SHIFT}px the way that matches most (${best.dx}px across, ${best.dy}px down); ticks: ${before.core.length} before the reload, ${best.inFirst} of them unmatched, ${after.core.length} after it, ${best.inSecond} of them unmatched`,
      )
      .toBeGreaterThanOrEqual(MIN_SHARE_UNMATCHED);
  },
);

test(
  'on the French home page, with JavaScript, when the window widens, the first card’s tick pattern is completed rather than stretched: the ticks it showed stay where they were, and new ticks, spaced like them, fill the added width up to its right edge',
  { tag: '@pixels' },
  async ({ page }) => {
    /* Reduced motion, so that whatever could animate shows a still picture. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    /* Two window widths, both in the single-column layout, where the card, and its tick pattern,
     follow the window's width: the pattern widens by a few hundred pixels between them. */
    const NARROW = { width: 400, height: 800 };
    const WIDE = { width: 720, height: 800 };
    const MIN_WIDENING = 200;
    /* Time left for a redraw once the pattern's box has widened. */
    const REDRAW_DELAY = 500;
    /* The ticks it showed stay where they were: next to none of them, or of those now drawn over the
     same region, without a tick at the same place in the other. */
    const MAX_SHARE_UNMATCHED = 0.05;
    /* Two neighbouring columns of ticks stand as far apart as the existing ones, each edge of a tick
     within SAME_PLACE of where it would be. */
    const SPACING_TOLERANCE = 2 * SAME_PLACE;
    const name = cardName(0);
    await page.setViewportSize(NARROW);
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);
    const card = cards.first();
    const pattern = tickPatternOf(card);
    const patternWidth = async (): Promise<number> => (await pattern.boundingBox())?.width ?? 0;
    const narrowWidth = await patternWidth();
    const before = await ticksOfTickPattern(card, `${name}, before the window widens`);

    await page.setViewportSize(WIDE);
    await expect
      .poll(patternWidth, `${name}: width of its tick pattern once the window widens from ${narrowWidth}px`)
      .toBeGreaterThanOrEqual(narrowWidth + MIN_WIDENING);
    const wideWidth = await patternWidth();
    await page.waitForTimeout(REDRAW_DELAY);
    const after = await ticksOfTickPattern(card, `${name}, after the window widens`);

    /* The original region: the ticks drawn there after the widening, against those it showed. The
     core ticks of that region lie as far inside it as the core ticks of the narrow pattern. */
    const original: TicksOfTickPattern = {
      ticks: after.ticks.filter((tick) => tick.x < narrowWidth),
      core: after.core.filter((tick) => tick.x + tick.width <= narrowWidth - CORE),
    };
    const { shareUnmatched, ...best } = bestMatchOfTicks(before, original);
    expect
      .soft(
        shareUnmatched,
        `${name}: share of the ticks of its ${Math.round(narrowWidth)}px-wide tick pattern, before and after the window widens it to ${Math.round(wideWidth)}px, with no tick at the same place (each edge within ${SAME_PLACE}px) in the other, over the original width (at least ${CORE}px inside it), with the first moved by up to ${MAX_SHIFT}px the way that matches most (${best.dx}px across, ${best.dy}px down); ticks: ${before.core.length} before, ${best.inFirst} of them unmatched, ${original.core.length} after, ${best.inSecond} of them unmatched`,
      )
      .toBeLessThanOrEqual(MAX_SHARE_UNMATCHED);

    /* The columns of ticks: the left edges of ticks that stand within SAME_PLACE of one another,
     from left to right, each column at its leftmost edge. */
    const columnsOf = (ticks: Rectangle[]): number[] =>
      [...ticks]
        .map((tick) => tick.x)
        .sort((a, b) => a - b)
        .reduce<number[]>(
          (columns, x) =>
            columns.length > 0 && x - columns[columns.length - 1] <= SAME_PLACE ? columns : [...columns, x],
          [],
        );
    const gaps = (columns: number[]): number[] => columns.slice(1).map((x, index) => x - columns[index]);
    const columnsBefore = columnsOf(before.ticks);
    const gapsBefore = gaps(columnsBefore).sort((a, b) => a - b);
    const spacing = gapsBefore[Math.floor(gapsBefore.length / 2)];
    const columnsAfter = columnsOf(after.ticks);
    /* The columns past the original ones, with the last original column, so that the seam counts
     too. */
    const lastOriginalColumn = columnsBefore[columnsBefore.length - 1];
    const addedColumns = columnsAfter.filter((x) => x >= lastOriginalColumn - SAME_PLACE);
    const unevenGaps = gaps(addedColumns)
      .map((gap, index) => ({ at: addedColumns[index], gap }))
      .filter(({ gap }) => Math.abs(gap - spacing) > SPACING_TOLERANCE)
      .map(({ at, gap }) => `${gap.toFixed(1)}px after the column at ${at.toFixed(1)}px`);
    expect
      .soft(
        addedColumns.length,
        `${name}: columns of ticks in its tick pattern from its last original column (${lastOriginalColumn.toFixed(1)}px) to its new right edge (${Math.round(wideWidth)}px)`,
      )
      .toBeGreaterThan(MIN_WIDENING / spacing);
    expect
      .soft(
        unevenGaps,
        `${name}: gaps between neighbouring columns of ticks, from its last original column (${lastOriginalColumn.toFixed(1)}px) on, that differ by more than ${SPACING_TOLERANCE}px from the spacing of its original columns (${spacing.toFixed(1)}px); columns after the widening: ${columnsAfter.map((x) => x.toFixed(1)).join(', ')}`,
      )
      .toEqual([]);

    /* Up to the right edge: the empty strip right of the last tick is no wider, give or take a
     column, than the one the narrow pattern left. */
    const emptyStrip = (ticks: Rectangle[], width: number): number =>
      width - Math.max(...ticks.map((tick) => tick.x + tick.width));
    const stripBefore = emptyStrip(before.ticks, narrowWidth);
    expect
      .soft(
        emptyStrip(after.ticks, wideWidth),
        `${name}: empty strip between its rightmost tick and the right edge of its ${Math.round(wideWidth)}px-wide tick pattern, against the ${stripBefore.toFixed(1)}px strip of its ${Math.round(narrowWidth)}px-wide pattern and a column spacing of ${spacing.toFixed(1)}px`,
      )
      .toBeLessThanOrEqual(stripBefore + spacing + SPACING_TOLERANCE);
  },
);

test(
  'on the French home page, with JavaScript, after the window moves to a screen with twice the pixel density without changing size, each card’s tick pattern is redrawn at the new density: shortly after the move, with nothing else happening, it shows what it shows once drawn anew at that density, the same ticks, crisp, not its old drawing stretched',
  { tag: '@pixels' },
  async ({ page, isMobile }) => {
    /* Reduced motion, so that whatever could animate shows a still picture. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    /* What it shows once drawn anew, within this share of its drawn pixels: the old drawing
     stretched to the new density smears the edges of every tick. */
    const MAX_SHARE_CHANGED = 0.02;
    /* Time stands still, so that nothing but the move can redraw a pattern. */
    await stopClockBeforeLoad(page);
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);
    const patterns = page.locator('tick-pattern');
    const oldDensity = await page.evaluate(() => window.devicePixelRatio);
    const newDensity = 2 * oldDensity;

    const screen = await moveToScreenOfDensity(page, {
      density: newDensity,
      isMobile,
      rendered: tickPatternOf(cards.first()),
    });
    const cardScreenshots = async (): Promise<Buffer[]> => {
      const screenshots: Buffer[] = [];
      for (const index of FEATURED_PROJECTS.keys()) screenshots.push(await screen.screenshot(cards.nth(index)));
      return screenshots;
    };
    const afterMove = await cardScreenshots();

    /* The reference: each tick pattern taken off the page and put back in its place, which draws
     it anew at the new density, whatever the layout. It keeps its ticks. */
    await patterns.evaluateAll((elements) => {
      for (const element of elements) {
        const [parent, next] = [element.parentNode!, element.nextSibling];
        element.remove();
        parent.insertBefore(element, next);
      }
    });
    await screen.waitForRender(tickPatternOf(cards.first()));
    const redrawn = await cardScreenshots();
    expect(await page.evaluate(() => window.devicePixelRatio), 'pixel density of the new screen').toBeCloseTo(
      newDensity,
      3,
    );

    for (const index of FEATURED_PROJECTS.keys()) {
      const where = cardName(index);
      const card = cards.nth(index);
      await card.scrollIntoViewIfNeeded();
      const { cardInScreenshot, patternBox } = await cardAndTickPatternBoxes(card, where);
      /* The pattern's whole box, measured against the card's background, up to CARD_EDGE inside
       the card's edges, which it touches. */
      const box = withinCardEdges(patternBox, cardInScreenshot);
      const { rows } = await pixelsNotOfBackgroundPerRow(card, redrawn[index], box);
      const drawnPixels = rows.reduce((sum, count) => sum + count, 0);
      expect
        .soft(
          drawnPixels,
          `${where}: pixels of its tick pattern drawn anew at the new density that differ from the card's background`,
        )
        .toBeGreaterThan(0);
      const { columns } = await pixelsChangedPerColumnInRectangle(card, afterMove[index], redrawn[index], box);
      const changedPixels = columns.reduce((sum, count) => sum + count, 0);
      expect
        .soft(
          changedPixels,
          `${where}: pixels of its ${Math.round(box.width)}px-wide tick pattern, ${DELAY_AFTER_MOVE_MS} ms after the window moved from a density of ${oldDensity} to ${newDensity}, that differ from the tick pattern drawn anew at that density, which shows ${drawnPixels} drawn pixels`,
        )
        .toBeLessThanOrEqual(MAX_SHARE_CHANGED * drawnPixels);
    }
  },
);

test(
  'on the French home page, without JavaScript, each card’s tick pattern is an empty band in its place: inside it, no pixel is drawn, it shows only the card’s background',
  { tag: '@pixels' },
  async ({ browser, baseURL, viewport }) => {
    /* The pattern is drawn by a script: without one, its band stays, with nothing in it. */
    const withoutJavaScript = await browser.newContext({ baseURL, viewport, javaScriptEnabled: false });
    try {
      const page = await withoutJavaScript.newPage();
      await page.goto('/fr/');
      const cards = await cardsOnceLoaded(page);
      for (const index of FEATURED_PROJECTS.keys()) {
        const where = `without JavaScript,${cardName(index)}`;
        const card = cards.nth(index);
        await expect(tickPatternOf(card), `${where}: the tick pattern's band is visible`).toBeVisible();
        await card.scrollIntoViewIfNeeded();
        const { cardInScreenshot, patternBox } = await cardAndTickPatternBoxes(card, where);
        /* The pattern's whole box, measured against the card's background. Where the pattern
         touches the card's edges, it is measured up to CARD_EDGE inside them, as the screenshot
         shows them: outside them, it shows the section's background. */
        const box = withinCardEdges(patternBox, cardInScreenshot);
        const { rows } = await pixelsNotOfBackgroundPerRow(card, await card.screenshot(), box);
        const drawn = rows.reduce((sum, count) => sum + count, 0);
        expect
          .soft(
            drawn,
            `${where}: screenshot pixels other than the card's background inside the ${Math.round(box.width)}×${Math.round(box.height)}px tick pattern`,
          )
          .toBe(0);
      }
    } finally {
      await withoutJavaScript.close();
    }
  },
);

test(
  'under prefers-reduced-motion: reduce, on the French home page, each card’s tick pattern stays still: 2 s after load, every vertical band inside it, from its left edge to its right edge, shows the brightness it showed right after load',
  { tag: '@pixels' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    /* The tick pattern's width split into adjacent vertical bands, at least this wide each. */
    const MIN_BAND_WIDTH = 40;
    /* What a band showed right after load, within this share, for rendering noise. */
    const TOLERANCE = 0.02;
    await page.goto('/fr/');
    const cards = await cardsOnceLoaded(page);

    /* For each card, the bands inside its tick pattern, relative to the card's box. */
    const bandsOfCards: Rectangle[][] = [];
    for (const index of FEATURED_PROJECTS.keys()) {
      const where = cardName(index);
      const card = cards.nth(index);
      const inside = insideTickPattern(await tickPatternBoxInCard(card, where));
      bandsOfCards.push(
        verticalBands(inside.width, inside.height, MIN_BAND_WIDTH).map((band) => ({
          ...band,
          x: band.x + inside.x,
          y: inside.y,
        })),
      );
    }
    const brightness = async (): Promise<number[][]> => {
      const perCard: number[][] = [];
      for (const [index, bands] of bandsOfCards.entries()) {
        const card = cards.nth(index);
        await card.scrollIntoViewIfNeeded();
        const screenshot = await card.screenshot();
        perCard.push(
          await Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(card, screenshot, band))),
        );
      }
      return perCard;
    };

    const rightAfterLoad = await brightness();
    /* Time passes, on the page's real clock: long enough for an animation to show. */
    await page.waitForTimeout(2000);
    const twoSecondsLater = await brightness();

    for (const index of FEATURED_PROJECTS.keys()) {
      const changedBands = bandsOfCards[index]
        .map((band, bandIndex) => ({
          band,
          before: rightAfterLoad[index][bandIndex],
          after: twoSecondsLater[index][bandIndex],
        }))
        .filter(({ before, after }) => Math.abs(after - before) > TOLERANCE * before)
        .map(
          ({ band, before, after }) =>
            `${Math.round(band.x)}–${Math.round(band.x + band.width)}px: ${Math.round(before)} → ${Math.round(after)}`,
        );
      expect
        .soft(
          changedBands,
          `${cardName(index)}: bands inside its tick pattern (${INSET}px from its edges, relative to the card) whose brightness above the card's background, under reduced motion, 2 s after load, differs by more than ${TOLERANCE * 100}% from what they showed right after load`,
        )
        .toEqual([]);
    }
  },
);

test.describe('home page of another site, featuring other projects', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_OTHER_PROJECTS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });
  /* Every test starts on this site's French home page. */
  test.beforeEach(async ({ page, context }) => {
    await serveSite(context, SITE_WITH_OTHER_PROJECTS, siteDirectory);
    await page.goto(`${SITE_WITH_OTHER_PROJECTS.origin}/fr/`);
  });

  test('the section "Projets sélectionnés" shows one card per project this site features, in its order, and none of the example site’s', async ({
    page,
  }) => {
    const section = projectsSection(page);
    /* Featured in tests/fixtures/other-projects/content/_index.md, in an order that is neither
       alphabetical nor reverse alphabetical. An array makes the match exact. */
    await expect(section.getByRole('heading', { level: 3 })).toHaveText([
      'Coucou de la Forêt-Noire',
      'Baromètre à mercure',
      'Chronomètre de marine',
    ]);
  });

  test('a featured project whose page declares only a title and a description gets a card with just those: no empty slot for the role or stack, no stray separator', async ({
    page,
  }) => {
    const section = projectsSection(page);
    /* tests/fixtures/other-projects/content/projets/barometre-mercure.md declares no [params]. */
    const title = 'Baromètre à mercure';
    const description = 'Baromètre à colonne de mercure remonté dans son cadre d’origine, avec une échelle regravée.';
    const card = cardTitled(section, title);
    await expect(card).toHaveCount(1);
    await expect(card.getByText(description, { exact: true })).toHaveRole('paragraph');
    /* Outside links (the link to the project's page has its own text), the title and the
       description are all the card shows: no role or stack text, no separator left alone… */
    const textOutsideLinks = () =>
      card.evaluate((article) => {
        const copy = article.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('a').forEach((link) => link.remove());
        return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      });
    await expect.poll(textOutsideLinks).toBe(`${title} ${description}`);
    /* …and no text element left empty, or holding only whitespace, where they would go. Only
       text elements are checked: the tick pattern and the link are not. */
    const textElements = card.locator('p, span, li, dt, dd, time, small, strong, em, h1, h2, h3, h4, h5, h6');
    await expect(textElements.filter({ hasNotText: /\S/ })).toHaveCount(0);
  });

  test('the card of a featured project without a detail page has no link, while the other cards keep theirs, and the site publishes no page at that project’s address', async ({
    page,
  }) => {
    const section = projectsSection(page);
    /* tests/fixtures/other-projects/content/projets/chronometre-marine.md declares
       [build] render = 'never': its card is still shown, with no link at all, not even an empty one. */
    const card = cardTitled(section, 'Chronomètre de marine');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.locator('a')).toHaveCount(0);
    /* The projects that have a page keep their link to it. */
    for (const title of ['Coucou de la Forêt-Noire', 'Baromètre à mercure']) {
      await expect(cardTitled(section, title).getByRole('link', { name: 'Voir le détail' })).toHaveCount(1);
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

  test('the card of a featured project that inherits render = "never" from its section’s cascade has no link, while the other card keeps its own, and the site publishes no page at that project’s address', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES, siteDirectory);
    await page.goto(`${SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES.origin}/fr/`);
    const section = projectsSection(page);
    /* tests/fixtures/section-without-detail-pages/content/esquisses/regulateur-de-parquet.md sets
       no [build] options: its section's _index.md declares [cascade.build] render = 'never'. Its
       card is still shown, with no link at all, not even an empty one. */
    const card = cardTitled(section, 'Régulateur de parquet');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.locator('a')).toHaveCount(0);
    /* The project that has a page keeps its link to it. */
    await expect(
      cardTitled(section, 'Restauration d’une pendule de cheminée').getByRole('link', { name: 'Voir le détail' }),
    ).toHaveCount(1);
    /* Nothing is published where the project's page would be. */
    const response = await page.goto(
      `${SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES.origin}/fr/esquisses/regulateur-de-parquet/`,
    );
    expect(response?.status()).toBe(404);
  });
});

test.describe('home page of another site, featuring projects whose page is not published', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_WITHOUT_PUBLISHED_PAGES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the cards of featured projects whose page declares render = "link" or render = false have no link, while the other card keeps its own', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_PROJECTS_WITHOUT_PUBLISHED_PAGES, siteDirectory);
    await page.goto(`${SITE_WITH_PROJECTS_WITHOUT_PUBLISHED_PAGES.origin}/fr/`);
    const section = projectsSection(page);
    /* In tests/fixtures/projects-without-published-pages/content/projets/, horloge-comtoise.md
       declares [build] render = 'link' and sablier-de-marine.md [build] render = false: neither
       has a published page. Their cards are still shown, with no link at all, not even an empty
       one. */
    for (const title of ['Horloge comtoise', 'Sablier de marine']) {
      const card = cardTitled(section, title);
      await expect(card).toHaveCount(1);
      await expect(card).toBeVisible();
      await expect.soft(card.locator('a'), `links in the card of "${title}"`).toHaveCount(0);
    }
    /* The project that has a page keeps its link to it. */
    await expect(
      cardTitled(section, 'Restauration d’une pendule de cheminée').getByRole('link', { name: 'Voir le détail' }),
    ).toHaveCount(1);
    /* render = 'link' gives the clock an address, but nothing is published there. */
    const response = await page.goto(
      `${SITE_WITH_PROJECTS_WITHOUT_PUBLISHED_PAGES.origin}/fr/projets/horloge-comtoise/`,
    );
    expect(response?.status()).toBe(404);
  });
});

test.describe('home page of another site, featuring projects whose page declares an unusual render value', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_UNUSUAL_RENDER_VALUES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the cards of featured projects whose page declares render = "Always" (capitalised) or a typo such as render = "nevr", which Hugo still publishes, keep their "Voir le détail" link, which opens that page', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_UNUSUAL_RENDER_VALUES, siteDirectory);
    /* In tests/fixtures/unusual-render-values/content/projets/, horloge-a-poids.md declares
       [build] render = 'Always' and pendulette-officier.md [build] render = 'nevr': Hugo reads the
       value case-sensitively, so that 'Always' and 'nevr' are both values it does not recognise,
       which it treats as 'always' (as for render = 'false', below): both pages are published. */
    const projects = [
      { title: 'Horloge à poids', slug: 'horloge-a-poids' },
      { title: 'Pendulette d’officier', slug: 'pendulette-officier' },
    ];
    for (const project of projects) {
      await page.goto(`${SITE_WITH_UNUSUAL_RENDER_VALUES.origin}/fr/`);
      const card = cardTitled(projectsSection(page), project.title);
      await expect(card).toHaveCount(1);
      const link = card.getByRole('link', { name: 'Voir le détail' });
      await expect(link, `"Voir le détail" link in the card of "${project.title}"`).toHaveCount(1);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(`${SITE_WITH_UNUSUAL_RENDER_VALUES.origin}/fr/projets/${project.slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    }
  });

  test('the card of a featured project whose page declares render = 0, which Hugo reads as "never" and does not publish, has no "Voir le détail" link', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_UNUSUAL_RENDER_VALUES, siteDirectory);
    /* tests/fixtures/unusual-render-values/content/projets/montre-gousset.md declares
       [build] render = 0, an integer: Hugo publishes nothing at that project's address… */
    const response = await page.goto(`${SITE_WITH_UNUSUAL_RENDER_VALUES.origin}/fr/projets/montre-gousset/`);
    expect(response?.status()).toBe(404);
    /* …yet its card is still shown, with no link at all, not even an empty one. */
    await page.goto(`${SITE_WITH_UNUSUAL_RENDER_VALUES.origin}/fr/`);
    const card = cardTitled(projectsSection(page), 'Montre de gousset');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.locator('a')).toHaveCount(0);
  });

  test('the card of a featured project whose page declares render = "false" (a quoted string, not the boolean), which Hugo publishes, keeps its "Voir le détail" link, which opens that page', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_UNUSUAL_RENDER_VALUES, siteDirectory);
    /* tests/fixtures/unusual-render-values/content/projets/carillon-de-bureau.md declares
       [build] render = 'false', a string: Hugo reads render values case-sensitively and only the
       boolean false means 'never'; the string 'false' is a value it does not recognise, so it
       publishes the page as with 'always'. */
    await page.goto(`${SITE_WITH_UNUSUAL_RENDER_VALUES.origin}/fr/`);
    const card = cardTitled(projectsSection(page), 'Carillon de bureau');
    await expect(card).toHaveCount(1);
    const link = card.getByRole('link', { name: 'Voir le détail' });
    await expect(link, '"Voir le détail" link in the card of "Carillon de bureau"').toHaveCount(1);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(`${SITE_WITH_UNUSUAL_RENDER_VALUES.origin}/fr/projets/carillon-de-bureau/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Carillon de bureau');
  });
});

test.describe('featured project whose page declares a custom param named build: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a featured project whose page declares a custom param build = "2020", a text rather than a table, makes the site build fail, with an error message that says Hugo reserves build for its build options and names that project, without a template execution error after it', () => {
    /* tests/fixtures/build-param-as-text/content/projets/pendule-squelette.md sets no [build]
       options, but declares under [params] a custom param build = '2020'. Hugo reserves build for
       the page's build options: .Params.build holds the real [build] table, and a custom build param
       replaces it, so the theme cannot tell whether that page is published. Rather than a card
       guessed from that text, the person building the site must get a failure whose message
       names the build param, says Hugo reserves it, and names that project by its reference or
       path, whatever the rest of the wording, and no Go template execution error that would follow
       it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_BUILD_PARAM_AS_TEXT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the error message should name the build param').toMatch(/\bbuild\b/);
    expect(build.errors, 'the error message should say the build param is reserved').toMatch(/\breserve/i);
    expect(build.errors, 'the error message should name Hugo').toMatch(/\bHugo\b/);
    expect(build.errors, 'the error message should name the project').toContain('projets/pendule-squelette');
    expect(build.errors, 'no template execution error should follow the error message').not.toMatch(
      /execute of template failed|error calling/i,
    );
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

  test('the section "Projets sélectionnés" has, once and outside the cards, a "Tous les projets" link that opens the section holding the featured projects, at the site root and under /portfolio/', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_PROJECTS_IN_ANOTHER_SECTION, siteDirectory);
    const sites = [
      /* The example site, whose featured projects are in content/projets/ (title "Projets"),
         served at the root of its origin, then under a subpath (playwright.config.ts)… */
      { home: '/fr/', sectionAddress: '/fr/projets/', sectionTitle: 'Projets' },
      {
        home: `${EXAMPLE_SITE_UNDER_PORTFOLIO}fr/`,
        sectionAddress: `${EXAMPLE_SITE_UNDER_PORTFOLIO}fr/projets/`,
        sectionTitle: 'Projets',
      },
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
      const section = projectsSection(page);
      /* The arrow is decorative: the accessible name is the text alone. */
      const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toContainText('Tous les projets');
      await expect(link).toHaveAccessibleName('Tous les projets');
      /* It belongs to the section, not to a card. */
      await expect(section.getByRole('article').getByRole('link', { name: 'Tous les projets' })).toHaveCount(0);
      await link.click();
      await expect(page).toHaveURL(site.sectionAddress);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(site.sectionTitle);
    }
  });
});

test.describe('home page of another site, featuring a project at the content root', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" shows the card of a featured project that lives at the content root, outside any section, but no "Tous les projets" link, since no section holds that project', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT, siteDirectory);
    await page.goto(`${SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT.origin}/fr/`);
    const section = projectsSection(page);
    /* tests/fixtures/project-at-the-root/content/_index.md features 'pendule-murale', a page at the
       root of the content: the section and its card are still shown… */
    const card = cardTitled(section, 'Pendule murale');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: 'Voir le détail' })).toHaveCount(1);
    /* …but no link claims to list all the projects: there is no projects section to open, and the
       home page the visitor is on is not one. */
    await expect(section.getByRole('link', { name: 'Tous les projets' })).toHaveCount(0);
    await expect(section.getByText('Tous les projets')).toHaveCount(0);
  });

  test('on a phone, without the "Tous les projets" link, the first card of the section "Projets sélectionnés" is as far below the heading as it is below the link on a home page that has it', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT, siteDirectory);
    await page.setViewportSize(PHONE);
    /* From the bottom of an element's box (the link's ends with its underline) to the top of the
       first card's. */
    const spaceAboveFirstCard = async (element: Locator, firstCard: Locator) => {
      const [above, card] = await Promise.all([elementBox(element), elementBox(firstCard)]);
      return card.top - above.bottom;
    };
    /* The example site's home page has the link, below the heading and above the first card. */
    await page.goto('/fr/');
    await page.evaluate(() => document.fonts.ready);
    const sectionWithLink = projectsSection(page);
    const link = sectionWithLink.getByRole('link', { name: 'Tous les projets', exact: true });
    await expect(link).toBeVisible();
    const belowLink = await spaceAboveFirstCard(link, sectionWithLink.getByRole('article').first());
    /* This site's home page has no link: the first card comes right after the heading. */
    await page.goto(`${SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT.origin}/fr/`);
    await page.evaluate(() => document.fonts.ready);
    const section = projectsSection(page);
    await expect(section.getByRole('link', { name: 'Tous les projets' })).toHaveCount(0);
    const firstCard = section.getByRole('article').first();
    await expect(firstCard).toBeVisible();
    const belowHeading = await spaceAboveFirstCard(section.getByRole('heading', { level: 2 }), firstCard);
    expect(
      Math.abs(belowHeading - belowLink),
      `space from the heading to the first card without the link (${belowHeading.toFixed(1)} px) against the space from the link to the first card with it (${belowLink.toFixed(1)} px)`,
    ).toBeLessThanOrEqual(2);
  });
});

test.describe('home pages of other sites, featuring a project whose section has no published page', () => {
  /* Two ways for a section to have no published page: its _index.md declares render = 'never' in
     its cascade, so that its projects have no page either, or under a plain [build], so that its
     projects keep theirs. */
  const sites = [
    {
      site: SITE_WITH_AN_UNPUBLISHED_PROJECTS_SECTION,
      sectionPath: '/fr/carnets/',
      projectTitle: 'Pendule œil-de-bœuf',
      projectHasDetailLink: false,
    },
    {
      site: SITE_WITH_AN_UNPUBLISHED_SECTION_PAGE,
      sectionPath: '/fr/ebauches/',
      projectTitle: 'Horloge de gare',
      projectHasDetailLink: true,
    },
  ];
  const siteDirectories: string[] = [];
  test.beforeAll(() => {
    for (const { site } of sites) siteDirectories.push(buildSite(site));
  });
  test.afterAll(() => {
    for (const directory of siteDirectories) removeDirectory(directory);
  });

  test('the section "Projets sélectionnés" shows the card of a featured project whose section declares render = "never", in its cascade or in a plain [build], but no "Tous les projets" link, since that section has no published page', async ({
    page,
    context,
  }) => {
    for (const [index, { site }] of sites.entries()) {
      await serveSite(context, site, siteDirectories[index]);
    }
    for (const { site, sectionPath, projectTitle, projectHasDetailLink } of sites) {
      /* tests/fixtures/unpublished-projects-section/content/carnets/_index.md declares
         [cascade.build] render = 'never', tests/fixtures/unpublished-section-page/content/ebauches/_index.md
         [build] render = 'never': nothing is published at the section's address… */
      const sectionResponse = await page.goto(`${site.origin}${sectionPath}`);
      expect(sectionResponse?.status(), `status of ${site.origin}${sectionPath}`).toBe(404);
      await page.goto(`${site.origin}/fr/`);
      const section = projectsSection(page);
      /* …yet the home page still shows the section and the card of the project it features, with
         its "Voir le détail" link when the project's own page is published… */
      const card = cardTitled(section, projectTitle);
      await expect(card).toHaveCount(1);
      await expect(card).toBeVisible();
      await expect(card.getByRole('link', { name: 'Voir le détail' })).toHaveCount(projectHasDetailLink ? 1 : 0);
      /* …but no link claims to list all the projects, not even an empty one: it would lead nowhere. */
      await expect
        .soft(section.getByRole('link', { name: 'Tous les projets' }), `"Tous les projets" links on ${site.origin}/fr/`)
        .toHaveCount(0);
      await expect
        .soft(section.getByText('Tous les projets'), `"Tous les projets" texts on ${site.origin}/fr/`)
        .toHaveCount(0);
    }
  });
});

test.describe('home page of another site, featuring projects from two published sections', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_IN_TWO_SECTIONS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" shows the cards of featured projects from two different published sections, but no "Tous les projets" link, since no single section holds them all', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_PROJECTS_IN_TWO_SECTIONS, siteDirectory);
    const origin = SITE_WITH_PROJECTS_IN_TWO_SECTIONS.origin;
    /* tests/fixtures/projects-in-two-sections/content/_index.md features a project of projets/,
       then one of realisations/: both sections are published… */
    for (const sectionPath of ['/fr/projets/', '/fr/realisations/']) {
      const sectionResponse = await page.goto(`${origin}${sectionPath}`);
      expect(sectionResponse?.status(), `status of ${origin}${sectionPath}`).toBe(200);
    }
    await page.goto(`${origin}/fr/`);
    const section = projectsSection(page);
    /* …and the home page shows the card of each featured project… */
    for (const title of ['Restauration d’une pendule de cheminée', 'Coucou de chalet']) {
      const card = cardTitled(section, title);
      await expect(card).toHaveCount(1);
      await expect(card).toBeVisible();
    }
    /* …but no link claims to list all the projects, not even an empty one: either section would
       list only some of them. */
    await expect
      .soft(section.getByRole('link', { name: 'Tous les projets' }), `"Tous les projets" links on ${origin}/fr/`)
      .toHaveCount(0);
    await expect
      .soft(section.getByText('Tous les projets'), `"Tous les projets" texts on ${origin}/fr/`)
      .toHaveCount(0);
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

  test('a home page whose front matter features no projects shows no section "Projets sélectionnés": no such heading, no empty region, no project card', async ({
    page,
    context,
  }) => {
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

/* The horizontal edges of one line of a text, with the text it belongs to. */
type TextLine = { text: string; left: number; right: number };

/* A card's horizontal edges, and the horizontal edges of every line of every text it displays,
   each with the text it belongs to. */
async function cardAndTextLines(
  card: Locator,
): Promise<{ cardBox: { left: number; right: number }; lines: TextLine[] }> {
  return card.evaluate((article) => {
    const { left, right } = article.getBoundingClientRect();
    const found: TextLine[] = [];
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) found.push({ text, left: rect.left, right: rect.right });
      }
    }
    return { cardBox: { left, right }, lines: found };
  });
}

test.describe('home page of another site, featuring a project with long words', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_LONG_PROJECT_WORDS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a phone, the card of a featured project whose role, description and stack each hold a word wider than the card keeps them inside the card: no text of the card leaves it, and the page does not scroll horizontally', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_LONG_PROJECT_WORDS, siteDirectory);
    await page.setViewportSize(PHONE);
    await page.goto(`${SITE_WITH_LONG_PROJECT_WORDS.origin}/fr/`);
    await page.evaluate(() => document.fonts.ready);
    /* tests/fixtures/long-project-words/content/projets/pendule-aux-mots-longs.md declares a role,
       a description and a stack that each hold a single word, without a hyphen nor a space,
       wider than the card. */
    const longWords = {
      role: 'Restauratricedemouvementscompliquésetdecadransémaillésanciens',
      description: 'Penduleastronomiqueàquantièmeperpétueléquationdutempsetphasesdelalune',
      stack: 'Laitonrecuitdoréàlamercurepuisrecouvertdunvernisàlagommelaque',
    };
    const card = cardTitled(projectsSection(page), 'Pendule aux mots longs');
    await expect(card).toHaveCount(1);
    for (const [part, word] of Object.entries(longWords)) {
      await expect(card.getByText(word), `the ${part} holding "${word}"`).toBeVisible();
    }
    /* No text leaves the card: every line of every text it displays stays within its box. */
    const { cardBox, lines } = await cardAndTextLines(card);
    expect(lines.length, 'lines of text the card displays').toBeGreaterThan(0);
    for (const line of lines) {
      expect
        .soft(
          line.left,
          `left edge of a line of "${line.text}" against the card's left edge (${cardBox.left.toFixed(1)} px)`,
        )
        .toBeGreaterThanOrEqual(cardBox.left - 1);
      expect
        .soft(
          line.right,
          `right edge of a line of "${line.text}" against the card's right edge (${cardBox.right.toFixed(1)} px)`,
        )
        .toBeLessThanOrEqual(cardBox.right + 1);
    }
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect.soft(pageWidth, 'width of the page content').toBeLessThanOrEqual(PHONE.width);
  });
});

test.describe('home page of another site, featuring a project with a long title and no years', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_LONG_PROJECT_TITLE_WITHOUT_YEARS);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a phone, the card of a featured project without years lets its long title use the whole width of the card’s text: the wrapped title reaches the right end of the card’s text, where the description’s lines end, rather than stopping short where years would be', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_A_LONG_PROJECT_TITLE_WITHOUT_YEARS, siteDirectory);
    await page.setViewportSize(PHONE);
    await page.goto(`${SITE_WITH_A_LONG_PROJECT_TITLE_WITHOUT_YEARS.origin}/fr/`);
    await page.evaluate(() => document.fonts.ready);
    /* tests/fixtures/long-project-title-without-years/content/projets/pendule-sans-annees.md
       declares no years, and a title and a description that each hold a single word wider than
       the card. A word that wraps anywhere fills each of its lines but the last to less than one
       character short of the width it is given, whatever that width: how far right the title
       reaches shows the width it gets. */
    const title = 'Penduleàrépétitiondesquartsetàsonneriegrandeetpetitesansannées';
    const description =
      'Remise en marche d’une Penduleastronomiqueàquantièmeperpétueléquationdutempsetphasesdelalune de l’atelier.';
    const card = cardTitled(projectsSection(page), title);
    await expect(card).toHaveCount(1);
    const heading = card.getByRole('heading', { level: 3, name: title, exact: true });
    const descriptionText = card.getByText(description, { exact: true });
    await expect(descriptionText).toBeVisible();
    /* Wrapped: the title is laid out on more than one line. */
    const titleLines = await textLineBoxes(heading);
    expect(titleLines.length, `lines the title "${title}" is laid out on`).toBeGreaterThan(1);
    /* The right end of the card's text: where the description's paragraph, across the card,
       ends its lines. */
    const descriptionBox = await descriptionText.boundingBox();
    expect(descriptionBox, 'box of the description').not.toBeNull();
    const textRight = descriptionBox!.x + descriptionBox!.width;
    /* One character of the title, in its monospace font. */
    const titleCharacterWidth = await heading.evaluate((element) => {
      const range = document.createRange();
      const text = element.firstChild as Text;
      range.setStart(text, 0);
      range.setEnd(text, 1);
      return range.getBoundingClientRect().width;
    });
    const titleRight = boxAround(titleLines)?.right ?? Number.NaN;
    expect(
      titleRight,
      `right edge of the title's widest line, against the right end of the card's text (${textRight.toFixed(1)} px), less one character of the title (${titleCharacterWidth.toFixed(1)} px)`,
    ).toBeGreaterThan(textRight - titleCharacterWidth);
    /* The right end of the card's content, inside its padding and border: the description
       could stop short of it along with the title, if both lost the same width. */
    const cardContentRight = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.getBoundingClientRect().right -
        Number.parseFloat(style.paddingRight) -
        Number.parseFloat(style.borderRightWidth)
      );
    });
    expect(
      titleRight,
      `right edge of the title's widest line, against the right end of the card's content (${cardContentRight.toFixed(1)} px), less one character of the title (${titleCharacterWidth.toFixed(1)} px)`,
    ).toBeGreaterThan(cardContentRight - titleCharacterWidth);
  });
});

/* The three checks every featured project content error shares: the build fails, its message
   names the projects parameter, in the style of the clients messages, which name the clients
   parameter, and no Go template execution error follows it and buries it in technical jargon.
   The context, if any, starts each assertion message ("with an empty reference"). */
function expectProjectsBuildError(build: BuildAttempt, context = ''): void {
  const prefix = context ? `${context}, ` : '';
  expect(build.succeeded, `${prefix}the site build should fail`).toBe(false);
  expect(build.errors, `${prefix}the error message should name the projects parameter`).toMatch(
    /\bprojects\s+parameter\b/,
  );
  expect(build.errors, `${prefix}no template execution error should follow the error message`).not.toMatch(
    /execute of template failed|error calling/i,
  );
}

test.describe('featured project content errors: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a home page that features a page that does not exist makes the site build fail, with an error message that names the projects parameter and that page reference, without a template execution error after it', () => {
    /* tests/fixtures/featured-ref-without-page/content/_index.md features
       'projets/restauration-pendule', an existing page, then 'projets/sablier-introuvable', which
       no page answers. Rather than a section that silently drops that card, the person building
       the site must get a failure whose message names the projects parameter, in the style of the
       clients messages, which name the clients parameter, and the reference as written in the
       front matter, whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the missing page reference').toContain(
      'projets/sablier-introuvable',
    );
  });

  test('a home page whose projects parameter is a text instead of a list makes the site build fail, with an error message that names the projects parameter and says it must be a list, without a template execution error after it', () => {
    /* tests/fixtures/single-ref-instead-of-list/content/_index.md declares
       projects = 'projets/restauration-pendule', a text rather than a list of page references,
       although that page exists. Rather than a section built from that text, or a build that
       quietly treats it as a list of one, the person building the site must get a failure whose
       message names the projects parameter, in the style of the clients messages, which name the
       clients parameter, and says, on that same line, that it must be a list, whatever the rest
       of the wording, and no Go template execution error, about a range over a text, that would
       follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_PROJECTS_AS_TEXT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should say the projects parameter must be a list').toMatch(
      /\bprojects\s+parameter\b.*\blist\b/,
    );
  });

  test('a home page whose projects parameter is an empty text instead of a list makes the site build fail, with an error message that names the projects parameter and says it must be a list, without a template execution error after it', () => {
    /* tests/fixtures/empty-text-instead-of-list/content/_index.md declares projects = '', an
       empty text rather than a list of page references. Rather than a home page that quietly
       leaves out the projects section, as if the parameter were absent, the person building the
       site must get a failure whose message names the projects parameter, in the style of the
       clients messages, which name the clients parameter, and says, on that same line, that it
       must be a list, whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_PROJECTS_AS_AN_EMPTY_TEXT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should say the projects parameter must be a list').toMatch(
      /\bprojects\s+parameter\b.*\blist\b/,
    );
  });

  test('a home page whose projects parameter is false instead of a list makes the site build fail, with an error message that names the projects parameter and says it must be a list, without a template execution error after it', () => {
    /* tests/fixtures/false-instead-of-list/content/_index.md declares projects = false, a
       boolean rather than a list of page references. Rather than a home page that quietly
       leaves out the projects section, as if the parameter were absent, the person building the
       site must get a failure whose message names the projects parameter, in the style of the
       clients messages, which name the clients parameter, and says, on that same line, that it
       must be a list, whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_PROJECTS_AS_FALSE);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should say the projects parameter must be a list').toMatch(
      /\bprojects\s+parameter\b.*\blist\b/,
    );
  });

  test('a home page whose projects list holds tables instead of page references makes the site build fail, with an error message that names the projects parameter and the position of each table, without a template execution error after it', () => {
    /* tests/fixtures/table-instead-of-ref/content/_index.md declares projects as a list (so the
       check that projects is a list lets it through) whose second entry is a table,
       { path = 'projets/restauration-pendule' }, rather than a page reference, although that page
       exists, and so is its fourth, { path = 'projets/montre-grande-complication' }. Rather than a section that looks that table up as a page, the person building the
       site must get a failure whose message names the projects parameter, in the style of the
       clients messages, which name the clients parameter, whatever the rest of the wording, and
       no Go template execution error, about a function called with a table, that would follow it
       and bury it in technical jargon. The message also gives each table's position in the list,
       counted from 1, "entry 2" and "entry 4", as the clients messages do, so that whoever fills
       in the content finds them. Two tables, so that a hard-coded position does not pass. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_AS_MAP);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should give the position of the first table').toMatch(/\bentry\s+2\b/);
    expect(build.errors, 'the error message should give the position of the second table').toMatch(/\bentry\s+4\b/);
  });

  test('a home page whose projects list holds an empty or whitespace-only page reference makes the site build fail, with an error message that names the projects parameter and the position of the blank entry, without a template execution error after it', () => {
    /* tests/fixtures/empty-ref and tests/fixtures/whitespace-only-ref declare projects as a list
       of texts, so the checks on the list and on its entries let them through, but the second
       entry of one is '' and the third entry of the other, after two references, is '   ': a
       reference that names no page. Rather than a section with a card of whatever page such a
       reference happens to resolve to (the home page itself, for ''), the person building the
       site must get, in both cases, a failure whose message names the projects parameter of the
       front matter, in the style of the clients messages, which name the clients parameter,
       whatever the rest of the wording, and no Go template execution error, such as the one
       today's template raises when it looks up the parent of the page '' resolves to, that would
       follow it and bury it in technical jargon.
       The message also gives the position of the blank entry in the list, counted from 1
       ("entry 2", "entry 3"), as the clients messages do, so that whoever fills in the content
       finds it. Two fixtures, so that rejecting only the empty reference does not pass, and two
       positions, so that a hard-coded position does not pass. */
    const cases = [
      { name: 'an empty reference', site: SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF, position: /\bentry\s+2\b/ },
      {
        name: 'a whitespace-only reference',
        site: SITE_WITH_A_WHITESPACE_ONLY_FEATURED_PROJECT_REF,
        position: /\bentry\s+3\b/,
      },
    ];
    for (const { name, site, position } of cases) {
      const build = tryToBuildSite(site);
      expectProjectsBuildError(build, `with ${name}`);
      expect(build.errors, `with ${name}, the error message should give the position of the blank entry`).toMatch(
        position,
      );
    }
  });

  test('a home page whose projects list holds a page reference with leading or trailing whitespace makes the site build fail, with an error message, for each such reference, that names the projects parameter and that reference and says it has whitespace', () => {
    /* tests/fixtures/padded-ref/content/_index.md features 'projets/restauration-pendule ', with
       a trailing space, then "\tprojets/montre-grande-complication", with a leading tab: both
       pages exist, but Hugo does not trim the whitespace, so that it finds neither. A message
       that only says the page cannot be found would show the person building the site a
       reference that looks right, the whitespace being invisible in it: the message must also
       say that the reference has whitespace, on the same line as the projects parameter and that
       reference, whatever the rest of the wording. A trailing space and a leading tab, so that
       checking only one end, or only the space character, does not pass. */
    const build = tryToBuildSite(SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE);
    expectProjectsBuildError(build);
    for (const { name, reference } of [
      { name: 'a trailing space', reference: 'projets/restauration-pendule' },
      { name: 'a leading tab', reference: 'projets/montre-grande-complication' },
    ]) {
      expect(
        build.errors,
        `for the reference with ${name}, the error message should name the projects parameter and that reference and say it has whitespace`,
      ).toMatch(new RegExp(`^(?=.*\\bprojects\\s+parameter\\b)(?=.*${reference})(?=.*\\bwhitespace\\b).*$`, 'im'));
    }
  });

  test('a home page whose projects list holds page references with leading or trailing whitespace makes the site build fail, with an error message, for each such reference, that gives the position of that entry', () => {
    /* tests/fixtures/padded-ref/content/_index.md features 'projets/restauration-pendule ', with
       a trailing space, as its first entry, then "\tprojets/montre-grande-complication", with a
       leading tab, as its second. Besides the reference, whose whitespace is invisible in the
       message, the message must give the position of the entry in the list, counted from 1
       ("entry 1", "entry 2"), as the messages on blank entries do, so that whoever fills in the
       content finds it. The position is looked for on the same line as the reference it belongs
       to, whatever the rest of the wording; two positions, so that a hard-coded position does not
       pass. */
    const build = tryToBuildSite(SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE);
    expectProjectsBuildError(build);
    for (const { position, reference } of [
      { position: 1, reference: 'projets/restauration-pendule' },
      { position: 2, reference: 'projets/montre-grande-complication' },
    ]) {
      expect(
        build.errors,
        `for the reference ${reference}, the error message should give the position of that entry, entry ${position}`,
      ).toMatch(new RegExp(`^(?=.*\\bentry\\s+${position}\\b)(?=.*${escapedForRegExp(reference)}).*$`, 'im'));
    }
  });

  test('a home page whose projects list references the home page itself, as "/", makes the site build fail, with an error message that names the projects parameter and that entry, without a template execution error after it', () => {
    /* tests/fixtures/self-ref/content/_index.md features 'projets/restauration-pendule', then '/':
       a reference to the home page itself, which exists, so that the check for a page not found
       lets it through, but is no project. Rather than a section with a card of the home page, or
       the Go template execution error today's template raises when it looks up the parent of the
       home page, which has none, the person building the site must get a failure whose message
       names the projects parameter, in the style of the clients messages, which name the clients
       parameter, and the entry as written in the front matter, whatever the rest of the wording.
       The entry, a lone '/', is looked for on the message's line as a token of its own, between
       spaces, quotes or punctuation, so that the slashes of a file path do not pass for it. */
    const build = tryToBuildSite(SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the entry "/" as written in the front matter').toMatch(
      /\bprojects\s+parameter\b.*(?:^|[\s:«"'‘“(])\/(?=$|[\s»"'’”),.;])/m,
    );
  });

  test('a home page whose projects list references the home page itself, as ".", makes the site build fail, with an error message that names the projects parameter and that entry, without a template execution error after it', () => {
    /* tests/fixtures/dot-self-ref/content/_index.md features 'projets/restauration-pendule', then
       '.': the current page, that is the home page itself, written another way than '/'. It is no
       project either: the person building the site must get the same failure as for '/', whose
       message names the projects parameter, in the style of the clients messages, which name the
       clients parameter, and the entry as written in the front matter, whatever the rest of the
       wording, rather than a message that calls that page not found or a section with a card of
       the home page. The entry, a lone '.', is looked for on the message's line as a token of its
       own, between spaces, quotes or punctuation other than a dot, so that neither the dots of a
       file name nor a sentence's full stop pass for it, nor a full stop right after the entry
       for the entry followed by a full stop. */
    const build = tryToBuildSite(SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT_WRITTEN_AS_A_DOT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the entry "." as written in the front matter').toMatch(
      /\bprojects\s+parameter\b.*(?:^|[\s:«"'‘“(])\.(?=$|[\s»"'’”),;])/m,
    );
  });

  test('a home page whose projects list references a section page, such as "projets", the projects section itself, makes the site build fail, with an error message that names the projects parameter and that entry and says it is not a project, without a template execution error after it', () => {
    /* tests/fixtures/section-ref/content/_index.md features 'projets/restauration-pendule', then
       'projets': the example site's projects section, which exists, so that the check for a page
       not found lets it through, and is not the home page, so that the check for the home page
       lets it through too, but is a section page, no project. Rather than a section with a card
       of the projects section, the person building the site must get a failure whose message
       names the projects parameter, in the style of the clients messages, which name the clients
       parameter, the entry as written in the front matter, and says that it is "not a project",
       whatever the rest of the wording. The entry, 'projets', is looked for on the message's line
       as a token of its own, between spaces, quotes or punctuation other than a slash, so that a
       file path or another page reference under projets/ does not pass for it; "not a project"
       is looked for on that same line. */
    const build = tryToBuildSite(SITE_WITH_A_SECTION_AS_FEATURED_PROJECT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the entry "projets" as written in the front matter').toMatch(
      /\bprojects\s+parameter\b.*(?:^|[\s:«"'‘“(])projets(?=$|[\s»"'’”),.;])/m,
    );
    expect(build.errors, 'the error message should say that entry is not a project').toMatch(
      /\bprojects\s+parameter\b.*\bnot\s+a\s+project\b/im,
    );
  });

  test('a home page whose projects list references a taxonomy term page, such as "tags/horlogerie", the page of a tag a project carries, makes the site build fail, with an error message that names the projects parameter and that entry and says it is not a project, without a template execution error after it', () => {
    /* tests/fixtures/taxonomy-refs enables the tags taxonomy, which the example site disables,
       adds a project that carries the tag 'horlogerie', and its content/_index.md features
       'projets/restauration-pendule', then 'tags/horlogerie': the page of that tag, which exists,
       so that the check for a page not found lets it through, and is neither the home page nor a
       section page, so that those checks let it through too, but is a taxonomy term page, no
       project. Rather than a section with a card of that tag's page, the person building the site
       must get a failure whose message names the projects parameter, in the style of the clients
       messages, which name the clients parameter, the entry as written in the front matter, and
       says that it is "not a project", whatever the rest of the wording. The entry,
       'tags/horlogerie', is looked for on the message's line as a token of its own, between
       spaces, quotes or punctuation other than a slash, so that a longer path ending or starting
       with it does not pass for it; "not a project" is looked for on that same line. The same
       site also features 'tags', which the next test checks: since its own message says "not a
       project" too, both are looked for on the line that names this entry. */
    const build = tryToBuildSite(SITE_WITH_TAXONOMY_PAGES_AS_FEATURED_PROJECTS);
    expectProjectsBuildError(build);
    expect(
      build.errors,
      'the error message should name the entry "tags/horlogerie" as written in the front matter and say it is not a project',
    ).toMatch(
      /^(?=.*\bprojects\s+parameter\b)(?=.*(?:^|[\s:«"'‘“(])tags\/horlogerie(?=$|[\s»"'’”),.;]))(?=.*\bnot\s+a\s+project\b).*$/im,
    );
  });

  test('a home page whose projects list references a taxonomy page, such as "tags", the page listing every tag, makes the site build fail, with an error message that names the projects parameter and that entry and says it is not a project, without a template execution error after it', () => {
    /* Same site as the test above, whose content/_index.md also features, third, 'tags': the
       page listing every tag, which exists, so that the check for a page not found lets it
       through, and is neither the home page, nor a section page, nor a tag's own page, so that
       those checks let it through too, but is a taxonomy page, no project. Rather than a section
       with a card of that page, the person building the site must get a failure whose message
       names the projects parameter, in the style of the clients messages, which name the clients
       parameter, the entry as written in the front matter, and says that it is "not a project",
       whatever the rest of the wording. The entry, 'tags', is looked for on the message's line as
       a token of its own, between spaces, quotes or punctuation other than a slash, so that a
       path such as 'tags/horlogerie' does not pass for it; "not a project" is looked for on that
       same line, not on the line of 'tags/horlogerie'. */
    const build = tryToBuildSite(SITE_WITH_TAXONOMY_PAGES_AS_FEATURED_PROJECTS);
    expectProjectsBuildError(build);
    expect(
      build.errors,
      'the error message should name the entry "tags" as written in the front matter and say it is not a project',
    ).toMatch(
      /^(?=.*\bprojects\s+parameter\b)(?=.*(?:^|[\s:«"'‘“(])tags(?=$|[\s»"'’”),.;]))(?=.*\bnot\s+a\s+project\b).*$/im,
    );
  });

  test('a home page whose projects list references the 404 page, as "/404", makes the site build fail, with an error message that names the projects parameter and that entry and says it is not a project, without a template execution error after it', () => {
    /* tests/fixtures/error-page-ref/content/_index.md features 'projets/restauration-pendule', then
       '/404': the site's 404 page, which Hugo creates even without a 404 template, so that the
       check for a page not found lets it through, and is neither the home page, nor a section
       page, nor a taxonomy or term page, so that those checks let it through too, but is no
       project. Rather than a section with a card of the 404 page, the person building the site
       must get a failure whose message names the projects parameter, in the style of the clients
       messages, which name the clients parameter, the entry as written in the front matter, and
       says that it is "not a project", whatever the rest of the wording. The entry, '/404', is
       looked for on the message's line as a token of its own, between spaces, quotes or
       punctuation other than a slash, so that a longer path ending or starting with it does not
       pass for it; "not a project" is looked for on that same line. */
    const build = tryToBuildSite(SITE_WITH_THE_404_PAGE_AS_FEATURED_PROJECT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the entry "/404" as written in the front matter').toMatch(
      /\bprojects\s+parameter\b.*(?:^|[\s:«"'‘“(])\/404(?=$|[\s»"'’”),.;])/m,
    );
    expect(build.errors, 'the error message should say that entry is not a project').toMatch(
      /\bprojects\s+parameter\b.*\bnot\s+a\s+project\b/im,
    );
  });

  /* Both directions, each with the code of the home page's language: a French home page featuring
     a project that only has an English page, and the other way round. */
  const HOME_PAGES_FEATURING_AN_UNTRANSLATED_PROJECT = [
    {
      name: 'a French home page featuring an English-only project',
      site: SITE_WITH_A_FRENCH_HOME_FEATURING_AN_ENGLISH_ONLY_PROJECT,
      language: 'fr',
    },
    {
      name: 'an English home page featuring a French-only project',
      site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_A_FRENCH_ONLY_PROJECT,
      language: 'en',
    },
  ];

  test('a home page that features a project without a translation in its language makes the site build fail, with an error message that names the projects parameter and that language and gives a missing translation in that language as a possible cause, without a template execution error after it', () => {
    /* tests/fixtures/english-only-project features, on the French home page, a project that only
       has an English page; tests/fixtures/french-only-project features, on the English home page,
       a project that only has a French page. Rather than a section that drops that card, or one
       that shows the project in the other language, the person building the site must get, in
       both cases, a failure whose message names the projects parameter, in the style of the
       clients messages, which name the clients parameter, and the home page's language by its
       code, as written in the site's configuration and in the content file names (fr, en),
       whatever the rest of the wording, and no Go template execution error that would follow it
       and bury it in technical jargon.
       A message that only says the page cannot be found, or only blames an unpublished page (a
       draft, a future date, an expired page), would send the person building the site looking
       for a missing or unpublished file, while the project's file is right there, in the other
       language: the message must also name a missing translation (translation, translated…) as a
       possible cause, on the same line as the language code. The code is looked for as a word
       that no other word follows, so that the letters "en" or "fr" met as a word inside the
       message's prose, followed by more of the sentence, do not pass for the code. Both
       directions, so that a message naming a language written in the template does not pass. */
    for (const { name, site, language } of HOME_PAGES_FEATURING_AN_UNTRANSLATED_PROJECT) {
      const build = tryToBuildSite(site);
      expectProjectsBuildError(build, `with ${name}`);
      expect(build.errors, `with ${name}, the error message should name the home page's language`).toMatch(
        new RegExp(languageCodePattern(language), 'u'),
      );
      expect(
        build.errors,
        `with ${name}, the error message should give a missing translation in ${language} as a possible cause`,
      ).toMatch(new RegExp(`^(?=.*translat)(?=.*${languageCodePattern(language)}).*$`, 'imu'));
    }
  });

  /* Each bad entry the projects checks reject before looking its page up, or after finding a page
     that is no project, with the pattern of the line of its own error message, as the tests above
     find it: the position of the entry for a table, a blank or a padded reference, "not a project"
     for a page that is no project. The French home pages come from the fixtures of the tests above;
     the English one holds an entry of each kind, at positions 1 to 4. */
  const HOME_PAGES_WITH_BAD_PROJECT_ENTRIES = [
    {
      language: 'fr',
      sites: [
        {
          name: 'a French home page with a table',
          site: SITE_WITH_A_FEATURED_PROJECT_AS_MAP,
          linePattern: '\\bentry\\s+2\\b',
        },
        {
          name: 'a French home page with an empty reference',
          site: SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF,
          linePattern: '\\bentry\\s+2\\b',
        },
        {
          name: 'a French home page with a whitespace-only reference',
          site: SITE_WITH_A_WHITESPACE_ONLY_FEATURED_PROJECT_REF,
          linePattern: '\\bentry\\s+3\\b',
        },
        {
          name: 'a French home page with a padded reference',
          site: SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE,
          linePattern: '\\bentry\\s+1\\b',
        },
        {
          name: 'a French home page with a section page',
          site: SITE_WITH_A_SECTION_AS_FEATURED_PROJECT,
          linePattern: '\\bnot\\s+a\\s+project\\b',
        },
      ],
    },
    {
      language: 'en',
      sites: [
        {
          name: 'an English home page with a table',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: '\\bentry\\s+1\\b',
        },
        {
          name: 'an English home page with an empty reference',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: '\\bentry\\s+2\\b',
        },
        {
          name: 'an English home page with a padded reference',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: '\\bentry\\s+3\\b',
        },
        {
          name: 'an English home page with a section page',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: '\\bnot\\s+a\\s+project\\b',
        },
      ],
    },
  ];

  test("a home page whose projects list holds an entry that is not a reference, a blank one, a padded one, or one that references a page that is not a project makes the site build fail, with an error message that names the home page's language, for French home pages and for an English one", () => {
    /* A bilingual site has a home page per language, each with its own projects list: an error
       message that does not say which language's home page holds the bad entry leaves the person
       building the site to look for it in every content/_index.<language>.md file. The message
       for a page that cannot be found already names the home page's language by its code (fr,
       en); the messages for a table instead of a reference, a blank reference, a reference with
       whitespace at its start or end, and a reference to a page that is no project must name it
       too, each on its own line, whatever the rest of the wording. The code is looked for, as in
       the test above, as a word that no other word follows, on the line of each error message,
       found by the pattern of its kind, so that every one of these messages must name it. A
       French home page and an English one, so that a language written in the template does not
       pass; the English site holds the four kinds at once, at positions that tell their lines
       apart. */
    const builds = new Map<BuiltSite, BuildAttempt>();
    for (const { language, sites } of HOME_PAGES_WITH_BAD_PROJECT_ENTRIES) {
      for (const { name, site, linePattern } of sites) {
        if (!builds.has(site)) builds.set(site, tryToBuildSite(site));
        const build = builds.get(site)!;
        expectProjectsBuildError(build, `with ${name}`);
        expect(
          build.errors,
          `with ${name}, the error message on that entry should name the home page's language, ${language}`,
        ).toMatch(new RegExp(`^(?=.*${linePattern})(?=.*${languageCodePattern(language)}).*$`, 'imu'));
      }
    }
  });

  test('a home page that features a project whose page is a draft makes the production build fail, with an error message that names the projects parameter and that page reference and says the page may be unpublished: a draft, a future date or an expired page, without a template execution error after it', () => {
    /* tests/fixtures/draft-ref/content/_index.md features 'projets/restauration-pendule', then
       'projets/pendule-portique', whose page exists but declares draft = true, so that the
       production build leaves it out. A message that only says the page cannot be found would send
       the person building the site looking for a missing file, while the file is right there: the
       error message must name the projects parameter and the reference as written in the front
       matter, say that the page may be unpublished, and name the three reasons a production build
       leaves a page out — a draft, a date in the future (future, scheduled) and an expiry date
       passed (expired) — whatever the rest of the wording, and no Go template execution error
       must follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_DRAFT_FEATURED_PROJECT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the unpublished page reference').toContain(
      'projets/pendule-portique',
    );
    expect(build.errors, 'the error message should say the page may be unpublished').toMatch(/publi/i);
    expect(build.errors, 'the error message should name a draft as a possible reason').toMatch(/\bdraft\b/i);
    expect(build.errors, 'the error message should name a future date as a possible reason').toMatch(
      /future|scheduled/i,
    );
    expect(build.errors, 'the error message should name an expired page as a possible reason').toMatch(/expir/i);
  });
});
