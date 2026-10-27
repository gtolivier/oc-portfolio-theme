import { type BrowserContext, type Locator, type Page, test, expect } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import { clickOrTap } from './helpers/pointer';
import {
  type Channels,
  type Rectangle,
  bandsWithoutDrawnPixels,
  brightestLuminanceAboveBackgroundPerColumnInRectangle,
  canvasOpacityOverBackgroundAt,
  countDrawnStrokes,
  countPixelsNotOfBackground,
  drawnStrokesInRectangle,
  horizontalBandsWithoutDrawnPixels,
  luminanceAboveBackgroundInRectangle,
  luminanceAboveBackgroundPerColumn,
  pixelsNotOfBackgroundPerColumn,
  pixelsNotOfBackgroundPerRow,
  strongestShareOfColourInRectangle,
  verticalBands,
} from './helpers/pixels';

/* The y, on the page, of a point `margin` CSS pixels below the box of a tick-field, or above
   it if the viewport, `viewportHeight` high, ends first: outside the tick-field. */
function yBelowOrAboveField(fieldBox: Rectangle, viewportHeight: number, margin: number): number {
  return fieldBox.y + fieldBox.height + margin < viewportHeight ? fieldBox.y + fieldBox.height + margin : fieldBox.y - margin;
}

test.describe('catalog: tick-field', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(CATALOG_SITE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  /* Serves the catalog and opens tick-field-empty, the visitor's motion preference emulated
     when `reducedMotion` is given, and time standing still from before the page loads, until
     the test advances it. Returns the only tick-field of the page, once visible
     (tests/fixtures/catalog/content/tick-field-empty.md): 320px high, as wide as the page,
     with no content and a solid background, followed by a paragraph. */
  const openEmptyTickField = async (
    page: Page,
    context: BrowserContext,
    reducedMotion?: 'reduce' | 'no-preference',
  ): Promise<Locator> => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    if (reducedMotion) await page.emulateMedia({ reducedMotion });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-empty/`);
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    return tickField;
  };

  /* Opens tick-field-empty like openEmptyTickField, the visitor's motion preference left as the
     browser sets it, scrolls the tick-field into view and lets 2 s pass: it is fully revealed. */
  const openRevealedTickField = async (page: Page, context: BrowserContext): Promise<Locator> => {
    const tickField = await openEmptyTickField(page, context);
    await tickField.scrollIntoViewIfNeeded();
    await page.clock.runFor(2000);
    return tickField;
  };

  test('a tick-field shows a decorative canvas, hidden from assistive technologies, that covers its whole box behind its content: its link stays the element under the pointer', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field.md), 320px
       high, whose content is a paragraph with a one-word link. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    const canvas = tickField.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible();

    const fieldBox = await tickField.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    expect(canvasBox, 'the canvas has a box on screen').not.toBeNull();
    expect(fieldBox!.height, 'the tick-field is 320px high').toBeCloseTo(320, 0);
    expect(canvasBox!.x, 'the canvas starts at the left edge of the tick-field').toBeCloseTo(fieldBox!.x, 0);
    expect(canvasBox!.y, 'the canvas starts at the top edge of the tick-field').toBeCloseTo(fieldBox!.y, 0);
    expect(canvasBox!.width, 'the canvas is as wide as the tick-field').toBeCloseTo(fieldBox!.width, 0);
    expect(canvasBox!.height, 'the canvas is as high as the tick-field').toBeCloseTo(fieldBox!.height, 0);

    /* Hidden from assistive technologies: the canvas, or one of its ancestors inside the
       tick-field, is aria-hidden. */
    const hiddenFromAssistiveTechnologies = await canvas.evaluate((element) => {
      for (let node: Element | null = element; node && node.localName !== 'tick-field'; node = node.parentElement) {
        if (node.getAttribute('aria-hidden') === 'true') return true;
      }
      return false;
    });
    expect(hiddenFromAssistiveTechnologies, 'the canvas is hidden from assistive technologies').toBe(true);

    /* Behind the content: at the middle of the link's first line box, the element under the
       pointer is the link (or one of its descendants), not the canvas. The first line box,
       rather than the bounding box, so that the point stays on the link even if it wraps. */
    const link = tickField.getByRole('link', { name: 'lien' });
    await expect(link).toBeVisible();
    await link.scrollIntoViewIfNeeded();
    const linkIsUnderThePointer = await link.evaluate((element) => {
      const firstLineBox = element.getClientRects()[0];
      if (!firstLineBox) return false;
      const hit = document.elementFromPoint(
        firstLineBox.left + firstLineBox.width / 2,
        firstLineBox.top + firstLineBox.height / 2,
      );
      return hit !== null && element.contains(hit);
    });
    expect(linkIsUnderThePointer, 'at the middle of the link, the element under the pointer is the link').toBe(true);
  });

  test('a tick-field starts empty and reveals from left to right', { tag: '@pixels' }, async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    /* Right after load: the first animation frame has run. */
    await page.clock.runFor(16);

    const differingPixels = await countPixelsNotOfBackground(tickField, await tickField.screenshot());
    expect(differingPixels, 'pixels of the tick-field that differ from its background, right after load').toBe(0);

    /* 500 ms after load, midway through the reveal, which sweeps the width in about 1.1 s: the
       front is near the middle, well past the left part and well short of the right part. */
    await page.clock.runFor(484);

    const screenshot = await tickField.screenshot();
    const { columns, scale } = await pixelsNotOfBackgroundPerColumn(tickField, screenshot);
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The left part, the first 30% of the width, split into adjacent vertical bands at least
       40px wide each: every band must show drawn pixels. */
    const LEFT_PART_END = 0.3 * width;
    const MIN_BAND_WIDTH = 40;
    const emptyBands = bandsWithoutDrawnPixels(columns, scale, LEFT_PART_END, MIN_BAND_WIDTH);
    expect(
      emptyBands,
      `bands of the left part (0–${Math.round(LEFT_PART_END)}px) of the ${Math.round(width)}px-wide tick-field with no drawn pixel, 500 ms after load`,
    ).toEqual([]);

    /* The right part, the last 40% of the width: still nothing but the background. */
    const RIGHT_PART_START = 0.6 * width;
    const drawnPixelsOnTheRight = columns
      .slice(Math.round(RIGHT_PART_START * scale))
      .reduce((sum, count) => sum + count, 0);
    expect(
      drawnPixelsOnTheRight,
      `pixels of the right part (${Math.round(RIGHT_PART_START)}–${Math.round(width)}px) of the tick-field that differ from its background, 500 ms after load`,
    ).toBe(0);
  });

  test('2 s after load, a tick-field is drawn across its whole width: every vertical band of it, from the left edge to the right edge, shows pixels that differ from its background', { tag: '@pixels' }, async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    await page.clock.runFor(2000);

    const screenshot = await tickField.screenshot();
    const { columns, scale } = await pixelsNotOfBackgroundPerColumn(tickField, screenshot);
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The width split into adjacent vertical bands, at least 40px wide each: the first starts
       at the left edge, the last ends at the right edge. Every band must show drawn pixels,
       so that the drawing reaches both edges and leaves no gap in between. */
    const MIN_BAND_WIDTH = 40;
    const emptyBands = bandsWithoutDrawnPixels(columns, scale, width, MIN_BAND_WIDTH);
    expect(emptyBands, `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel`).toEqual([]);
  });

  test('once revealed, after the window is widened, a tick-field is drawn up to its new right edge with ticks as close together as before: 100 ms after the resize, every vertical band of it shows as many ticks as the same width showed before the resize, not the fewer, wider ticks of the old field stretched', { tag: '@pixels' }, async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    /* Revealed: the reveal sweeps the width in about 1.1 s. */
    await page.clock.runFor(2000);

    /* Before the resize: how close together the ticks are, as the number of separate drawn
       strokes per CSS pixel of the field's width. */
    const boxBefore = await tickField.boundingBox();
    expect(boxBefore, 'the tick-field has a box on screen').not.toBeNull();
    const widthBefore = boxBefore!.width;
    const before = await pixelsNotOfBackgroundPerColumn(tickField, await tickField.screenshot());
    const ticksBefore = countDrawnStrokes(before.columns, 0, before.columns.length);
    expect(ticksBefore, `ticks the ${Math.round(widthBefore)}px-wide tick-field shows before the resize`).toBeGreaterThan(0);
    const ticksPerPixel = ticksBefore / widthBefore;

    /* The visitor widens the window to twice its width; time then moves by about six
       animation frames. */
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport size').not.toBeNull();
    await page.setViewportSize({ width: 2 * viewport!.width, height: viewport!.height });
    await page.clock.runFor(100);

    const boxAfter = await tickField.boundingBox();
    expect(boxAfter, 'the tick-field still has a box on screen').not.toBeNull();
    const width = boxAfter!.width;
    expect(width, `width of the tick-field, ${Math.round(widthBefore)}px before the window was widened`).toBeGreaterThan(1.5 * widthBefore);
    const { columns, scale } = await pixelsNotOfBackgroundPerColumn(tickField, await tickField.screenshot());

    /* The new width split into adjacent vertical bands, at least 80px wide each: the first
       starts at the left edge, the last ends at the new right edge. Each must show as many
       ticks as its width held before the resize, within 1.5: a band with no tick shows 0, and
       the old field stretched to twice its width shows about half as many. */
    const MIN_BAND_WIDTH = 80;
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const expectedTicks = ticksPerPixel * bandWidth;
    const offBands: string[] = [];
    for (let band = 0; band < bandCount; band++) {
      const fromColumn = Math.round(band * bandWidth * scale);
      const toColumn = Math.round((band + 1) * bandWidth * scale);
      const ticks = countDrawnStrokes(columns, fromColumn, toColumn);
      if (Math.abs(ticks - expectedTicks) > 1.5) {
        offBands.push(`${Math.round(band * bandWidth)}–${Math.round((band + 1) * bandWidth)}px: ${ticks} ticks`);
      }
    }
    expect(
      offBands,
      `bands of the tick-field, widened from ${Math.round(widthBefore)}px to ${Math.round(width)}px, whose tick count is not the ${expectedTicks.toFixed(1)} their width held before the resize`,
    ).toEqual([]);
  });

  test('under prefers-reduced-motion: reduce, a tick-field is drawn across its whole width from load: right after load, every vertical band of it, from the left edge to the right edge, shows pixels that differ from its background', { tag: '@pixels' }, async ({ page, context }) => {
    /* The visitor asks for reduced motion, and time stands still from before the page
       loads, until the test advances it by a single animation frame. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    /* Right after load: the first animation frame has run, long before the reveal, which
       sweeps the width in about 1.1 s, would have reached the right edge. */
    await page.clock.runFor(16);

    const screenshot = await tickField.screenshot();
    const { columns, scale } = await pixelsNotOfBackgroundPerColumn(tickField, screenshot);
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The width split into adjacent vertical bands, at least 40px wide each: the first starts
       at the left edge, the last ends at the right edge. Every band must show drawn pixels,
       so that the drawing reaches both edges and leaves no gap in between. */
    const MIN_BAND_WIDTH = 40;
    const emptyBands = bandsWithoutDrawnPixels(columns, scale, width, MIN_BAND_WIDTH);
    expect(
      emptyBands,
      `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel, right after load under reduced motion`,
    ).toEqual([]);
  });

  test('once revealed, a tick-field is made of short ticks in rows: between two rows of drawn pixels, a horizontal band at least 4px high, across its whole width, shows only its background', { tag: '@pixels' }, async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to change it. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const { rows, scale } = await pixelsNotOfBackgroundPerRow(tickField, await tickField.screenshot());
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();

    /* Runs of adjacent screenshot rows, from top to bottom, that show no drawn pixel across
       the whole width, and that have rows with drawn pixels both above and below them: the
       gaps between two rows of ticks. Full-height lines leave none. */
    const MIN_BAND_HEIGHT = 4;
    const firstDrawn = rows.findIndex((count) => count > 0);
    const lastDrawn = rows.findLastIndex((count) => count > 0);
    const gaps = horizontalBandsWithoutDrawnPixels(rows, scale, MIN_BAND_HEIGHT);
    expect(
      gaps.length,
      `horizontal bands at least ${MIN_BAND_HEIGHT}px high with no drawn pixel between two rows of drawn pixels, in the ${Math.round(fieldBox!.height)}px-high tick-field (drawn from ${(firstDrawn / scale).toFixed(1)}px to ${((lastDrawn + 1) / scale).toFixed(1)}px): ${gaps.join(', ') || 'none'}`,
    ).toBeGreaterThan(0);
  });

  test('once revealed, a tick-field is brighter on the right than on the left: 2 s after load, its right quarter shows more than twice the brightness above the background of its left quarter', { tag: '@pixels' }, async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    await page.clock.runFor(2000);

    const screenshot = await tickField.screenshot();
    const { columns, scale } = await luminanceAboveBackgroundPerColumn(tickField, screenshot);
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The left quarter and the right quarter of the width, each summed over its whole
       height. A field drawn the same everywhere shows about as much on both sides; the field
       must show more than twice as much on the right. */
    const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
    const QUARTER = 0.25 * width;
    const left = sum(columns.slice(0, Math.round(QUARTER * scale)));
    const right = sum(columns.slice(Math.round((width - QUARTER) * scale)));
    expect(
      right,
      `brightness above the background of the right quarter (${Math.round(width - QUARTER)}–${Math.round(width)}px), against ${Math.round(left)} for the left quarter (0–${Math.round(QUARTER)}px)`,
    ).toBeGreaterThan(2 * left);
  });

  test('once revealed, a tick-field fades from its top right corner, clearly visible, to its bottom left corner, almost invisible, over its whole height: its bottom left tick lies less than 9% of the way from the background to its green, its top right tick more than 40% of the way to the cream, and in a vertical band at the middle of its width, the ticks at mid-height are dimmer than those at the top and brighter than those at the bottom', { tag: '@pixels' }, async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to brighten a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    const screenshot = await tickField.screenshot();
    const themeColour = (customProperty: string): Promise<string> =>
      tickField.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), customProperty);
    const describeZone = (zone: Rectangle): string =>
      `(${Math.round(zone.x)}–${Math.round(zone.x + zone.width)}px, ${Math.round(zone.y)}–${Math.round(zone.y + zone.height)}px)`;

    /* The corner ticks: a 40px square at a corner holds the tick of the field's outermost
       column and row there, and none of its neighbours, 16px and 22px away beyond margins of
       at least 24px and 18px. A tick drawn with an opacity shows, at a pixel it covers fully,
       that share of the way from the background to its colour, whatever its height: green
       (the theme's --color-accent-dark) at the left, cream (--color-paper) at the top right.
       At the bottom left, a tick less than 9% of the way is barely there; at the top right,
       more than 40% of the way stands out. */
    const CORNER = 40;
    const bottomLeftZone = { x: 0, y: height - CORNER, width: CORNER, height: CORNER };
    const topRightZone = { x: width - CORNER, y: 0, width: CORNER, height: CORNER };
    const bottomLeft = await strongestShareOfColourInRectangle(tickField, screenshot, bottomLeftZone, await themeColour('--color-accent-dark'));
    const topRight = await strongestShareOfColourInRectangle(tickField, screenshot, topRightZone, await themeColour('--color-paper'));
    const corners = `bottom left tick ${(100 * bottomLeft).toFixed(1)}% of the way from the background to the green, in ${describeZone(bottomLeftZone)}; top right tick ${(100 * topRight).toFixed(1)}% of the way to the cream, in ${describeZone(topRightZone)}`;
    expect.soft(bottomLeft, `strongest pixel of the ${corners}`).toBeLessThan(0.09);
    expect.soft(topRight, `strongest pixel of the ${corners}`).toBeGreaterThan(0.4);

    /* Down a vertical band at the middle of the width, a fifth of it wide: the same columns at
       the top, at mid-height and at the bottom, so that whatever changes from left to right
       changes the same in all three. The top and bottom zones, 40px high, each hold the
       field's first or last row; the one at mid-height, 22px high, the row there. In each
       screenshot column of a zone, the brightest drawn pixel is one a tick covers fully,
       whatever the tick's height; their mean is how bright the zone's ticks are. A field that
       only dims near its top shows mid-height ticks as bright as the bottom ones. */
    const band = { x: 0.4 * width, width: 0.2 * width };
    const MIDDLE_ROW = 22;
    const zones = {
      top: { ...band, y: 0, height: CORNER },
      middle: { ...band, y: height / 2 - MIDDLE_ROW / 2, height: MIDDLE_ROW },
      bottom: { ...band, y: height - CORNER, height: CORNER },
    };
    const mean = (values: number[]): number => values.reduce((total, value) => total + value, 0) / values.length;
    const brightness = async (zone: Rectangle): Promise<number> => {
      const columns = await brightestLuminanceAboveBackgroundPerColumnInRectangle(tickField, screenshot, zone);
      expect(columns.length, `columns with drawn pixels in ${describeZone(zone)}`).toBeGreaterThan(0);
      return mean(columns);
    };
    const top = await brightness(zones.top);
    const middle = await brightness(zones.middle);
    const bottom = await brightness(zones.bottom);
    const column = `mean, over the drawn columns of each zone, of the brightest pixel's luma above the background: top ${describeZone(zones.top)} ${top.toFixed(1)}, mid-height ${describeZone(zones.middle)} ${middle.toFixed(1)}, bottom ${describeZone(zones.bottom)} ${bottom.toFixed(1)}`;
    expect.soft(top, `top against 1.1 times mid-height; ${column}`).toBeGreaterThan(1.1 * middle);
    expect.soft(middle, `mid-height against 1.15 times bottom; ${column}`).toBeGreaterThan(1.15 * bottom);
  });

  test('once revealed, each tick rests at the opacity its place along the diagonal sets: its top right tick shows about 61% of its colour over the background, not more, its bottom right tick about 50%, and its top left tick, where the horizontal place weighs three times the vertical one, about 14%', { tag: '@pixels' }, async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to brighten a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    const screenshot = await tickField.screenshot();
    const describeZone = (zone: Rectangle): string =>
      `(${Math.round(zone.x)}–${Math.round(zone.x + zone.width)}px, ${Math.round(zone.y)}–${Math.round(zone.y + zone.height)}px)`;

    /* The corner ticks: a 40px square at a corner holds the tick of the field's outermost
       column and row there, and none of its neighbours, 16px and 22px away beyond margins of
       at least 24px and 18px. A pixel the tick covers fully shows the background plus the
       tick's opacity times (its colour − the background): the opacity is read from it,
       whichever colour the tick has. Halfway down the tick, across it every quarter of a CSS
       pixel, the most opaque reading is that of a fully covered pixel. */
    const CORNER = 40;
    const zones = {
      topRight: { x: width - CORNER, y: 0, width: CORNER, height: CORNER },
      bottomRight: { x: width - CORNER, y: height - CORNER, width: CORNER, height: CORNER },
      topLeft: { x: 0, y: 0, width: CORNER, height: CORNER },
    };
    const STEP = 0.25;
    type Reading = { opacity: number; colour: Channels; x: number; y: number; tick: Rectangle };
    const opacityOfTick = async (zone: Rectangle): Promise<Reading> => {
      const ticks = await drawnStrokesInRectangle(tickField, screenshot, zone);
      expect(ticks, `ticks drawn whole in ${describeZone(zone)}`).toHaveLength(1);
      const [tick] = ticks;
      const y = tick.y + tick.height / 2;
      const points = Array.from({ length: Math.ceil(tick.width / STEP) }, (_, step) => ({ x: tick.x + (step + 0.5) * STEP, y }));
      const measures = await canvasOpacityOverBackgroundAt(tickField, screenshot, points);
      return measures
        .map((measure, index) => ({ ...measure, ...points[index], tick }))
        .reduce((most, measure) => (measure.opacity > most.opacity ? measure : most));
    };
    const topRight = await opacityOfTick(zones.topRight);
    const bottomRight = await opacityOfTick(zones.bottomRight);
    const topLeft = await opacityOfTick(zones.topLeft);

    /* The design's opacity for a tick whose top left corner sits at (x, y): its place along
       the diagonal, the horizontal one weighing three quarters, eased in and out, from 6% to
       61%. At the top left tick, a few tens of pixels from the corner, about 14% on a wide
       screen, a little more on a phone; an even weighing would put it near 44%. */
    const designOpacity = (x: number, y: number): number => {
      const place = Math.min(1, Math.max(0, (x / width) * 0.75 + (1 - y / height) * 0.25));
      const eased = place * place * (3 - 2 * place);
      return 0.06 + eased * 0.55;
    };
    const topLeftDesign = designOpacity(topLeft.tick.x, topLeft.tick.y);

    const describe = (reading: Reading): string =>
      `${(100 * reading.opacity).toFixed(1)}% of its colour (${reading.colour.red}, ${reading.colour.green}, ${reading.colour.blue}) at (${reading.x.toFixed(2)}px, ${reading.y.toFixed(1)}px)`;
    const ticks = `in the ${Math.round(width)}px-wide tick-field, top right tick ${describe(topRight)}, bottom right tick ${describe(bottomRight)}, top left tick ${describe(topLeft)} where the design sets ${(100 * topLeftDesign).toFixed(1)}%`;

    /* About 61%, within 5%: a bit less, as the ticks sit inside the margins, short of the very
       corner; about 50%, within 7%; and the design's value at the top left tick, within 5%. */
    expect.soft(Math.abs(topRight.opacity - 0.61), `distance from 61% of the opacity of the top right tick, ${ticks}`).toBeLessThanOrEqual(0.05);
    expect.soft(Math.abs(bottomRight.opacity - 0.5), `distance from 50% of the opacity of the bottom right tick, ${ticks}`).toBeLessThanOrEqual(0.07);
    expect.soft(Math.abs(topLeft.opacity - topLeftDesign), `distance from the design's opacity of the top left tick, ${ticks}`).toBeLessThanOrEqual(0.05);
  });

  test('with a fine pointer, hovering brightens the ticks under the pointer, and the trail fades once it leaves', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport').not.toBeNull();
    /* A point in the left half, where the ticks are dim, at mid-height; the zone is the 40px
       square centred on it. */
    const point = { x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 };
    const HALF_SIDE = 20;
    const zone = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };
    /* A point of the page 40px below the tick-field, or above it if the viewport ends first:
       outside the tick-field, in the same column. */
    const MARGIN = 40;
    const outside = { x: fieldBox!.x + point.x, y: yBelowOrAboveField(fieldBox!, viewport!.height, MARGIN) };
    expect(
      outside.y < fieldBox!.y || outside.y > fieldBox!.y + fieldBox!.height,
      'the point the pointer leaves for is outside the tick-field',
    ).toBe(true);
    expect(outside.y, 'the point the pointer leaves for is in the viewport').toBeGreaterThanOrEqual(0);

    const brightness = async (): Promise<number> =>
      luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    const before = await brightness();

    await page.mouse.move(fieldBox!.x + point.x, fieldBox!.y + point.y);
    /* A few animation frames. */
    await page.clock.runFor(100);
    const lit = await brightness();
    expect(
      lit,
      `brightness above the background of the 40px square around the pointer at (${Math.round(point.x)}, ${Math.round(point.y)})px, against ${Math.round(before)} before the hover`,
    ).toBeGreaterThan(1.5 * before);

    await page.mouse.move(outside.x, outside.y);
    /* Shortly after the pointer leaves: still more than half of what the hover added. */
    await page.clock.runFor(150);
    const shortlyAfter = await brightness();
    expect(
      shortlyAfter,
      `brightness above the background of the 40px square at (${Math.round(point.x)}, ${Math.round(point.y)})px 150 ms after the pointer left, against ${Math.round(before)} before the hover and ${Math.round(lit)} under the pointer`,
    ).toBeGreaterThan(before + 0.5 * (lit - before));

    /* A few seconds later: back to what it showed before the hover, within 10%. */
    await page.clock.runFor(4000);
    const later = await brightness();
    expect(
      Math.abs(later - before),
      `change in brightness above the background of the 40px square at (${Math.round(point.x)}, ${Math.round(point.y)})px 4 s after the pointer left (${Math.round(before)} before the hover → ${Math.round(later)}; ${Math.round(lit)} under the pointer)`,
    ).toBeLessThanOrEqual(0.1 * before);
  });

  test('a click (a tap on mobile) starts a ripple that spreads, then fades', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    const brightnessIn = async (screenshot: Buffer, zones: Rectangle[]): Promise<number[]> =>
      Promise.all(zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshot, zone)));

    /* The ring grows about 0.28px per ms: 300 ms after the click it is about 84px from the
       click point, 600 ms after it about 168px. Zones straddle the ring, 20px deep across it
       and 40px long along it. All of them are far enough from the click point for the ring
       alone to light them, not the glow of a pointer hovering the click point. */
    const NEAR_RADIUS = 84;
    const FAR_RADIUS = 168;
    const DEPTH = 20;
    const LENGTH = 40;

    /* First click, at the centre of the field, with room for the ring all around it. Four zones
       straddle the ring 300 ms after the click, to its right, left, top and bottom; one 30px
       square sits at the click point, well inside the ring. */
    const centrePoint = { x: width / 2, y: height / 2 };
    const centreOnScreen = { x: fieldBox!.x + centrePoint.x, y: fieldBox!.y + centrePoint.y };
    const ringZones = [
      { name: 'right', rectangle: { x: centrePoint.x + NEAR_RADIUS - DEPTH / 2, y: centrePoint.y - LENGTH / 2, width: DEPTH, height: LENGTH } },
      { name: 'left', rectangle: { x: centrePoint.x - NEAR_RADIUS - DEPTH / 2, y: centrePoint.y - LENGTH / 2, width: DEPTH, height: LENGTH } },
      { name: 'top', rectangle: { x: centrePoint.x - LENGTH / 2, y: centrePoint.y - NEAR_RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH } },
      { name: 'bottom', rectangle: { x: centrePoint.x - LENGTH / 2, y: centrePoint.y + NEAR_RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH } },
    ];
    const HALF_SIDE = 15;
    const centre = { x: centrePoint.x - HALF_SIDE, y: centrePoint.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };
    const startZones = [...ringZones.map((zone) => zone.rectangle), centre];
    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: together they cover every place the ring crossed and every place it would still be
       on, about 560px from the click point, had it not faded. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, height, MIN_BAND_WIDTH);

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(centreOnScreen.x, centreOnScreen.y);
    await page.clock.runFor(300);
    const beforeShot = await tickField.screenshot();
    const before = await brightnessIn(beforeShot, startZones);
    const bandsBefore = await brightnessIn(beforeShot, bands);

    await clickOrTap(page, hasTouch, centreOnScreen);
    await page.clock.runFor(300);
    const after = await brightnessIn(await tickField.screenshot(), startZones);

    /* 300 ms after the click: the ring lights the zones around the click point. */
    const dimRingZones = ringZones
      .map((zone, index) => ({ zone, before: before[index], after: after[index] }))
      .filter(({ before, after }) => !(after > 1.25 * before))
      .map(
        ({ zone, before, after }) =>
          `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      dimRingZones,
      `zones about ${NEAR_RADIUS}px around the click point at (${Math.round(centrePoint.x)}, ${Math.round(centrePoint.y)})px that do not show more than 1.25 times the brightness above the background they showed before the click, 300 ms after it`,
    ).toEqual([]);

    /* The click point itself: what it showed before the click, within 10%. */
    const centreBefore = before[ringZones.length];
    const centreAfter = after[ringZones.length];
    expect(
      Math.abs(centreAfter - centreBefore),
      `change in brightness above the background of the 30px square at the click point (${Math.round(centrePoint.x)}, ${Math.round(centrePoint.y)})px, 300 ms after the click (${Math.round(centreBefore)} before → ${Math.round(centreAfter)})`,
    ).toBeLessThanOrEqual(0.1 * centreBefore);

    /* 2 s after the click, the ripple has faded: each band is back to what it showed before
       the click, within 5%. */
    await page.clock.runFor(1700);
    const bandsAfter = await brightnessIn(await tickField.screenshot(), bands);
    const changedBands = bands
      .map((band, index) => ({ band, before: bandsBefore[index], after: bandsAfter[index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.05 * before)
      .map(
        ({ band, before, after }) =>
          `${Math.round(band.x)}–${Math.round(band.x + band.width)}px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      changedBands,
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 2 s after the click at (${Math.round(centrePoint.x)}, ${Math.round(centrePoint.y)})px, differs by more than 5% from what they showed just before it`,
    ).toEqual([]);

    /* Second click, to see the ripple spread. At mid-height, 20px short of putting the far zone
       against the left edge: the field is 320px high, too low for a ring 168px from the click
       point above and below it, and on a phone a far zone to the right would sit in the bright
       right edge, where ticks are close to full brightness already. The far zone lies in the
       dim left part on every screen. */
    const point = { x: FAR_RADIUS + DEPTH / 2 + 20, y: height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };
    const across = (side: 'right' | 'left', radius: number) => ({
      name: `${side}, ${radius}px`,
      rectangle: {
        x: point.x + (side === 'right' ? radius : -radius) - DEPTH / 2,
        y: point.y - LENGTH / 2,
        width: DEPTH,
        height: LENGTH,
      },
    });
    const farZones = [across('left', FAR_RADIUS)];
    const nearZones = [across('right', NEAR_RADIUS), across('left', NEAR_RADIUS)];
    const spreadZones = [...farZones, ...nearZones];
    for (const zone of spreadZones) {
      expect(
        zone.rectangle.x >= 0 && zone.rectangle.x + zone.rectangle.width <= width,
        `the zone ${zone.name} from the click point lies inside the ${Math.round(width)}px-wide tick-field`,
      ).toBe(true);
    }
    const describe = (zone: (typeof spreadZones)[number], before: number, after: number): string =>
      `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: ${Math.round(before)} → ${Math.round(after)}`;
    const spreadRectangles = spreadZones.map((zone) => zone.rectangle);

    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const beforeSpread = await brightnessIn(await tickField.screenshot(), spreadRectangles);

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(600);
    const afterSpread = await brightnessIn(await tickField.screenshot(), spreadRectangles);

    /* The ring, now farther: more than 1.25 times what the zone showed before the click. */
    const dimFarZones = farZones
      .map((zone, index) => ({ zone, before: beforeSpread[index], after: afterSpread[index] }))
      .filter(({ before, after }) => !(after > 1.25 * before))
      .map(({ zone, before, after }) => describe(zone, before, after));
    expect(
      dimFarZones,
      `zones about ${FAR_RADIUS}px to the left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px that do not show more than 1.25 times the brightness above the background they showed before the click, 600 ms after it`,
    ).toEqual([]);

    /* Where the ring was 300 ms after the click: what they showed before it, within 10%. */
    const stillLitNearZones = nearZones
      .map((zone, index) => ({ zone, before: beforeSpread[farZones.length + index], after: afterSpread[farZones.length + index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.1 * before)
      .map(({ zone, before, after }) => describe(zone, before, after));
    expect(
      stillLitNearZones,
      `zones about ${NEAR_RADIUS}px to the right and left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px whose brightness above the background, 600 ms after the click, differs by more than 10% from what they showed before it`,
    ).toEqual([]);
  });

  test('a click (a tap on mobile) outside a tick-field starts no ripple: once revealed, 300 ms after a click just below its bottom edge, the zones of the field about 84px from the click point are what they showed just before the click', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport').not.toBeNull();
    /* A point of the page 6px below the bottom edge of the field, at the middle of its width:
       outside the field, close enough to it for a ring centred there to reach into it. */
    const GAP = 6;
    const point = { x: fieldBox!.width / 2, y: fieldBox!.height + GAP };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };
    expect(onScreen.y, 'the click point is in the viewport').toBeLessThan(viewport!.height);
    const outsideTheField = await tickField.evaluate(
      (element, { x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && !element.contains(hit) && hit.closest('a, button, input, select, textarea, summary') === null;
      },
      onScreen,
    );
    expect(outsideTheField, 'the element under the click point is outside the tick-field and does nothing on a click').toBe(true);

    /* A ring started there would be about 84px from the click point 300 ms after the click
       (about 0.28px per ms). Three zones of the field straddle that circle: one straight above
       the click point, 20px deep across it and 40px long along it, and two 30px squares up and
       to its left and right, at 45°. All of them are far enough from the click point for the
       ring alone to change them, not the glow of a pointer hovering the click point. */
    const RADIUS = 84;
    const DEPTH = 20;
    const LENGTH = 40;
    const HALF_SIDE = 15;
    const diagonal = RADIUS / Math.SQRT2;
    const zones = [
      { name: 'above', rectangle: { x: point.x - LENGTH / 2, y: point.y - RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH } },
      {
        name: 'up and to the left',
        rectangle: { x: point.x - diagonal - HALF_SIDE, y: point.y - diagonal - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE },
      },
      {
        name: 'up and to the right',
        rectangle: { x: point.x + diagonal - HALF_SIDE, y: point.y - diagonal - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE },
      },
    ];
    for (const zone of zones) {
      expect(
        zone.rectangle.x >= 0 &&
          zone.rectangle.x + zone.rectangle.width <= fieldBox!.width &&
          zone.rectangle.y >= 0 &&
          zone.rectangle.y + zone.rectangle.height <= fieldBox!.height,
        `the zone ${zone.name} of the click point lies inside the tick-field`,
      ).toBe(true);
    }

    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshot, zone.rectangle)));
    };

    /* With a fine pointer, a click first brings the pointer over the click point: the pointer
       is there already before the click, so that both measures differ by the click alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const before = await brightness();

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    const after = await brightness();

    /* What each zone showed before the click, within 10%. */
    const changedZones = zones
      .map((zone, index) => ({ zone, before: before[index], after: after[index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.1 * before)
      .map(
        ({ zone, before, after }) =>
          `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      changedZones,
      `zones of the tick-field about ${RADIUS}px from the click point ${GAP}px below its bottom edge, at (${Math.round(point.x)}, ${Math.round(point.y)})px, whose brightness above the background, 300 ms after the click, differs by more than 10% from what they showed just before it`,
    ).toEqual([]);
  });

  test('under prefers-reduced-motion: reduce, a tick-field stays still: 2 s after load, after a hover (with a fine pointer) and 300 ms after a click (a tap on mobile) at its centre, every vertical band of it, from the left edge to the right edge, shows the brightness it showed right after load', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    /* The visitor asks for reduced motion, and time stands still from before the page
       loads, until the test advances it. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await tickField.scrollIntoViewIfNeeded();
    /* Right after load: the first animation frame has run. */
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: the first starts at the left edge, the last ends at the right edge. Together they
       cover the whole field, the glow around a hovered point and the ring around a click point
       included. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, fieldBox!.height, MIN_BAND_WIDTH);
    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(tickField, screenshot, band)));
    };

    const rightAfterLoad = await brightness();

    /* Time passes: long enough for the reveal, which sweeps the width in about 1.1 s, to end. */
    await page.clock.runFor(2000);

    /* With a fine pointer, a hover of a point in the left half, at mid-height, for a few
       animation frames. */
    const hovered = { x: 0.2 * width, y: fieldBox!.height / 2 };
    if (!hasTouch) {
      await page.mouse.move(fieldBox!.x + hovered.x, fieldBox!.y + hovered.y);
      await page.clock.runFor(100);
    }

    /* A click (a tap on mobile) at the centre of the field, with room all around it for a
       ring, which would be about 84px from it 300 ms after the click. */
    const clicked = { x: width / 2, y: fieldBox!.height / 2 };
    await clickOrTap(page, hasTouch, { x: fieldBox!.x + clicked.x, y: fieldBox!.y + clicked.y });
    await page.clock.runFor(300);
    const afterwards = await brightness();

    /* What each band showed right after load, within 2%. */
    const changedBands = bands
      .map((band, index) => ({ band, before: rightAfterLoad[index], after: afterwards[index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.02 * before)
      .map(
        ({ band, before, after }) =>
          `${Math.round(band.x)}–${Math.round(band.x + band.width)}px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      changedBands,
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, under reduced motion, 2 s after load${hasTouch ? '' : `, a hover at (${Math.round(hovered.x)}, ${Math.round(hovered.y)})px`} and 300 ms after a ${hasTouch ? 'tap' : 'click'} at (${Math.round(clicked.x)}, ${Math.round(clicked.y)})px, differs by more than 2% from what they showed right after load`,
    ).toEqual([]);
  });

  test('if the visitor turns on reduced motion during the reveal, a tick-field is drawn across its whole width at once, then stays still: two animation frames after the switch, every vertical band of it shows drawn pixels, and 300 ms after a click (a tap on mobile) at its centre, every band shows the brightness it showed right after the switch', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it to the middle of the reveal. */
    const tickField = await openEmptyTickField(page, context, 'no-preference');
    await tickField.scrollIntoViewIfNeeded();
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* Midway through the reveal, which sweeps the width in about 1.1 s: its right part, the
       last 40% of the width, still only shows the background. */
    await page.clock.runFor(500);
    const RIGHT_PART_START = 0.6 * width;
    const midway = await pixelsNotOfBackgroundPerColumn(tickField, await tickField.screenshot());
    expect(
      midway.columns.slice(Math.round(RIGHT_PART_START * midway.scale)).reduce((sum, count) => sum + count, 0),
      `500 ms after load, pixels of the right part (${Math.round(RIGHT_PART_START)}–${Math.round(width)}px) of the tick-field that differ from its background`,
    ).toBe(0);

    /* The visitor then asks for reduced motion. Time moves by two animation frames, far less
       than the 600 ms of reveal left, then stands still again. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(32);

    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: the first starts at the left edge, the last ends at the right edge. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, fieldBox!.height, MIN_BAND_WIDTH);
    const describeBand = (band: Rectangle): string =>
      `${Math.round(band.x)}–${Math.round(band.x + band.width)}px`;

    /* Drawn at once: every band shows drawn pixels, the right part included. */
    const afterSwitch = await tickField.screenshot();
    const { columns, scale } = await pixelsNotOfBackgroundPerColumn(tickField, afterSwitch);
    const emptyBands = bands
      .filter((band) => !columns.slice(Math.round(band.x * scale), Math.round((band.x + band.width) * scale)).some((count) => count > 0))
      .map(describeBand);
    expect(
      emptyBands,
      `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel, two animation frames after reduced motion was turned on midway through the reveal`,
    ).toEqual([]);

    /* Then still: a click (a tap on mobile) at the centre of the field, with room all around it
       for a ring, which would be about 84px from it 300 ms after the click. */
    const brightness = async (screenshot: Buffer): Promise<number[]> =>
      Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(tickField, screenshot, band)));
    const rightAfterSwitch = await brightness(afterSwitch);
    const clicked = { x: width / 2, y: fieldBox!.height / 2 };
    await clickOrTap(page, hasTouch, { x: fieldBox!.x + clicked.x, y: fieldBox!.y + clicked.y });
    await page.clock.runFor(300);
    const afterwards = await brightness(await tickField.screenshot());

    /* What each band showed right after the switch, within 2%. */
    const changedBands = bands
      .map((band, index) => ({ band, before: rightAfterSwitch[index], after: afterwards[index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.02 * before)
      .map(({ band, before, after }) => `${describeBand(band)}: ${Math.round(before)} → ${Math.round(after)}`);
    expect(
      changedBands,
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 300 ms after a ${hasTouch ? 'tap' : 'click'} at (${Math.round(clicked.x)}, ${Math.round(clicked.y)})px, differs by more than 2% from what they showed right after reduced motion was turned on`,
    ).toEqual([]);
  });

  test('if the visitor turns on reduced motion while a ripple spreads, a tick-field stays still from then on: once revealed, 300 ms after a click (a tap on mobile) at its centre, reduced motion is turned on, and 300 ms and 2 s after the switch, every vertical band of it shows the brightness it showed two animation frames after the switch', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    /* Animations are allowed: the visitor's motion preference is left as the browser sets
       it, and the field is fully revealed. */
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    /* The centre of the field, with room all around it for a ring, about 84px from it 300 ms
       after the click and still spreading. */
    const clicked = { x: width / 2, y: fieldBox!.height / 2 };
    const onScreen = { x: fieldBox!.x + clicked.x, y: fieldBox!.y + clicked.y };

    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: the first starts at the left edge, the last ends at the right edge. Together they
       cover the whole field, every place the ring crosses. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, fieldBox!.height, MIN_BAND_WIDTH);
    const describeBand = (band: Rectangle): string =>
      `${Math.round(band.x)}–${Math.round(band.x + band.width)}px`;
    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(tickField, screenshot, band)));
    };
    /* The bands whose brightness differs from `reference` by more than `tolerance` of it. */
    const changedBands = (reference: number[], measured: number[], tolerance: number): string[] =>
      bands
        .map((band, index) => ({ band, before: reference[index], after: measured[index] }))
        .filter(({ before, after }) => Math.abs(after - before) > tolerance * before)
        .map(({ band, before, after }) => `${describeBand(band)}: ${Math.round(before)} → ${Math.round(after)}`);

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that the field
       differs by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const beforeClick = await brightness();

    /* The ripple spreads: 300 ms after the click, its ring lights bands the field showed
       dimmer just before the click. */
    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    expect(
      changedBands(beforeClick, await brightness(), 0.05),
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 300 ms after a ${hasTouch ? 'tap' : 'click'} at (${Math.round(clicked.x)}, ${Math.round(clicked.y)})px, differs by more than 5% from what they showed just before it`,
    ).not.toEqual([]);

    /* The visitor then asks for reduced motion, the ring still far from the end of its 1.7 s.
       Time moves by two animation frames, then stands still again. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(32);
    const rightAfterSwitch = await brightness();

    /* From then on, still: 300 ms after the switch, while the ring would still spread, and
       2 s after it, once it would have faded, each band shows what it showed right after the
       switch, within 2%. */
    await page.clock.runFor(300);
    const shortlyAfter = changedBands(rightAfterSwitch, await brightness(), 0.02).map((band) => `300 ms after: ${band}`);
    await page.clock.runFor(1700);
    const longAfter = changedBands(rightAfterSwitch, await brightness(), 0.02).map((band) => `2 s after: ${band}`);
    expect(
      [...shortlyAfter, ...longAfter],
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 300 ms and 2 s after reduced motion was turned on while the ripple of a ${hasTouch ? 'tap' : 'click'} at (${Math.round(clicked.x)}, ${Math.round(clicked.y)})px spread, differs by more than 2% from what they showed two animation frames after the switch`,
    ).toEqual([]);
  });

  test('with a fine pointer, if the visitor turns on reduced motion while the hover trail fades, a tick-field stays still from then on: once revealed, 150 ms after the pointer leaves the tick-field it hovered, reduced motion is turned on, and 300 ms and 2 s after the switch, every vertical band of it shows the brightness it showed two animation frames after the switch', { tag: '@pixels' }, async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    /* Animations are allowed: the visitor's motion preference is left as the browser sets
       it, and the field is fully revealed. */
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport').not.toBeNull();
    const width = fieldBox!.width;
    /* A point in the left half, where the ticks are dim, at mid-height. */
    const hovered = { x: 0.2 * width, y: fieldBox!.height / 2 };
    /* A point of the page 40px below the tick-field, or above it if the viewport ends first:
       outside the tick-field, in the same column. */
    const MARGIN = 40;
    const outside = { x: fieldBox!.x + hovered.x, y: yBelowOrAboveField(fieldBox!, viewport!.height, MARGIN) };
    expect(
      outside.y < fieldBox!.y || outside.y > fieldBox!.y + fieldBox!.height,
      'the point the pointer leaves for is outside the tick-field',
    ).toBe(true);
    expect(outside.y, 'the point the pointer leaves for is in the viewport').toBeGreaterThanOrEqual(0);

    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: the first starts at the left edge, the last ends at the right edge. Together they
       cover the whole field, the glow around the hovered point included. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, fieldBox!.height, MIN_BAND_WIDTH);
    const describeBand = (band: Rectangle): string =>
      `${Math.round(band.x)}–${Math.round(band.x + band.width)}px`;
    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(tickField, screenshot, band)));
    };
    /* The bands whose brightness differs from `reference` by more than `tolerance` of it. */
    const changedBands = (reference: number[], measured: number[], tolerance: number): string[] =>
      bands
        .map((band, index) => ({ band, before: reference[index], after: measured[index] }))
        .filter(({ before, after }) => Math.abs(after - before) > tolerance * before)
        .map(({ band, before, after }) => `${describeBand(band)}: ${Math.round(before)} → ${Math.round(after)}`);

    const beforeHover = await brightness();

    /* A hover for a few animation frames, then the pointer leaves the field. */
    await page.mouse.move(fieldBox!.x + hovered.x, fieldBox!.y + hovered.y);
    await page.clock.runFor(100);
    await page.mouse.move(outside.x, outside.y);

    /* The trail fades: 150 ms after the pointer left, it still lights bands the field showed
       dimmer before the hover. */
    await page.clock.runFor(150);
    expect(
      changedBands(beforeHover, await brightness(), 0.05),
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 150 ms after the pointer left the point (${Math.round(hovered.x)}, ${Math.round(hovered.y)})px it hovered, differs by more than 5% from what they showed before the hover`,
    ).not.toEqual([]);

    /* The visitor then asks for reduced motion, the trail still far from faded. Time moves by
       two animation frames, then stands still again. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(32);
    const rightAfterSwitch = await brightness();

    /* From then on, still: 300 ms after the switch, while the trail would still fade, and 2 s
       after it, once it would have faded, each band shows what it showed right after the
       switch, within 2%. */
    await page.clock.runFor(300);
    const shortlyAfter = changedBands(rightAfterSwitch, await brightness(), 0.02).map((band) => `300 ms after: ${band}`);
    await page.clock.runFor(1700);
    const longAfter = changedBands(rightAfterSwitch, await brightness(), 0.02).map((band) => `2 s after: ${band}`);
    expect(
      [...shortlyAfter, ...longAfter],
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 300 ms and 2 s after reduced motion was turned on while the trail of a hover at (${Math.round(hovered.x)}, ${Math.round(hovered.y)})px faded, differs by more than 2% from what they showed two animation frames after the switch`,
    ).toEqual([]);
  });

  test('a tick-field scrolled out of view during its reveal stops animating, and resumes once back: while it is off screen, the page requests no animation frame, and 2 s after it is back on screen, every vertical band of it, from the left edge to the right edge, shows drawn pixels', { tag: '@pixels' }, async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    /* Every animation frame the page requests, counted from load: requestAnimationFrame
       wrapped after the fake clock replaced it, so that the count follows the clock. */
    await context.addInitScript(() => {
      const counted = window as unknown as { frameRequests: number };
      counted.frameRequests = 0;
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
        counted.frameRequests += 1;
        return request(callback);
      };
    });
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-long-text/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-long-text.md),
       320px high, with no content and a solid background, followed by a long text. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();

    const frameRequests = (): Promise<number> =>
      page.evaluate(() => (window as unknown as { frameRequests: number }).frameRequests);
    /* Resolves once the browser has laid out the page at its current scroll position and
       reports the tick-field on screen (or off screen). */
    const reportedOnScreen = (onScreen: boolean): Promise<void> =>
      tickField.evaluate(
        (element, wanted) =>
          new Promise<void>((resolve) => {
            const observer = new IntersectionObserver((entries) => {
              if (entries.some((entry) => entry.isIntersecting === wanted)) {
                observer.disconnect();
                resolve();
              }
            });
            observer.observe(element);
          }),
        onScreen,
      );

    /* On screen, early in the reveal, which sweeps the width in about 1.1 s: the field is
       animating, and the count sees its frames. */
    await reportedOnScreen(true);
    const atLoad = await frameRequests();
    await page.clock.runFor(300);
    expect(
      (await frameRequests()) - atLoad,
      'animation frames the page requests during the first 300 ms of the reveal, the tick-field on screen',
    ).toBeGreaterThan(0);

    /* The visitor scrolls down to the end of the long text: the tick-field leaves the screen,
       its reveal still under way. */
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const boxOffScreen = await tickField.evaluate((element) => element.getBoundingClientRect().bottom);
    expect(boxOffScreen, 'bottom edge of the tick-field, relative to the top of the viewport, once scrolled down').toBeLessThanOrEqual(0);
    await reportedOnScreen(false);
    /* A few animation frames for the field to notice, then 500 ms, well before the reveal,
       started about 400 ms earlier, would have reached the right edge. */
    await page.clock.runFor(100);
    const offScreenFrom = await frameRequests();
    await page.clock.runFor(500);
    expect(
      (await frameRequests()) - offScreenFrom,
      'animation frames the page requests during 500 ms with the tick-field off screen, its reveal unfinished',
    ).toBe(0);

    /* The visitor scrolls back up to the tick-field; time then moves by 2 s, more than the
       whole reveal. */
    await tickField.scrollIntoViewIfNeeded();
    await reportedOnScreen(true);
    await page.clock.runFor(2000);

    const { columns, scale } = await pixelsNotOfBackgroundPerColumn(tickField, await tickField.screenshot());
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The width split into adjacent vertical bands, at least 40px wide each: the first starts
       at the left edge, the last ends at the right edge. Every band must show drawn pixels:
       the reveal went on to the right edge. */
    const MIN_BAND_WIDTH = 40;
    const emptyBands = bandsWithoutDrawnPixels(columns, scale, width, MIN_BAND_WIDTH);
    expect(
      emptyBands,
      `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel, 2 s after it was scrolled back on screen`,
    ).toEqual([]);
  });
});
