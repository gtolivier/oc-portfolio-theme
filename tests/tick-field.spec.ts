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
  channelsOfColour,
  channelsOfPixelsAt,
  colourAddedOverBackgroundInRectangle,
  countDrawnStrokes,
  countPixelsNotOfBackground,
  drawnPixelsClosestToColourInRectangles,
  drawnStrokesInRectangle,
  extentOfDrawnTicks,
  heightsOfDrawnRunsInRectangle,
  horizontalBandsWithoutDrawnPixels,
  horizontalExtentOfDrawnStrokeInRectangles,
  luminanceAboveBackgroundInRectangle,
  luminanceAboveBackgroundInRectangles,
  luminanceAboveBackgroundPerColumn,
  pixelsNotOfBackgroundPerColumn,
  pixelsNotOfBackgroundPerRow,
  sizeOfDrawnStrokeInRectangle,
  strongestShareOfColourInRectangle,
  verticalBands,
} from './helpers/pixels';

/* The y, on the page, of a point `margin` CSS pixels below the box of a tick-field, or above
   it if the viewport, `viewportHeight` high, ends first: outside the tick-field. */
function yBelowOrAboveField(fieldBox: Rectangle, viewportHeight: number, margin: number): number {
  return fieldBox.y + fieldBox.height + margin < viewportHeight ? fieldBox.y + fieldBox.height + margin : fieldBox.y - margin;
}

type Point = { x: number; y: number };

function centreOf(stroke: Rectangle): Point {
  return { x: stroke.x + stroke.width / 2, y: stroke.y + stroke.height / 2 };
}

/* Among drawn strokes, the one whose centre lies nearest to `target`; the first of them on a
   tie. */
function strokeNearest(strokes: Rectangle[], target: Point): Rectangle {
  const distanceToTarget = (stroke: Rectangle) => Math.hypot(centreOf(stroke).x - target.x, centreOf(stroke).y - target.y);
  return strokes.reduce((nearest, stroke) => (distanceToTarget(stroke) < distanceToTarget(nearest) ? stroke : nearest));
}

/* How far up and down the tick centred at `centre` reaches in a screenshot of a tick-field
   `fieldHeight` high, in CSS pixels from its top: the run of rows with drawn pixels, through
   the tick's centre, in a column 8px wide around it, well short of its neighbours 16px away,
   over the whole height of the field, so that a tick grown into its neighbours above or below
   shows how far it reaches. */
async function verticalExtentOfTick(
  tickField: Locator,
  screenshot: Buffer,
  centre: Point,
  fieldHeight: number,
): Promise<{ top: number; bottom: number }> {
  const column = { x: centre.x - 4, y: 0, width: 8, height: fieldHeight };
  const { rows, scale } = await pixelsNotOfBackgroundPerRow(tickField, screenshot, column);
  let top = Math.floor(centre.y * scale);
  let bottom = top;
  while (top > 0 && rows[top - 1] > 0) top -= 1;
  while (bottom < rows.length - 1 && rows[bottom + 1] > 0) bottom += 1;
  return { top: top / scale, bottom: (bottom + 1) / scale };
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

  test('right after load, a tick-field is empty: on screen, it only shows its background', async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    /* Right after load: the first animation frame has run. */
    await page.clock.runFor(16);

    const screenshot = await tickField.screenshot();
    const differingPixels = await countPixelsNotOfBackground(tickField, screenshot);
    expect(differingPixels, 'pixels of the tick-field that differ from its background').toBe(0);
  });

  test('2 s after load, a tick-field is drawn across its whole width: every vertical band of it, from the left edge to the right edge, shows pixels that differ from its background', async ({ page, context }) => {
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

  test('once revealed, after the window is widened, a tick-field is drawn up to its new right edge with ticks as close together as before: 100 ms after the resize, every vertical band of it shows as many ticks as the same width showed before the resize, not the fewer, wider ticks of the old field stretched', async ({ page, context }) => {
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

  test('under prefers-reduced-motion: reduce, a tick-field is drawn across its whole width from load: right after load, every vertical band of it, from the left edge to the right edge, shows pixels that differ from its background', async ({ page, context }) => {
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

  test('once revealed, a tick-field is made of short ticks in rows: between two rows of drawn pixels, a horizontal band at least 4px high, across its whole width, shows only its background', async ({ page, context }) => {
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

  test('once revealed, the ticks of a tick-field stand 16px apart within a row, and its rows 22px apart: from one tick\'s left edge to the next one\'s in the same row, and from one row\'s top to the next row\'s top', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to widen or light a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;

    /* The ticks drawn in the middle half of the width, over the whole height: each one a
       separate stroke, with its box. Ticks whose tops lie within 4px of one another belong
       to the same row. */
    const ZONE = { x: 0.25 * width, y: 0, width: 0.5 * width, height };
    const ticks = await drawnStrokesInRectangle(tickField, await tickField.screenshot(), ZONE);
    expect(ticks.length, `ticks drawn in the middle half of the tick-field (${Math.round(ZONE.x)}–${Math.round(ZONE.x + ZONE.width)}px)`).toBeGreaterThan(0);
    const SAME_ROW_PX = 4;
    const rows: Rectangle[][] = [];
    for (const tick of [...ticks].sort((a, b) => a.y - b.y)) {
      const row = rows[rows.length - 1];
      if (row && tick.y - row[0].y <= SAME_ROW_PX) row.push(tick);
      else rows.push([tick]);
    }

    /* From each tick's left edge to the next one's in the same row, and from each row's top
       to the next row's top; their medians are the spacings, which a stroke cut short at an
       anti-aliased end barely moves. */
    const tickGaps = rows.flatMap((row) => {
      const lefts = row.map((tick) => tick.x).sort((a, b) => a - b);
      return lefts.slice(1).map((left, index) => left - lefts[index]);
    });
    const rowTops = rows.map((row) => Math.min(...row.map((tick) => tick.y)));
    const rowGaps = rowTops.slice(1).map((top, index) => top - rowTops[index]);
    expect(tickGaps.length, `pairs of neighbouring ticks in the same row, over ${rows.length} rows`).toBeGreaterThan(0);
    expect(rowGaps.length, `pairs of neighbouring rows, among ${rows.length}`).toBeGreaterThan(0);
    const median = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    expect(
      { tickSpacing: median(tickGaps), rowSpacing: median(rowGaps) },
      `spacings of the ticks drawn in the middle half of the ${Math.round(width)}px-wide tick-field, in CSS pixels, within half a pixel: median of ${tickGaps.length} gaps between neighbouring ticks of a row, and of ${rowGaps.length} gaps between neighbouring rows`,
    ).toEqual({ tickSpacing: expect.closeTo(16, 0), rowSpacing: expect.closeTo(22, 0) });
  });

  test('once revealed, a tick-field is centred in its box: at several sizes, the empty margin on its left equals the one on its right, and the one at its top equals the one at its bottom, within a pixel; the side margins are at least 24px, the top and bottom ones at least 18px', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to light or lengthen a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    /* Sizes that leave different room around a field of ticks 16px apart in rows 22px apart,
       so that a field set at a fixed distance from the top left corner shows unequal margins
       in at least one of them. All fit in a phone's width. */
    const SIZES = [
      { width: 280, height: 320 },
      { width: 287, height: 331 },
      { width: 297, height: 343 },
    ];
    /* The text above the field can leave it at a fraction of a pixel from the top of the page,
       which would shift its screenshot by up to a pixel against its box: the field is moved,
       without changing the layout around it, onto whole CSS pixels. */
    await tickField.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const left = box.left + window.scrollX;
      const top = box.top + window.scrollY;
      element.style.left = `${Math.round(left) - left}px`;
      element.style.top = `${Math.round(top) - top}px`;
    });
    const problems: string[] = [];
    const measured: string[] = [];
    for (const size of SIZES) {
      await tickField.evaluate((element, { width, height }) => {
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
      }, size);
      await page.clock.runFor(100);
      const box = await tickField.boundingBox();
      expect(box, 'the tick-field has a box on screen').not.toBeNull();
      expect({ width: box!.width, height: box!.height }, 'size of the tick-field, in CSS pixels').toEqual({
        width: expect.closeTo(size.width, 0),
        height: expect.closeTo(size.height, 0),
      });

      /* The empty margins, in CSS pixels: from each edge of the box to the nearest edge of a
         drawn tick, anti-aliased edges counted by how much of a pixel they cover, so that the
         faint edge of a bright tick reaches no farther than that of a dim one. */
      const screenshot = await tickField.screenshot();
      const extent = await extentOfDrawnTicks(tickField, screenshot);
      expect(extent.left, `drawn ticks in the ${size.width}×${size.height}px tick-field`).not.toBeNaN();
      /* Across, the edges of the outermost columns of ticks are measured by how much of each
         screenshot column the ticks cover, summed over the field's whole height, and nothing
         else: every tick of a column spans the same screenshot columns, whatever its colour and
         opacity, so neither decides where the column starts and ends. Each column of ticks is
         taken in a band from 6px outside its edge to 8px inside it, which holds its
         anti-aliased edges and none of the next column, 16px away. */
      const [leftColumn, rightColumn] = await horizontalExtentOfDrawnStrokeInRectangles(tickField, screenshot, [
        { x: extent.left - 6, y: 0, width: 14, height: box!.height },
        { x: extent.right - 8, y: 0, width: 14, height: box!.height },
      ]);
      const margins = {
        left: leftColumn.x,
        right: box!.width - (rightColumn.x + rightColumn.width),
        top: extent.top,
        bottom: box!.height - extent.bottom,
      };
      const describe = `${size.width}×${size.height}px: left ${margins.left.toFixed(2)}, right ${margins.right.toFixed(2)}, top ${margins.top.toFixed(2)}, bottom ${margins.bottom.toFixed(2)}`;
      measured.push(describe);
      if (Math.abs(margins.left - margins.right) > 1) problems.push(`${describe}: left and right margins differ by more than 1px`);
      if (Math.abs(margins.top - margins.bottom) > 1) problems.push(`${describe}: top and bottom margins differ by more than 1px`);
      if (Math.min(margins.left, margins.right) < 24) problems.push(`${describe}: a side margin is under 24px`);
      if (Math.min(margins.top, margins.bottom) < 18) problems.push(`${describe}: a top or bottom margin is under 18px`);
    }
    expect(problems, `empty margins around the drawn ticks, in CSS pixels (${measured.join('; ')})`).toEqual([]);
  });

  test('a minimum side margin a stylesheet gives a tick-field in rem is honoured in pixels: with --tick-field-min-side-margin set to 3rem, the empty margins on the left and right of its drawn ticks are at least 48px', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to light or lengthen a tick. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-rem-margin/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-rem-margin.md),
       320px high, as wide as the page, with no content and a solid background, whose style
       sets --tick-field-min-side-margin to 3rem: 48px, the root font size being 16px. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    const rootFontSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(rootFontSize, 'root font size, in CSS pixels').toBe(16);
    /* The text above the field can leave it at a fraction of a pixel from the left or top of
       the page, which would shift its screenshot by up to a pixel against its box: the field is
       moved, without changing the layout around it, onto whole CSS pixels. */
    await tickField.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const left = box.left + window.scrollX;
      const top = box.top + window.scrollY;
      element.style.left = `${Math.round(left) - left}px`;
      element.style.top = `${Math.round(top) - top}px`;
    });
    await page.clock.runFor(100);
    const box = await tickField.boundingBox();
    expect(box, 'the tick-field has a box on screen').not.toBeNull();

    /* The side margins, in CSS pixels, measured as in the test of the centred field: from each
       side of the box to the outer edge of the outermost column of ticks, taken in a band from
       6px outside its edge to 8px inside it. */
    const screenshot = await tickField.screenshot();
    const extent = await extentOfDrawnTicks(tickField, screenshot);
    expect(extent.left, `drawn ticks in the ${Math.round(box!.width)}px-wide tick-field`).not.toBeNaN();
    const [leftColumn, rightColumn] = await horizontalExtentOfDrawnStrokeInRectangles(tickField, screenshot, [
      { x: extent.left - 6, y: 0, width: 14, height: box!.height },
      { x: extent.right - 8, y: 0, width: 14, height: box!.height },
    ]);
    const margins = { left: leftColumn.x, right: box!.width - (rightColumn.x + rightColumn.width) };
    expect(
      Math.min(margins.left, margins.right),
      `smaller side margin of the ${Math.round(box!.width)}px-wide tick-field, in CSS pixels (left ${margins.left.toFixed(2)}, right ${margins.right.toFixed(2)})`,
    ).toBeGreaterThanOrEqual(48);
  });

  test('a minimum margin a stylesheet gives a tick-field as a calc() expression is honoured: with --tick-field-min-vertical-margin set to calc(2rem + 8px), the empty margins at the top and bottom of its drawn ticks are at least 40px', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to light or lengthen a tick. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-calc-margin/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-calc-margin.md),
       320px high, as wide as the page, with no content and a solid background, whose style
       sets --tick-field-min-vertical-margin to calc(2rem + 8px): 40px, the root font size
       being 16px. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    const rootFontSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect(rootFontSize, 'root font size, in CSS pixels').toBe(16);
    /* The text above the field can leave it at a fraction of a pixel from the left or top of
       the page, which would shift its screenshot by up to a pixel against its box: the field is
       moved, without changing the layout around it, onto whole CSS pixels. */
    await tickField.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const left = box.left + window.scrollX;
      const top = box.top + window.scrollY;
      element.style.left = `${Math.round(left) - left}px`;
      element.style.top = `${Math.round(top) - top}px`;
    });
    await page.clock.runFor(100);
    const box = await tickField.boundingBox();
    expect(box, 'the tick-field has a box on screen').not.toBeNull();

    /* The top and bottom margins, in CSS pixels, measured as in the test of the centred field:
       from the top and bottom of the box to the nearest edge of a drawn tick. */
    const screenshot = await tickField.screenshot();
    const extent = await extentOfDrawnTicks(tickField, screenshot);
    expect(extent.top, `drawn ticks in the ${Math.round(box!.height)}px-high tick-field`).not.toBeNaN();
    const margins = { top: extent.top, bottom: box!.height - extent.bottom };
    expect(
      Math.min(margins.top, margins.bottom),
      `smaller top or bottom margin of the ${Math.round(box!.height)}px-high tick-field, in CSS pixels (top ${margins.top.toFixed(2)}, bottom ${margins.bottom.toFixed(2)})`,
    ).toBeGreaterThanOrEqual(40);
  });

  test('a tick-field reveals from left to right: 500 ms after load, every vertical band of its left part shows drawn pixels, while its right part still only shows its background', async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    /* Midway through the reveal, which sweeps the width in about 1.1 s: the front is near
       the middle, well past the left part and well short of the right part. */
    await page.clock.runFor(500);

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
      `bands of the left part (0–${Math.round(LEFT_PART_END)}px) of the ${Math.round(width)}px-wide tick-field with no drawn pixel`,
    ).toEqual([]);

    /* The right part, the last 40% of the width: still nothing but the background. */
    const RIGHT_PART_START = 0.6 * width;
    const drawnPixelsOnTheRight = columns
      .slice(Math.round(RIGHT_PART_START * scale))
      .reduce((sum, count) => sum + count, 0);
    expect(
      drawnPixelsOnTheRight,
      `pixels of the right part (${Math.round(RIGHT_PART_START)}–${Math.round(width)}px) of the tick-field that differ from its background`,
    ).toBe(0);
  });

  test('during the reveal, each tick fades in over about 350 ms: 800 ms after load, the ticks the front passed less than about 200 ms before show between 10% and 75% of the brightness above the background they show once revealed, while those it passed more than 400 ms before already show it all, within 10%', async ({ page, context }) => {
    const tickField = await openEmptyTickField(page, context);
    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;

    /* The reveal sweeps the width from left to right in about 1.1 s, starting at most about
       50 ms after load: a tick at x is reached between (x / width) × 1100 ms and 50 ms later.
       800 ms after load, the front stands at about two thirds of the width.
       - The fresh zone, from 50% to 62% of the width, was reached between about 550 and
         730 ms after load: less than about 250 ms before, and on average less than 200 ms.
         Fading in over 350 ms, its ticks are still on their way, about a third to a half as
         bright as once revealed; drawn at full brightness as soon as the front passes, they
         would already be as bright as once revealed.
       - The settled zone, from 8% to 30% of the width, was reached at the latest about 380 ms
         after load: more than 400 ms before, so its ticks are done fading in. */
    await page.clock.runFor(800);
    const zones: (Rectangle & { name: string })[] = [
      { name: 'fresh', x: 0.5 * width, y: 0, width: 0.12 * width, height },
      { name: 'settled', x: 0.08 * width, y: 0, width: 0.22 * width, height },
    ];
    const duringReveal = await luminanceAboveBackgroundInRectangles(tickField, await tickField.screenshot(), zones);

    /* Once revealed: the same zones, the field drawn whole and still. */
    await page.clock.runFor(2000);
    const revealed = await luminanceAboveBackgroundInRectangles(tickField, await tickField.screenshot(), zones);

    const describeZone = (index: number): string =>
      `${zones[index].name} zone (${Math.round(zones[index].x)}–${Math.round(zones[index].x + zones[index].width)}px of ${Math.round(width)}px): ${Math.round(duringReveal[index])} 800 ms after load, against ${Math.round(revealed[index])} once revealed`;
    expect(revealed[0], `brightness above the background of the ${describeZone(0)}`).toBeGreaterThan(0);
    expect(revealed[1], `brightness above the background of the ${describeZone(1)}`).toBeGreaterThan(0);
    const freshShare = duringReveal[0] / revealed[0];
    const settledShare = duringReveal[1] / revealed[1];
    expect(freshShare, `share of its final brightness shown by the ${describeZone(0)}`).toBeGreaterThan(0.1);
    expect(freshShare, `share of its final brightness shown by the ${describeZone(0)}`).toBeLessThan(0.75);
    expect(settledShare, `share of its final brightness shown by the ${describeZone(1)}`).toBeGreaterThan(0.9);
    expect(settledShare, `share of its final brightness shown by the ${describeZone(1)}`).toBeLessThan(1.1);
  });

  test('once revealed, a tick-field is brighter on the right than on the left: 2 s after load, its right quarter shows more than twice the brightness above the background of its left quarter', async ({ page, context }) => {
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

  test('once revealed, within a column, a tick-field is brighter at the top than at the bottom: in a vertical band at the middle of its width, the strokes of its top quarter are, at their brightest, more than 1.3 times as bright above the background as those of its bottom quarter', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to brighten a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;

    /* A vertical band at the middle of the width, a fifth of it wide, cut into its top quarter
       and its bottom quarter: the same columns, so that whatever changes from left to right
       changes the same in both. In each screenshot column of a zone, the brightest drawn pixel
       is one a tick covers fully, whatever the tick's height or its anti-aliased edges; their
       mean is how bright the zone's ticks are. A field as bright at the top as at the bottom
       gives about the same mean in both zones. */
    const screenshot = await tickField.screenshot();
    const band = { x: 0.4 * width, width: 0.2 * width };
    const QUARTER = 0.25 * height;
    const top = await brightestLuminanceAboveBackgroundPerColumnInRectangle(tickField, screenshot, { ...band, y: 0, height: QUARTER });
    const bottom = await brightestLuminanceAboveBackgroundPerColumnInRectangle(tickField, screenshot, { ...band, y: height - QUARTER, height: QUARTER });
    const describeZone = (y: number): string =>
      `(${Math.round(band.x)}–${Math.round(band.x + band.width)}px, ${Math.round(y)}–${Math.round(y + QUARTER)}px)`;
    expect(top.length, `columns with drawn pixels in the top quarter of the band ${describeZone(0)}`).toBeGreaterThan(0);
    expect(bottom.length, `columns with drawn pixels in the bottom quarter of the band ${describeZone(height - QUARTER)}`).toBeGreaterThan(0);
    const mean = (values: number[]): number => values.reduce((total, value) => total + value, 0) / values.length;
    const topBrightness = mean(top);
    const bottomBrightness = mean(bottom);
    expect(
      topBrightness,
      `mean, over its ${top.length} drawn columns, of the brightest pixel's luma above the background in the top quarter ${describeZone(0)}, against ${bottomBrightness.toFixed(1)} over the ${bottom.length} of the bottom quarter ${describeZone(height - QUARTER)}`,
    ).toBeGreaterThan(1.3 * bottomBrightness);
  });

  test('once revealed, a tick-field has taller ticks on the right than on the left: the typical height of the strokes drawn in its right quarter is more than 1.4 times that of the strokes drawn in its left quarter', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to stretch a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;

    /* The left quarter and the right quarter of the width, each over the whole height: in
       every column, each vertical run of drawn pixels is a tick, cut by that column. The
       median of their heights is the typical tick height on that side, which a pixel more or
       less at the anti-aliased ends of some ticks barely moves. Ticks of the same height
       everywhere give about the same median on both sides. */
    const screenshot = await tickField.screenshot();
    const QUARTER = 0.25 * width;
    const left = await heightsOfDrawnRunsInRectangle(tickField, screenshot, { x: 0, y: 0, width: QUARTER, height });
    const right = await heightsOfDrawnRunsInRectangle(tickField, screenshot, { x: width - QUARTER, y: 0, width: QUARTER, height });
    expect(left.length, `strokes drawn in the left quarter (0–${Math.round(QUARTER)}px)`).toBeGreaterThan(0);
    expect(right.length, `strokes drawn in the right quarter (${Math.round(width - QUARTER)}–${Math.round(width)}px)`).toBeGreaterThan(0);
    const median = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const leftHeight = median(left);
    const rightHeight = median(right);
    expect(
      rightHeight,
      `median height of the ${right.length} strokes drawn in the right quarter (${Math.round(width - QUARTER)}–${Math.round(width)}px), in CSS pixels, against ${leftHeight.toFixed(1)}px for the ${left.length} of the left quarter (0–${Math.round(QUARTER)}px)`,
    ).toBeGreaterThan(1.4 * leftHeight);
  });

  test('once revealed, the ticks of a tick-field are about 1.6px wide, and taller at the top than at the bottom: from about 5px at the bottom left to about 13px at the top right, the top left tick being taller than the bottom left one', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to stretch a tick. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    const screenshot = await tickField.screenshot();

    /* In a 60px square at a corner of the field, the tick closest to that corner: among the
       ticks drawn whole inside the square, those of the column nearest its side edge, then,
       of these, the one nearest its top or bottom edge. Its size is measured in its box,
       widened by 2px on every side to take in its faint anti-aliased edges, well short of
       the neighbouring ticks, 16px and 22px away. */
    const CORNER = 60;
    const SAME_COLUMN_PX = 4;
    const cornerTick = async (corner: { right: boolean; bottom: boolean }): Promise<{ box: Rectangle; width: number; height: number }> => {
      const zone = { x: corner.right ? width - CORNER : 0, y: corner.bottom ? height - CORNER : 0, width: CORNER, height: CORNER };
      const name = `${corner.bottom ? 'bottom' : 'top'} ${corner.right ? 'right' : 'left'}`;
      const ticks = await drawnStrokesInRectangle(tickField, screenshot, zone);
      expect(ticks.length, `ticks drawn whole in the ${name} corner of the tick-field (${Math.round(zone.x)}–${Math.round(zone.x + zone.width)}px, ${Math.round(zone.y)}–${Math.round(zone.y + zone.height)}px)`).toBeGreaterThan(0);
      const side = (tick: Rectangle): number => (corner.right ? -(tick.x + tick.width) : tick.x);
      const end = (tick: Rectangle): number => (corner.bottom ? -(tick.y + tick.height) : tick.y);
      const nearestSide = Math.min(...ticks.map(side));
      const column = ticks.filter((tick) => side(tick) - nearestSide <= SAME_COLUMN_PX);
      const box = column.reduce((nearest, tick) => (end(tick) < end(nearest) ? tick : nearest));
      const PADDING = 2;
      const size = await sizeOfDrawnStrokeInRectangle(tickField, screenshot, {
        x: box.x - PADDING,
        y: box.y - PADDING,
        width: box.width + 2 * PADDING,
        height: box.height + 2 * PADDING,
      });
      return { box, ...size };
    };
    const bottomLeft = await cornerTick({ right: false, bottom: true });
    const topLeft = await cornerTick({ right: false, bottom: false });
    const topRight = await cornerTick({ right: true, bottom: false });
    const describe = (tick: { box: Rectangle; width: number; height: number }): string =>
      `${tick.width.toFixed(2)}px wide and ${tick.height.toFixed(2)}px high, at (${tick.box.x.toFixed(1)}px, ${tick.box.y.toFixed(1)}px)`;
    const sizes = `in the ${Math.round(width)}px-wide tick-field, in CSS pixels, anti-aliased edges counted by how much of a pixel they cover: bottom left tick ${describe(bottomLeft)}, top left tick ${describe(topLeft)}, top right tick ${describe(topRight)}`;

    /* The width is measured on the top right tick, the brightest, whose faint edges stand
       furthest above rounding errors. 1.6px within 0.2px; 2px ticks fall outside. */
    expect(Math.abs(topRight.width - 1.6), `distance from 1.6px of the width of the top right tick, ${sizes}`).toBeLessThanOrEqual(0.2);
    /* About 5px at the bottom left, within 1px, and about 13px at the top right, within
       0.8px. The bottom left tick is the field's dimmest: it stands only a few colour levels
       above the background, so its faint anti-aliased edges, counted by how much of a pixel
       they cover, shift by most of a pixel from one renderer to another. */
    expect(Math.abs(bottomLeft.height - 5), `distance from 5px of the height of the bottom left tick, ${sizes}`).toBeLessThanOrEqual(1);
    expect(Math.abs(topRight.height - 13), `distance from 13px of the height of the top right tick, ${sizes}`).toBeLessThanOrEqual(0.8);
    /* Within the left column, taller at the top than at the bottom, by more than half a
       pixel. */
    expect(topLeft.height - bottomLeft.height, `height the top left tick has over the bottom left one, ${sizes}`).toBeGreaterThan(0.5);
  });

  test('once revealed, a tick-field is green on the left and cream at the top right: the colour its ticks add over the background in its left fifth has clearly more green than red or blue, and in its top right corner takes the hue of the cream', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to turn a tick to the accent. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    const screenshot = await tickField.screenshot();

    /* The hue of a colour drawn over the background, whatever its opacity: the direction of
       what it adds over the background, channel by channel. Ticks drawn with partial opacity
       add a fraction of (colour − background), so the brightness of a zone does not change
       which channels it adds most of. */
    const describe = (added: Channels): string =>
      `(${Math.round(added.red)}, ${Math.round(added.green)}, ${Math.round(added.blue)})`;

    /* The left fifth, over the whole height: green. The green it adds is well above both the
       red and the blue it adds; ticks of the theme's cream add more red than green. */
    const leftZone = { x: 0, y: 0, width: 0.2 * width, height };
    const left = await colourAddedOverBackgroundInRectangle(tickField, screenshot, leftZone);
    const leftMessage = `red, green and blue the left fifth (0–${Math.round(leftZone.width)}px) adds over the background, summed over its drawn pixels: ${describe(left)}`;
    expect(left.green, leftMessage).toBeGreaterThan(0);
    expect(left.green, `${leftMessage}; green against 1.4 times red`).toBeGreaterThan(1.4 * left.red);
    expect(left.green, `${leftMessage}; green against 1.4 times blue`).toBeGreaterThan(1.4 * left.blue);

    /* The top right corner, the last tenth of the width over the top 15% of the height:
       cream (the theme's --color-paper). The angle between what it adds over the background
       and what the cream adds says how far its hue is from the cream's: 0° when only the
       cream is drawn there; the accent is about 25° away, the green farther. */
    const background = await channelsOfColour(tickField, await tickField.evaluate((el) => getComputedStyle(el).backgroundColor));
    const cream = await channelsOfColour(
      tickField,
      await tickField.evaluate((el) => getComputedStyle(el).getPropertyValue('--color-paper').trim()),
    );
    const creamAdds = [cream.red - background.red, cream.green - background.green, cream.blue - background.blue];
    const degreesFromCreamHue = (added: Channels): number => {
      const vector = [added.red, added.green, added.blue];
      const dot = vector.reduce((sum, value, index) => sum + value * creamAdds[index], 0);
      const norm = (values: number[]) => Math.hypot(...values);
      return (Math.acos(Math.min(1, dot / (norm(vector) * norm(creamAdds)))) * 180) / Math.PI;
    };
    const topRightZone = { x: 0.9 * width, y: 0, width: 0.1 * width, height: 0.15 * height };
    const topRight = await colourAddedOverBackgroundInRectangle(tickField, screenshot, topRightZone);
    expect(
      topRight.red + topRight.green + topRight.blue,
      `colour the top right corner (${Math.round(topRightZone.x)}–${Math.round(width)}px, 0–${Math.round(topRightZone.height)}px) adds over the background: ${describe(topRight)}`,
    ).toBeGreaterThan(0);
    const MAX_DEGREES = 8;
    expect(
      degreesFromCreamHue(topRight),
      `angle between the hue the top right corner (${Math.round(topRightZone.x)}–${Math.round(width)}px, 0–${Math.round(topRightZone.height)}px) adds over the background, ${describe(topRight)}, and the cream's, ${describe({ red: creamAdds[0], green: creamAdds[1], blue: creamAdds[2] })}`,
    ).toBeLessThan(MAX_DEGREES);
  });

  test('once revealed, a tick-field is coloured along its diagonal: its ticks are green at the bottom left, accent in the middle and cream in the top right corner, and nowhere else cream: the colour its ticks add over the background in each of these zones, and at its top left and at the bottom of its right part, has the hue, of green, accent and cream, closest to the one named', async ({ page, context }) => {
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to turn a tick to the accent. */
    const tickField = await openEmptyTickField(page, context, 'reduce');
    await page.clock.runFor(16);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    const screenshot = await tickField.screenshot();

    /* The hue of a colour drawn over the background, whatever its opacity: the direction of
       what it adds over the background, channel by channel. A tick drawn with partial opacity
       adds a fraction of (colour − background), so neither how bright a tick is nor how many
       ticks a zone holds changes the direction of what the zone adds, summed over its drawn
       pixels. A zone's hue is the one of the three theme colours — green (--color-accent-dark),
       accent (--color-accent) and cream (--color-paper) — whose own direction over the
       background makes the smallest angle with it. */
    const themeColour = (customProperty: string): Promise<string> =>
      tickField.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), customProperty);
    const background = await channelsOfColour(tickField, await tickField.evaluate((el) => getComputedStyle(el).backgroundColor));
    const added = (colour: Channels): Channels => ({
      red: colour.red - background.red,
      green: colour.green - background.green,
      blue: colour.blue - background.blue,
    });
    const hues = {
      green: added(await channelsOfColour(tickField, await themeColour('--color-accent-dark'))),
      accent: added(await channelsOfColour(tickField, await themeColour('--color-accent'))),
      cream: added(await channelsOfColour(tickField, await themeColour('--color-paper'))),
    };
    type Hue = keyof typeof hues;
    const degreesBetween = (a: Channels, b: Channels): number => {
      const dot = a.red * b.red + a.green * b.green + a.blue * b.blue;
      const norms = Math.hypot(a.red, a.green, a.blue) * Math.hypot(b.red, b.green, b.blue);
      return (Math.acos(Math.min(1, dot / norms)) * 180) / Math.PI;
    };
    const describe = (channels: Channels): string =>
      `(${Math.round(channels.red)}, ${Math.round(channels.green)}, ${Math.round(channels.blue)})`;

    /* Zones as shares of the field's width and height, from its top left corner. The bottom
       of the right part stops short of the right edge, where the diagonal reaches the cream's
       side at the very corner. */
    const zones: { name: string; share: Rectangle; expected: (hue: Hue) => boolean; wanted: string }[] = [
      { name: 'bottom left', share: { x: 0, y: 0.8, width: 0.2, height: 0.2 }, expected: (hue) => hue === 'green', wanted: 'green' },
      { name: 'middle', share: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 }, expected: (hue) => hue === 'accent', wanted: 'accent' },
      { name: 'top right corner', share: { x: 0.9, y: 0, width: 0.1, height: 0.15 }, expected: (hue) => hue === 'cream', wanted: 'cream' },
      { name: 'top left', share: { x: 0, y: 0, width: 0.2, height: 0.15 }, expected: (hue) => hue !== 'cream', wanted: 'not cream' },
      { name: 'bottom of the right part', share: { x: 0.6, y: 0.85, width: 0.3, height: 0.15 }, expected: (hue) => hue !== 'cream', wanted: 'not cream' },
    ];
    const findings: string[] = [];
    let mismatches = 0;
    for (const { name, share, expected, wanted } of zones) {
      const zone = { x: share.x * width, y: share.y * height, width: share.width * width, height: share.height * height };
      const colour = await colourAddedOverBackgroundInRectangle(tickField, screenshot, zone);
      const angles = (Object.keys(hues) as Hue[]).map((hue) => ({ hue, degrees: degreesBetween(colour, hues[hue]) }));
      const closest = angles.reduce((best, angle) => (angle.degrees < best.degrees ? angle : best));
      const drawn = colour.red !== 0 || colour.green !== 0 || colour.blue !== 0;
      const matches = drawn && expected(closest.hue);
      if (!matches) mismatches += 1;
      findings.push(
        `${matches ? 'ok' : 'WRONG'} ${name} (${Math.round(zone.x)}–${Math.round(zone.x + zone.width)}px, ${Math.round(zone.y)}–${Math.round(zone.y + zone.height)}px), wanted ${wanted}: adds ${describe(colour)}, closest to ${drawn ? closest.hue : 'nothing (nothing drawn)'}; ${angles.map(({ hue, degrees }) => `${degrees.toFixed(1)}° from ${hue}`).join(', ')}`,
      );
    }
    expect(
      mismatches,
      `zones of the ${Math.round(width)}px-wide tick-field whose hue is not the one wanted, against green ${describe(hues.green)}, accent ${describe(hues.accent)} and cream ${describe(hues.cream)} over the background:\n${findings.join('\n')}`,
    ).toBe(0);
  });

  test('once revealed, a tick-field fades from its top right corner, clearly visible, to its bottom left corner, almost invisible, over its whole height: its bottom left tick lies less than 9% of the way from the background to its green, its top right tick more than 40% of the way to the cream, and in a vertical band at the middle of its width, the ticks at mid-height are dimmer than those at the top and brighter than those at the bottom', async ({ page, context }) => {
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

  test('once revealed, each tick rests at the opacity its place along the diagonal sets: its top right tick shows about 61% of its colour over the background, not more, its bottom right tick about 50%, and its top left tick, where the horizontal place weighs three times the vertical one, about 14%', async ({ page, context }) => {
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

  test('with a fine pointer, hovering a tick-field brightens the ticks under the pointer: once revealed, the zone around the pointer shows more than 1.5 times the brightness above the background it showed before the hover', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* A point in the left half, where the ticks are dim, at mid-height; the zone is the 40px
       square centred on it. */
    const point = { x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 };
    const HALF_SIDE = 20;
    const zone = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };

    const before = await luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    await page.mouse.move(fieldBox!.x + point.x, fieldBox!.y + point.y);
    /* A few animation frames. */
    await page.clock.runFor(100);
    const after = await luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    expect(
      after,
      `brightness above the background of the 40px square around the pointer at (${Math.round(point.x)}, ${Math.round(point.y)})px, against ${Math.round(before)} before the hover`,
    ).toBeGreaterThan(1.5 * before);
  });

  test('with a fine pointer, the trail stays local: once revealed, a zone far below the pointer, in the same columns, and a zone far to its side, at the same height, keep the brightness they showed before the hover', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* A point in the left half, near the top. Each zone is a 40px square: one at the same x
       near the bottom, one at the same height 160px to the right. Both are well over 100px
       from the pointer, far outside the glow around it. */
    const point = { x: 0.2 * fieldBox!.width, y: 40 };
    const HALF_SIDE = 20;
    const square = (centre: { x: number; y: number }) => ({
      x: centre.x - HALF_SIDE,
      y: centre.y - HALF_SIDE,
      width: 2 * HALF_SIDE,
      height: 2 * HALF_SIDE,
    });
    const zones = [
      { name: 'below the pointer', rectangle: square({ x: point.x, y: fieldBox!.height - 40 }) },
      { name: 'to the side of the pointer', rectangle: square({ x: point.x + 160, y: point.y }) },
    ];

    const screenshotBefore = await tickField.screenshot();
    const before = await Promise.all(
      zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshotBefore, zone.rectangle)),
    );

    await page.mouse.move(fieldBox!.x + point.x, fieldBox!.y + point.y);
    /* A few animation frames. */
    await page.clock.runFor(100);
    const screenshotAfter = await tickField.screenshot();
    const after = await Promise.all(
      zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshotAfter, zone.rectangle)),
    );

    /* Unchanged, within 10% of the brightness before the hover. */
    const changedZones = zones
      .map((zone, index) => ({ zone, before: before[index], after: after[index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.1 * before)
      .map(
        ({ zone, before, after }) =>
          `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      changedZones,
      `40px squares far from the pointer at (${Math.round(point.x)}, ${Math.round(point.y)})px whose brightness above the background changed with the hover`,
    ).toEqual([]);
  });

  test('with a fine pointer, hovering lights a disc around the pointer: once revealed, a tick 48px straight above the pointer and the same tick 48px up and to the right of it, at 45°, gain alike over the brightness they showed before the hover, within 25%', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport').not.toBeNull();

    /* One tick, in the dim left part, a little above mid-height: the drawn stroke nearest to
       that point. Measuring the same tick for both pointer positions leaves out the field's
       own gradients and how its rows and columns fall. */
    const target = { x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 - 24 };
    const search = { x: target.x - 16, y: target.y - 20, width: 32, height: 40 };
    const strokes = await drawnStrokesInRectangle(tickField, await tickField.screenshot(), search);
    expect(strokes.length, `ticks drawn whole around (${Math.round(target.x)}, ${Math.round(target.y)})px`).toBeGreaterThan(0);
    const tick = strokeNearest(strokes, target);
    const tickCentre = centreOf(tick);
    /* The tick with a few pixels around it, room for it to grow when lit, short of its
       neighbours. */
    const zone = { x: tick.x - 3, y: tick.y - 4, width: tick.width + 6, height: tick.height + 8 };

    /* 48px from the tick, well inside a 60px glow: the pointer straight below it, then down and
       to the left of it, at 45°, so that the tick lies straight above the pointer, then up and
       to the right of it. A lit square, rather than a disc, lights one and not the other. */
    const DISTANCE = 48;
    const diagonal = DISTANCE / Math.SQRT2;
    const pointerPositions = [
      { name: 'straight above the pointer', x: tickCentre.x, y: tickCentre.y + DISTANCE },
      { name: 'up and to the right of the pointer, at 45°', x: tickCentre.x - diagonal, y: tickCentre.y + diagonal },
    ];
    /* A point of the page 40px below the tick-field, or above it if the viewport ends first:
       outside the tick-field, where the pointer goes between the two hovers. */
    const MARGIN = 40;
    const outside = { x: fieldBox!.x + tickCentre.x, y: yBelowOrAboveField(fieldBox!, viewport!.height, MARGIN) };
    expect(outside.y, 'the point the pointer leaves for is in the viewport').toBeGreaterThanOrEqual(0);

    const brightness = async (): Promise<number> =>
      luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    /* For each pointer position: the tick's brightness with the pointer outside the field, its
       trail long faded, then after a few animation frames of hover. */
    const gains: { name: string; before: number; after: number }[] = [];
    for (const position of pointerPositions) {
      await page.mouse.move(outside.x, outside.y);
      await page.clock.runFor(4000);
      const before = await brightness();
      await page.mouse.move(fieldBox!.x + position.x, fieldBox!.y + position.y);
      await page.clock.runFor(100);
      const after = await brightness();
      gains.push({ name: position.name, before, after });
    }

    const describe = gains
      .map(({ name, before, after }) => `${name}: ${Math.round(before)} → ${Math.round(after)}`)
      .join('; ');
    const [above, diagonally] = gains.map(({ before, after }) => after - before);
    const message = `gain in brightness above the background of the tick at (${Math.round(tickCentre.x)}, ${Math.round(tickCentre.y)})px, ${DISTANCE}px from the pointer (${describe})`;
    expect(Math.min(above, diagonally), message).toBeGreaterThan(0.75 * Math.max(above, diagonally));
    for (const { name, before, after } of gains) {
      expect(after, `${message}; ${name}, against 1.2 times before the hover`).toBeGreaterThan(1.2 * before);
    }
  });

  test('with a fine pointer, the light falls off with distance: once revealed, a tick 15px from the pointer gains more than twice the brightness over what it showed before the hover that the same tick gains 45px from the pointer, near the edge of the 60px disc, where it still gains', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport').not.toBeNull();

    /* One tick, in the dim left part, at mid-height: the drawn stroke nearest to that point.
       Measuring the same tick for both pointer positions leaves out the field's own gradients
       and how its rows and columns fall. */
    const target = { x: 0.3 * fieldBox!.width, y: fieldBox!.height / 2 };
    const search = { x: target.x - 16, y: target.y - 20, width: 32, height: 40 };
    const strokes = await drawnStrokesInRectangle(tickField, await tickField.screenshot(), search);
    expect(strokes.length, `ticks drawn whole around (${Math.round(target.x)}, ${Math.round(target.y)})px`).toBeGreaterThan(0);
    const tick = strokeNearest(strokes, target);
    const tickCentre = centreOf(tick);
    /* The tick with a few pixels around it, room for it to grow when lit, short of its
       neighbours. */
    const zone = { x: tick.x - 3, y: tick.y - 4, width: tick.width + 6, height: tick.height + 8 };

    /* The pointer at the tick's height, to its left: close to it, then near the edge of the
       60px disc it lights. Level with the tick, so that the rows above and below, which grow
       when lit, stay out of the zone. */
    const pointerPositions = [
      { name: '15px from the pointer', x: tickCentre.x - 15, y: tickCentre.y },
      { name: '45px from the pointer', x: tickCentre.x - 45, y: tickCentre.y },
    ];
    /* A point of the page 40px below the tick-field, or above it if the viewport ends first:
       outside the tick-field, where the pointer goes between the two hovers. */
    const MARGIN = 40;
    const outside = { x: fieldBox!.x + tickCentre.x, y: yBelowOrAboveField(fieldBox!, viewport!.height, MARGIN) };
    expect(outside.y, 'the point the pointer leaves for is in the viewport').toBeGreaterThanOrEqual(0);

    const brightness = async (): Promise<number> =>
      luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    /* For each pointer position: the tick's brightness with the pointer outside the field, its
       trail long faded, then after a few animation frames of hover. */
    const gains: { name: string; before: number; after: number }[] = [];
    for (const position of pointerPositions) {
      await page.mouse.move(outside.x, outside.y);
      await page.clock.runFor(4000);
      const before = await brightness();
      await page.mouse.move(fieldBox!.x + position.x, fieldBox!.y + position.y);
      await page.clock.runFor(100);
      const after = await brightness();
      gains.push({ name: position.name, before, after });
    }

    const describe = gains
      .map(({ name, before, after }) => `${name}: ${Math.round(before)} → ${Math.round(after)}`)
      .join('; ');
    const [close, nearTheEdge] = gains;
    const message = `brightness above the background of the tick at (${Math.round(tickCentre.x)}, ${Math.round(tickCentre.y)})px (${describe})`;
    expect(nearTheEdge.after, `${message}; 45px from the pointer, against 1.2 times before the hover`).toBeGreaterThan(
      1.2 * nearTheEdge.before,
    );
    expect(close.after - close.before, `${message}; gain 15px from the pointer, against twice the gain 45px from it`).toBeGreaterThan(
      2 * (nearTheEdge.after - nearTheEdge.before),
    );
  });

  test('with a fine pointer, hovered ticks turn to the accent colour, even where the field is bright: once revealed, the colour the zone around the pointer adds over the background, in the bright right part, takes the hue of the accent', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* A point in the right part, where the ticks are bright, at mid-height; the zone is the
       40px square centred on it. */
    const point = { x: 0.85 * fieldBox!.width, y: fieldBox!.height / 2 };
    const HALF_SIDE = 20;
    const zone = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };

    /* The hue of a colour drawn over the background, whatever its opacity: the direction of
       what it adds over the background. The accent (the theme's --color-accent) adds
       (accent − background); the angle between that and what the zone adds says how far the
       zone's hue is from the accent's, 0° when only the accent is drawn there. */
    const background = await channelsOfColour(tickField, await tickField.evaluate((el) => getComputedStyle(el).backgroundColor));
    const accent = await channelsOfColour(
      tickField,
      await tickField.evaluate((el) => getComputedStyle(el).getPropertyValue('--color-accent').trim()),
    );
    const accentAdds = [accent.red - background.red, accent.green - background.green, accent.blue - background.blue];
    const degreesFromAccentHue = (added: Channels): number => {
      const vector = [added.red, added.green, added.blue];
      const dot = vector.reduce((sum, value, index) => sum + value * accentAdds[index], 0);
      const norm = (values: number[]) => Math.hypot(...values);
      return (Math.acos(Math.min(1, dot / (norm(vector) * norm(accentAdds)))) * 180) / Math.PI;
    };

    const before = degreesFromAccentHue(
      await colourAddedOverBackgroundInRectangle(tickField, await tickField.screenshot(), zone),
    );

    await page.mouse.move(fieldBox!.x + point.x, fieldBox!.y + point.y);
    /* A few animation frames. */
    await page.clock.runFor(100);
    const after = degreesFromAccentHue(
      await colourAddedOverBackgroundInRectangle(tickField, await tickField.screenshot(), zone),
    );

    /* Pulled toward the accent: within a few degrees of its hue, and at most half as far from
       it as before the hover. */
    const MAX_DEGREES = 8;
    const message = `angle between the hue the 40px square around the pointer at (${Math.round(point.x)}, ${Math.round(point.y)})px adds over the background and the accent's, after the hover, against ${before.toFixed(1)}° before`;
    expect(after, message).toBeLessThan(MAX_DEGREES);
    expect(after, message).toBeLessThan(before / 2);
  });

  test('with a fine pointer, the trail fades: once revealed, 150 ms after the pointer leaves the tick-field the zone it hovered is still brighter than before the hover, and 4 s after it is back to the brightness it showed before the hover', async ({ page, context, hasTouch }) => {
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

  test('with a fine pointer, the trail lingers: once revealed, 150 ms after the pointer moves elsewhere inside the tick-field, far from where it was, the zone it hovered is still brighter than before the hover, and 4 s after it is back to the brightness it showed before the hover', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* A point in the left half, where the ticks are dim, at mid-height; the zone is the 40px
       square centred on it. */
    const point = { x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 };
    const HALF_SIDE = 20;
    const zone = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };
    /* Where the pointer moves next: 200px to the right, at the same height, still inside the
       tick-field. The zone is well over 100px from it, far outside the glow around it. */
    const elsewhere = { x: point.x + 200, y: point.y };
    expect(
      elsewhere.x,
      `the point the pointer moves to lies inside the ${Math.round(fieldBox!.width)}px-wide tick-field`,
    ).toBeLessThan(fieldBox!.width);

    const brightness = async (): Promise<number> =>
      luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    const before = await brightness();

    await page.mouse.move(fieldBox!.x + point.x, fieldBox!.y + point.y);
    /* A few animation frames. */
    await page.clock.runFor(100);
    const lit = await brightness();

    await page.mouse.move(fieldBox!.x + elsewhere.x, fieldBox!.y + elsewhere.y);
    /* Shortly after the pointer moves away: still more than half of what the hover added. */
    await page.clock.runFor(150);
    const shortlyAfter = await brightness();
    expect(
      shortlyAfter,
      `brightness above the background of the 40px square at (${Math.round(point.x)}, ${Math.round(point.y)})px 150 ms after the pointer moved to (${Math.round(elsewhere.x)}, ${Math.round(elsewhere.y)})px, against ${Math.round(before)} before the hover and ${Math.round(lit)} under the pointer`,
    ).toBeGreaterThan(before + 0.5 * (lit - before));

    /* A few seconds later, the pointer still elsewhere: back to what it showed before the
       hover, within 10%. */
    await page.clock.runFor(4000);
    const later = await brightness();
    expect(
      Math.abs(later - before),
      `change in brightness above the background of the 40px square at (${Math.round(point.x)}, ${Math.round(point.y)})px 4 s after the pointer moved to (${Math.round(elsewhere.x)}, ${Math.round(elsewhere.y)})px (${Math.round(before)} before the hover → ${Math.round(later)}; ${Math.round(lit)} under the pointer)`,
    ).toBeLessThanOrEqual(0.1 * before);
  });

  test('with a fine pointer, the trail lingers where the pointer rested: once revealed, after the pointer stays 2 s on a spot, 150 ms after it moves elsewhere inside the tick-field, far from that spot, the zone it rested on is still brighter than before the hover, and 4 s after it is back to the brightness it showed before the hover', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* A point in the left half, where the ticks are dim, at mid-height; the zone is the 40px
       square centred on it. */
    const point = { x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 };
    const HALF_SIDE = 20;
    const zone = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };
    /* Where the pointer moves next: 200px to the right, at the same height, still inside the
       tick-field. The zone is well over 100px from it, far outside the glow around it. */
    const elsewhere = { x: point.x + 200, y: point.y };
    expect(
      elsewhere.x,
      `the point the pointer moves to lies inside the ${Math.round(fieldBox!.width)}px-wide tick-field`,
    ).toBeLessThan(fieldBox!.width);

    const brightness = async (): Promise<number> =>
      luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    const before = await brightness();

    await page.mouse.move(fieldBox!.x + point.x, fieldBox!.y + point.y);
    /* The pointer rests there, without moving, for 2 s. */
    await page.clock.runFor(2000);
    const lit = await brightness();

    await page.mouse.move(fieldBox!.x + elsewhere.x, fieldBox!.y + elsewhere.y);
    /* Shortly after the pointer moves away: still more than half of what the hover added. */
    await page.clock.runFor(150);
    const shortlyAfter = await brightness();
    expect(
      shortlyAfter,
      `brightness above the background of the 40px square at (${Math.round(point.x)}, ${Math.round(point.y)})px 150 ms after the pointer, resting there for 2 s, moved to (${Math.round(elsewhere.x)}, ${Math.round(elsewhere.y)})px, against ${Math.round(before)} before the hover and ${Math.round(lit)} under the resting pointer`,
    ).toBeGreaterThan(before + 0.5 * (lit - before));

    /* A few seconds later, the pointer still elsewhere: back to what it showed before the
       hover, within 10%. */
    await page.clock.runFor(4000);
    const later = await brightness();
    expect(
      Math.abs(later - before),
      `change in brightness above the background of the 40px square at (${Math.round(point.x)}, ${Math.round(point.y)})px 4 s after the pointer, resting there for 2 s, moved to (${Math.round(elsewhere.x)}, ${Math.round(elsewhere.y)})px (${Math.round(before)} before the hover → ${Math.round(later)}; ${Math.round(lit)} under the resting pointer)`,
    ).toBeLessThanOrEqual(0.1 * before);
  });

  test('a click (a tap on mobile) starts a ripple: once revealed, 300 ms after the click, zones all around the click point, about 84px from it, are brighter than just before the click, while the zone at the click point is not', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* The centre of the field, with room for the ring all around it. */
    const point = { x: fieldBox!.width / 2, y: fieldBox!.height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };

    /* The ring grows about 0.28px per ms: 300 ms after the click, it is about 84px from the
       click point. Four zones straddle the ring, 20px deep across it and 40px long along it,
       to its right, left, top and bottom; one 30px square sits at the click point, well inside
       the ring. All of them are far enough from the click point for the ring alone to light
       them, not the glow of a pointer hovering the click point. */
    const RADIUS = 84;
    const DEPTH = 20;
    const LENGTH = 40;
    const ringZones = [
      { name: 'right', rectangle: { x: point.x + RADIUS - DEPTH / 2, y: point.y - LENGTH / 2, width: DEPTH, height: LENGTH } },
      { name: 'left', rectangle: { x: point.x - RADIUS - DEPTH / 2, y: point.y - LENGTH / 2, width: DEPTH, height: LENGTH } },
      { name: 'top', rectangle: { x: point.x - LENGTH / 2, y: point.y - RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH } },
      { name: 'bottom', rectangle: { x: point.x - LENGTH / 2, y: point.y + RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH } },
    ];
    const HALF_SIDE = 15;
    const centre = { x: point.x - HALF_SIDE, y: point.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };
    const zones = [...ringZones.map((zone) => zone.rectangle), centre];

    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshot, zone)));
    };

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const before = await brightness();

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    const after = await brightness();

    const dimRingZones = ringZones
      .map((zone, index) => ({ zone, before: before[index], after: after[index] }))
      .filter(({ before, after }) => !(after > 1.25 * before))
      .map(
        ({ zone, before, after }) =>
          `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      dimRingZones,
      `zones about ${RADIUS}px around the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px that do not show more than 1.25 times the brightness above the background they showed before the click, 300 ms after it`,
    ).toEqual([]);

    /* The click point itself: what it showed before the click, within 10%. */
    const centreBefore = before[ringZones.length];
    const centreAfter = after[ringZones.length];
    expect(
      Math.abs(centreAfter - centreBefore),
      `change in brightness above the background of the 30px square at the click point (${Math.round(point.x)}, ${Math.round(point.y)})px, 300 ms after the click (${Math.round(centreBefore)} before → ${Math.round(centreAfter)})`,
    ).toBeLessThanOrEqual(0.1 * centreBefore);
  });

  test('the ripple lights the ticks themselves: once revealed, 300 ms after the click, a zone the ring crosses about 84px to the left of the click point is brighter than just before the click, yet still shows, between its rows of ticks, as many horizontal bands at least 4px high with no drawn pixel as it did before the click', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* The ring grows about 0.28px per ms: 300 ms after the click, it is about 84px from the
       click point. The zone straddles it to the left of the click point, 20px deep across it
       and 64px long along it, so that it holds several rows of ticks and the gaps between
       them, which the ring runs across. The click point is at mid-height, 20px short of
       putting the zone against the left edge: the zone lies in the dim left part on every
       screen, where the ticks are short and the gaps between rows wide. It is far enough from
       the click point for the ring alone to light it, not the glow of a pointer hovering the
       click point. */
    const RADIUS = 84;
    const DEPTH = 20;
    const LENGTH = 64;
    const point = { x: RADIUS + DEPTH / 2 + 20, y: fieldBox!.height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };
    const zone = { x: point.x - RADIUS - DEPTH / 2, y: point.y - LENGTH / 2, width: DEPTH, height: LENGTH };
    const describeZone = `(${Math.round(zone.x)}–${Math.round(zone.x + zone.width)}px, ${Math.round(zone.y)}–${Math.round(zone.y + zone.height)}px)`;

    /* The zone's brightness above the background, and its horizontal bands at least 4px high
       with no drawn pixel between two rows of drawn pixels: the empty gaps between its rows of
       ticks. */
    const MIN_BAND_HEIGHT = 4;
    const measure = async (): Promise<{ brightness: number; emptyBands: string[] }> => {
      const screenshot = await tickField.screenshot();
      const { rows, scale } = await pixelsNotOfBackgroundPerRow(tickField, screenshot, zone);
      return {
        brightness: await luminanceAboveBackgroundInRectangle(tickField, screenshot, zone),
        emptyBands: horizontalBandsWithoutDrawnPixels(rows, scale, MIN_BAND_HEIGHT),
      };
    };

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const before = await measure();
    expect(
      before.emptyBands.length,
      `empty horizontal bands at least ${MIN_BAND_HEIGHT}px high between rows of ticks in the zone ${describeZone}, before the click`,
    ).toBeGreaterThanOrEqual(2);

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    const after = await measure();

    /* The ring is there: the zone shows more than 1.25 times the brightness it showed before
       the click. */
    expect(
      after.brightness,
      `brightness above the background of the zone ${describeZone}, about ${RADIUS}px to the left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px, 300 ms after the click, against ${Math.round(before.brightness)} just before it`,
    ).toBeGreaterThan(1.25 * before.brightness);
    /* Yet it lights the ticks alone: the gaps between their rows stay empty. */
    expect(
      after.emptyBands.length,
      `empty horizontal bands at least ${MIN_BAND_HEIGHT}px high between rows of ticks in the zone ${describeZone}, which the ring crosses 300 ms after the click (after: ${after.emptyBands.join(', ') || 'none'}; before: ${before.emptyBands.join(', ')})`,
    ).toBe(before.emptyBands.length);
  });

  test('a lit tick is the same tick, taller: once revealed, under the hover (with a fine pointer) and 300 ms after a click (a tap on mobile), each tick of a zone of three rows of three ticks stays a separate stroke at the same x, no wider than before it was lit, covering at least what it covered before, and some of them are more than 1px taller; nothing is drawn between two ticks of a row or between two rows', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport, 'the page has a viewport').not.toBeNull();

    const strokesIn = async (zone: Rectangle): Promise<Rectangle[]> =>
      drawnStrokesInRectangle(tickField, await tickField.screenshot(), zone);
    const describeBox = (box: Rectangle) =>
      `${box.x.toFixed(1)}–${(box.x + box.width).toFixed(1)}px × ${box.y.toFixed(1)}–${(box.y + box.height).toFixed(1)}px`;
    /* The ticks drawn whole in a zone, each across from its left edge to its right edge as far
       as it covers the pixels, anti-aliased edges included, whatever its opacity: a dim tick
       whose faint edge column falls within a rounding error of the background is as wide as the
       same tick lit. Measured over the tick's own rows, 2px beyond its drawn pixels on either
       side, well short of its neighbours 16px away. */
    const ticksIn = async (zone: Rectangle): Promise<Rectangle[]> => {
      const screenshot = await tickField.screenshot();
      const strokes = await drawnStrokesInRectangle(tickField, screenshot, zone);
      const PADDING = 2;
      const across = await horizontalExtentOfDrawnStrokeInRectangles(
        tickField,
        screenshot,
        strokes.map((stroke) => ({ ...stroke, x: stroke.x - PADDING, width: stroke.width + 2 * PADDING })),
      );
      return strokes.map((stroke, i) => ({ ...stroke, ...across[i] }));
    };

    /* The unlit tick nearest to a point, in the dim left part where the ticks are short, and the
       zone of three rows of three ticks around it: ticks stand 16px apart within a row and rows
       22px apart, so that each edge of the zone runs halfway between two columns, or two rows,
       of ticks, well clear of a tick grown a few pixels taller. */
    const TICK_SPACING = 16;
    const ROW_SPACING = 22;
    const zoneAround = async (target: { x: number; y: number }): Promise<{ centre: { x: number; y: number }; zone: Rectangle }> => {
      const search = { x: target.x - TICK_SPACING, y: target.y - ROW_SPACING, width: 2 * TICK_SPACING, height: 2 * ROW_SPACING };
      const strokes = await strokesIn(search);
      expect(strokes.length, `ticks drawn whole around (${Math.round(target.x)}, ${Math.round(target.y)})px`).toBeGreaterThan(0);
      const centre = centreOf(strokeNearest(strokes, target));
      return {
        centre,
        zone: { x: centre.x - 1.5 * TICK_SPACING, y: centre.y - 1.5 * ROW_SPACING, width: 3 * TICK_SPACING, height: 3 * ROW_SPACING },
      };
    };

    /* The strokes drawn whole in the zone once its ticks are lit, against its unlit ticks: each
       unlit tick must match exactly one lit stroke, and each lit stroke one unlit tick, so that
       nothing is drawn between two ticks or two rows, nor joins them. A lit tick stays at the
       same x and no wider, within half a pixel, and covers at least the height it covered,
       within half a pixel. Also returns how much taller the lit ticks grew, at most. */
    const TOLERANCE = 0.5;
    const compare = (unlit: Rectangle[], lit: Rectangle[]): { problems: string[]; growth: number } => {
      const problems: string[] = [];
      let growth = -Infinity;
      const overlaps = (a: Rectangle, b: Rectangle) =>
        a.x < b.x + b.width + TOLERANCE && b.x < a.x + a.width + TOLERANCE && a.y < b.y + b.height && b.y < a.y + a.height;
      for (const stroke of lit) {
        if (!unlit.some((tick) => overlaps(tick, stroke))) problems.push(`lit stroke ${describeBox(stroke)} matches no unlit tick`);
      }
      for (const tick of unlit) {
        const matches = lit.filter((stroke) => overlaps(tick, stroke));
        if (matches.length !== 1) {
          problems.push(`unlit tick ${describeBox(tick)} matches ${matches.length} lit strokes${matches.length ? `: ${matches.map(describeBox).join(', ')}` : ''}`);
          continue;
        }
        const [stroke] = matches;
        const sameTick =
          Math.abs(stroke.x - tick.x) <= TOLERANCE &&
          stroke.width <= tick.width + TOLERANCE &&
          stroke.y <= tick.y + TOLERANCE &&
          stroke.y + stroke.height >= tick.y + tick.height - TOLERANCE;
        if (!sameTick) problems.push(`unlit tick ${describeBox(tick)} lit as ${describeBox(stroke)}`);
        growth = Math.max(growth, stroke.height - tick.height);
      }
      if (lit.length !== unlit.length) problems.push(`${lit.length} lit strokes against ${unlit.length} unlit ticks`);
      return { problems, growth };
    };

    if (!hasTouch) {
      /* Hover: the pointer on the tick nearest to a point of the left part at mid-height, from a
         point of the page 40px below the tick-field, or above it if the viewport ends first. */
      const MARGIN = 40;
      const outside = { x: fieldBox!.x + 0.2 * fieldBox!.width, y: yBelowOrAboveField(fieldBox!, viewport!.height, MARGIN) };
      expect(outside.y, 'the point the pointer starts from is in the viewport').toBeGreaterThanOrEqual(0);
      await page.mouse.move(outside.x, outside.y);
      await page.clock.runFor(300);
      const { centre, zone } = await zoneAround({ x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 });
      const unlit = await ticksIn(zone);
      expect(unlit.length, `unlit ticks drawn whole in the zone ${describeBox(zone)}`).toBe(9);

      await page.mouse.move(fieldBox!.x + centre.x, fieldBox!.y + centre.y);
      /* A few animation frames. */
      await page.clock.runFor(100);
      const { problems, growth } = compare(unlit, await ticksIn(zone));
      expect(
        problems,
        `strokes drawn whole in the zone ${describeBox(zone)} under the pointer at (${Math.round(centre.x)}, ${Math.round(centre.y)})px, against its unlit ticks`,
      ).toEqual([]);
      expect(growth, `how much taller the ticks of the zone ${describeBox(zone)} grew under the pointer, at most, in px`).toBeGreaterThan(1);

      /* The pointer leaves the field and its trail fades. */
      await page.mouse.move(outside.x, outside.y);
      await page.clock.runFor(4000);
    }

    /* Ripple: the ring grows about 0.28px per ms, so that 300 ms after the click it is about
       84px from the click point. The click point is at mid-height, 84px to the right of the
       second column of ticks from the left, found from the drawn ticks whatever margin the field
       leaves along its left edge, so that a whole column stands on either side of it; the zone
       is around the tick nearest to the point 84px to the click point's left, where the ring
       passes, far enough from the click point for the ring alone to light it, not the glow of a
       pointer hovering the click point. */
    const RADIUS = 84;
    const leftHalf = await strokesIn({ x: 0, y: 0, width: fieldBox!.width / 2, height: fieldBox!.height });
    const columnCentres: number[] = [];
    for (const centreX of leftHalf.map((stroke) => stroke.x + stroke.width / 2).sort((a, b) => a - b)) {
      if (columnCentres.length === 0 || centreX - columnCentres[columnCentres.length - 1] > TICK_SPACING / 2) columnCentres.push(centreX);
    }
    expect(columnCentres.length, `columns of ticks drawn in the left half of the tick-field`).toBeGreaterThanOrEqual(2);
    const point = { x: RADIUS + columnCentres[1], y: fieldBox!.height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };
    /* With a fine pointer, a click first brings the pointer over the click point: it hovers it
       already before the click, so that both measures differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const { zone } = await zoneAround({ x: point.x - RADIUS, y: point.y });
    const unlit = await ticksIn(zone);
    expect(unlit.length, `unlit ticks drawn whole in the zone ${describeBox(zone)}`).toBe(9);

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    const { problems, growth } = compare(unlit, await ticksIn(zone));
    expect(
      problems,
      `strokes drawn whole in the zone ${describeBox(zone)}, which the ring crosses about ${RADIUS}px to the left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px 300 ms after the click, against its unlit ticks`,
    ).toEqual([]);
    expect(growth, `how much taller the ticks of the zone ${describeBox(zone)} grew 300 ms after the click, at most, in px`).toBeGreaterThan(1);
  });

  test('a lit tick grows about 3px at each end at full strength, and no more where lights overlap: once revealed, 100 ms after two clicks (two taps on mobile), 24px to the left and 24px to the right of a tick, whose two rings pass over it at once, near full strength, while with a fine pointer the hover lights it as well, the tick reaches between 2 and 3.5px higher and between 2 and 3.5px lower than before it was lit', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();

    /* The unlit tick nearest to a point of the left part at mid-height, before any pointer
       comes over the field: ticks stand 16px apart within a row and rows 22px apart. */
    const TICK_SPACING = 16;
    const ROW_SPACING = 22;
    const target = { x: 0.2 * fieldBox!.width, y: fieldBox!.height / 2 };
    const strokes = await drawnStrokesInRectangle(tickField, await tickField.screenshot(), {
      x: target.x - TICK_SPACING,
      y: target.y - ROW_SPACING,
      width: 2 * TICK_SPACING,
      height: 2 * ROW_SPACING,
    });
    expect(strokes.length, `ticks drawn whole around (${Math.round(target.x)}, ${Math.round(target.y)})px`).toBeGreaterThan(0);
    const centre = centreOf(strokeNearest(strokes, target));

    const verticalExtent = async (): Promise<{ top: number; bottom: number }> =>
      verticalExtentOfTick(tickField, await tickField.screenshot(), centre, fieldBox!.height);
    const unlit = await verticalExtent();

    /* The rings grow about 0.28px per ms: about 100 ms after the clicks, both are about 24px
       from their click points, right over the tick, and still near full strength. With a fine
       pointer, the second click leaves the pointer 24px from the tick, which the hover lights
       too. Both clicks at the same instant: time stands still until the test advances it. */
    const OFFSET = 24;
    for (const side of [-1, 1]) {
      await clickOrTap(page, hasTouch, { x: fieldBox!.x + centre.x + side * OFFSET, y: fieldBox!.y + centre.y });
    }
    await page.clock.runFor(100);
    const lit = await verticalExtent();

    const describe = `the tick at (${Math.round(centre.x)}, ${Math.round(centre.y)})px, from ${unlit.top.toFixed(1)}–${unlit.bottom.toFixed(1)}px unlit to ${lit.top.toFixed(1)}–${lit.bottom.toFixed(1)}px lit by two rings at once${hasTouch ? '' : ' and the hover'}`;
    const grownUp = unlit.top - lit.top;
    const grownDown = lit.bottom - unlit.bottom;
    expect(grownUp, `how much higher ${describe} reaches, in px`).toBeGreaterThanOrEqual(2);
    expect(grownUp, `how much higher ${describe} reaches, in px`).toBeLessThanOrEqual(3.5);
    expect(grownDown, `how much lower ${describe} reaches, in px`).toBeGreaterThanOrEqual(2);
    expect(grownDown, `how much lower ${describe} reaches, in px`).toBeLessThanOrEqual(3.5);
  });

  test('a lit tick shows one opacity from end to end: once revealed, 600 ms after a click (a tap on mobile) 168px to the left of a tick of the bright upper right part, whose ring passes over it at partial strength, a pixel inside each end the tick grew shows the same colour, within 4 levels per channel, as a pixel at the middle of the tick', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();

    /* The unlit tick nearest to a point of the upper right part, where the resting ticks are
       bright: ticks stand 16px apart within a row and rows 22px apart. */
    const TICK_SPACING = 16;
    const ROW_SPACING = 22;
    const target = { x: 0.8 * fieldBox!.width, y: 0.25 * fieldBox!.height };
    const strokes = await drawnStrokesInRectangle(tickField, await tickField.screenshot(), {
      x: target.x - TICK_SPACING,
      y: target.y - ROW_SPACING,
      width: 2 * TICK_SPACING,
      height: 2 * ROW_SPACING,
    });
    expect(strokes.length, `ticks drawn whole around (${Math.round(target.x)}, ${Math.round(target.y)})px`).toBeGreaterThan(0);
    const tick = strokeNearest(strokes, target);
    const centre = centreOf(tick);
    /* Half a pixel in from the tick's left edge: a column of pixels the tick, about 1.6px wide,
       covers whole, away from its anti-aliased sides. */
    const pixelColumnX = tick.x + 0.5;

    const verticalExtent = async (screenshot: Buffer): Promise<{ top: number; bottom: number }> =>
      verticalExtentOfTick(tickField, screenshot, centre, fieldBox!.height);
    const unlit = await verticalExtent(await tickField.screenshot());

    /* The ring grows about 0.28px per ms: 600 ms after the click it is about 168px from the
       click point, right over the tick, at a little more than half its strength. With a fine
       pointer, the click leaves the pointer 168px from the tick, too far for the hover to light
       it. */
    const RADIUS = 168;
    const clickPoint = { x: fieldBox!.x + centre.x - RADIUS, y: fieldBox!.y + centre.y };
    expect(clickPoint.x, 'the click point is inside the tick-field').toBeGreaterThan(fieldBox!.x);
    await clickOrTap(page, hasTouch, clickPoint);
    await page.clock.runFor(600);
    const screenshot = await tickField.screenshot();
    const lit = await verticalExtent(screenshot);

    const describeTick = `the tick at (${Math.round(centre.x)}, ${Math.round(centre.y)})px, from ${unlit.top.toFixed(1)}–${unlit.bottom.toFixed(1)}px unlit to ${lit.top.toFixed(1)}–${lit.bottom.toFixed(1)}px lit by the ring`;
    /* Ends at least 1.5px long, so that a pixel halfway along each lies whole inside it, away
       from its anti-aliased edges. */
    expect(unlit.top - lit.top, `how much higher ${describeTick} reaches, in px`).toBeGreaterThanOrEqual(1.5);
    expect(lit.bottom - unlit.bottom, `how much lower ${describeTick} reaches, in px`).toBeGreaterThanOrEqual(1.5);

    const [middle, topEnd, bottomEnd] = await channelsOfPixelsAt(tickField, screenshot, [
      { x: pixelColumnX, y: centre.y },
      { x: pixelColumnX, y: (unlit.top + lit.top) / 2 },
      { x: pixelColumnX, y: (unlit.bottom + lit.bottom) / 2 },
    ]);
    const describe = (channels: Channels) => `rgb(${channels.red}, ${channels.green}, ${channels.blue})`;
    const largestChannelGap = (a: Channels, b: Channels) =>
      Math.max(Math.abs(a.red - b.red), Math.abs(a.green - b.green), Math.abs(a.blue - b.blue));
    const TOLERANCE = 4;
    expect(
      largestChannelGap(topEnd, middle),
      `largest gap per channel between a pixel inside the top end of ${describeTick}, ${describe(topEnd)}, and one at its middle, ${describe(middle)}`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      largestChannelGap(bottomEnd, middle),
      `largest gap per channel between a pixel inside the bottom end of ${describeTick}, ${describe(bottomEnd)}, and one at its middle, ${describe(middle)}`,
    ).toBeLessThanOrEqual(TOLERANCE);
  });

  test('the ripple spreads: once revealed, 600 ms after the click, a zone to the left of the click point, about 168px from it, is brighter than just before the click, while the zones to its right and left about 84px from it, which the ring lit 300 ms after the click, are back to what they showed before it', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* The ring grows about 0.28px per ms: 300 ms after the click it is about 84px from the
       click point, 600 ms after it about 168px. Each zone straddles one of these radii, 20px
       deep across it and 40px long along it, to the right or left of the click point. All of
       them are far enough from the click point for the ring alone to light them, not the glow
       of a pointer hovering the click point. */
    const NEAR_RADIUS = 84;
    const FAR_RADIUS = 168;
    const DEPTH = 20;
    const LENGTH = 40;
    /* At mid-height, 20px short of putting the far zone against the left edge: the field is
       320px high, too low for a ring 168px from the click point above and below it, and on a
       phone a far zone to the right would sit in the bright right edge, where ticks are close
       to full brightness already. The far zone lies in the dim left part on every screen. */
    const point = { x: FAR_RADIUS + DEPTH / 2 + 20, y: fieldBox!.height / 2 };
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
    const zones = [...farZones, ...nearZones];
    for (const zone of zones) {
      expect(
        zone.rectangle.x >= 0 && zone.rectangle.x + zone.rectangle.width <= fieldBox!.width,
        `the zone ${zone.name} from the click point lies inside the ${Math.round(fieldBox!.width)}px-wide tick-field`,
      ).toBe(true);
    }

    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshot, zone.rectangle)));
    };
    const describe = (zone: (typeof zones)[number], before: number, after: number): string =>
      `${zone.name} (${Math.round(zone.rectangle.x)}, ${Math.round(zone.rectangle.y)})px: ${Math.round(before)} → ${Math.round(after)}`;

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const before = await brightness();

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(600);
    const after = await brightness();

    /* The ring, now farther: more than 1.25 times what the zone showed before the click. */
    const dimFarZones = farZones
      .map((zone, index) => ({ zone, before: before[index], after: after[index] }))
      .filter(({ before, after }) => !(after > 1.25 * before))
      .map(({ zone, before, after }) => describe(zone, before, after));
    expect(
      dimFarZones,
      `zones about ${FAR_RADIUS}px to the left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px that do not show more than 1.25 times the brightness above the background they showed before the click, 600 ms after it`,
    ).toEqual([]);

    /* Where the ring was 300 ms after the click: what they showed before it, within 10%. */
    const stillLitNearZones = nearZones
      .map((zone, index) => ({ zone, before: before[farZones.length + index], after: after[farZones.length + index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.1 * before)
      .map(({ zone, before, after }) => describe(zone, before, after));
    expect(
      stillLitNearZones,
      `zones about ${NEAR_RADIUS}px to the right and left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px whose brightness above the background, 600 ms after the click, differs by more than 10% from what they showed before it`,
    ).toEqual([]);
  });

  test('ripples add up: once revealed, 300 ms after a first click (a tap on mobile), a second click elsewhere in the tick-field leaves the first ripple running alongside the new one: 300 ms after the second click, a zone to the left of the first click point, about 168px from it, and a zone above the second click point, about 84px from it, are both brighter than just before the first click', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* The ring grows about 0.28px per ms: 600 ms after the first click its ring is about 168px
       from the first click point, and 300 ms after the second click that ring is about 84px from
       the second click point. Each zone straddles its ring, 20px deep across it and 40px long
       along it. */
    const FIRST_RADIUS = 168;
    const SECOND_RADIUS = 84;
    const DEPTH = 20;
    const LENGTH = 40;
    /* The first click point is at mid-height, 20px short of putting its zone against the left
       edge, in the dim left part on every screen. The second one is 120px to its right, inside
       a phone's field too: its zone, above it, lies about 290px from the first zone, which the
       second ring cannot reach, and both zones are far enough from both click points for the
       rings alone to light them, not the glow of a pointer hovering a click point. */
    const first = { x: FIRST_RADIUS + DEPTH / 2 + 20, y: fieldBox!.height / 2 };
    const second = { x: first.x + 120, y: first.y };
    const onScreen = (point: { x: number; y: number }) => ({ x: fieldBox!.x + point.x, y: fieldBox!.y + point.y });
    const zones = [
      {
        name: `about ${FIRST_RADIUS}px to the left of the first click point (${Math.round(first.x)}, ${Math.round(first.y)})px`,
        rectangle: { x: first.x - FIRST_RADIUS - DEPTH / 2, y: first.y - LENGTH / 2, width: DEPTH, height: LENGTH },
      },
      {
        name: `about ${SECOND_RADIUS}px above the second click point (${Math.round(second.x)}, ${Math.round(second.y)})px`,
        rectangle: { x: second.x - LENGTH / 2, y: second.y - SECOND_RADIUS - DEPTH / 2, width: LENGTH, height: DEPTH },
      },
    ];
    expect(
      second.x + LENGTH / 2 <= fieldBox!.width,
      `the second click point and its zone lie inside the ${Math.round(fieldBox!.width)}px-wide tick-field`,
    ).toBe(true);

    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(zones.map((zone) => luminanceAboveBackgroundInRectangle(tickField, screenshot, zone.rectangle)));
    };

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers the first click point already before the click. */
    if (!hasTouch) await page.mouse.move(onScreen(first).x, onScreen(first).y);
    await page.clock.runFor(300);
    const before = await brightness();

    await clickOrTap(page, hasTouch, onScreen(first));
    await page.clock.runFor(300);
    await clickOrTap(page, hasTouch, onScreen(second));
    await page.clock.runFor(300);
    const after = await brightness();

    /* Both rings: more than 1.25 times what each zone showed before the first click. */
    const dimZones = zones
      .map((zone, index) => ({ zone, before: before[index], after: after[index] }))
      .filter(({ before, after }) => !(after > 1.25 * before))
      .map(({ zone, before, after }) => `${zone.name}: ${Math.round(before)} → ${Math.round(after)}`);
    expect(
      dimZones,
      'zones that do not show more than 1.25 times the brightness above the background they showed before the first click, 600 ms after it and 300 ms after the second click',
    ).toEqual([]);
  });

  test('where the rings of two ripples cross, a tick is at least as bright as under one of them alone: once revealed, 300 ms after two clicks (two taps on mobile) at once, 84px to the left and 84px to the right of a tick of the dim left part, whose two rings pass over it at their strongest, the tick shows at least the brightness above the background it shows 300 ms after either click alone', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;

    /* The ring grows about 0.28px per ms: 300 ms after a click, its middle is about 84px from
       the click point. The tick is the one nearest to a point at mid-height, 40px short of
       putting the left click point against the left edge: in the dim left part on every
       screen, where the ripple's light shows plainly over the tick's own. Both click points lie
       on its row, 84px away, so that each ring passes over it at its middle at the same moment,
       and farther than the 60px a pointer hovering a click point lights: the rings alone light
       it. Ticks stand 16px apart within a row and rows 22px apart. */
    const RADIUS = 84;
    const TICK_SPACING = 16;
    const ROW_SPACING = 22;
    const target = { x: RADIUS + 40, y: fieldBox!.height / 2 };
    const strokes = await drawnStrokesInRectangle(tickField, await tickField.screenshot(), {
      x: target.x - TICK_SPACING,
      y: target.y - ROW_SPACING,
      width: 2 * TICK_SPACING,
      height: 2 * ROW_SPACING,
    });
    expect(strokes.length, `ticks drawn whole around (${Math.round(target.x)}, ${Math.round(target.y)})px`).toBeGreaterThan(0);
    const tick = strokeNearest(strokes, target);
    const centre = centreOf(tick);
    const left = { x: fieldBox!.x + centre.x - RADIUS, y: fieldBox!.y + centre.y };
    const right = { x: fieldBox!.x + centre.x + RADIUS, y: fieldBox!.y + centre.y };
    expect(
      centre.x - RADIUS > 0 && centre.x + RADIUS < width,
      `both click points, ${RADIUS}px to either side of the tick at (${Math.round(centre.x)}, ${Math.round(centre.y)})px, lie inside the ${Math.round(width)}px-wide tick-field`,
    ).toBe(true);

    /* The tick in its box widened by 2px on either side and 5px above and below, so that its
       light counts even if a ring draws it a little wider or taller; its neighbours, lit or
       not, stay outside. */
    const box = { x: tick.x - 2, y: tick.y - 5, width: tick.width + 4, height: tick.height + 10 };
    const brightnessAfter = async (clicks: { x: number; y: number }[]): Promise<number> => {
      /* All clicks at the same instant: time stands still until the test advances it. */
      for (const click of clicks) await clickOrTap(page, hasTouch, click);
      await page.clock.runFor(300);
      const brightness = await luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), box);
      /* Long enough for the ripples, gone 1.7 s after their clicks, to leave nothing behind. */
      await page.clock.runFor(2000);
      return brightness;
    };
    const leftAlone = await brightnessAfter([left]);
    const rightAlone = await brightnessAfter([right]);
    const crossing = await brightnessAfter([left, right]);

    expect(
      crossing,
      `brightness above the background of the tick at (${Math.round(centre.x)}, ${Math.round(centre.y)})px, 300 ms after two clicks at once ${RADIUS}px to its left and right, against ${Math.round(leftAlone)} after the left click alone and ${Math.round(rightAlone)} after the right click alone`,
    ).toBeGreaterThanOrEqual(Math.max(leftAlone, rightAlone));
  });

  test('the ripple lasts more than a second: once revealed, 1.2 s after the click, a zone down and to the left of the click point, at 45°, about 336px from it, is brighter than just before the click', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    /* The ring grows about 0.28px per ms: 1.2 s after the click it is about 336px from the
       click point, farther than the 320px-high field is high and than a phone's field leaves
       room for on either side of a point. The zone, a 30px square, straddles that circle down
       and to the left of the click point, at 45°, near the bottom left corner, in the dim part
       of the field on every screen; the click point lies about 238px to its right and above
       it, inside any field wider than about 283px. The zone is far enough from the click point
       for the ring alone to light it, not the glow of a pointer hovering the click point. */
    const RADIUS = 336;
    const HALF_SIDE = 15;
    const diagonal = RADIUS / Math.SQRT2;
    const zoneCentre = { x: 40, y: fieldBox!.height - 40 };
    const point = { x: zoneCentre.x + diagonal, y: zoneCentre.y - diagonal };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };
    const zone = { x: zoneCentre.x - HALF_SIDE, y: zoneCentre.y - HALF_SIDE, width: 2 * HALF_SIDE, height: 2 * HALF_SIDE };
    expect(
      point.x >= 0 && point.x <= fieldBox!.width && point.y >= 0 && point.y <= fieldBox!.height,
      `the click point (${Math.round(point.x)}, ${Math.round(point.y)})px lies inside the ${Math.round(fieldBox!.width)}px-wide tick-field`,
    ).toBe(true);
    expect(
      zone.x >= 0 && zone.x + zone.width <= fieldBox!.width && zone.y >= 0 && zone.y + zone.height <= fieldBox!.height,
      `the zone down and to the left of the click point lies inside the tick-field`,
    ).toBe(true);

    const brightness = async (): Promise<number> =>
      luminanceAboveBackgroundInRectangle(tickField, await tickField.screenshot(), zone);

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const before = await brightness();

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(1200);
    const after = await brightness();

    /* The ring, faded but still there: more than 1.25 times what the zone showed before the
       click. */
    expect(
      after,
      `brightness above the background of the 30px square at (${Math.round(zone.x)}, ${Math.round(zone.y)})px, about ${RADIUS}px down and to the left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px, 1.2 s after the click, against ${Math.round(before)} just before it`,
    ).toBeGreaterThan(1.25 * before);
  });

  test('the ripple is strongest at the middle of its ring and fades towards its edges, and is gone 1.7 s after the click: once revealed, 300 ms after the click, the ticks at the middle of the ring, about 84px from the click point, gain more than 1.5 times as much brightness as those 12 to 22px inside it, and as those 12 to 22px outside it, which still gain some; 1.7 s after the click, every vertical band of the tick-field is back to the brightness it showed just before the click', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    const height = fieldBox!.height;
    /* The ring grows about 0.28px per ms: 300 ms after the click, its middle is about 84px
       from the click point. The ticks measured lie to the left of the click point, within 22px
       of that circle on either side; the click point is at mid-height, 20px short of putting
       the farthest of them against the left edge: they lie in the dim left part on every
       screen, where the ripple's light shows plainly over the ticks' own. All of them are more
       than 60px from the click point, far enough for the ring alone to light them, not the
       glow of a pointer hovering the click point. */
    const RADIUS = 84;
    const MIDDLE = 7;
    const EDGE_FROM = 12;
    const EDGE_TO = 22;
    const point = { x: RADIUS + EDGE_TO + 20, y: height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that the measures
       show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const beforeScreenshot = await tickField.screenshot();

    /* The ticks to the left of the click point, as drawn just before the click, sorted by how
       far their centre lies from the middle of the ring: at its middle, within 7px of it, or
       12 to 22px inside or outside it. Each tick is measured in its box widened by 2px on
       either side and 5px above and below, so that its light counts even if the ripple draws
       it a little wider or taller; the boxes of two ticks never overlap. */
    const ticks = await drawnStrokesInRectangle(tickField, beforeScreenshot, { x: 0, y: 0, width: point.x, height });
    const groups = [
      { name: 'at the middle of the ring', offsets: [-MIDDLE, MIDDLE] },
      { name: `${EDGE_FROM} to ${EDGE_TO}px inside the ring`, offsets: [-EDGE_TO, -EDGE_FROM] },
      { name: `${EDGE_FROM} to ${EDGE_TO}px outside the ring`, offsets: [EDGE_FROM, EDGE_TO] },
    ].map((group) => ({
      ...group,
      boxes: ticks
        .filter((tick) => {
          const offset = Math.hypot(tick.x + tick.width / 2 - point.x, tick.y + tick.height / 2 - point.y) - RADIUS;
          return offset >= group.offsets[0] && offset <= group.offsets[1];
        })
        .map((tick) => ({ x: tick.x - 2, y: tick.y - 5, width: tick.width + 4, height: tick.height + 10 })),
    }));
    for (const group of groups) {
      expect(group.boxes.length, `ticks ${group.name}, to the left of the click point`).toBeGreaterThanOrEqual(4);
    }
    const allBoxes = groups.flatMap((group) => group.boxes);
    const beforeTicks = await luminanceAboveBackgroundInRectangles(tickField, beforeScreenshot, allBoxes);

    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: together they cover every place the ring crossed. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, height, MIN_BAND_WIDTH);
    const beforeBands = await luminanceAboveBackgroundInRectangles(tickField, beforeScreenshot, bands);

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    const afterTicks = await luminanceAboveBackgroundInRectangles(tickField, await tickField.screenshot(), allBoxes);

    /* The mean brightness the ticks of each group gained over what they showed before the
       click. */
    let index = 0;
    const gains = groups.map((group) => {
      let gained = 0;
      for (let tick = 0; tick < group.boxes.length; tick++, index++) gained += afterTicks[index] - beforeTicks[index];
      return gained / group.boxes.length;
    });
    const [middleGain, ...edgeGains] = gains;
    const describeGains = groups.map((group, i) => `${group.name}: ${Math.round(gains[i])}`).join('; ');
    /* Strongest at the middle of the ring: more than 1.5 times what each edge gained. */
    for (const [i, edgeGain] of edgeGains.entries()) {
      expect(
        middleGain,
        `mean brightness gained by the ticks at the middle of the ring, about ${RADIUS}px from the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px, 300 ms after the click, against those ${groups[i + 1].name} (${describeGains})`,
      ).toBeGreaterThan(1.5 * edgeGain);
    }
    /* Fading towards the edges, not cut off: the edges still gain more than a tenth of what the
       middle gained. */
    for (const [i, edgeGain] of edgeGains.entries()) {
      expect(
        edgeGain,
        `mean brightness gained by the ticks ${groups[i + 1].name}, 300 ms after the click at (${Math.round(point.x)}, ${Math.round(point.y)})px (${describeGains})`,
      ).toBeGreaterThan(0.1 * middleGain);
    }

    /* 1.7 s after the click: every band back to what it showed before the click, within 5%. */
    await page.clock.runFor(1400);
    const afterBands = await luminanceAboveBackgroundInRectangles(tickField, await tickField.screenshot(), bands);
    const changedBands = bands
      .map((band, i) => ({ band, before: beforeBands[i], after: afterBands[i] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.05 * before)
      .map(
        ({ band, before, after }) =>
          `${Math.round(band.x)}–${Math.round(band.x + band.width)}px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      changedBands,
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 1.7 s after the click at (${Math.round(point.x)}, ${Math.round(point.y)})px, differs by more than 5% from what they showed just before it`,
    ).toEqual([]);
  });

  test('the ripple turns the ticks it lights to the accent colour and makes them nearly opaque: once revealed, 300 ms after the click, the colour the ticks at the middle of the ring add over the background, in the dim left part, takes the hue of the accent, and one of them shows a pixel 60% to 110% of the way from the background to the accent, with almost no other hue', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const height = fieldBox!.height;
    /* The ring grows about 0.28px per ms: 300 ms after the click, its middle is about 84px
       from the click point. The ticks measured lie to the left of the click point, their
       centre within 7px of that circle; the click point is at mid-height, 42px short of
       putting the ring against the left edge: they lie in the dim left part on every screen,
       where the ticks are green and faint. All of them are more than 60px from the click
       point, far enough for the ring alone to light them, not the glow of a pointer hovering
       the click point. */
    const RADIUS = 84;
    const MIDDLE = 7;
    const point = { x: RADIUS + 42, y: height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const beforeScreenshot = await tickField.screenshot();

    /* The ticks at the middle of the ring, as drawn just before the click, each in its box
       widened by 2px on either side and 5px above and below, so that a tick the ripple draws
       a little wider or taller still lies inside it; the boxes of two ticks never overlap. */
    const ticks = await drawnStrokesInRectangle(tickField, beforeScreenshot, { x: 0, y: 0, width: point.x, height });
    const boxes = ticks
      .filter((tick) => Math.abs(Math.hypot(tick.x + tick.width / 2 - point.x, tick.y + tick.height / 2 - point.y) - RADIUS) <= MIDDLE)
      .map((tick) => ({ x: tick.x - 2, y: tick.y - 5, width: tick.width + 4, height: tick.height + 10 }));
    expect(boxes.length, 'ticks at the middle of the ring, to the left of the click point').toBeGreaterThanOrEqual(4);

    /* The accent (the theme's --color-accent) adds (accent − background) over the background.
       The hue of a colour drawn over the background, whatever its opacity, is the direction of
       what it adds: the angle between that and what the accent adds says how far it is from
       the accent's hue, 0° when only the accent is drawn there; the field's own green is about
       20° away, its cream farther. */
    const background = await channelsOfColour(tickField, await tickField.evaluate((el) => getComputedStyle(el).backgroundColor));
    const accentColour = await tickField.evaluate((el) => getComputedStyle(el).getPropertyValue('--color-accent').trim());
    const accent = await channelsOfColour(tickField, accentColour);
    const accentAdds = [accent.red - background.red, accent.green - background.green, accent.blue - background.blue];
    const accentNorm = Math.hypot(...accentAdds);
    const degreesFromAccentHue = (added: Channels): number => {
      const vector = [added.red, added.green, added.blue];
      const dot = vector.reduce((sum, value, index) => sum + value * accentAdds[index], 0);
      return (Math.acos(Math.min(1, dot / (Math.hypot(...vector) * accentNorm))) * 180) / Math.PI;
    };
    const colourAdded = async (screenshot: Buffer): Promise<Channels> => {
      const added = await Promise.all(boxes.map((box) => colourAddedOverBackgroundInRectangle(tickField, screenshot, box)));
      return added.reduce(
        (sum, box) => ({ red: sum.red + box.red, green: sum.green + box.green, blue: sum.blue + box.blue }),
        { red: 0, green: 0, blue: 0 },
      );
    };
    const before = degreesFromAccentHue(await colourAdded(beforeScreenshot));

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(300);
    const afterScreenshot = await tickField.screenshot();

    /* The hue: within a few degrees of the accent's, and at most half as far from it as before
       the click. */
    const after = degreesFromAccentHue(await colourAdded(afterScreenshot));
    const MAX_DEGREES = 8;
    const hueMessage = `angle between the hue the ${boxes.length} ticks at the middle of the ring, about ${RADIUS}px to the left of the click point at (${Math.round(point.x)}, ${Math.round(point.y)})px, add over the background 300 ms after the click and the accent's, against ${before.toFixed(1)}° just before it`;
    expect(after, hueMessage).toBeLessThan(MAX_DEGREES);
    expect(after, hueMessage).toBeLessThan(before / 2);

    /* Nearly opaque: in each tick, the pixel closest to the accent, written as the background
       plus a share of (accent − background) — how far along the way from the background to
       the accent it lies — plus what it adds in any other direction, as a share of the same
       length. In one of the ticks at least, that pixel lies at least 60% of the way to the
       accent and not more than 10% beyond it, and strays from that way by less than 15% of
       its length. */
    const closest = await drawnPixelsClosestToColourInRectangles(tickField, afterScreenshot, boxes, accentColour);
    const shares = closest
      .filter((pixel): pixel is Channels => pixel !== null)
      .map((pixel) => {
        const vector = [pixel.red - background.red, pixel.green - background.green, pixel.blue - background.blue];
        const along = vector.reduce((sum, value, index) => sum + value * accentAdds[index], 0) / accentNorm ** 2;
        const astray = Math.hypot(...vector.map((value, index) => value - along * accentAdds[index])) / accentNorm;
        return { pixel, along, astray };
      });
    const MIN_ALONG = 0.6;
    const MAX_ALONG = 1.1;
    const MAX_ASTRAY = 0.15;
    const describeShares = shares
      .map(({ pixel, along, astray }) => `(${pixel.red}, ${pixel.green}, ${pixel.blue}): ${Math.round(100 * along)}% along, ${Math.round(100 * astray)}% astray`)
      .join('; ');
    expect(
      shares.some(({ along, astray }) => along >= MIN_ALONG && along <= MAX_ALONG && astray < MAX_ASTRAY),
      `a tick at the middle of the ring, 300 ms after the click at (${Math.round(point.x)}, ${Math.round(point.y)})px, whose pixel closest to the accent (${accent.red}, ${accent.green}, ${accent.blue}) lies ${100 * MIN_ALONG}% to ${100 * MAX_ALONG}% of the way from the background (${background.red}, ${background.green}, ${background.blue}) to it, straying less than ${100 * MAX_ASTRAY}% from that way; per tick: ${describeShares}`,
    ).toBe(true);
  });

  test('the ripple fades: once revealed, 2 s after the click, every vertical band of the tick-field, from the left edge to the right edge, is back to the brightness it showed just before the click', async ({ page, context, hasTouch }) => {
    const tickField = await openRevealedTickField(page, context);

    const fieldBox = await tickField.boundingBox();
    expect(fieldBox, 'the tick-field has a box on screen').not.toBeNull();
    const width = fieldBox!.width;
    /* The centre of the field: whatever the ripple left, on any side of the click point, lies
       inside the field. */
    const point = { x: width / 2, y: fieldBox!.height / 2 };
    const onScreen = { x: fieldBox!.x + point.x, y: fieldBox!.y + point.y };

    /* The width split into adjacent vertical bands, at least 40px wide each and as high as the
       field: the first starts at the left edge, the last ends at the right edge. Together they
       cover the whole field, every place the ring crossed and every place it would still be
       on, about 560px from the click point, had it not faded. */
    const MIN_BAND_WIDTH = 40;
    const bands = verticalBands(width, fieldBox!.height, MIN_BAND_WIDTH);
    const brightness = async (): Promise<number[]> => {
      const screenshot = await tickField.screenshot();
      return Promise.all(bands.map((band) => luminanceAboveBackgroundInRectangle(tickField, screenshot, band)));
    };

    /* With a fine pointer, a click first brings the pointer over the click point, which lights
       the ticks under it: the pointer hovers it already before the click, so that both
       measures show the same hover and differ by the ripple alone. */
    if (!hasTouch) await page.mouse.move(onScreen.x, onScreen.y);
    await page.clock.runFor(300);
    const before = await brightness();

    await clickOrTap(page, hasTouch, onScreen);
    await page.clock.runFor(2000);
    const after = await brightness();

    /* Back to what each band showed before the click, within 5%. */
    const changedBands = bands
      .map((band, index) => ({ band, before: before[index], after: after[index] }))
      .filter(({ before, after }) => Math.abs(after - before) > 0.05 * before)
      .map(
        ({ band, before, after }) =>
          `${Math.round(band.x)}–${Math.round(band.x + band.width)}px: ${Math.round(before)} → ${Math.round(after)}`,
      );
    expect(
      changedBands,
      `bands of the ${Math.round(width)}px-wide tick-field whose brightness above the background, 2 s after the click at (${Math.round(point.x)}, ${Math.round(point.y)})px, differs by more than 5% from what they showed just before it`,
    ).toEqual([]);
  });

  test('a click (a tap on mobile) outside a tick-field starts no ripple: once revealed, 300 ms after a click just below its bottom edge, the zones of the field about 84px from the click point are what they showed just before the click', async ({ page, context, hasTouch }) => {
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

  test('under prefers-reduced-motion: reduce, a tick-field stays still: 2 s after load, after a hover (with a fine pointer) and 300 ms after a click (a tap on mobile) at its centre, every vertical band of it, from the left edge to the right edge, shows the brightness it showed right after load', async ({ page, context, hasTouch }) => {
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

  test('if the visitor turns on reduced motion during the reveal, a tick-field is drawn across its whole width at once, then stays still: two animation frames after the switch, every vertical band of it shows drawn pixels, and 300 ms after a click (a tap on mobile) at its centre, every band shows the brightness it showed right after the switch', async ({ page, context, hasTouch }) => {
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

  test('if the visitor turns on reduced motion while a ripple spreads, a tick-field stays still from then on: once revealed, 300 ms after a click (a tap on mobile) at its centre, reduced motion is turned on, and 300 ms and 2 s after the switch, every vertical band of it shows the brightness it showed two animation frames after the switch', async ({ page, context, hasTouch }) => {
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

  test('with a fine pointer, if the visitor turns on reduced motion while the hover trail fades, a tick-field stays still from then on: once revealed, 150 ms after the pointer leaves the tick-field it hovered, reduced motion is turned on, and 300 ms and 2 s after the switch, every vertical band of it shows the brightness it showed two animation frames after the switch', async ({ page, context, hasTouch }) => {
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

  test('a tick-field scrolled out of view during its reveal stops animating, and resumes once back: while it is off screen, the page requests no animation frame, and 2 s after it is back on screen, every vertical band of it, from the left edge to the right edge, shows drawn pixels', async ({ page, context }) => {
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
