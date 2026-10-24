import { test, expect } from '@playwright/test';
import { CATALOG_SITE, buildSite, removeDirectory, serveSite } from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import {
  type Channels,
  channelsOfColour,
  colourAddedOverBackgroundInRectangle,
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
});
