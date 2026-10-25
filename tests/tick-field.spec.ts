import { test, expect } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import {
  type Channels,
  type Rectangle,
  brightestLuminanceAboveBackgroundPerColumnInRectangle,
  channelsOfColour,
  colourAddedOverBackgroundInRectangle,
  countDrawnStrokes,
  countPixelsNotOfBackground,
  drawnStrokesInRectangle,
  heightsOfDrawnRunsInRectangle,
  luminanceAboveBackgroundInRectangle,
  luminanceAboveBackgroundPerColumn,
  pixelsNotOfBackgroundPerColumn,
  pixelsNotOfBackgroundPerRow,
} from './helpers/pixels';

test.describe('catalog: tick-field', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(CATALOG_SITE);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    /* Right after load: the first animation frame has run. */
    await page.clock.runFor(16);

    const screenshot = await tickField.screenshot();
    const differingPixels = await countPixelsNotOfBackground(tickField, screenshot);
    expect(differingPixels, 'pixels of the tick-field that differ from its background').toBe(0);
  });

  test('2 s after load, a tick-field is drawn across its whole width: every vertical band of it, from the left edge to the right edge, shows pixels that differ from its background', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const emptyBands: string[] = [];
    for (let band = 0; band < bandCount; band++) {
      const fromColumn = Math.round(band * bandWidth * scale);
      const toColumn = Math.round((band + 1) * bandWidth * scale);
      const drawn = columns.slice(fromColumn, toColumn).some((count) => count > 0);
      if (!drawn) {
        emptyBands.push(`${Math.round(band * bandWidth)}–${Math.round((band + 1) * bandWidth)}px`);
      }
    }
    expect(emptyBands, `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel`).toEqual([]);
  });

  test('once revealed, after the window is widened, a tick-field is drawn up to its new right edge with ticks as close together as before: 100 ms after the resize, every vertical band of it shows as many ticks as the same width showed before the resize, not the fewer, wider ticks of the old field stretched', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, as wide as the page, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* The visitor asks for reduced motion, and time stands still from before the page
       loads, until the test advances it by a single animation frame. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const emptyBands: string[] = [];
    for (let band = 0; band < bandCount; band++) {
      const fromColumn = Math.round(band * bandWidth * scale);
      const toColumn = Math.round((band + 1) * bandWidth * scale);
      const drawn = columns.slice(fromColumn, toColumn).some((count) => count > 0);
      if (!drawn) {
        emptyBands.push(`${Math.round(band * bandWidth)}–${Math.round((band + 1) * bandWidth)}px`);
      }
    }
    expect(
      emptyBands,
      `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel, right after load under reduced motion`,
    ).toEqual([]);
  });

  test('once revealed, a tick-field is made of short ticks in rows: between two rows of drawn pixels, a horizontal band at least 4px high, across its whole width, shows only its background', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to change it. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    const gaps: string[] = [];
    let gapStart = -1;
    for (let row = firstDrawn + 1; firstDrawn >= 0 && row <= lastDrawn; row++) {
      if (rows[row] === 0 && gapStart < 0) gapStart = row;
      if (rows[row] > 0 && gapStart >= 0) {
        if ((row - gapStart) / scale >= MIN_BAND_HEIGHT) {
          gaps.push(`${(gapStart / scale).toFixed(1)}–${(row / scale).toFixed(1)}px`);
        }
        gapStart = -1;
      }
    }
    expect(
      gaps.length,
      `horizontal bands at least ${MIN_BAND_HEIGHT}px high with no drawn pixel between two rows of drawn pixels, in the ${Math.round(fieldBox!.height)}px-high tick-field (drawn from ${(firstDrawn / scale).toFixed(1)}px to ${((lastDrawn + 1) / scale).toFixed(1)}px): ${gaps.join(', ') || 'none'}`,
    ).toBeGreaterThan(0);
  });

  test('a tick-field reveals from left to right: 500 ms after load, every vertical band of its left part shows drawn pixels, while its right part still only shows its background', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    const bandCount = Math.max(1, Math.floor(LEFT_PART_END / MIN_BAND_WIDTH));
    const bandWidth = LEFT_PART_END / bandCount;
    const emptyBands: string[] = [];
    for (let band = 0; band < bandCount; band++) {
      const fromColumn = Math.round(band * bandWidth * scale);
      const toColumn = Math.round((band + 1) * bandWidth * scale);
      const drawn = columns.slice(fromColumn, toColumn).some((count) => count > 0);
      if (!drawn) {
        emptyBands.push(`${Math.round(band * bandWidth)}–${Math.round((band + 1) * bandWidth)}px`);
      }
    }
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

  test('once revealed, a tick-field is brighter on the right than on the left: 2 s after load, its right quarter shows more than twice the brightness above the background of its left quarter', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to brighten a tick. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to stretch a tick. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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

  test('once revealed, a tick-field is green on the left and cream at the top right: the colour its ticks add over the background in its left fifth has clearly more green than red or blue, and in its top right corner takes the hue of the cream', async ({ page, context }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Reduced motion: the field is drawn whole and still from load, with no hover or ripple
       to turn a tick to the accent. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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

  test('with a fine pointer, hovering a tick-field brightens the ticks under the pointer: once revealed, the zone around the pointer shows more than 1.5 times the brightness above the background it showed before the hover', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background, followed by a paragraph. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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
    const centreOf = (stroke: Rectangle) => ({ x: stroke.x + stroke.width / 2, y: stroke.y + stroke.height / 2 });
    const distanceToTarget = (stroke: Rectangle) => Math.hypot(centreOf(stroke).x - target.x, centreOf(stroke).y - target.y);
    const tick = strokes.reduce((nearest, stroke) => (distanceToTarget(stroke) < distanceToTarget(nearest) ? stroke : nearest));
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
    const outside = {
      x: fieldBox!.x + tickCentre.x,
      y:
        fieldBox!.y + fieldBox!.height + MARGIN < viewport!.height
          ? fieldBox!.y + fieldBox!.height + MARGIN
          : fieldBox!.y - MARGIN,
    };
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

  test('with a fine pointer, hovered ticks turn to the accent colour, even where the field is bright: once revealed, the colour the zone around the pointer adds over the background, in the bright right part, takes the hue of the accent', async ({ page, context, hasTouch }) => {
    test.skip(hasTouch, 'hover needs a fine pointer; touch screens have none');
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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
    const outside = {
      x: fieldBox!.x + point.x,
      y:
        fieldBox!.y + fieldBox!.height + MARGIN < viewport!.height
          ? fieldBox!.y + fieldBox!.height + MARGIN
          : fieldBox!.y - MARGIN,
    };
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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

  test('a click (a tap on mobile) starts a ripple: once revealed, 300 ms after the click, zones all around the click point, about 84px from it, are brighter than just before the click, while the zone at the click point is not', async ({ page, context, hasTouch }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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

    if (hasTouch) await page.touchscreen.tap(onScreen.x, onScreen.y);
    else await page.mouse.click(onScreen.x, onScreen.y);
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

  test('the ripple spreads: once revealed, 600 ms after the click, a zone to the left of the click point, about 168px from it, is brighter than just before the click, while the zones to its right and left about 84px from it, which the ring lit 300 ms after the click, are back to what they showed before it', async ({ page, context, hasTouch }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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

    if (hasTouch) await page.touchscreen.tap(onScreen.x, onScreen.y);
    else await page.mouse.click(onScreen.x, onScreen.y);
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

  test('the ripple fades: once revealed, 2 s after the click, every vertical band of the tick-field, from the left edge to the right edge, is back to the brightness it showed just before the click', async ({ page, context, hasTouch }) => {
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const bands = Array.from({ length: bandCount }, (_, band) => ({
      x: band * bandWidth,
      y: 0,
      width: bandWidth,
      height: fieldBox!.height,
    }));
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

    if (hasTouch) await page.touchscreen.tap(onScreen.x, onScreen.y);
    else await page.mouse.click(onScreen.x, onScreen.y);
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background, followed by a paragraph. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
    await tickField.scrollIntoViewIfNeeded();
    /* Fully revealed. */
    await page.clock.runFor(2000);

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

    if (hasTouch) await page.touchscreen.tap(onScreen.x, onScreen.y);
    else await page.mouse.click(onScreen.x, onScreen.y);
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* The visitor asks for reduced motion, and time stands still from before the page
       loads, until the test advances it. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const bands = Array.from({ length: bandCount }, (_, band) => ({
      x: band * bandWidth,
      y: 0,
      width: bandWidth,
      height: fieldBox!.height,
    }));
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
    if (hasTouch) await page.touchscreen.tap(fieldBox!.x + clicked.x, fieldBox!.y + clicked.y);
    else await page.mouse.click(fieldBox!.x + clicked.x, fieldBox!.y + clicked.y);
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
    await serveSite(context, CATALOG_SITE, siteDirectory);
    /* Animations are allowed, and time stands still from before the page loads, until the
       test advances it to the middle of the reveal. */
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await stopClockBeforeLoad(page);
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-vide/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-vide.md),
       320px high, with no content and a solid background. */
    const tickField = page.getByRole('main').locator('tick-field');
    await expect(tickField).toHaveCount(1);
    await expect(tickField).toBeVisible();
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
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const bands = Array.from({ length: bandCount }, (_, band) => ({
      x: band * bandWidth,
      y: 0,
      width: bandWidth,
      height: fieldBox!.height,
    }));
    const describeBand = (band: (typeof bands)[number]): string =>
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
    if (hasTouch) await page.touchscreen.tap(fieldBox!.x + clicked.x, fieldBox!.y + clicked.y);
    else await page.mouse.click(fieldBox!.x + clicked.x, fieldBox!.y + clicked.y);
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
    await page.goto(`${CATALOG_SITE.origin}/fr/tick-field-long-texte/`);
    /* The only tick-field of the page (tests/fixtures/catalog/content/tick-field-long-texte.md),
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
    const bandCount = Math.max(1, Math.floor(width / MIN_BAND_WIDTH));
    const bandWidth = width / bandCount;
    const emptyBands: string[] = [];
    for (let band = 0; band < bandCount; band++) {
      const fromColumn = Math.round(band * bandWidth * scale);
      const toColumn = Math.round((band + 1) * bandWidth * scale);
      if (!columns.slice(fromColumn, toColumn).some((count) => count > 0)) {
        emptyBands.push(`${Math.round(band * bandWidth)}–${Math.round((band + 1) * bandWidth)}px`);
      }
    }
    expect(
      emptyBands,
      `bands of the ${Math.round(width)}px-wide tick-field with no drawn pixel, 2 s after it was scrolled back on screen`,
    ).toEqual([]);
  });
});
