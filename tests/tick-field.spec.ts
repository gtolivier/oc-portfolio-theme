import { test, expect } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import {
  countPixelsNotOfBackground,
  luminanceAboveBackgroundInRectangle,
  luminanceAboveBackgroundPerColumn,
  pixelsNotOfBackgroundPerColumn,
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
});
