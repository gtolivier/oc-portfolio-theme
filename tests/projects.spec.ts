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
  SITE_WITH_A_PROJECT_IN_AN_UNPUBLISHED_SUBSECTION_OF_ANOTHER_SECTION,
  SITE_WITH_PROJECTS_IN_TWO_SECTIONS,
  SITE_WITH_PROJECTS_IN_A_SUBSECTION,
  SITE_WITH_PROJECTS_IN_THE_SECTION_AND_A_SUBSECTION,
  SITE_WITH_PROJECTS_IN_THE_CONFIGURED_SECTION,
  SITE_WITH_A_PROJECT_OUTSIDE_THE_CONFIGURED_SECTION,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_AS_A_NUMBER,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_AS_A_LIST,
  SITE_WITH_AN_EMPTY_PROJECTS_SECTION_PARAM,
  SITE_WITH_A_WHITESPACE_ONLY_PROJECTS_SECTION_PARAM,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_TRAILING_SPACE,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_LEADING_TAB,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_AS_A_NUMBER_AND_PROJECTS_ELSEWHERE,
  SITE_WITH_AN_EMPTY_PROJECTS_SECTION_PARAM_AND_PROJECTS_ELSEWHERE,
  SITE_WITH_A_PADDED_PROJECTS_SECTION_PARAM_AND_PROJECTS_ELSEWHERE,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_NO_SECTION_AND_PROJECTS_ELSEWHERE,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_LEADING_TO_A_SECTION_WITHOUT_NAMING_IT,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_LEADING_TO_A_SECTION_THROUGH_A_PATH,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_A_SUBSECTION_AND_ITS_PROJECTS,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_LEADING_SLASH,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_TRAILING_SLASH,
  SITE_WITH_A_CAPITALIZED_PROJECTS_SECTION_PARAM_AND_ITS_PROJECTS,
  SITE_WITH_PROJECTS_AS_TEXT,
  SITE_WITH_AN_ENGLISH_HOME_WITH_PROJECTS_AS_TEXT,
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
  SITE_WITH_AN_ENGLISH_HOME_FEATURING_A_BUILD_PARAM_AS_TEXT,
  SITE_WITH_A_PROJECT_STACK_AS_A_TEXT,
  SITE_WITH_PROJECT_STACKS_AS_AN_EMPTY_TEXT_AND_FALSE,
  SITE_WITH_A_PROJECT_STACK_LEFT_BLANK_IN_YAML,
  SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
  SITE_WITH_PROJECTS_UNDER_THE_HERO,
  SITE_WITH_PROJECTS_OF_ONE_KIND_PER_LANGUAGE,
  SITE_WITH_PROJECTS_ORDERED_BY_WEIGHT,
  SITE_WITH_A_SUBSECTION_OF_THE_PROJECTS_SECTION_WITH_A_CASCADED_KIND,
  SITE_WITH_A_SUBSECTION_OF_AN_UNWRITTEN_PROJECTS_LIST,
  SITE_WITH_PROJECTS_LISTED_WITHOUT_WRITTEN_PAGES,
  SITE_WITH_PROJECTS_WITHOUT_A_VALID_KIND,
  SITE_WITH_A_KINDLESS_PROJECT_IN_THE_CONFIGURED_SECTION,
  SITE_WITH_A_KINDLESS_PROJECT_OUTSIDE_THE_CONFIGURED_SECTION,
  SITE_WITH_LISTED_PROJECT_STACKS_AS_A_TEXT,
  SITE_WITH_AN_UNRENDERED_HOME_FEATURING_A_PROJECT_STACK_AS_A_TEXT,
  SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_NO_SECTION_AND_UNRENDERED_HOME_PAGES,
  SITE_WITH_A_PROJECTS_LIST_WITHOUT_CONTACT_INTRO,
  SITE_WITH_HOME_PAGES_WITHOUT_CONTACT_INTRO,
  SITE_WITH_A_SECTION_SETTING_A_CONTACT_INTRO,
  SITE_WITH_SHORT_PROJECTS_ONLY_AND_CONTACT,
  SITE_WITH_AN_EMPTY_PROJECTS_LIST_AND_CONTACT,
  SITE_WITH_ENGAGEMENTS_ONLY_AND_CONTACT,
  TEMPLATE_EXECUTION_ERROR,
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
import { displayedPieces, displayedText, effectiveOpacity } from './helpers/text-on-screen';
import { tabUntilFocused } from './helpers/keyboard';
import { stopClockBeforeLoad } from './helpers/clock';
import { DELAY_AFTER_MOVE_MS, moveToScreenOfDensity } from './helpers/screen-density';

/* The projects the example site's French home page features, in the order its front matter lists
   them (params.projects, page references to content/projects/<slug>). The order is neither
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
   English pages (content/projects/<page>.en.md) declare, each different from the French one. Their
   English pages live in the projects/ section's English address, /en/projects/<slug>/, where the
   slug is the page's file name unless its front matter sets one: horloge-astronomique's English
   page sets slug = 'astronomical-clock'. */
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
    slug: 'astronomical-clock',
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

/* The contact section of the page's main content: a region named by its title, as on the home
   page and a project page. */
function contactSection(page: Page): Locator {
  return page.getByRole('main').getByRole('region', { name: 'Contact', exact: true });
}

/* The address the example site's contact form posts to: its contactAction site param
   (exampleSite/hugo.toml). */
const CONTACT_ACTION = '/api/contact';

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

/* The pattern, for a RegExp, of the position the projects error messages give an entry of the
   list, counted from 1 ("entry 1", "entry 2"). */
function entryPositionPattern(position: number): string {
  return `\\bentry\\s+${position}\\b`;
}

/* The pattern, for a RegExp, of the projects error message on a page that is no project. */
const NOT_A_PROJECT_PATTERN = '\\bnot\\s+a\\s+project\\b';

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
   ::after pseudo-elements of it and its descendants, read as displayedText reads them — hidden
   elements excluded, each with its text color and the background colors behind it, nearest
   first. */
async function displayedTexts(root: Locator): Promise<{ text: string; color: string; backgrounds: string[] }[]> {
  const pieces = await displayedPieces(root);
  return root.evaluate((rootElement, pieces) => {
    const elements = [rootElement, ...Array.from(rootElement.querySelectorAll('*'))];
    /* As backgroundChain, inside the page. */
    const chainOf = (el: Element) => {
      const chain: string[] = [];
      for (let current: Element | null = el; current; current = current.parentElement)
        chain.push(getComputedStyle(current).backgroundColor);
      return chain;
    };
    return pieces.flatMap(({ text, element, pseudo }) => {
      const el = elements[element];
      const style = getComputedStyle(el, pseudo);
      const shown = pseudo ? text.trim() : text.replace(/\s+/g, ' ').trim();
      if (!shown) return [];
      return [
        {
          text: pseudo ? `${pseudo} ${shown}` : shown,
          color: style.color,
          backgrounds: pseudo ? [style.backgroundColor, ...chainOf(el)] : chainOf(el),
        },
      ];
    });
  }, pieces);
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
    /* tests/fixtures/other-projects/content/projects/barometre-mercure.md declares no [params]. */
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
    /* tests/fixtures/other-projects/content/projects/chronometre-marine.md declares
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
    /* In tests/fixtures/projects-without-published-pages/content/projects/, horloge-comtoise.md
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
    /* In tests/fixtures/unusual-render-values/content/projects/, horloge-a-poids.md declares
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
    /* tests/fixtures/unusual-render-values/content/projects/montre-gousset.md declares
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
    /* tests/fixtures/unusual-render-values/content/projects/carillon-de-bureau.md declares
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

  test('a featured project whose page declares a custom param build = "2020", a text rather than a table, makes the site build fail, with an error message that says the theme reads the page’s build param as Hugo’s build options (the [build] front matter) and names that project, without a template execution error after it', () => {
    /* tests/fixtures/build-param-as-text/content/projects/pendule-squelette.md sets no [build]
       options, but declares under [params] a custom param build = '2020'. The theme reads the
       page's build param as Hugo's build options, the [build] front matter: .Params.build holds the
       real [build] table, and a custom build param replaces it, so the theme cannot tell whether
       that page is published. Rather than a card guessed from that text, the person building the
       site must get a failure whose message names the build param, says the theme reads it as
       Hugo's build options, and names that project by its reference or path, whatever the rest of
       the wording, and no Go template execution error that would follow it and bury it in
       technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_BUILD_PARAM_AS_TEXT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the error message should name the build param').toMatch(/\bbuild\b/);
    expect(build.errors, 'the error message should say the theme reads build as Hugo’s build options').toMatch(
      /\btheme\b/,
    );
    expect(build.errors, 'the error message should name Hugo').toMatch(/\bHugo\b/);
    expect(build.errors, 'the error message should name the project').toContain('projects/pendule-squelette');
    expect(build.errors, 'no template execution error should follow the error message').not.toMatch(
      TEMPLATE_EXECUTION_ERROR,
    );
  });

  test("a featured project whose page declares a custom param build that is not a table makes the site build fail with an error message that names the home page's language, for a French home page and for an English one", () => {
    /* A bilingual site has a home page per language, each with its own featured projects, and a
       project page per language: a message saying a featured project declares a custom build
       param that does not say which language's home page features it leaves the person building
       the site to look for it in every content/_index.<language>.md file and every translation of
       that project. The other messages on the entries of the projects list already name the home
       page's language by its code (fr, en); this one must name it too, whatever the rest of the
       wording. The French home page comes from the fixture of the test of this message above,
       tests/fixtures/build-param-as-text/content; the English one, from
       tests/fixtures/english-home-year-param/content, features an English-only project whose
       page makes the same mistake. The message, one line naming the build param and the project,
       must be there and name, on that line, the home page's language, looked for, as in the
       other projects' tests, as a word that no other word follows. A French home page and an
       English one, so that a language written in the template does not pass. */
    const cases: { name: string; site: BuiltSite; language: string }[] = [
      {
        name: 'a French home page featuring a project with a build param as a text',
        site: SITE_WITH_A_BUILD_PARAM_AS_TEXT,
        language: 'fr',
      },
      {
        name: 'an English home page featuring a project with a build param as a text',
        site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_A_BUILD_PARAM_AS_TEXT,
        language: 'en',
      },
    ];
    for (const { name, site, language } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      expect(build.errors, `with ${name}, no template execution error should follow the error message`).not.toMatch(
        TEMPLATE_EXECUTION_ERROR,
      );
      const messages = build.errors
        .split('\n')
        .filter((line) => /\bbuild\b/.test(line) && line.includes('projects/pendule-squelette'));
      expect(
        messages,
        `with ${name}, one error message naming the build param and the project, in:\n${build.errors}`,
      ).toHaveLength(1);
      expect(
        messages.filter((line) => !new RegExp(languageCodePattern(language), 'u').test(line)),
        `with ${name}, build param error messages that do not name the home page's language, ${language}`,
      ).toEqual([]);
    }
  });
});

test.describe('featured project whose page writes its stack as a text: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a featured project whose page writes its stack as a text rather than a list makes the site build fail, with an error message that names that project and says its stack must be a list, without a template execution error after it', () => {
    /* tests/fixtures/card-materials-as-text/content/projects/lanterne-forgee.md, a project the
       French home page features, writes its stack under [params] as a single text,
       'Laiton, Acier', rather than a list of entries: joining a text in a Go template may raise
       an execution error, or none, and the card would show the text as it is. Rather than that,
       the person building the site must get a failure whose message, on one line, is about the
       featured projects, names that project by its reference and says its stack must be a list,
       whatever the rest of the wording, and no Go template execution error that would follow it
       and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_PROJECT_STACK_AS_A_TEXT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const messages = build.errors
      .split('\n')
      .filter((line) => line.includes('projects/lanterne-forgee') && /\bstack\b.*\blist\b/.test(line));
    expect(
      messages,
      `one error message naming the project and saying its stack must be a list, in:\n${build.errors}`,
    ).toHaveLength(1);
    expect(messages[0], 'the error message should be about the featured projects').toMatch(/\bprojects\b(?!\/)/);
    expect(build.errors, 'no template execution error should follow the error message').not.toMatch(
      TEMPLATE_EXECUTION_ERROR,
    );
  });
});

test.describe('featured projects whose pages write their stack as an empty text or as false: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('featured projects whose pages write their stack as an empty text or as the boolean false rather than a list make the site build fail, with, for each, an error message that names that project and says its stack must be a list', () => {
    /* tests/fixtures/materials-left-blank-or-false/content/projects/cadran-solaire.md and
       girouette-cuivre.md, two projects the French home page features, write their stack under
       [params] as an empty text, '', and as the boolean false, rather than a list of entries:
       Go templates read both as an empty value, so the card would silently show no stack. Like
       a stack written as a text, each must instead make the build fail with a message, on one
       line, about the featured projects, that names the project by its reference and says its
       stack must be a list, whatever the rest of the wording. */
    const build = tryToBuildSite(SITE_WITH_PROJECT_STACKS_AS_AN_EMPTY_TEXT_AND_FALSE);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    for (const project of ['projects/cadran-solaire', 'projects/girouette-cuivre']) {
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(project) && /\bstack\b.*\blist\b/.test(line));
      expect(
        messages,
        `one error message naming ${project} and saying its stack must be a list, in:\n${build.errors}`,
      ).toHaveLength(1);
      expect(messages[0], `the error message about ${project} should be about the featured projects`).toMatch(
        /\bprojects\b(?!\/)/,
      );
    }
  });
});

test('a featured project whose page, written with a YAML front matter, leaves its stack blank (stack: with no value) does not make the site build fail, and gets a card like a project without a stack: its title and description, no stack text, no empty slot for it', async ({
  page,
  context,
}) => {
  /* tests/fixtures/materials-left-unset-in-yaml/content/projects/sablier-chapelle.md, a project
     the French home page features, writes its front matter in YAML and leaves its stack: line
     without a value, which YAML reads as null. Unlike an empty text or false in TOML, the person
     who wrote it left the field unfilled: the site must build, and the card must show the
     project as if its page declared no stack at all. */
  const build = tryToBuildSite(SITE_WITH_A_PROJECT_STACK_LEFT_BLANK_IN_YAML);
  expect(build.succeeded, `the site build should succeed, but Hugo reported:\n${build.errors}`).toBe(true);
  const siteDirectory = buildSite(SITE_WITH_A_PROJECT_STACK_LEFT_BLANK_IN_YAML);
  try {
    await serveSite(context, SITE_WITH_A_PROJECT_STACK_LEFT_BLANK_IN_YAML, siteDirectory);
    await page.goto(`${SITE_WITH_A_PROJECT_STACK_LEFT_BLANK_IN_YAML.origin}/fr/`);
    const title = 'Sablier de chapelle';
    const description = 'Sablier de chapelle en verre soufflé, monture de chêne ciré et sable de marbre tamisé.';
    const card = cardTitled(projectsSection(page), title);
    await expect(card).toHaveCount(1);
    await expect(card.getByText(description, { exact: true })).toHaveRole('paragraph');
    /* Outside links (the link to the project's page has its own text), the title and the
       description are all the card shows: no stack text, no separator left alone… */
    const textOutsideLinks = () =>
      card.evaluate((article) => {
        const copy = article.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('a').forEach((link) => link.remove());
        return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      });
    await expect.poll(textOutsideLinks).toBe(`${title} ${description}`);
    /* …and no text element left empty, or holding only whitespace, where the stack would go. */
    const textElements = card.locator('p, span, li, dt, dd, time, small, strong, em, h1, h2, h3, h4, h5, h6');
    await expect(textElements.filter({ hasNotText: /\S/ })).toHaveCount(0);
  } finally {
    removeDirectory(siteDirectory);
  }
});

test.describe('home pages of the example site, served at the site root and under /portfolio/', () => {
  test('the section "Projets sélectionnés" has, once and outside the cards, a "Tous les projets" link that opens the section holding the featured projects, at the site root and under /portfolio/', async ({
    page,
  }) => {
    /* The example site, whose featured projects are in content/projects/ (title "Projets"),
       served at the root of its origin, then under a subpath (playwright.config.ts), so that an
       address written from the root cannot pass. */
    const sites = [
      { home: '/fr/', sectionAddress: '/fr/projets/', sectionTitle: 'Projets' },
      {
        home: `${EXAMPLE_SITE_UNDER_PORTFOLIO}fr/`,
        sectionAddress: `${EXAMPLE_SITE_UNDER_PORTFOLIO}fr/projets/`,
        sectionTitle: 'Projets',
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

test('the projects section’s page shows, in each language, the section’s title as its page heading and the section’s description as an intro paragraph', async ({
  page,
}) => {
  /* The title and description of exampleSite/content/projects/_index.md and _index.en.md. */
  const sections = [
    {
      address: '/fr/projets/',
      title: 'Projets',
      description: 'Pendules, régulateurs et complications imaginaires, restaurés ou conçus pour la démonstration.',
    },
    {
      address: '/en/projects/',
      title: 'Projects',
      description: 'Imaginary clocks, regulators and complications, restored or designed for the demo.',
    },
  ];
  for (const section of sections) {
    await page.goto(section.address);
    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText(section.title);
    const intro = main.getByText(section.description, { exact: true });
    await expect(intro).toHaveCount(1);
    await expect(intro).toBeVisible();
    await expect(intro).toHaveRole('paragraph');
  }
});

/* Whether the element sits under the heading in the page's outline: it comes after the heading,
   and no heading of the same or a higher rank (a lower or equal level) comes between them. */
async function isUnderHeading(heading: Locator, element: Locator): Promise<boolean> {
  const target = await element.elementHandle();
  return heading.evaluate((start, end) => {
    if (!end) return false;
    const levelOf = (node: Element) => Number(node.getAttribute('aria-level') ?? node.tagName.slice(1));
    const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (!follows(start, end)) return false;
    const level = levelOf(start);
    return !Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).some(
      (other) =>
        other !== start &&
        other !== end &&
        !other.contains(end) &&
        follows(start, other) &&
        follows(other, end) &&
        levelOf(other) <= level,
    );
  }, target);
}

test('the projects section’s page shows, in each language, a short project (params.kind = "short") under the short-projects heading, with its title, its description and its stack joined by " · "', async ({
  page,
}) => {
  /* exampleSite/content/projects/regulateur-noyer.md and .en.md declare kind = 'short' under
     [params]; their title, description and stack are those below. */
  const sections = [
    {
      address: '/fr/projets/',
      groupHeading: 'Projets courts & interactifs',
      title: 'Régulateur de parquet en noyer',
      description: 'Régulateur à balancier compensé, logé dans une caisse en noyer massif sculptée à la main.',
      stack: ['Noyer', 'Invar', 'Laiton'],
    },
    {
      address: '/en/projects/',
      groupHeading: 'Short & interactive projects',
      title: 'Walnut floor regulator',
      description: 'A regulator with a compensated pendulum, housed in a hand-carved solid walnut case.',
      stack: ['Walnut', 'Invar', 'Brass'],
    },
  ];
  for (const section of sections) {
    await page.goto(section.address);
    const main = page.getByRole('main');
    const groupHeading = main.getByRole('heading', { level: 2, name: section.groupHeading, exact: true });
    await expect(groupHeading, `on ${section.address}, the short-projects heading`).toHaveCount(1);
    await expect(groupHeading).toBeVisible();
    const projectHeading = main.getByRole('heading', { level: 3, name: section.title, exact: true });
    await expect(projectHeading, `on ${section.address}, the project's title`).toHaveCount(1);
    await expect(projectHeading).toBeVisible();
    expect(
      await isUnderHeading(groupHeading, projectHeading),
      `on ${section.address}, the project's title is under the short-projects heading`,
    ).toBe(true);
    for (const [name, text] of [
      ['description', section.description],
      ['stack', section.stack.join(' · ')],
    ] as const) {
      const line = main.getByText(text, { exact: true });
      await expect(line, `on ${section.address}, the project's ${name}, shown once`).toHaveCount(1);
      await expect(line).toBeVisible();
      expect(
        await isUnderHeading(projectHeading, line),
        `on ${section.address}, the project's ${name} is under its title`,
      ).toBe(true);
    }
  }
});

test('the projects section’s page shows, in each language, an engagement (params.kind = "engagement") under the engagements heading, with its title, its years, its mode and its duration', async ({
  page,
}) => {
  /* exampleSite/content/projects/restauration-pendule.md and .en.md declare kind = 'engagement'
     under [params]; their title, years, mode and duration are those below. The years, mode and
     duration are each looked for as part of a text, so that they may share a line or not. */
  const sections = [
    {
      address: '/fr/projets/',
      groupHeading: 'Missions & applications métier',
      title: 'Restauration d’une pendule de cheminée',
      years: '2019 – 2020',
      mode: 'Forfait',
      duration: '14 mois',
    },
    {
      address: '/en/projects/',
      groupHeading: 'Engagements & business applications',
      title: 'Restoration of a mantel clock',
      years: '2019 – 2020',
      mode: 'Fixed-price',
      duration: '14 months',
    },
  ];
  for (const section of sections) {
    await page.goto(section.address);
    const main = page.getByRole('main');
    const groupHeading = main.getByRole('heading', { level: 2, name: section.groupHeading, exact: true });
    await expect(groupHeading, `on ${section.address}, the engagements heading`).toHaveCount(1);
    await expect(groupHeading).toBeVisible();
    const projectHeading = main.getByRole('heading', { level: 3, name: section.title, exact: true });
    await expect(projectHeading, `on ${section.address}, the engagement's title`).toHaveCount(1);
    await expect(projectHeading).toBeVisible();
    expect(
      await isUnderHeading(groupHeading, projectHeading),
      `on ${section.address}, the engagement's title is under the engagements heading`,
    ).toBe(true);
    for (const [name, text] of [
      ['years', section.years],
      ['mode', section.mode],
      ['duration', section.duration],
    ] as const) {
      const line = main.getByText(text);
      await expect(line, `on ${section.address}, the engagement's ${name}, shown once`).toHaveCount(1);
      await expect(line).toBeVisible();
      expect(
        await isUnderHeading(projectHeading, line),
        `on ${section.address}, the engagement's ${name} is under its title`,
      ).toBe(true);
    }
  }
});

test('the projects section’s page lists, in each language, an engagement’s parts ([[params.parts]]) under its description, in their front-matter order, each with its name and its description', async ({
  page,
}) => {
  /* exampleSite/content/projects/restauration-pendule.md and .en.md give the engagement the
     description and the [[params.parts]] below, in that order. Each item is checked to hold the
     part's name and description, whatever separates them. */
  const sections = [
    {
      address: '/fr/projets/',
      title: 'Restauration d’une pendule de cheminée',
      description:
        'Remise en marche d’une pendule Empire en bronze doré : mouvement nettoyé, suspension refaite, cadran retouché.',
      parts: [
        { name: 'Mouvement à sonnerie', description: 'Démontage, nettoyage et huilage des rouages et du barillet.' },
        { name: 'Suspension du balancier', description: 'Remplacement du fil de soie et réglage du battement.' },
        { name: 'Émail du cadran', description: 'Reprise des chiffres effacés et du vernis fendillé.' },
      ],
    },
    {
      address: '/en/projects/',
      title: 'Restoration of a mantel clock',
      description:
        'An Empire gilt-bronze clock brought back to life: movement cleaned, suspension rebuilt, dial touched up.',
      parts: [
        { name: 'Striking movement', description: 'Wheels and barrel taken apart, cleaned and oiled.' },
        { name: 'Pendulum suspension', description: 'Silk thread replaced and beat adjusted.' },
        { name: 'Dial enamel', description: 'Worn numerals restored and crazed varnish redone.' },
      ],
    },
  ];
  for (const section of sections) {
    await page.goto(section.address);
    const main = page.getByRole('main');
    const projectHeading = main.getByRole('heading', { level: 3, name: section.title, exact: true });
    await expect(projectHeading, `on ${section.address}, the engagement's title`).toHaveCount(1);
    const list = main.getByRole('list').filter({ hasText: section.parts[0].name });
    await expect(list, `on ${section.address}, the list of the engagement's parts`).toHaveCount(1);
    await expect(list).toBeVisible();
    const items = list.getByRole('listitem');
    await expect(items, `on ${section.address}, one list item per part`).toHaveCount(section.parts.length);
    for (const [index, part] of section.parts.entries()) {
      const item = items.nth(index);
      await expect(item, `on ${section.address}, item ${index + 1} gives part ${index + 1}'s name`).toContainText(
        part.name,
      );
      await expect(
        item,
        `on ${section.address}, item ${index + 1} gives part ${index + 1}'s description`,
      ).toContainText(part.description);
    }
    expect(
      await isUnderHeading(projectHeading, list),
      `on ${section.address}, the list of parts is under the engagement's title`,
    ).toBe(true);
    const description = main.getByText(section.description, { exact: true });
    await expect(description, `on ${section.address}, the engagement's description, shown once`).toHaveCount(1);
    await expect(description).toBeVisible();
    expect(
      await isUnderHeading(projectHeading, description),
      `on ${section.address}, the engagement's description is under its title`,
    ).toBe(true);
    const descriptionHandle = await description.elementHandle();
    expect(
      await list.evaluate(
        (parts, text) => !!text && (text.compareDocumentPosition(parts) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        descriptionHandle,
      ),
      `on ${section.address}, the list of parts comes after the engagement's description`,
    ).toBe(true);
  }
});

test('the projects section’s page links, in each language, each project’s title to that project’s own page in the same language, for a short project and for an engagement', async ({
  page,
}) => {
  /* exampleSite/content/projects/regulateur-noyer.md (kind = 'short') and
     restauration-pendule.md (kind = 'engagement'), each with an .en.md translation; their slug
     is their file name. */
  const sections = [
    {
      address: '/fr/projets/',
      projects: [
        { title: 'Régulateur de parquet en noyer', address: '/fr/projets/regulateur-noyer/' },
        { title: 'Restauration d’une pendule de cheminée', address: '/fr/projets/restauration-pendule/' },
      ],
    },
    {
      address: '/en/projects/',
      projects: [
        { title: 'Walnut floor regulator', address: '/en/projects/regulateur-noyer/' },
        { title: 'Restoration of a mantel clock', address: '/en/projects/restauration-pendule/' },
      ],
    },
  ];
  for (const section of sections) {
    for (const project of section.projects) {
      await page.goto(section.address);
      const main = page.getByRole('main');
      const projectHeading = main.getByRole('heading', { level: 3, name: project.title, exact: true });
      await expect(projectHeading, `on ${section.address}, the title of ${project.title}`).toHaveCount(1);
      const link = projectHeading.getByRole('link', { name: project.title, exact: true });
      await expect(link, `on ${section.address}, the link in the title of ${project.title}`).toHaveCount(1);
      await expect(link).toBeVisible();
      const [response] = await Promise.all([
        page.waitForResponse(
          (candidate) => candidate.request().isNavigationRequest() && candidate.request().frame() === page.mainFrame(),
        ),
        link.click(),
      ]);
      expect(response.status(), `status of the page ${project.title}’s link opens`).toBe(200);
      await expect(page).toHaveURL(project.address);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(project.title);
    }
  }
});

test('the projects section’s page shows, in each language, the site’s author and its footer note above the page heading', async ({
  page,
}) => {
  /* The author ([params] author) and the footer note of each language ([languages.<lang>.params]
     footerNote) of exampleSite/hugo.toml. Both are looked for in the main content, so that the
     footer, which shows them too, does not count; each must end above the page heading,
     whatever separates them. */
  const author = 'Jean Exemple';
  const sections = [
    { address: '/fr/projets/', footerNote: 'Horloger de démonstration' },
    { address: '/en/projects/', footerNote: 'Sample clockmaker' },
  ];
  for (const section of sections) {
    await page.goto(section.address);
    const main = page.getByRole('main');
    const heading = main.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    const headingBox = (await heading.boundingBox())!;
    for (const [name, text] of [
      ['site’s author', author],
      ['footer note', section.footerNote],
    ] as const) {
      const line = main.getByText(text);
      await expect(line, `on ${section.address}, the main content should show the ${name} once`).toHaveCount(1);
      await expect(line).toBeVisible();
      const lineBox = (await line.boundingBox())!;
      /* Compared with a 0.5 px tolerance: rendered box positions may carry sub-pixel rounding. */
      expect(
        lineBox.y + lineBox.height,
        `on ${section.address}, bottom of the ${name} against the top of the page heading (${headingBox.y} px)`,
      ).toBeLessThanOrEqual(headingBox.y + 0.5);
    }
  }
});

test('the line above the projects section’s page heading shows, in each language, the "//" marker before the site’s author and its footer note, while assistive technologies get the author and the footer note alone', async ({
  page,
}) => {
  /* The author ([params] author) and the footer note of each language ([languages.<lang>.params]
     footerNote) of exampleSite/hugo.toml. The line is the paragraph of the main content that
     gives the author: the footer, which shows it too, does not count. Whatever separates the
     author from the footer note, it holds no letter and no slash. */
  const author = 'Jean Exemple';
  const sections = [
    { address: '/fr/projets/', footerNote: 'Horloger de démonstration' },
    { address: '/en/projects/', footerNote: 'Sample clockmaker' },
  ];
  for (const section of sections) {
    await page.goto(section.address);
    const line = page.getByRole('main').getByRole('paragraph').filter({ hasText: author });
    await expect(line, `on ${section.address}, the line giving the site’s author`).toHaveCount(1);
    await expect(line).toBeVisible();
    /* On screen: the marker, then the author and the footer note, whether the marker is text in
       the page or generated by the stylesheet. */
    expect(await displayedText(line), `on ${section.address}, text displayed by the line`).toMatch(
      new RegExp(`^// ?${author}[^/\\p{L}]*${section.footerNote}$`, 'u'),
    );
    /* For assistive technologies: the author and the footer note, without the marker. */
    expect(
      (await line.ariaSnapshot()).trim(),
      `on ${section.address}, what assistive technologies get from the line`,
    ).toMatch(new RegExp(`^- paragraph: "?${author}[^/\\p{L}]*${section.footerNote}"?$`, 'u'));
  }
});

test.describe('projects section’s page without JavaScript', () => {
  /* The theme rule: no JavaScript is required to read the content. A script may decode a
     scrambled text or reveal a component: without it, nothing may stay hidden. */
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, the projects section’s page shows, in each language, its title, its intro and the title of each of its projects, in clear and nothing left transparent', async ({
    page,
  }) => {
    /* The title and description of exampleSite/content/projects/_index.md and _index.en.md, and
       the titles of the section's four projects in each language, short projects and
       engagements alike. */
    const sections = [
      {
        address: '/fr/projets/',
        title: 'Projets',
        description: 'Pendules, régulateurs et complications imaginaires, restaurés ou conçus pour la démonstration.',
        projects: [
          'Régulateur de parquet en noyer',
          'Montre de poche à grande complication',
          'Restauration d’une pendule de cheminée',
          'Horloge astronomique de l’atelier',
        ],
      },
      {
        address: '/en/projects/',
        title: 'Projects',
        description: 'Imaginary clocks, regulators and complications, restored or designed for the demo.',
        projects: [
          'Walnut floor regulator',
          'Grand complication pocket watch',
          'Restoration of a mantel clock',
          'The workshop’s astronomical clock',
        ],
      },
    ];
    for (const section of sections) {
      await page.goto(section.address);
      const main = page.getByRole('main');
      const heading = main.getByRole('heading', { level: 1 });
      await expect(heading, `on ${section.address}, the page heading`).toHaveCount(1);
      const intro = main.getByText(section.description, { exact: true });
      await expect(intro, `on ${section.address}, the intro`).toHaveCount(1);
      const elements: [string, Locator, string][] = [
        ['page heading', heading, section.title],
        ['intro', intro, section.description],
      ];
      for (const title of section.projects) {
        const projectHeading = main.getByRole('heading', { level: 3, name: title, exact: true });
        await expect(projectHeading, `on ${section.address}, the title of ${title}`).toHaveCount(1);
        elements.push([`title of ${title}`, projectHeading, title]);
      }
      for (const [name, element, text] of elements) {
        await expect(element, `on ${section.address}, the ${name}`).toBeVisible();
        /* In clear: the element displays the text itself, not scrambled signs, whether in its
           text or in generated content. */
        expect(await displayedText(element), `on ${section.address}, text displayed by the ${name}`).toBe(text);
        /* Readable: no element is left transparent, waiting for a script to reveal it. */
        const opacity = await effectiveOpacity(element);
        expect.soft(opacity, `on ${section.address}, effective opacity of the ${name}`).toBe(1);
      }
    }
  });

  test('the projects section’s page ends, in each language, with the contact section (anchor #contact) after its projects, showing the contactIntro its front matter sets instead of the home page’s intro, above a form that posts the email, the message and the page’s language to the address the site’s contactAction param gives', async ({
    page,
    baseURL,
  }) => {
    /* exampleSite/content/projects/_index.md and _index.en.md set contactIntro, each in its own
       language; the home pages declare their own intro in content/_index.md and _index.en.md
       ([params.contact] intro). exampleSite/hugo.toml gives the form the address /api/contact.
       No endpoint answers on the test servers: the post gets a page here, so that the browser has
       somewhere to land. */
    await page.route(`**${CONTACT_ACTION}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' }),
    );
    const homeIntros = [
      'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.',
      'Available for new restorations, at the workshop or at your home. Let us talk about your clock.',
    ];
    const listIntros = ['Un projet similaire ? Parlons-en.', "A similar project in mind? Let's talk."];
    const sections = [
      {
        address: '/fr/projets/',
        lang: 'fr',
        intro: listIntros[0],
        projectTitles: ['Restauration d’une pendule de cheminée', 'Régulateur de parquet en noyer'],
      },
      {
        address: '/en/projects/',
        lang: 'en',
        intro: listIntros[1],
        projectTitles: ['Restoration of a mantel clock', 'Walnut floor regulator'],
      },
    ];
    for (const { address, lang, intro, projectTitles } of sections) {
      await page.goto(address);
      const main = page.getByRole('main');
      const section = contactSection(page);
      await expect(section, `contact section on ${address}`).toHaveCount(1);
      await expect(section, `anchor of the contact section on ${address}`).toHaveAttribute('id', 'contact');

      /* It ends the page: after the projects, an engagement and a short project, and nothing of
         the main content shows after it. */
      for (const title of projectTitles) {
        const projectHeading = await main.getByRole('heading', { level: 3, name: title, exact: true }).elementHandle();
        expect(
          await section.evaluate(
            (contact, heading) =>
              (heading!.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
              !contact.contains(heading),
            projectHeading,
          ),
          `contact section after ${title} on ${address}`,
        ).toBe(true);
      }
      const textAfter = await section.evaluate((contact) => {
        const walker = document.createTreeWalker(contact.closest('main')!, NodeFilter.SHOW_TEXT);
        const found: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const isAfter =
            !contact.contains(node) && (contact.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
          if (isAfter && node.textContent!.trim() !== '') found.push(node.textContent!.trim());
        }
        return found;
      });
      expect(textAfter, `text of the main content after the contact section on ${address}`).toEqual([]);

      /* The list's own intro, not the home pages' nor the other language's, above the form. */
      const introText = section.getByText(intro, { exact: true });
      await introText.scrollIntoViewIfNeeded();
      await expect(introText, `contact intro on ${address}`).toBeVisible();
      for (const other of [...homeIntros, ...listIntros].filter((text) => text !== intro)) {
        await expect(section.getByText(other), `another intro on ${address}`).toHaveCount(0);
      }
      const form = section.getByRole('form');
      await expect(form, `contact form on ${address}`).toBeVisible();
      const introBox = (await introText.boundingBox())!;
      const formBox = (await form.boundingBox())!;
      expect(introBox.y + introBox.height, `contact intro above the form on ${address}`).toBeLessThanOrEqual(
        formBox.y + 1,
      );

      /* Sent as a visitor would: the email and the message, with the page's language, posted to
         the contactAction address. */
      await form.locator('[name="email"]').fill('marie.horloge@exemple.fr');
      await form.locator('[name="message"]').fill('Bonjour, je cherche une restauration comme celles de la liste.');
      const [request] = await Promise.all([
        page.waitForRequest((sent) => sent.method() === 'POST'),
        form.getByRole('button').click(),
      ]);
      expect(request.url(), `the address the form posts to from ${address}`).toBe(
        new URL(CONTACT_ACTION, baseURL).href,
      );
      const body = Object.fromEntries(new URLSearchParams(request.postData() ?? ''));
      expect(body, `the data sent from ${address}`).toEqual(
        expect.objectContaining({
          email: 'marie.horloge@exemple.fr',
          message: 'Bonjour, je cherche une restauration comme celles de la liste.',
          lang,
        }),
      );
    }
  });
});

test('with JavaScript, sending the filled contact form from the projects section’s page posts it in the background to the contactAction address, without leaving the page, and on a successful answer shows the confirmation in place of the list’s contactIntro', async ({
  page,
  baseURL,
}) => {
  /* exampleSite/hugo.toml gives the form the address /api/contact; the endpoint answers the
     background request with success, in JSON. content/projects/_index.md sets the list's
     contactIntro; the confirmation is the theme's default French one, the home page giving none. */
  await page.route(`**${CONTACT_ACTION}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
  const listIntro = 'Un projet similaire ? Parlons-en.';
  const confirmation = 'Merci, je vous réponds sous 48 heures ouvrées.';
  await page.goto('/fr/projets/');
  const urlBefore = page.url();
  /* A mark left on the page as loaded: a reload or a navigation would wipe it out. */
  await page.evaluate(() => {
    (window as unknown as { samePageMark?: boolean }).samePageMark = true;
  });
  const section = contactSection(page);
  const form = section.getByRole('form');
  await expect(section.getByText(listIntro, { exact: true }), 'the list’s contact intro before sending').toBeVisible();
  await form.locator('[name="email"]').fill('marie.horloge@exemple.fr');
  await form.locator('[name="message"]').fill('Bonjour, je cherche une restauration comme celles de la liste.');
  const [request] = await Promise.all([
    page.waitForRequest((sent) => sent.method() === 'POST'),
    form.getByRole('button').click(),
  ]);
  expect(request.url(), 'the address the form posts to').toBe(new URL(CONTACT_ACTION, baseURL).href);
  /* On success, the confirmation shows in place of the list's intro… */
  await expect(section.getByText(confirmation), 'the confirmation').toBeVisible();
  await expect(section.getByText(listIntro), 'the list’s contact intro').not.toBeVisible();
  /* …on the same page: same address, not reloaded. */
  expect(page.url(), 'the page address').toBe(urlBefore);
  expect(
    await page.evaluate(() => (window as unknown as { samePageMark?: boolean }).samePageMark === true),
    'the page is the one loaded before sending',
  ).toBe(true);
});

test('on the projects section’s page, in each language, the header’s "Contact" link leads to the page’s own contact section (#contact): following it keeps the visitor on the list and brings the heading of that section fully into view, below the sticky header', async ({
  page,
}) => {
  /* exampleSite/hugo.toml's main menu points its Contact entry at the home page's #contact
     ('/fr/#contact', '/en/#contact'); the projects list ends with its own contact section. */
  for (const address of ['/fr/projets/', '/en/projects/']) {
    await page.goto(address);
    const heading = contactSection(page).getByRole('heading', { level: 2 });
    await expect(heading, `heading of the contact section on ${address}`).toHaveCount(1);
    /* Below the first screen on load, so that the link has to bring it into view. */
    await expect(heading, `heading of the contact section on load on ${address}`).not.toBeInViewport();
    const link = page.locator('header nav').getByRole('link', { name: 'Contact', exact: true });
    await expect(link, `the header’s Contact link on ${address}`).toHaveAttribute('href', '#contact');
    await link.click();
    /* Still on the list: same path, now at the anchor. */
    await expect(page, `the page reached from the Contact link of ${address}`).toHaveURL(`${address}#contact`);
    await expect(heading, `the heading is fully in view on ${address}`).toBeInViewport({ ratio: 1 });
    /* Below the sticky header, not hidden under it; polled, as the scroll may be smooth. */
    await expect
      .poll(
        async () => {
          const headerBox = (await page.locator('header').boundingBox())!;
          const headingBox = (await heading.boundingBox())!;
          return headingBox.y - (headerBox.y + headerBox.height);
        },
        { message: `gap between the bottom of the header and the top of the heading on ${address}` },
      )
      .toBeGreaterThanOrEqual(0);
  }
});

test.describe('projects section of another site, whose projects list sets no contactIntro', () => {
  test('when the projects list sets no contactIntro param, its contact section shows, in each language, the intro the home page of its language declares', async ({
    page,
    context,
  }) => {
    /* SITE_WITH_A_PROJECTS_LIST_WITHOUT_CONTACT_INTRO: neither projects list sets contactIntro;
       each home page declares a violin maker's intro in its own language, unlike the example
       site's clockmaker's intros. */
    const site = SITE_WITH_A_PROJECTS_LIST_WITHOUT_CONTACT_INTRO;
    const homeIntros = [
      'Ouvert aux commandes de violons et d’altos, neufs ou restaurés. Écrivez-moi pour une visite de l’atelier.',
      'Open to orders for new or restored violins and violas. Write to me to visit the workshop.',
    ];
    /* The example site's intros: those of its home pages and those its projects list sets. */
    const exampleSiteIntros = [
      'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.',
      'Available for new restorations, at the workshop or at your home. Let us talk about your clock.',
      'Un projet similaire ? Parlons-en.',
      "A similar project in mind? Let's talk.",
    ];
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      for (const { address, intro } of [
        { address: '/fr/projets/', intro: homeIntros[0] },
        { address: '/en/projects/', intro: homeIntros[1] },
      ]) {
        const url = `${site.origin}${address}`;
        const response = await page.goto(url);
        expect(response?.status(), url).toBe(200);
        const section = contactSection(page);
        await expect(section, `contact section on ${url}`).toHaveCount(1);
        const introText = section.getByText(intro, { exact: true });
        await introText.scrollIntoViewIfNeeded();
        await expect(introText, `home page’s contact intro on ${url}`).toBeVisible();
        for (const other of [...homeIntros, ...exampleSiteIntros].filter((text) => text !== intro)) {
          await expect(section.getByText(other), `another intro on ${url}`).toHaveCount(0);
        }
        await expect(section.getByRole('form'), `contact form on ${url}`).toBeVisible();
      }
    } finally {
      removeDirectory(siteDirectory);
    }
  });
});

test.describe('projects section of another site, whose home pages declare no contact intro', () => {
  test('when the home page of its language declares no contact intro, the projects list shows no contact section, in each language, even when it sets its own contactIntro param, and keeps its projects', async ({
    page,
    context,
  }) => {
    /* SITE_WITH_HOME_PAGES_WITHOUT_CONTACT_INTRO: the French home page has no contact params, the
       English one contact params without an intro. The projects lists are the example site's,
       whose content/projects/_index.md and _index.en.md each set a contactIntro, which must not
       bring the section back. */
    const site = SITE_WITH_HOME_PAGES_WITHOUT_CONTACT_INTRO;
    /* The example site's intros: those of its home pages and those its projects lists set. */
    const intros = [
      'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.',
      'Available for new restorations, at the workshop or at your home. Let us talk about your clock.',
      'Un projet similaire ? Parlons-en.',
      "A similar project in mind? Let's talk.",
    ];
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      for (const { address, projectTitles } of [
        {
          address: '/fr/projets/',
          projectTitles: ['Restauration d’une pendule de cheminée', 'Régulateur de parquet en noyer'],
        },
        { address: '/en/projects/', projectTitles: ['Restoration of a mantel clock', 'Walnut floor regulator'] },
      ]) {
        const url = `${site.origin}${address}`;
        const response = await page.goto(url);
        expect(response?.status(), url).toBe(200);
        const main = page.getByRole('main');
        /* The list still shows its projects… */
        for (const title of projectTitles) {
          await expect(
            main.getByRole('heading', { level: 3, name: title, exact: true }),
            `project ${title} on ${url}`,
          ).toBeVisible();
        }
        /* …but offers no contact: no section, no anchor, no form, none of the intros. */
        await expect(contactSection(page), `contact section on ${url}`).toHaveCount(0);
        await expect(page.locator('#contact'), `#contact anchor on ${url}`).toHaveCount(0);
        await expect(main.getByRole('form'), `contact form on ${url}`).toHaveCount(0);
        for (const intro of intros) {
          await expect(page.getByText(intro), `contact intro "${intro}" on ${url}`).toHaveCount(0);
        }
      }
    } finally {
      removeDirectory(siteDirectory);
    }
  });
});

test.describe('section of another site that is not the projects list, setting a contactIntro param', () => {
  test('a section page other than the projects list shows no contact section, in each language, even when it sets its own contactIntro param, while the projects list of the same site shows one', async ({
    page,
    context,
  }) => {
    /* SITE_WITH_A_SECTION_SETTING_A_CONTACT_INTRO: the example site, whose home pages declare a
       contact intro, plus a journal/ section whose pages each set a contactIntro. Only the
       absence of the contact section on the journal can tell it from the projects list. */
    const site = SITE_WITH_A_SECTION_SETTING_A_CONTACT_INTRO;
    const journalIntros = [
      'Une question sur ces notes ? Écrivez-moi depuis le journal.',
      'A question about these notes? Write to me from the journal.',
    ];
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      for (const { journal, projectsList } of [
        { journal: '/fr/journal/', projectsList: '/fr/projets/' },
        { journal: '/en/journal/', projectsList: '/en/projects/' },
      ]) {
        /* The projects list of the same site still ends with the contact section… */
        const listUrl = `${site.origin}${projectsList}`;
        expect((await page.goto(listUrl))?.status(), listUrl).toBe(200);
        await expect(contactSection(page), `contact section on ${listUrl}`).toHaveCount(1);
        await expect(page.locator('#contact'), `#contact anchor on ${listUrl}`).toHaveCount(1);

        /* …while the journal, a section page, offers no contact: no section, no anchor, no form,
           none of its intros. */
        const url = `${site.origin}${journal}`;
        expect((await page.goto(url))?.status(), url).toBe(200);
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 1 }), `title of ${url}`).toHaveCount(1);
        await expect(contactSection(page), `contact section on ${url}`).toHaveCount(0);
        await expect(page.locator('#contact'), `#contact anchor on ${url}`).toHaveCount(0);
        await expect(main.getByRole('form'), `contact form on ${url}`).toHaveCount(0);
        for (const intro of journalIntros) {
          await expect(page.getByText(intro), `contact intro "${intro}" on ${url}`).toHaveCount(0);
        }
      }
    } finally {
      removeDirectory(siteDirectory);
    }
  });
});

test.describe('projects section of another site, named by its projectsSection site param instead of projects, holding projects of one kind only in each language', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_OF_ONE_KIND_PER_LANGUAGE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a group with no project shows no heading', async ({ page, context }) => {
    /* tests/fixtures/one-kind-per-language/content/ateliers/ holds, in French, a single short
       project and, in English, a single engagement. Each page must show its one project under the
       one group heading it calls for, and no heading for the group that has no project: neither
       the other group's heading, looked for by its name (the only handle a group heading has),
       nor any other second level-2 heading. Both directions, so that a template that only drops
       one of the two headings does not pass. */
    const site = SITE_WITH_PROJECTS_OF_ONE_KIND_PER_LANGUAGE;
    await serveSite(context, site, siteDirectory);
    const sections = [
      {
        address: '/fr/ateliers/',
        title: 'Coucou de chalet',
        emptyGroupHeading: 'Missions & applications métier',
      },
      {
        address: '/en/ateliers/',
        title: 'Railway station clock',
        emptyGroupHeading: 'Short & interactive projects',
      },
    ];
    for (const section of sections) {
      await page.goto(`${site.origin}${section.address}`);
      const main = page.getByRole('main');
      const projectHeading = main.getByRole('heading', { level: 3, name: section.title, exact: true });
      await expect(projectHeading, `on ${section.address}, the project's title`).toHaveCount(1);
      await expect(projectHeading).toBeVisible();
      await expect(
        main.getByRole('heading', { name: section.emptyGroupHeading, exact: true }),
        `on ${section.address}, the heading of the group that has no project`,
      ).toHaveCount(0);
      const groupHeadings = main.getByRole('heading', { level: 2 });
      await expect(groupHeadings, `on ${section.address}, a single group heading`).toHaveCount(1);
      expect(
        await isUnderHeading(groupHeadings.first(), projectHeading),
        `on ${section.address}, the project's title is under the one group heading`,
      ).toBe(true);
    }
  });

  test('with projectsSection naming another section, that section’s page is the projects list, and the page of the projects/ section, no longer the configured one, lists no project', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/one-kind-per-language/hugo.toml names ateliers/ in projectsSection; the
       example site's projects/ section, whose projects all declare a valid kind, is still built,
       in both languages. Only the configured section's page is the projects list: there, its
       project is shown under a group heading, so that a site with no list at all does not pass.
       The page of projects/ is still published, with its own title, but is no projects list: no
       group, no project, none of its pages' titles. Both languages, so that a list dropped in one
       language only does not pass. */
    const site = SITE_WITH_PROJECTS_OF_ONE_KIND_PER_LANGUAGE;
    await serveSite(context, site, siteDirectory);
    const configuredSections = [
      { address: '/fr/ateliers/', title: 'Coucou de chalet' },
      { address: '/en/ateliers/', title: 'Railway station clock' },
    ];
    for (const section of configuredSections) {
      const response = await page.goto(`${site.origin}${section.address}`);
      expect(response?.status(), `status of ${section.address}`).toBe(200);
      const main = page.getByRole('main');
      const projectHeading = main.getByRole('heading', { level: 3, name: section.title, exact: true });
      await expect(projectHeading, `on ${section.address}, the configured section, the project's title`).toHaveCount(1);
      await expect(projectHeading).toBeVisible();
      await expect(
        main.getByRole('heading', { level: 2 }),
        `on ${section.address}, the configured section, a group heading`,
      ).toHaveCount(1);
    }
    const otherSections = [
      {
        address: '/fr/projets/',
        titles: [
          'Régulateur de parquet en noyer',
          'Restauration d’une pendule de cheminée',
          'Horloge astronomique de l’atelier',
          'Montre de poche à grande complication',
        ],
      },
      {
        address: '/en/projects/',
        titles: [
          'Walnut floor regulator',
          'Restoration of a mantel clock',
          'The workshop’s astronomical clock',
          'Grand complication pocket watch',
        ],
      },
    ];
    for (const section of otherSections) {
      const response = await page.goto(`${site.origin}${section.address}`);
      expect(response?.status(), `status of ${section.address}`).toBe(200);
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1 }), `on ${section.address}, the page heading`).toHaveCount(1);
      /* The page is static and already loaded once its heading is found: what it must not show is
         counted once, rather than waited for, so that every absence is reported. */
      expect
        .soft(await main.getByRole('heading', { level: 2 }).count(), `on ${section.address}, group headings`)
        .toBe(0);
      expect
        .soft(await main.getByRole('heading', { level: 3 }).count(), `on ${section.address}, project titles`)
        .toBe(0);
      expect.soft(await main.getByRole('article').count(), `on ${section.address}, project entries`).toBe(0);
      for (const title of section.titles) {
        expect
          .soft(await main.getByText(title, { exact: true }).count(), `on ${section.address}, the title "${title}"`)
          .toBe(0);
      }
    }
  });
});

test.describe('projects section of another site, holding several weighted projects of each kind', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_ORDERED_BY_WEIGHT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('within each group, projects follow their weight', async ({ page, context }) => {
    /* tests/fixtures/weighted-projects/content/vitrines/ holds three engagements and three short
       projects, listed below in ascending front-matter weight. Within each group, that order is
       neither the order of their titles, nor of their file names, nor of their dates, in either
       direction. A group heading is found by its name, the only handle it has; the titles under it
       are read in the page's order. */
    const site = SITE_WITH_PROJECTS_ORDERED_BY_WEIGHT;
    await serveSite(context, site, siteDirectory);
    const groups = [
      {
        heading: 'Missions & applications métier',
        titles: ['Horloge du beffroi', 'Comtoise de ferme', 'Pendule d’applique'],
      },
      {
        heading: 'Projets courts & interactifs',
        titles: ['Pendulette de bureau', 'Cadran solaire de terrasse', 'Sablier de marine'],
      },
    ];
    await page.goto(`${site.origin}/fr/vitrines/`);
    const main = page.getByRole('main');
    const projectHeadings = main.getByRole('heading', { level: 3 });
    await expect(projectHeadings, 'one title per project').toHaveCount(6);
    for (const group of groups) {
      const groupHeading = main.getByRole('heading', { level: 2, name: group.heading, exact: true });
      await expect(groupHeading, `the "${group.heading}" heading`).toHaveCount(1);
      const titlesUnderGroup: string[] = [];
      for (const projectHeading of await projectHeadings.all()) {
        if (await isUnderHeading(groupHeading, projectHeading)) {
          titlesUnderGroup.push((await projectHeading.textContent())!.trim());
        }
      }
      expect(titlesUnderGroup, `the titles under "${group.heading}", in the page's order`).toEqual(group.titles);
    }
  });
});

test.describe('projects section of another site, holding short projects only, followed by its contact section', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_SHORT_PROJECTS_ONLY_AND_CONTACT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a projects list with only short projects, the heading of the group "Projets courts" shows the section number "01 //" and the heading of the contact section after it "02 //", while assistive technologies get the titles alone', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/short-projects-and-contact/content/ateliers/ holds two short projects and no
       engagement, and its home page declares a contact intro: the list shows the short projects'
       group, the first numbered section, then the contact section. The group heading is found by
       its name, the only handle it has. */
    const site = SITE_WITH_SHORT_PROJECTS_ONLY_AND_CONTACT;
    await serveSite(context, site, siteDirectory);
    await page.goto(`${site.origin}/fr/ateliers/`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2, name: 'Missions & applications métier' })).toHaveCount(0);
    const groupHeading = main.getByRole('heading', { level: 2, name: 'Projets courts & interactifs', exact: true });
    await expect(groupHeading).toBeVisible();
    const contactHeading = contactSection(page).getByRole('heading', { level: 2 });
    await expect(contactHeading).toBeVisible();
    /* On screen: the first number, then the group's title; the next number, then "Contact" (its
       case left to the stylesheet). For assistive technologies, the titles alone. */
    await expect
      .poll(() => displayedText(groupHeading), 'text displayed by the short projects heading')
      .toMatch(/^01 ?\/\/ ?Projets courts & interactifs$/i);
    await expect
      .poll(() => displayedText(contactHeading), 'text displayed by the contact heading')
      .toMatch(/^02 ?\/\/ ?Contact$/i);
    await expect(groupHeading).toHaveAccessibleName('Projets courts & interactifs');
    await expect(contactHeading).toHaveAccessibleName('Contact');
  });
});

test.describe('projects section of another site, holding no project, followed by its contact section', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_AN_EMPTY_PROJECTS_LIST_AND_CONTACT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a projects list with no project, the heading of its contact section, the only numbered section, shows the section number "01 //", while assistive technologies get the title alone', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/empty-projects-list-and-contact/content/ateliers/ holds no project, and its
       home page declares a contact intro: the list shows no project group, only the contact
       section, which is then the first numbered section. */
    const site = SITE_WITH_AN_EMPTY_PROJECTS_LIST_AND_CONTACT;
    await serveSite(context, site, siteDirectory);
    await page.goto(`${site.origin}/fr/ateliers/`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 3 }), 'no project title').toHaveCount(0);
    const contactHeading = contactSection(page).getByRole('heading', { level: 2 });
    await expect(contactHeading).toBeVisible();
    await expect(main.getByRole('heading', { level: 2 }), 'the contact heading, the only section heading').toHaveCount(
      1,
    );
    /* On screen: the first number, then "Contact" (its case left to the stylesheet). For assistive
       technologies, the title alone. */
    await expect
      .poll(() => displayedText(contactHeading), 'text displayed by the contact heading')
      .toMatch(/^01 ?\/\/ ?Contact$/i);
    await expect(contactHeading).toHaveAccessibleName('Contact');
  });
});

test.describe('projects section of another site, holding engagements only, followed by its contact section', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ENGAGEMENTS_ONLY_AND_CONTACT);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on a projects list with engagements but no short projects, the heading of the contact section after the engagements shows the section number "02 //", while assistive technologies get the title alone', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/engagements-and-contact/content/ateliers/ holds two engagements and no short
       project, and its home page declares a contact intro: the list shows the engagements' group,
       the first numbered section, then the contact section, the second one. The group heading is
       found by its name, the only handle it has. */
    const site = SITE_WITH_ENGAGEMENTS_ONLY_AND_CONTACT;
    await serveSite(context, site, siteDirectory);
    await page.goto(`${site.origin}/fr/ateliers/`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2, name: 'Projets courts & interactifs' })).toHaveCount(0);
    const groupHeading = main.getByRole('heading', { level: 2, name: 'Missions & applications métier', exact: true });
    await expect(groupHeading).toBeVisible();
    const contactHeading = contactSection(page).getByRole('heading', { level: 2 });
    await expect(contactHeading).toBeVisible();
    /* On screen: the next number after the engagements' one, then "Contact" (its case left to the
       stylesheet). For assistive technologies, the title alone. */
    await expect
      .poll(() => displayedText(contactHeading), 'text displayed by the contact heading')
      .toMatch(/^02 ?\/\/ ?Contact$/i);
    await expect(contactHeading).toHaveAccessibleName('Contact');
  });
});

test.describe('projects section of another site, holding a subsection whose kind cascades to its pages', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_SUBSECTION_OF_THE_PROJECTS_SECTION_WITH_A_CASCADED_KIND);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a page in a subsection of the projects section does not appear on the list', async ({ page, context }) => {
    /* tests/fixtures/subsection-with-a-cascaded-kind/content/projects/marqueterie/_index.md, titled
       "Pendules marquetées", gives kind = 'short' to itself and to its one page, "Pendule religieuse
       Boulle", through [cascade]. Only the projects that sit directly in projects/ belong on the
       list: neither the subsection nor its page, although both carry a kind. The example site's
       short project "Régulateur de parquet en noyer", directly in projects/, is still listed, so
       that an empty page does not pass. */
    const site = SITE_WITH_A_SUBSECTION_OF_THE_PROJECTS_SECTION_WITH_A_CASCADED_KIND;
    await serveSite(context, site, siteDirectory);
    const response = await page.goto(`${site.origin}/fr/projets/`);
    expect(response?.status(), 'status of the projects section’s page').toBe(200);
    const main = page.getByRole('main');
    const directProject = main.getByRole('heading', { level: 3, name: 'Régulateur de parquet en noyer', exact: true });
    await expect(directProject, 'the title of a project directly in the section').toHaveCount(1);
    await expect(directProject).toBeVisible();
    for (const title of ['Pendules marquetées', 'Pendule religieuse Boulle']) {
      await expect(main.getByText(title, { exact: true }), `the title "${title}" on the list`).toHaveCount(0);
    }
  });

  test('the page of a subsection of the projects section sends the visitor, without JavaScript, to the projects list of its language, and asks search engines not to index it', async ({
    page,
    context,
    browser,
    viewport,
  }) => {
    /* The subsection marqueterie/, titled "Pendules marquetées" in French and "Marquetry clocks"
       in English, is not a list of its own: its page sends the visitor on to the projects list of
       its language, /fr/projets/ or /en/projects/, even without JavaScript. That list is
       recognised by a project sitting directly in projects/, "Régulateur de parquet en noyer" or
       "Walnut floor regulator", so that landing on any other page does not pass. */
    const site = SITE_WITH_A_SUBSECTION_OF_THE_PROJECTS_SECTION_WITH_A_CASCADED_KIND;
    const languages = [
      {
        subsection: '/fr/projets/marqueterie/',
        list: '/fr/projets/',
        lang: 'fr-FR',
        directProject: 'Régulateur de parquet en noyer',
      },
      {
        subsection: '/en/projects/marqueterie/',
        list: '/en/projects/',
        lang: 'en-US',
        directProject: 'Walnut floor regulator',
      },
    ];
    const withoutJavaScript = await browser.newContext({ viewport, javaScriptEnabled: false });
    try {
      await serveSite(withoutJavaScript, site, siteDirectory);
      const visitor = await withoutJavaScript.newPage();
      for (const { subsection, list, lang, directProject } of languages) {
        await visitor.goto(`${site.origin}${subsection}`);
        await expect(visitor, `without JavaScript, the page reached from ${subsection}`).toHaveURL(
          `${site.origin}${list}`,
        );
        await expect(visitor.locator('html'), `the language of the page reached from ${subsection}`).toHaveAttribute(
          'lang',
          lang,
        );
        const main = visitor.getByRole('main');
        await expect(
          main.getByRole('heading', { level: 1 }),
          `the list’s title, reached from ${subsection}`,
        ).toBeVisible();
        await expect(
          main.getByRole('heading', { level: 3, name: directProject, exact: true }),
          `a project of the list, reached from ${subsection}`,
        ).toBeVisible();
      }
    } finally {
      await withoutJavaScript.close();
    }
    /* What a crawler reads: the document served at the subsection's address, fetched, then
       parsed without being run. */
    await serveSite(context, site, siteDirectory);
    await page.goto(`${site.origin}/fr/`);
    for (const { subsection } of languages) {
      const robots = await page.evaluate(async (address) => {
        const response = await fetch(address);
        const document = new DOMParser().parseFromString(await response.text(), 'text/html');
        return Array.from(
          document.querySelectorAll('head meta[name="robots" i]'),
          (meta) => meta.getAttribute('content') ?? '',
        );
      }, subsection);
      expect(
        robots.some((content) =>
          content
            .split(',')
            .map((directive) => directive.trim().toLowerCase())
            .includes('noindex'),
        ),
        `the robots directives of the document served at ${subsection}: ${JSON.stringify(robots)}`,
      ).toBe(true);
    }
  });
});

test.describe('projects section of another site, whose list Hugo does not write, holding a subsection', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_SUBSECTION_OF_AN_UNWRITTEN_PROJECTS_LIST);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('when the projects list is not written ([build] render = "never" or "link"), the page of a subsection of the projects section does not send the visitor anywhere, even without JavaScript', async ({
    browser,
    viewport,
  }) => {
    /* In tests/fixtures/unwritten-projects-list/content/projects/, the French list declares
       render = 'never' (no address: a redirect there would only reload the subsection's page,
       again and again) and the English one render = 'link' (an address, but nothing written
       there: a redirect would lead to a missing page). The subsection marqueterie/ then has
       nowhere to send the visitor: its page stays at its own address, loaded once, its title
       shown. */
    const site = SITE_WITH_A_SUBSECTION_OF_AN_UNWRITTEN_PROJECTS_LIST;
    const subsections = ['/fr/projets/marqueterie/', '/en/projects/marqueterie/'];
    const withoutJavaScript = await browser.newContext({ viewport, javaScriptEnabled: false });
    try {
      await serveSite(withoutJavaScript, site, siteDirectory);
      const visitor = await withoutJavaScript.newPage();
      for (const subsection of subsections) {
        const documentsRequested: string[] = [];
        const recordDocument = (request: { resourceType(): string; url(): string }) => {
          if (request.resourceType() === 'document') documentsRequested.push(request.url());
        };
        visitor.on('request', recordDocument);
        const response = await visitor.goto(`${site.origin}${subsection}`);
        expect(response?.status(), `status of ${subsection}`).toBe(200);
        /* Leave a redirect, immediate as it is, the time to happen. */
        await visitor.waitForTimeout(1500);
        visitor.off('request', recordDocument);
        expect(documentsRequested, `the documents loaded from ${subsection}`).toEqual([`${site.origin}${subsection}`]);
        await expect(visitor, `without JavaScript, the page reached from ${subsection}`).toHaveURL(
          `${site.origin}${subsection}`,
        );
        await expect(
          visitor.getByRole('main').getByRole('heading', { level: 1 }),
          `the subsection’s title, at ${subsection}`,
        ).toBeVisible();
      }
    } finally {
      await withoutJavaScript.close();
    }
  });
});

test.describe('projects section of another site, holding projects whose page Hugo does not write', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_LISTED_WITHOUT_WRITTEN_PAGES);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a project whose page is not written ([build] render = "never" or "link") is listed without a link', async ({
    page,
    context,
  }) => {
    /* In tests/fixtures/projects-listed-without-pages/content/projects/, a short project and an
       engagement declare render = 'never' (no address), and a short project and an engagement
       render = 'link' (an address, but nothing written there). Each is still listed, its title
       shown, with no link at all: none in its title, not even an empty one, and none anywhere on
       the page to the address render = 'link' gives it. The example site's projects of both
       kinds, whose pages are written, keep the link in their title, so that a list without any
       link does not pass. */
    const site = SITE_WITH_PROJECTS_LISTED_WITHOUT_WRITTEN_PAGES;
    await serveSite(context, site, siteDirectory);
    const response = await page.goto(`${site.origin}/fr/projets/`);
    expect(response?.status(), 'status of the projects section’s page').toBe(200);
    const main = page.getByRole('main');
    const unwrittenProjects = [
      { title: 'Pendulette de voyage', render: 'never' },
      { title: 'Carillon de beffroi', render: 'never' },
      { title: 'Horloge de gare', render: 'link', address: '/fr/projets/horloge-de-gare/' },
      { title: 'Régulateur de marine', render: 'link', address: '/fr/projets/regulateur-de-marine/' },
    ];
    /* The page is static and already loaded once a title is found: the links are counted once,
       rather than waited for, so that every project's failure is reported within the test's
       timeout. */
    for (const project of unwrittenProjects) {
      const projectHeading = main.getByRole('heading', { level: 3, name: project.title, exact: true });
      await expect(projectHeading, `the title of ${project.title} (render = "${project.render}")`).toHaveCount(1);
      await expect(projectHeading).toBeVisible();
      expect
        .soft(
          await projectHeading.locator('a').count(),
          `links in the title of ${project.title} (render = "${project.render}")`,
        )
        .toBe(0);
      if (project.address) {
        expect
          .soft(
            await main.locator(`a[href$="${project.address}"]`).count(),
            `links to ${project.address}, where no page is written`,
          )
          .toBe(0);
      }
    }
    for (const title of ['Régulateur de parquet en noyer', 'Restauration d’une pendule de cheminée']) {
      const projectHeading = main.getByRole('heading', { level: 3, name: title, exact: true });
      await expect(
        projectHeading.getByRole('link', { name: title, exact: true }),
        `the link in the title of ${title}, whose page is written`,
      ).toHaveCount(1);
    }
  });
});

test.describe('projects section content errors: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a project of the projects section’s list that declares no kind, or a kind other than "engagement" or "short", makes the site build fail, with an error message that names that project and its language', () => {
    /* In tests/fixtures/projects-without-a-valid-kind/content/projects/, pendule-sans-genre.md, in
       French only, declares no kind, and comtoise-mal-classee.en.md, in English only, declares
       kind = 'Short', with a capital letter. Rather than a list that silently leaves them out, the
       person building the site must get a failure with, for each of them, a message that names the
       project, through its file name, which every way of referring to the page (its path, its
       file, its address) holds, and the language of its page by its code, as a word that no other
       word follows, whatever the rest of the wording. Both cases, each in its own language, so that
       a check for only one of them, or a language written in the template, does not pass. Only the
       projects on the list are concerned: neither the page of the subsection atelier/,
       cartel-hors-liste.md, which declares no kind either but is not on the list, nor the example
       site's projects, which all declare a valid kind, may be reported. */
    const build = tryToBuildSite(SITE_WITH_PROJECTS_WITHOUT_A_VALID_KIND);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const cases = [
      { name: 'a French project without a kind', project: 'pendule-sans-genre', language: 'fr' },
      { name: "an English project of kind 'Short'", project: 'comtoise-mal-classee', language: 'en' },
    ];
    for (const { name, project, language } of cases) {
      const messages = build.errors.split('\n').filter((line) => line.includes(project));
      expect
        .soft(messages.length, `with ${name}, error messages naming the project ${project}, in:\n${build.errors}`)
        .toBeGreaterThan(0);
      for (const message of messages) {
        expect
          .soft(message, `with ${name}, the error message should name the project's language, ${language}`)
          .toMatch(new RegExp(languageCodePattern(language), 'u'));
      }
    }
    for (const project of [
      'cartel-hors-liste',
      'regulateur-noyer',
      'restauration-pendule',
      'horloge-astronomique',
      'montre-grande-complication',
    ]) {
      expect.soft(build.errors, `no error message should name ${project}`).not.toContain(project);
    }
  });

  test('with projectsSection naming another section, a project of that section without a kind makes the site build fail, with an error message that names that project and its language, while a project without a kind in a projects/ section that is not the configured one breaks nothing', () => {
    /* Both sites name ateliers/ in projectsSection and feature no projects on their home pages.
       In tests/fixtures/kindless-project-in-the-configured-section/content/ateliers/,
       sablier-sans-genre.md, in French only, declares no kind: it is on the projects list, and the
       person building the site must get a failure with a message that names it, through its file
       name, and the language of its page by its code. In
       tests/fixtures/kindless-project-outside-the-configured-section/content/, the one project of
       ateliers/ declares a valid kind, and it is projects/sablier-sans-genre.md, of a section the
       site no longer uses for its projects, that declares none: no list holds it, so the site must
       build. Both halves, so that a check left on projects/ alone, or one that drops the check,
       does not pass. */
    const project = 'sablier-sans-genre';
    const inTheConfiguredSection = tryToBuildSite(SITE_WITH_A_KINDLESS_PROJECT_IN_THE_CONFIGURED_SECTION);
    expect
      .soft(inTheConfiguredSection.succeeded, 'with a project without a kind in ateliers/, the site build should fail')
      .toBe(false);
    const messages = inTheConfiguredSection.errors.split('\n').filter((line) => line.includes(project));
    expect
      .soft(
        messages.length,
        `with a project without a kind in ateliers/, error messages naming the project ${project}, in:\n${inTheConfiguredSection.errors}`,
      )
      .toBeGreaterThan(0);
    for (const message of messages) {
      expect
        .soft(message, 'the error message should name the project’s language, fr')
        .toMatch(new RegExp(languageCodePattern('fr'), 'u'));
    }
    const outsideTheConfiguredSection = tryToBuildSite(SITE_WITH_A_KINDLESS_PROJECT_OUTSIDE_THE_CONFIGURED_SECTION);
    expect
      .soft(
        outsideTheConfiguredSection.succeeded,
        `with a project without a kind in projects/ only, the site should build, but Hugo reported:\n${outsideTheConfiguredSection.errors}`,
      )
      .toBe(true);
  });

  test('a short project of the projects section’s list, featured on neither home page, whose page writes its stack as a text rather than a list makes the site build fail, with an error message that names that project, says its stack must be a list and names its language', () => {
    /* In tests/fixtures/listed-materials-as-text/content/projects/, carillon-de-poche.md, in French
       only, and boussole-laiton.en.md, in English only, are short projects whose stack is a single
       text ('Laiton, Verre', 'Brass, Glass') rather than a list. Neither home page features them,
       so the check of the featured projects' cards cannot be what reports them: the projects
       section's list must. Rather than a list that shows the text as it is, the person building
       the site must get a failure with, for each of them, a message that names the project,
       through its file name, says its stack must be a list, and names the language of its page by
       its code, as a word that no other word follows, whatever the rest of the wording. One
       project per language, so that a language written in the template does not pass. */
    const build = tryToBuildSite(SITE_WITH_LISTED_PROJECT_STACKS_AS_A_TEXT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const cases = [
      { project: 'carillon-de-poche', language: 'fr' },
      { project: 'boussole-laiton', language: 'en' },
    ];
    for (const { project, language } of cases) {
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(project) && /\bstack\b.*\blist\b/.test(line));
      expect
        .soft(
          messages.length,
          `error messages naming the project ${project} and saying its stack must be a list, in:\n${build.errors}`,
        )
        .toBeGreaterThan(0);
      for (const message of messages) {
        expect
          .soft(message, `the error message about ${project} should name its language, ${language}`)
          .toMatch(new RegExp(languageCodePattern(language), 'u'));
      }
    }
  });

  test('a short project of the projects section’s list, featured on a home page that is not written, whose page writes its stack as a text rather than a list makes the site build fail, with an error message that names that project, says its stack must be a list and names its language, without a template execution error after it', () => {
    /* tests/fixtures/unrendered-home-featuring-a-stack-as-text/content/_index.en.md, the English
       home page, declares [build] render = 'never' and features projects/sextant-laiton, an
       English-only short project whose stack is a single text, 'Brass', rather than a list. The
       home page being not written, the check of the featured projects' cards never runs: the
       projects section's list must still report that stack. The person building the site must
       get a failure with a message, on one line, that names the project through its file name,
       says its stack must be a list, and names the language of its page, en, by its code,
       whatever the rest of the wording, and no Go template execution error that would follow it
       and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_AN_UNRENDERED_HOME_FEATURING_A_PROJECT_STACK_AS_A_TEXT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const messages = build.errors
      .split('\n')
      .filter((line) => line.includes('sextant-laiton') && /\bstack\b.*\blist\b/.test(line));
    expect(
      messages.length,
      `error messages naming the project sextant-laiton and saying its stack must be a list, in:\n${build.errors}`,
    ).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message, 'the error message should name the project’s language, en').toMatch(
        new RegExp(languageCodePattern('en'), 'u'),
      );
    }
    expect(build.errors, 'no template execution error should follow the error message').not.toMatch(
      TEMPLATE_EXECUTION_ERROR,
    );
  });
});

test.describe('home page of another site, featuring only projects of one subsection of the projects section', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_IN_A_SUBSECTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the "Tous les projets" link opens the projects section, not the subsection that holds every featured project', async ({
    page,
    context,
  }) => {
    const site = SITE_WITH_PROJECTS_IN_A_SUBSECTION;
    await serveSite(context, site, siteDirectory);
    /* tests/fixtures/projects-in-a-subsection/content/_index.md features two projects, both in
       content/projects/horlogerie/ (title "Horlogerie", published at /fr/projets/horlogerie/). */
    /* The subsection's page redirects to the projects list with a meta refresh: opened in a page
       of its own, closed before the next navigation, its refresh cannot interrupt that one. */
    const subsectionPage = await context.newPage();
    const subsectionResponse = await subsectionPage.goto(`${site.origin}/fr/projets/horlogerie/`);
    await subsectionPage.close();
    expect(subsectionResponse?.status(), 'status of the subsection page').toBe(200);
    await page.goto(`${site.origin}/fr/`);
    const section = projectsSection(page);
    await expect(section.getByRole('article')).toHaveCount(2);
    const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
    await expect(link).toHaveCount(1);
    await link.click();
    /* The example site's content/projects/, titled "Projets". */
    await expect(page).toHaveURL(`${site.origin}/fr/projets/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projets');
  });
});

test.describe('home page of another site, featuring projects of the projects section and of one of its subsections', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_PROJECTS_IN_THE_SECTION_AND_A_SUBSECTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('with featured projects in the projects section and in one of its subsections, the "Tous les projets" link shows and opens the projects section', async ({
    page,
    context,
  }) => {
    const site = SITE_WITH_PROJECTS_IN_THE_SECTION_AND_A_SUBSECTION;
    await serveSite(context, site, siteDirectory);
    /* tests/fixtures/projects-in-the-section-and-a-subsection/content/_index.md features one
       project of content/projects/ and one of content/projects/marine/ (title "Marine", published
       at /fr/projets/marine/). */
    const subsectionResponse = await page.goto(`${site.origin}/fr/projets/marine/`);
    expect(subsectionResponse?.status(), 'status of the subsection page').toBe(200);
    await page.goto(`${site.origin}/fr/`);
    const section = projectsSection(page);
    await expect(section.getByRole('article')).toHaveCount(2);
    const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
    await expect(link).toHaveCount(1);
    await link.click();
    /* The example site's content/projects/, titled "Projets". */
    await expect(page).toHaveURL(`${site.origin}/fr/projets/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projets');
  });
});

test.describe('home page of another site, whose projectsSection param names the section of its projects', () => {
  test('a home page featuring projects of the section named by the projectsSection site param builds, and its "Tous les projets" link opens that section', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/projects-in-the-configured-section/hugo.toml sets projectsSection =
       'realisations'; its content/_index.md features two projects of content/realisations/ (title
       "Réalisations", published at /fr/realisations/). The site, not the theme, says where its
       projects live: the person building it must get a site, not a build error. */
    const site = SITE_WITH_PROJECTS_IN_THE_CONFIGURED_SECTION;
    const build = tryToBuildSite(site);
    expect(build.succeeded, `the site build should succeed, Hugo said:\n${build.errors}`).toBe(true);
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      await page.goto(`${site.origin}/fr/`);
      const section = projectsSection(page);
      await expect(section.getByRole('article')).toHaveCount(2);
      const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
      await expect(link).toHaveCount(1);
      await link.click();
      await expect(page).toHaveURL(`${site.origin}/fr/realisations/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réalisations');
    } finally {
      removeDirectory(siteDirectory);
    }
  });

  test('a projectsSection site param written with capitals, naming a section whose folder has the same capitals, lets the home page featuring projects of that section build, and its "Tous les projets" link opens that section', async ({
    page,
    context,
  }) => {
    /* tests/fixtures/capitalized-param-with-its-projects/hugo.toml sets projectsSection =
       'Realisations'; its content/_index.md features two projects of content/Realisations/ (title
       "Réalisations", published at /fr/realisations/, Hugo lowercasing the address). The param is
       written as the folder is: the person building the site must get a site, not an error message
       per featured project saying it does not live in the section where it does live. */
    const site = SITE_WITH_A_CAPITALIZED_PROJECTS_SECTION_PARAM_AND_ITS_PROJECTS;
    const build = tryToBuildSite(site);
    expect(build.succeeded, `the site build should succeed, Hugo said:\n${build.errors}`).toBe(true);
    const siteDirectory = buildSite(site);
    try {
      await serveSite(context, site, siteDirectory);
      await page.goto(`${site.origin}/fr/`);
      const section = projectsSection(page);
      await expect(section.getByRole('article')).toHaveCount(2);
      const link = section.getByRole('link', { name: 'Tous les projets', exact: true });
      await expect(link).toHaveCount(1);
      await link.click();
      await expect(page).toHaveURL(`${site.origin}/fr/realisations/`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réalisations');
    } finally {
      removeDirectory(siteDirectory);
    }
  });
});

test.describe('featured project outside the section named by the projectsSection param: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('with the projectsSection site param set to realisations, a home page that features a project of the projects section makes the site build fail, with an error message that names that entry and the configured section, realisations, never the default section, projects, as the section', () => {
    /* tests/fixtures/project-outside-the-configured-section/hugo.toml sets projectsSection =
       'realisations'; its content/_index.md features 'realisations/pendule-de-voyage', then the
       example site's 'projects/restauration-pendule'. The site said its projects live in
       realisations: the person building it must be told that section, the one the project should
       move to, not the theme's default, projects. The message is the one line naming the entry, as
       written in the front matter; the section is looked for as the word "section" and the token
       realisations, which neither a word nor a page path under realisations/ continues, so that
       the reference 'realisations/pendule-de-voyage' does not pass for it. Nor may the message
       name the default section, projects, as the section, which would send the person to the wrong
       one: it is looked for as in the default-section case, with NAMES_THE_PROJECTS_SECTION, which
       the entry 'projects/restauration-pendule' does not pass for. That project of the configured
       section must not be reported. */
    const entry = 'projects/restauration-pendule';
    const build = tryToBuildSite(SITE_WITH_A_PROJECT_OUTSIDE_THE_CONFIGURED_SECTION);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'no error message should name the featured project of realisations/').not.toContain(
      'realisations/pendule-de-voyage',
    );
    const messages = build.errors.split('\n').filter((line) => line.includes(entry));
    expect(messages, `one error message naming the entry ${entry}, in:\n${build.errors}`).toHaveLength(1);
    expect(messages[0], 'the error message should name the configured section, realisations').toMatch(
      /^(?=.*\bsection\b)(?=.*(?<![\w-])realisations(?![\w-]|\/[\w-])).*$/u,
    );
    expect(messages[0], 'the error message should not name the default section, projects, as the section').not.toMatch(
      NAMES_THE_PROJECTS_SECTION,
    );
  });
});

/* A message saying, on one line, that the projectsSection param must be a text, whatever the rest
   of the wording. */
const PROJECTS_SECTION_MUST_BE_A_TEXT = /\bprojectsSection\b.*\b(?:must|should)\s+be\b.*\btext\b/i;

/* A message saying, on one line, that the projectsSection param is empty or blank. */
const PROJECTS_SECTION_IS_EMPTY = /\bprojectsSection\b.*\b(?:empty|blank)\b/i;

test.describe('projectsSection site param that is not a text or is empty: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a projectsSection site param that is not a text (a number, a list) or is empty (an empty text, spaces only) makes the site build fail, with an error message that names the param and says it must be a text, or that it is empty, without a template execution error after it', () => {
    /* tests/fixtures/section-param-as-a-number/hugo.toml sets projectsSection = 42,
       tests/fixtures/section-param-as-a-list/hugo.toml projectsSection = ['realisations'],
       tests/fixtures/unfilled-section-param/hugo.toml projectsSection = '' and
       tests/fixtures/section-param-of-spaces/hugo.toml projectsSection = '   '; all four keep the
       example site's home pages, which feature projects of projects/. None names a section: rather
       than a site that quietly falls back to projects, a message saying every project lives outside
       a section "42" or "   ", or a Go template execution error, the person building the site must
       get an error message that names the projectsSection param and says, on that same line, that
       it must be a text (for a number or a list) or that it is empty (for an empty text or spaces),
       whatever the rest of the wording, and no Go template execution error that would follow it
       and bury it in technical jargon. Two values of each kind, so that a check, or a message,
       made for a single type or a single empty value does not pass. */
    const cases: { name: string; site: BuiltSite; message: RegExp; description: string }[] = [
      {
        name: 'a number as projectsSection',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_AS_A_NUMBER,
        message: PROJECTS_SECTION_MUST_BE_A_TEXT,
        description: 'projectsSection must be a text',
      },
      {
        name: 'a list as projectsSection',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_AS_A_LIST,
        message: PROJECTS_SECTION_MUST_BE_A_TEXT,
        description: 'projectsSection must be a text',
      },
      {
        name: 'an empty text as projectsSection',
        site: SITE_WITH_AN_EMPTY_PROJECTS_SECTION_PARAM,
        message: PROJECTS_SECTION_IS_EMPTY,
        description: 'projectsSection is empty',
      },
      {
        name: 'spaces only as projectsSection',
        site: SITE_WITH_A_WHITESPACE_ONLY_PROJECTS_SECTION_PARAM,
        message: PROJECTS_SECTION_IS_EMPTY,
        description: 'projectsSection is empty',
      },
    ];
    for (const { name, site, message, description } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      expect(build.errors, `with ${name}, the error message should say ${description}`).toMatch(message);
      expect(build.errors, `with ${name}, no template execution error should follow the error message`).not.toMatch(
        TEMPLATE_EXECUTION_ERROR,
      );
    }
  });

  test('a projectsSection site param that is not a text, on a site whose featured projects live in another section than projects, makes the site build fail with the error message about the param alone, without an error message per featured project', () => {
    /* tests/fixtures/number-param-with-projects-elsewhere/hugo.toml sets projectsSection = 42; its
       content/_index.md features 'realisations/pendule-de-voyage' and
       'realisations/horloge-de-parquet', two projects of content/realisations/, the section the
       person building the site meant to name. The param names no section, so the theme cannot
       tell where featured projects must live: the person must get the error message saying
       projectsSection must be a text, and no error message per featured project saying it does
       not live in projects, a section they never chose and that would send them moving projects
       that are where they should be. The messages are looked for as the lines naming an entry, as
       written in the front matter. */
    const entries = ['realisations/pendule-de-voyage', 'realisations/horloge-de-parquet'];
    const build = tryToBuildSite(SITE_WITH_A_PROJECTS_SECTION_PARAM_AS_A_NUMBER_AND_PROJECTS_ELSEWHERE);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the error message should say projectsSection must be a text').toMatch(
      PROJECTS_SECTION_MUST_BE_A_TEXT,
    );
    for (const entry of entries) {
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `no error message should name the featured project ${entry}, in:\n${build.errors}`).toEqual([]);
    }
  });

  test('an empty projectsSection site param, on a site whose featured projects live in another section than projects, makes the site build fail with the error message about the param alone, without an error message per featured project', () => {
    /* tests/fixtures/unfilled-param-with-projects-elsewhere/hugo.toml sets projectsSection = '';
       its content/_index.md features 'realisations/pendule-de-voyage' and
       'realisations/horloge-de-parquet', two projects of content/realisations/, the section the
       person building the site meant to name. The param names no section, so the theme cannot
       tell where featured projects must live: the person must get the error message saying
       projectsSection is empty, and no error message per featured project saying it does not
       live in a section, an unnamed one or projects, that they never chose and that would send
       them moving projects that are where they should be. The messages are looked for as the
       lines naming an entry, as written in the front matter. */
    const entries = ['realisations/pendule-de-voyage', 'realisations/horloge-de-parquet'];
    const build = tryToBuildSite(SITE_WITH_AN_EMPTY_PROJECTS_SECTION_PARAM_AND_PROJECTS_ELSEWHERE);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the error message should say projectsSection is empty').toMatch(PROJECTS_SECTION_IS_EMPTY);
    for (const entry of entries) {
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `no error message should name the featured project ${entry}, in:\n${build.errors}`).toEqual([]);
    }
  });
});

test.describe('projectsSection site param with whitespace at its start or end: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a projectsSection site param with whitespace at its start or end makes the site build fail, with an error message that names the param, quotes its value and says it has whitespace', () => {
    /* tests/fixtures/section-param-with-trailing-space/hugo.toml sets projectsSection =
       'projects ', with a trailing space, and tests/fixtures/section-param-with-leading-tab/hugo.toml
       projectsSection = "\tprojects", with a leading tab; both keep the example site's home pages,
       which feature projects of projects/. Hugo does not trim the whitespace: a message saying every
       featured project does not live in that section would show the person building the site a
       section name that looks right, the whitespace being invisible in it. The message must name the
       projectsSection param, quote its value as Go's %q does, which shows the whitespace
       ("projects ", "\tprojects"), and say, on that same line, that it has whitespace, whatever the
       rest of the wording. A trailing space and a leading tab, so that checking only one end, or
       only the space character, does not pass. */
    const cases: { name: string; site: BuiltSite; quoted: string }[] = [
      {
        name: 'a trailing space',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_TRAILING_SPACE,
        quoted: '"projects "',
      },
      { name: 'a leading tab', site: SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_LEADING_TAB, quoted: '"\\tprojects"' },
    ];
    for (const { name, site, quoted } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(quoted) && /\bprojectsSection\b/.test(line) && /\bwhitespace\b/i.test(line));
      expect(
        messages,
        `with ${name}, error messages that name projectsSection, quote its value as ${quoted} and say it has whitespace, in:\n${build.errors}`,
      ).not.toEqual([]);
    }
  });

  test('a projectsSection site param with whitespace at its start or end, on a site whose featured projects live in the section it names, makes the site build fail with the error message about the param alone, without an error message per featured project', () => {
    /* tests/fixtures/padded-param-with-projects-elsewhere/hugo.toml sets projectsSection =
       'realisations ', with a trailing space; its content/_index.md features
       'realisations/pendule-de-voyage' and 'realisations/horloge-de-parquet', two projects of
       content/realisations/, the section the person building the site meant to name. Hugo does
       not trim the whitespace, so the param names no section exactly and the theme cannot tell
       where featured projects must live: the person must get the error message saying the param
       has whitespace, and no error message per featured project saying it does not live in a
       section, the padded one or projects, that they never chose and that would send them moving
       projects that are where they should be. The param's message is looked for as in the test
       above, the others as the lines naming an entry, as written in the front matter. */
    const entries = ['realisations/pendule-de-voyage', 'realisations/horloge-de-parquet'];
    const quoted = '"realisations "';
    const build = tryToBuildSite(SITE_WITH_A_PADDED_PROJECTS_SECTION_PARAM_AND_PROJECTS_ELSEWHERE);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const paramMessages = build.errors
      .split('\n')
      .filter((line) => line.includes(quoted) && /\bprojectsSection\b/.test(line) && /\bwhitespace\b/i.test(line));
    expect(
      paramMessages,
      `error messages that name projectsSection, quote its value as ${quoted} and say it has whitespace, in:\n${build.errors}`,
    ).not.toEqual([]);
    for (const entry of entries) {
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `no error message should name the featured project ${entry}, in:\n${build.errors}`).toEqual([]);
    }
  });
});

test.describe('projectsSection site param that names no section: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a projectsSection site param that names no section of the site, on a site whose featured projects live in another section, makes the site build fail with an error message that names the param and quotes its value, without an error message per featured project', () => {
    /* tests/fixtures/misspelled-param-with-projects-elsewhere/hugo.toml sets projectsSection =
       'realisatons', a typo; its content/_index.md features 'realisations/pendule-de-voyage' and
       'realisations/horloge-de-parquet', two projects of content/realisations/, the section the
       person building the site meant to name. The param is a well-formed text, but no section of
       the site has that name: the person must get an error message that names the projectsSection
       param and quotes its value as Go's %q does ("realisatons"), so that they see the typo, and no
       error message per featured project saying it does not live in a section that does not
       exist, which would send them moving projects that are where they meant them. The param's
       message is looked for as the lines naming projectsSection and quoting its value, the others
       as the lines naming an entry, as written in the front matter. */
    const entries = ['realisations/pendule-de-voyage', 'realisations/horloge-de-parquet'];
    const quoted = '"realisatons"';
    const build = tryToBuildSite(SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_NO_SECTION_AND_PROJECTS_ELSEWHERE);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const paramMessages = build.errors
      .split('\n')
      .filter((line) => line.includes(quoted) && /\bprojectsSection\b/.test(line));
    expect(
      paramMessages,
      `error messages that name projectsSection and quote its value as ${quoted}, in:\n${build.errors}`,
    ).not.toEqual([]);
    for (const entry of entries) {
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `no error message should name the featured project ${entry}, in:\n${build.errors}`).toEqual([]);
    }
  });

  test('a projectsSection site param that leads to a section without being its name, on a site whose featured projects live in that section, makes the site build fail with the error message that it names no section and quotes its value, without an error message per featured project', () => {
    /* tests/fixtures/extension-param-with-its-projects/hugo.toml sets projectsSection =
       'projects.md', the file name of a page rather than the name of a section; its
       content/_index.md features 'projects/horloge-astronomique' and 'projects/regulateur-noyer',
       two projects of the example site's projects/ section. Hugo's GetPage resolves '/projects.md'
       to the projects section, but the param is not that section's name, and featured projects are
       compared with the param through their section's name: the person building the site must get
       the error message that names the projectsSection param, quotes its value as Go's %q does
       ("projects.md") and says it names no section, whatever the rest of the wording, and no error
       message per featured project saying it does not live in a section it does live in. The
       param's message is looked for as the lines naming projectsSection, quoting its value and
       saying "names no section", the others as the lines naming an entry, as written in the front
       matter. */
    const entries = ['projects/horloge-astronomique', 'projects/regulateur-noyer'];
    const quoted = '"projects.md"';
    const build = tryToBuildSite(SITE_WITH_A_PROJECTS_SECTION_PARAM_LEADING_TO_A_SECTION_WITHOUT_NAMING_IT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const paramMessages = build.errors
      .split('\n')
      .filter(
        (line) => line.includes(quoted) && /\bprojectsSection\b/.test(line) && /\bnames no section\b/i.test(line),
      );
    expect(
      paramMessages,
      `error messages that name projectsSection, quote its value as ${quoted} and say it names no section, in:\n${build.errors}`,
    ).not.toEqual([]);
    for (const entry of entries) {
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `no error message should name the featured project ${entry}, in:\n${build.errors}`).toEqual([]);
    }
  });

  test('a projectsSection site param that leads to a top-level section through a path makes the site build fail with the error message that it names no section and quotes its value, and no error message saying it names a subsection', () => {
    /* tests/fixtures/index-file-param/hugo.toml sets projectsSection = 'projects/_index.md', the
       path of the projects section's own page rather than the name of a section, and keeps the
       example site's home pages, which feature projects of projects/. Hugo's GetPage resolves
       '/projects/_index.md' to the top-level projects section, so the value holds a slash without
       naming a subsection: telling the person building the site that it names one, and that it
       must name a top-level section, would leave them puzzled, since projects is one. The message
       must name the projectsSection param, quote its value as Go's %q does ("projects/_index.md")
       and say, on that same line, that it names no section, whatever the rest of the wording; no
       error line may say the param names a subsection. */
    const quoted = '"projects/_index.md"';
    const build = tryToBuildSite(SITE_WITH_A_PROJECTS_SECTION_PARAM_LEADING_TO_A_SECTION_THROUGH_A_PATH);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const lines = build.errors.split('\n');
    const paramMessages = lines.filter(
      (line) => line.includes(quoted) && /\bprojectsSection\b/.test(line) && /\bnames no section\b/i.test(line),
    );
    expect(
      paramMessages,
      `error messages that name projectsSection, quote its value as ${quoted} and say it names no section, in:\n${build.errors}`,
    ).not.toEqual([]);
    const subsectionMessages = lines.filter((line) => /\bsubsections?\b/i.test(line));
    expect(
      subsectionMessages,
      `no error message should say the param names a subsection, in:\n${build.errors}`,
    ).toEqual([]);
  });
});

test.describe('projectsSection site param that names a subsection: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a projectsSection site param that names a subsection, on a site whose featured projects live in that subsection, makes the site build fail with an error message that names the param, quotes its value and says it must name a top-level section, without an error message per featured project', () => {
    /* tests/fixtures/nested-param-with-its-projects/hugo.toml sets projectsSection =
       'projects/horlogerie', a subsection of projects/; its content/_index.md features
       'projects/horlogerie/pendule-de-voyage' and 'projects/horlogerie/horloge-comtoise', two
       projects of that subsection. Featured projects are compared with the param through their
       top-level section, so a param naming a subsection can never match: rather than an error
       message per featured project saying it does not live in the section where it does live,
       the person building the site must get an error message that names the projectsSection
       param, quotes its value as Go's %q does ("projects/horlogerie") and says, on that same line,
       that it must be a top-level section, whatever the rest of the wording. The param's message
       is looked for as the lines naming projectsSection, quoting its value and saying top-level,
       the others as the lines naming an entry, as written in the front matter. */
    const entries = ['projects/horlogerie/pendule-de-voyage', 'projects/horlogerie/horloge-comtoise'];
    const quoted = '"projects/horlogerie"';
    const build = tryToBuildSite(SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_A_SUBSECTION_AND_ITS_PROJECTS);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    const paramMessages = build.errors
      .split('\n')
      .filter((line) => line.includes(quoted) && /\bprojectsSection\b/.test(line) && /\btop[- ]level\b/i.test(line));
    expect(
      paramMessages,
      `error messages that name projectsSection, quote its value as ${quoted} and say it must be a top-level section, in:\n${build.errors}`,
    ).not.toEqual([]);
    for (const entry of entries) {
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `no error message should name the featured project ${entry}, in:\n${build.errors}`).toEqual([]);
    }
  });
});

test.describe('projectsSection site param with a slash at its start or end: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a projectsSection site param with a slash at its start or end makes the site build fail, with an error message that names the param, quotes its value and says something about a slash, and no error message saying it names a subsection', () => {
    /* tests/fixtures/section-param-with-leading-separator/hugo.toml sets projectsSection =
       '/projects', as a path from the content root, and
       tests/fixtures/section-param-with-trailing-separator/hugo.toml projectsSection = 'projects/', as
       a folder; both keep the example site's home pages, which feature projects of projects/. Either
       value holds a slash, but names no subsection: telling the person building the site that it
       does, and that it must name a top-level section, would leave them puzzled, since projects is
       one. The message must name the projectsSection param, quote its value as Go's %q does
       ("/projects", "projects/") and say, on that same line, something about a slash, whatever the
       rest of the wording; no error line may say the param names a subsection. A slash at each end,
       so that checking only one of them does not pass. */
    const cases: { name: string; site: BuiltSite; quoted: string }[] = [
      { name: 'a leading slash', site: SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_LEADING_SLASH, quoted: '"/projects"' },
      {
        name: 'a trailing slash',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_TRAILING_SLASH,
        quoted: '"projects/"',
      },
    ];
    for (const { name, site, quoted } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      const lines = build.errors.split('\n');
      const messages = lines.filter(
        (line) => line.includes(quoted) && /\bprojectsSection\b/.test(line) && /\bslash/i.test(line),
      );
      expect(
        messages,
        `with ${name}, error messages that name projectsSection, quote its value as ${quoted} and say something about a slash, in:\n${build.errors}`,
      ).not.toEqual([]);
      const subsectionMessages = lines.filter((line) => /\bsubsections?\b/i.test(line));
      expect(
        subsectionMessages,
        `with ${name}, no error message should say the param names a subsection, in:\n${build.errors}`,
      ).toEqual([]);
    }
  });
});

test.describe('projectsSection site param that names no section, a subsection or has a slash at one end: one error message on a bilingual site', () => {
  runBuildTestsInOneProjectOnly();

  test('a projectsSection site param that names no section, names a subsection, or has a slash at its start or end makes the site build fail with a single error message about the param, that names no language, as the other projectsSection error messages do', () => {
    /* The projectsSection param is a site param, the same for every language, but its checks run
       once per home page, and the example site is bilingual (fr, en). Hugo prints an identical
       error line only once: the messages saying the param is not a text, is empty or has
       whitespace name no language and show once, while a message that names the language of the
       home page being built shows once per language, a repetition that suggests to the person
       building the site that each language has its own mistake to fix, and a language that the
       param, written once for the whole site, does not have. The sites are those of the tests
       above: tests/fixtures/misspelled-param-with-projects-elsewhere ('realisatons', no section),
       tests/fixtures/nested-param-with-its-projects ('projects/horlogerie', a subsection),
       tests/fixtures/section-param-with-leading-separator ('/projects') and
       tests/fixtures/section-param-with-trailing-separator ('projects/'). The param's message is
       looked for as the lines naming projectsSection and quoting its value as Go's %q does: there
       must be exactly one, and it must name no language code (fr, en), looked for as a word that
       no other word follows. Each of the three checks, so that fixing only one of them does not
       pass. */
    const cases: { name: string; site: BuiltSite; quoted: string }[] = [
      {
        name: 'a param that names no section',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_NO_SECTION_AND_PROJECTS_ELSEWHERE,
        quoted: '"realisatons"',
      },
      {
        name: 'a param that names a subsection',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_A_SUBSECTION_AND_ITS_PROJECTS,
        quoted: '"projects/horlogerie"',
      },
      { name: 'a leading slash', site: SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_LEADING_SLASH, quoted: '"/projects"' },
      {
        name: 'a trailing slash',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_WITH_A_TRAILING_SLASH,
        quoted: '"projects/"',
      },
    ];
    for (const { name, site, quoted } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(quoted) && /\bprojectsSection\b/.test(line));
      expect(
        messages,
        `with ${name}, one error message naming projectsSection and quoting its value as ${quoted}, in:\n${build.errors}`,
      ).toHaveLength(1);
      expect(
        messages.filter((line) =>
          ['fr', 'en'].some((language) => new RegExp(languageCodePattern(language), 'u').test(line)),
        ),
        `with ${name}, projectsSection error messages that name a language`,
      ).toEqual([]);
    }
  });

  test('an invalid projectsSection site param is reported once for the whole build, although both home pages and both list pages check it, and still once when no home page is rendered to check it', () => {
    /* The projectsSection param belongs to the site, not to a language, and the section pages use
       it to tell which section is the projects list: with an invalid value, they must not quietly
       fall back to projects, so they check it as the home pages do. On the bilingual example site,
       that makes four pages checking the same param: the person building the site must still get
       a single error message about it. Two sites, with the same invalid value, 'realisatons', a
       typo that names no section: tests/fixtures/misspelled-param-with-projects-elsewhere, whose
       two home pages and two section pages are rendered, and
       tests/fixtures/unrendered-homes-with-a-misspelled-param, whose home pages declare
       [build] render = 'never', so that only the two section pages of projects/ are left to check
       the param. The build must fail on both, and the param's problem is looked for as the lines
       naming projectsSection and quoting its value as Go's %q does: there must be exactly one. */
    const quoted = '"realisatons"';
    const cases: { name: string; site: BuiltSite }[] = [
      {
        name: 'home pages and section pages rendered',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_NO_SECTION_AND_PROJECTS_ELSEWHERE,
      },
      {
        name: 'section pages rendered, home pages not',
        site: SITE_WITH_A_PROJECTS_SECTION_PARAM_NAMING_NO_SECTION_AND_UNRENDERED_HOME_PAGES,
      },
    ];
    for (const { name, site } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      const messages = build.errors
        .split('\n')
        .filter((line) => line.includes(quoted) && /\bprojectsSection\b/.test(line));
      expect(
        messages,
        `with ${name}, one error message naming projectsSection and quoting its value as ${quoted}, in:\n${build.errors}`,
      ).toHaveLength(1);
    }
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

  test('on a phone, without the "Tous les projets" link, the first card of the section "Projets sélectionnés" is as far below the heading as it is below the link on a home page that has it', async ({
    page,
    context,
  }) => {
    const siteWithoutLink = SITE_WITH_AN_UNPUBLISHED_PROJECTS_SECTION;
    await serveSite(context, siteWithoutLink, siteDirectories[sites.findIndex(({ site }) => site === siteWithoutLink)]);
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
    /* The home page of the site whose carnets/ section has no published page has no link: the
       first card comes right after the heading. */
    await page.goto(`${siteWithoutLink.origin}/fr/`);
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

test.describe('home page of another site, featuring a project of an unpublished subsection of a section other than the projects section', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_A_PROJECT_IN_AN_UNPUBLISHED_SUBSECTION_OF_ANOTHER_SECTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('the section "Projets sélectionnés" shows the card of the project but no "Tous les projets" link, since the published section above its subsection is not the projects section', async ({
    page,
    context,
  }) => {
    const site = SITE_WITH_A_PROJECT_IN_AN_UNPUBLISHED_SUBSECTION_OF_ANOTHER_SECTION;
    await serveSite(context, site, siteDirectory);
    /* In tests/fixtures/unpublished-subsection-of-another-section/content/, archives/_index.md is
       published, while archives/brouillons/_index.md declares [build] render = 'never'. */
    const sectionResponse = await page.goto(`${site.origin}/fr/archives/`);
    expect(sectionResponse?.status(), 'status of the archives section page').toBe(200);
    const subsectionResponse = await page.goto(`${site.origin}/fr/archives/brouillons/`);
    expect(subsectionResponse?.status(), 'status of the brouillons subsection page').toBe(404);
    await page.goto(`${site.origin}/fr/`);
    const section = projectsSection(page);
    const card = cardTitled(section, 'Carillon de beffroi');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    /* archives/ holds the featured project, but it is not the projects section, projects/: no link
       claims it lists all the projects. */
    await expect
      .soft(section.getByRole('link', { name: 'Tous les projets' }), `"Tous les projets" links on ${site.origin}/fr/`)
      .toHaveCount(0);
    await expect
      .soft(section.getByText('Tous les projets'), `"Tous les projets" texts on ${site.origin}/fr/`)
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
    /* tests/fixtures/long-project-words/content/projects/pendule-aux-mots-longs.md declares a role,
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
    /* tests/fixtures/long-project-title-without-years/content/projects/pendule-sans-annees.md
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
    TEMPLATE_EXECUTION_ERROR,
  );
}

/* A message naming, on its own line, the projects section: the word "section" right next to the
   word projects, in either order ("projects section", "section projects"), projects possibly
   between quotes or guillemets, and neither a word nor a page path under projects/ continuing
   it. Every message of this partial already holds the token projects (its "projects:" prefix,
   the words "projects parameter"), so the token alone would also pass for a message naming
   another section. A quote opening "projects section" needs no pattern of its own: the match can
   start at projects, which the lookbehind still sees after the quote. */
const NAMES_THE_PROJECTS_SECTION =
  /(?<![\w-])projects(?![\w-]|\/[\w-])(?:\s?["'`‘’“”«»])?\s+section\b|\bsection\s+(?:["'`‘’“”«»]\s?)?(?<![\w-])projects(?![\w-]|\/[\w-])/u;

test.describe('featured project content errors: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a home page that features a page that does not exist makes the site build fail, with an error message that names the projects parameter and that page reference, without a template execution error after it', () => {
    /* tests/fixtures/featured-ref-without-page/content/_index.md features
       'projects/restauration-pendule', an existing page, then 'projects/sablier-introuvable', which
       no page answers. Rather than a section that silently drops that card, the person building
       the site must get a failure whose message names the projects parameter, in the style of the
       clients messages, which name the clients parameter, and the reference as written in the
       front matter, whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the missing page reference').toContain(
      'projects/sablier-introuvable',
    );
  });

  test('a home page whose projects parameter is a text instead of a list makes the site build fail, with an error message that names the projects parameter and says it must be a list, without a template execution error after it', () => {
    /* tests/fixtures/single-ref-instead-of-list/content/_index.md declares
       projects = 'projects/restauration-pendule', a text rather than a list of page references,
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

  test("a home page whose projects parameter is not a list makes the site build fail with an error message that names the home page's language, for a French home page and for an English one", () => {
    /* A bilingual site has a home page per language, each with its own projects: a message saying
       the projects parameter must be a list that does not say which language's home page is at
       fault leaves the person building the site to look for it in every
       content/_index.<language>.md file. The messages on the entries of the list already name the
       home page's language by its code (fr, en); this one must name it too, whatever the rest of
       the wording. The French home page comes from the fixture of the test of this message above,
       tests/fixtures/single-ref-instead-of-list/content/_index.md; the English one, from
       tests/fixtures/english-home-single-ref/content/_index.en.md, makes the same mistake. The
       message, one line naming the projects parameter, must be there and name, on that line, the
       home page's language, looked for, as in the clients' tests, as a word that no other word
       follows. A French home page and an English one, so that a language written in the template
       does not pass. */
    const cases: { name: string; site: BuiltSite; language: string }[] = [
      { name: 'a French home page with projects as a text', site: SITE_WITH_PROJECTS_AS_TEXT, language: 'fr' },
      {
        name: 'an English home page with projects as a text',
        site: SITE_WITH_AN_ENGLISH_HOME_WITH_PROJECTS_AS_TEXT,
        language: 'en',
      },
    ];
    for (const { name, site, language } of cases) {
      const build = tryToBuildSite(site);
      expectProjectsBuildError(build, `with ${name}`);
      const messages = build.errors.split('\n').filter((line) => /\bprojects\s+parameter\b/.test(line));
      expect(
        messages,
        `with ${name}, one error message naming the projects parameter, in:\n${build.errors}`,
      ).toHaveLength(1);
      expect(
        messages.filter((line) => !new RegExp(languageCodePattern(language), 'u').test(line)),
        `with ${name}, projects error messages that do not name the home page's language, ${language}`,
      ).toEqual([]);
    }
  });

  test('a home page whose projects list holds tables instead of page references makes the site build fail, with an error message that names the projects parameter and the position of each table, without a template execution error after it', () => {
    /* tests/fixtures/table-instead-of-ref/content/_index.md declares projects as a list (so the
       check that projects is a list lets it through) whose second entry is a table,
       { path = 'projects/restauration-pendule' }, rather than a page reference, although that page
       exists, and so is its fourth, { path = 'projects/montre-grande-complication' }. Rather than a section that looks that table up as a page, the person building the
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
    /* tests/fixtures/padded-ref/content/_index.md features 'projects/restauration-pendule ', with
       a trailing space, then "\tprojects/montre-grande-complication", with a leading tab: both
       pages exist, but Hugo does not trim the whitespace, so that it finds neither. A message
       that only says the page cannot be found would show the person building the site a
       reference that looks right, the whitespace being invisible in it: the message must also
       say that the reference has whitespace, on the same line as the projects parameter and that
       reference, whatever the rest of the wording. A trailing space and a leading tab, so that
       checking only one end, or only the space character, does not pass. */
    const build = tryToBuildSite(SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE);
    expectProjectsBuildError(build);
    for (const { name, reference } of [
      { name: 'a trailing space', reference: 'projects/restauration-pendule' },
      { name: 'a leading tab', reference: 'projects/montre-grande-complication' },
    ]) {
      expect(
        build.errors,
        `for the reference with ${name}, the error message should name the projects parameter and that reference and say it has whitespace`,
      ).toMatch(new RegExp(`^(?=.*\\bprojects\\s+parameter\\b)(?=.*${reference})(?=.*\\bwhitespace\\b).*$`, 'im'));
    }
  });

  test('a home page whose projects list holds page references with leading or trailing whitespace makes the site build fail, with an error message, for each such reference, that gives the position of that entry', () => {
    /* tests/fixtures/padded-ref/content/_index.md features 'projects/restauration-pendule ', with
       a trailing space, as its first entry, then "\tprojects/montre-grande-complication", with a
       leading tab, as its second. Besides the reference, whose whitespace is invisible in the
       message, the message must give the position of the entry in the list, counted from 1
       ("entry 1", "entry 2"), as the messages on blank entries do, so that whoever fills in the
       content finds it. The position is looked for on the same line as the reference it belongs
       to, whatever the rest of the wording; two positions, so that a hard-coded position does not
       pass. */
    const build = tryToBuildSite(SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE);
    expectProjectsBuildError(build);
    for (const { position, reference } of [
      { position: 1, reference: 'projects/restauration-pendule' },
      { position: 2, reference: 'projects/montre-grande-complication' },
    ]) {
      expect(
        build.errors,
        `for the reference ${reference}, the error message should give the position of that entry, entry ${position}`,
      ).toMatch(new RegExp(`^(?=.*${entryPositionPattern(position)})(?=.*${escapedForRegExp(reference)}).*$`, 'im'));
    }
  });

  test('a home page whose projects list references the home page itself, as "/", makes the site build fail, with an error message that names the projects parameter and that entry, without a template execution error after it', () => {
    /* tests/fixtures/self-ref/content/_index.md features 'projects/restauration-pendule', then '/':
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
    /* tests/fixtures/dot-self-ref/content/_index.md features 'projects/restauration-pendule', then
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

  test('a home page whose projects list references a section page, such as "projects", the projects section itself, makes the site build fail, with an error message that names the projects parameter and that entry and says it is not a project, without a template execution error after it', () => {
    /* tests/fixtures/section-ref/content/_index.md features 'projects/restauration-pendule', then
       'projects': the example site's projects section, which exists, so that the check for a page
       not found lets it through, and is not the home page, so that the check for the home page
       lets it through too, but is a section page, no project. Rather than a section with a card
       of the projects section, the person building the site must get a failure whose message
       names the projects parameter, in the style of the clients messages, which name the clients
       parameter, the entry as written in the front matter, and says that it is "not a project",
       whatever the rest of the wording. The entry, 'projects', is looked for on the message's line
       between quotes, so that the word projects of "projects parameter", a file path or another
       page reference under projects/ does not pass for it; "not a project" is looked for on that
       same line. */
    const build = tryToBuildSite(SITE_WITH_A_SECTION_AS_FEATURED_PROJECT);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should name the entry "projects" as written in the front matter').toMatch(
      /\bprojects\s+parameter\b.*[«"'‘“]projects[»"'’”]/m,
    );
    expect(build.errors, 'the error message should say that entry is not a project').toMatch(
      /\bprojects\s+parameter\b.*\bnot\s+a\s+project\b/im,
    );
  });

  test('a home page whose projects list references a taxonomy term page, such as "tags/horlogerie", the page of a tag a project carries, makes the site build fail, with an error message that names the projects parameter and that entry and says it is not a project, without a template execution error after it', () => {
    /* tests/fixtures/taxonomy-refs enables the tags taxonomy, which the example site disables,
       adds a project that carries the tag 'horlogerie', and its content/_index.md features
       'projects/restauration-pendule', then 'tags/horlogerie': the page of that tag, which exists,
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
    /* tests/fixtures/error-page-ref/content/_index.md features 'projects/restauration-pendule', then
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

  test("a home page that features a project living in a top-level section other than projects makes the site build fail, with an error message that names that entry, the projects section and the home page's language, without a template execution error after it", () => {
    /* Without the projectsSection site param, featured projects must live in the theme's default
       section, projects, the one the "Tous les projets" link opens.
       tests/fixtures/projects-in-another-section/content/_index.md features a single
       project, 'realisations/pendule-de-voyage', of another published section, realisations/;
       tests/fixtures/projects-in-two-sections/content/_index.md features
       'projects/restauration-pendule', then 'realisations/coucou-de-chalet', of that same other
       section. Rather than a section whose cards come from anywhere, the person building the site
       must get a failure whose message, on one line, names the entry as written in the front
       matter, the section the project must live in, projects, and the home page's language by its
       code, whatever the rest of the wording, and no Go template execution error that would
       follow it and bury it in technical jargon. Two sites whose entries differ, so that an entry
       written in the template does not pass; the second also features a project of projects/,
       which must not be reported. The section is looked for as the word projects right next to
       the word "section", so that the "projects:" prefix and the words "projects parameter" of
       every message of this partial do not pass for it; the language code, as in the other
       projects' tests, as a word that no other word follows. */
    const cases: { name: string; site: BuiltSite; entry: string; language: string }[] = [
      {
        name: 'a French home page featuring a project of realisations/ alone',
        site: SITE_WITH_PROJECTS_IN_ANOTHER_SECTION,
        entry: 'realisations/pendule-de-voyage',
        language: 'fr',
      },
      {
        name: 'a French home page featuring a project of projects/, then one of realisations/',
        site: SITE_WITH_PROJECTS_IN_TWO_SECTIONS,
        entry: 'realisations/coucou-de-chalet',
        language: 'fr',
      },
    ];
    for (const { name, site, entry, language } of cases) {
      const build = tryToBuildSite(site);
      expect(build.succeeded, `with ${name}, the site build should fail`).toBe(false);
      expect(build.errors, `with ${name}, no template execution error should follow the error message`).not.toMatch(
        TEMPLATE_EXECUTION_ERROR,
      );
      expect(
        build.errors,
        `with ${name}, no error message should name the featured project of projects/`,
      ).not.toContain('projects/restauration-pendule');
      const messages = build.errors.split('\n').filter((line) => line.includes(entry));
      expect(messages, `with ${name}, one error message naming the entry ${entry}, in:\n${build.errors}`).toHaveLength(
        1,
      );
      expect(messages[0], `with ${name}, the error message should name the projects section`).toMatch(
        NAMES_THE_PROJECTS_SECTION,
      );
      expect(messages[0], `with ${name}, the error message should name the home page's language, ${language}`).toMatch(
        new RegExp(languageCodePattern(language), 'u'),
      );
    }
  });

  test("a home page that features a project living at the content root, outside any section, makes the site build fail, with an error message that names that entry, the projects section and the home page's language, without a template execution error after it", () => {
    /* Without the projectsSection site param, featured projects must live in the theme's default
       section, projects, the one the "Tous les projets" link opens: a page at the root of the
       content, in no section at all, does not either.
       tests/fixtures/project-at-the-root/content/_index.md features a single project,
       'pendule-murale', a page at the root of the content. Rather than a section with a card of
       that page, the person building the site must get the same failure as for a project of
       another section: a message that, on one line, names the entry as written in the front
       matter, the section the project must live in, projects, and the home page's language by its
       code, whatever the rest of the wording, and no Go template execution error that would
       follow it and bury it in technical jargon. The section and the language are looked for as
       in the test above. */
    const entry = 'pendule-murale';
    const language = 'fr';
    const build = tryToBuildSite(SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'no template execution error should follow the error message').not.toMatch(
      TEMPLATE_EXECUTION_ERROR,
    );
    const messages = build.errors.split('\n').filter((line) => line.includes(entry));
    expect(messages, `one error message naming the entry ${entry}, in:\n${build.errors}`).toHaveLength(1);
    expect(messages[0], 'the error message should name the projects section').toMatch(NAMES_THE_PROJECTS_SECTION);
    expect(messages[0], `the error message should name the home page's language, ${language}`).toMatch(
      new RegExp(languageCodePattern(language), 'u'),
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
          linePattern: entryPositionPattern(2),
        },
        {
          name: 'a French home page with an empty reference',
          site: SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF,
          linePattern: entryPositionPattern(2),
        },
        {
          name: 'a French home page with a whitespace-only reference',
          site: SITE_WITH_A_WHITESPACE_ONLY_FEATURED_PROJECT_REF,
          linePattern: entryPositionPattern(3),
        },
        {
          name: 'a French home page with a padded reference',
          site: SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE,
          linePattern: entryPositionPattern(1),
        },
        {
          name: 'a French home page with a section page',
          site: SITE_WITH_A_SECTION_AS_FEATURED_PROJECT,
          linePattern: NOT_A_PROJECT_PATTERN,
        },
      ],
    },
    {
      language: 'en',
      sites: [
        {
          name: 'an English home page with a table',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: entryPositionPattern(1),
        },
        {
          name: 'an English home page with an empty reference',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: entryPositionPattern(2),
        },
        {
          name: 'an English home page with a padded reference',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: entryPositionPattern(3),
        },
        {
          name: 'an English home page with a section page',
          site: SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES,
          linePattern: NOT_A_PROJECT_PATTERN,
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
    /* tests/fixtures/draft-ref/content/_index.md features 'projects/restauration-pendule', then
       'projects/pendule-portique', whose page exists but declares draft = true, so that the
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
      'projects/pendule-portique',
    );
    expect(build.errors, 'the error message should say the page may be unpublished').toMatch(/publi/i);
    expect(build.errors, 'the error message should name a draft as a possible reason').toMatch(/\bdraft\b/i);
    expect(build.errors, 'the error message should name a future date as a possible reason').toMatch(
      /future|scheduled/i,
    );
    expect(build.errors, 'the error message should name an expired page as a possible reason').toMatch(/expir/i);
  });

  test('a home page whose projects list references a page that cannot be found makes the site build fail, with an error message that gives a project that does not exist as a possible cause', () => {
    /* tests/fixtures/featured-ref-without-page/content/_index.md features
       'projects/restauration-pendule', an existing page, then 'projects/sablier-introuvable', which
       no page answers, in any language, published or not. A message that only blames a missing
       translation or an unpublished page (a draft, a future date, an expired page) would send the
       person building the site looking for a translation or a publishing setting, while the most
       common cause is a reference that matches no content file at all: a project that does not
       exist, or a reference with a typo. The message must also give that as a possible cause —
       a page or project that does not exist (does not exist, doesn't exist, non-existent, no such
       page), whatever the rest of the wording. "cannot be found" alone does not count: it states
       the failure, not its cause. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND);
    expectProjectsBuildError(build);
    expect(build.errors, 'the error message should give a project that does not exist as a possible cause').toMatch(
      /\b(?:not|n['’]t)\s+exist|\bnon-?existent\b|\bno\s+such\b/i,
    );
  });

  test('a home page whose projects list references a page that cannot be found makes the site build fail, with an error message that gives a typo in the reference as a possible cause', () => {
    /* tests/fixtures/featured-ref-without-page/content/_index.md features
       'projects/restauration-pendule', an existing page, then 'projects/sablier-introuvable', which
       no page answers, in any language, published or not. A reference typed wrong is as common a
       cause as a project that does not exist, and the hero's message for a pageRef that matches
       no page already names it: a projects message that leaves it out would send the person
       building the site looking for a missing project or a publishing setting, while the project
       is right there under another name. The projects message that cites this reference must, on
       that same line, give a typo in the reference (typo, misspelled) as a possible cause,
       whatever the rest of the wording. */
    const build = tryToBuildSite(SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND);
    expectProjectsBuildError(build);
    expect(
      build.errors,
      'the projects error message that cites the missing reference should give a typo as a possible cause',
    ).toMatch(/^(?=.*\bprojects:)(?=.*projects\/sablier-introuvable)(?=.*(?:\btypo|\bmisspel)).*$/im);
  });

  test('a home page whose projects key is written under [params.hero] makes the site build fail, with an error message that says the projects parameter belongs to [params], before [params.hero], without a template execution error after it', () => {
    /* tests/fixtures/featured-list-in-the-banner/content/_index.md writes projects = [...] after
       the [params.hero] header, so that TOML puts it in the hero's table (params.hero.projects)
       rather than in params.projects, where the theme reads the featured projects. Rather than a
       home page whose projects silently disappear, the person building the site must get a
       failure whose message says, on one line, that projects belongs to [params], written before
       [params.hero], whatever the rest of the wording, and no Go template execution error that
       would follow it and bury it in technical jargon. [params] is looked for as written, so that
       [params.hero] alone does not count for it. */
    const build = tryToBuildSite(SITE_WITH_PROJECTS_UNDER_THE_HERO);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(
      build.errors,
      'one error message should say that projects belongs to [params], before [params.hero]',
    ).toMatch(/^(?=.*\bprojects\b)(?=.*\[params\])(?=.*\bbefore\s+\[params\.hero\]).*$/im);
    expect(build.errors, 'no template execution error should follow the error message').not.toMatch(
      TEMPLATE_EXECUTION_ERROR,
    );
  });
});
