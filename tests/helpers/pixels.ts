import { type Locator } from '@playwright/test';

/* A rectangle in CSS pixels, relative to the top-left corner of an element's box. */
export type Rectangle = { x: number; y: number; width: number; height: number };

/* Column by column, from left to right, what the screenshot of an element shows on top of the
   element's background colour:
   - `notOfBackground`: the number of pixels that differ from the background by more than a
     rounding error on a channel;
   - `luminanceAboveBackground`: the sum, over the pixels of the column, of how much brighter
     each pixel is than the background (luma, Rec. 709 weights, 0–255; darker pixels count
     as 0).
   With a `rectangle`, only the pixels inside it count. With a `background` (a CSS colour), it
   stands for the element's background colour: for an element without one of its own, the
   colour that shows through it. `scale` is the number of screenshot columns per CSS pixel of
   the element's width. Decoded in the page, so that the background colour is read through the
   same colour handling as the screenshot. */
async function columnsOverBackground(
  element: Locator,
  screenshot: Buffer,
  rectangle?: Rectangle,
  background?: string,
): Promise<{ notOfBackground: number[]; notOfBackgroundPerRow: number[]; luminanceAboveBackground: number[]; scale: number }> {
  return element.evaluate(
    async (el, [base64, zone, backgroundColour]) => {
      const TOLERANCE = 2;
      const luma = (data: Uint8ClampedArray, i: number): number =>
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const scale = image.width / el.getBoundingClientRect().width;
      const fromColumn = zone ? Math.max(0, Math.round(zone.x * scale)) : 0;
      const toColumn = zone ? Math.min(image.width, Math.round((zone.x + zone.width) * scale)) : image.width;
      const fromRow = zone ? Math.max(0, Math.round(zone.y * scale)) : 0;
      const toRow = zone ? Math.min(image.height, Math.round((zone.y + zone.height) * scale)) : image.height;
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.fillStyle = backgroundColour ?? getComputedStyle(el).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const background = context.getImageData(0, 0, 1, 1).data;
      const backgroundLuma = luma(background, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const notOfBackground = new Array<number>(image.width).fill(0);
      const notOfBackgroundPerRow = new Array<number>(image.height).fill(0);
      const luminanceAboveBackground = new Array<number>(image.width).fill(0);
      for (let i = 0; i < pixels.length; i += 4) {
        const column = (i / 4) % image.width;
        const row = Math.floor(i / 4 / image.width);
        if (column < fromColumn || column >= toColumn || row < fromRow || row >= toRow) continue;
        for (let channel = 0; channel < 3; channel++) {
          if (Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE) {
            notOfBackground[column] += 1;
            notOfBackgroundPerRow[row] += 1;
            luminanceAboveBackground[column] += Math.max(0, luma(pixels, i) - backgroundLuma);
            break;
          }
        }
      }
      return { notOfBackground, notOfBackgroundPerRow, luminanceAboveBackground, scale };
    },
    [screenshot.toString('base64'), rectangle ?? null, background ?? null] as const,
  );
}

/* Where the pixels of the screenshot of an element differ from the element's background
   colour by more than a rounding error on a channel: for each column of the screenshot, from
   left to right, the number of such pixels. `scale` is the number of screenshot columns per
   CSS pixel of the element's width. */
export async function pixelsNotOfBackgroundPerColumn(
  element: Locator,
  screenshot: Buffer,
): Promise<{ columns: number[]; scale: number }> {
  const { notOfBackground, scale } = await columnsOverBackground(element, screenshot);
  return { columns: notOfBackground, scale };
}

/* Where the pixels of the screenshot of an element differ from the element's background
   colour by more than a rounding error on a channel: for each row of the screenshot, from top
   to bottom, the number of such pixels. `scale` is the number of screenshot rows (and
   columns) per CSS pixel of the element's size. */
export async function pixelsNotOfBackgroundPerRow(
  element: Locator,
  screenshot: Buffer,
): Promise<{ rows: number[]; scale: number }> {
  const { notOfBackgroundPerRow, scale } = await columnsOverBackground(element, screenshot);
  return { rows: notOfBackgroundPerRow, scale };
}

/* Number of separate vertical strokes drawn between two columns of a screenshot (from
   `fromColumn` included to `toColumn` excluded), given the drawn pixels of each column, as
   pixelsNotOfBackgroundPerColumn counts them: a stroke is a run of adjacent columns that each
   show at least one drawn pixel, and strokes are separated by at least one column that shows
   none. A stroke cut by `fromColumn` counts as one. */
export function countDrawnStrokes(columns: number[], fromColumn: number, toColumn: number): number {
  let strokes = 0;
  for (let column = Math.max(0, fromColumn); column < Math.min(columns.length, toColumn); column++) {
    const drawn = columns[column] > 0;
    const previousDrawn = column > fromColumn && columns[column - 1] > 0;
    if (drawn && !previousDrawn) strokes += 1;
  }
  return strokes;
}

/* How much brighter than the element's background the screenshot of an element is: for each
   column of the screenshot, from left to right, the sum over its pixels of their luma above
   the background's (pixels within a rounding error of the background, or darker, count as
   0). `scale` is the number of screenshot columns per CSS pixel of the element's width. */
export async function luminanceAboveBackgroundPerColumn(
  element: Locator,
  screenshot: Buffer,
): Promise<{ columns: number[]; scale: number }> {
  const { luminanceAboveBackground, scale } = await columnsOverBackground(element, screenshot);
  return { columns: luminanceAboveBackground, scale };
}

/* How much brighter than the element's background the screenshot of an element is inside a
   rectangle of it (CSS pixels, relative to the element's box): the sum over the pixels of the
   rectangle of their luma above the background's, as luminanceAboveBackgroundPerColumn
   counts it. For an element without a background colour of its own, `background` (a CSS
   colour) is the colour that shows through it. */
export async function luminanceAboveBackgroundInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
  background?: string,
): Promise<number> {
  const { luminanceAboveBackground } = await columnsOverBackground(element, screenshot, rectangle, background);
  return luminanceAboveBackground.reduce((sum, value) => sum + value, 0);
}

/* Red, green and blue channels (0–255). */
export type Channels = { red: number; green: number; blue: number };

/* The channels of a CSS colour as the page draws it, read through the same colour handling as
   the screenshots. */
export async function channelsOfColour(element: Locator, colour: string): Promise<Channels> {
  return element.evaluate((_, cssColour) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.fillStyle = cssColour;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return { red, green, blue };
  }, colour);
}

/* The colour the screenshot of an element adds on top of the element's background inside a
   rectangle of it (CSS pixels, relative to the element's box): over the pixels that differ
   from the background by more than a rounding error on a channel, the sum, channel by channel,
   of the pixel minus the background. A colour drawn over the background with any opacity, or
   blurred into it, adds a multiple of (colour − background): the direction of the sum tells
   which colour was drawn, whatever its opacity. */
export async function colourAddedOverBackgroundInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
): Promise<Channels> {
  return element.evaluate(
    async (el, [base64, zone]) => {
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
      context.fillStyle = getComputedStyle(el).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const background = context.getImageData(0, 0, 1, 1).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const added = [0, 0, 0];
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const i = 4 * (row * image.width + column);
          const differs = [0, 1, 2].some((channel) => Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE);
          if (!differs) continue;
          for (let channel = 0; channel < 3; channel++) added[channel] += pixels[i + channel] - background[channel];
        }
      }
      return { red: added[0], green: added[1], blue: added[2] };
    },
    [screenshot.toString('base64'), rectangle] as const,
  );
}

/* Where two screenshots of the same element, taken at different times, differ by more than a
   rounding error on a channel: for each column of the screenshots, from left to right, the
   number of such pixels inside a rectangle of the element (CSS pixels, relative to its box).
   For an element without a background colour of its own, whose background is whatever shows
   through it. `scale` is the number of screenshot columns per CSS pixel of the element's
   width. */
export async function pixelsChangedPerColumnInRectangle(
  element: Locator,
  before: Buffer,
  after: Buffer,
  rectangle: Rectangle,
): Promise<{ columns: number[]; scale: number }> {
  return element.evaluate(
    async (el, [beforeBase64, afterBase64, zone]) => {
      const TOLERANCE = 2;
      const decode = async (base64: string): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(image, 0, 0);
        return { pixels: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height };
      };
      const first = await decode(beforeBase64);
      const second = await decode(afterBase64);
      const width = Math.min(first.width, second.width);
      const height = Math.min(first.height, second.height);
      const scale = first.width / el.getBoundingClientRect().width;
      const fromColumn = Math.max(0, Math.round(zone.x * scale));
      const toColumn = Math.min(width, Math.round((zone.x + zone.width) * scale));
      const fromRow = Math.max(0, Math.round(zone.y * scale));
      const toRow = Math.min(height, Math.round((zone.y + zone.height) * scale));
      const columns = new Array<number>(width).fill(0);
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const i = 4 * (row * first.width + column);
          const j = 4 * (row * second.width + column);
          if ([0, 1, 2].some((channel) => Math.abs(first.pixels[i + channel] - second.pixels[j + channel]) > TOLERANCE)) {
            columns[column] += 1;
          }
        }
      }
      return { columns, scale };
    },
    [before.toString('base64'), after.toString('base64'), rectangle] as const,
  );
}

/* How much brighter a rectangle of an element (CSS pixels, relative to its box) became between
   two screenshots of it, taken at different times: the mean, over the pixels of the rectangle,
   of how much brighter each pixel is in `after` than in `before` (luma, Rec. 709 weights,
   0–255; pixels that got darker count as 0). For an element without a background colour of
   its own, or whose rectangle holds text: what did not change, text included, adds nothing. */
export async function meanLuminanceGainedInRectangle(
  element: Locator,
  before: Buffer,
  after: Buffer,
  rectangle: Rectangle,
): Promise<number> {
  return element.evaluate(
    async (el, [beforeBase64, afterBase64, zone]) => {
      const luma = (data: Uint8ClampedArray, i: number): number =>
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const decode = async (base64: string): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(image, 0, 0);
        return { pixels: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height };
      };
      const first = await decode(beforeBase64);
      const second = await decode(afterBase64);
      const width = Math.min(first.width, second.width);
      const height = Math.min(first.height, second.height);
      const scale = first.width / el.getBoundingClientRect().width;
      const fromColumn = Math.max(0, Math.round(zone.x * scale));
      const toColumn = Math.min(width, Math.round((zone.x + zone.width) * scale));
      const fromRow = Math.max(0, Math.round(zone.y * scale));
      const toRow = Math.min(height, Math.round((zone.y + zone.height) * scale));
      let gained = 0;
      let count = 0;
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const i = 4 * (row * first.width + column);
          const j = 4 * (row * second.width + column);
          gained += Math.max(0, luma(second.pixels, j) - luma(first.pixels, i));
          count += 1;
        }
      }
      return count === 0 ? 0 : gained / count;
    },
    [before.toString('base64'), after.toString('base64'), rectangle] as const,
  );
}

/* The vertical bands, at least `minBandWidth` CSS pixels wide each, into which a width of
   `width` CSS pixels splits from its left edge to its right edge, that show no drawn pixel:
   given, for each column of a screenshot, a count of drawn pixels (as
   pixelsNotOfBackgroundPerColumn or pixelsChangedPerColumnInRectangle count them) and `scale`,
   the number of screenshot columns per CSS pixel, each band without any is described by its
   extent ("0–40px"). An empty list means the drawing reaches both edges and leaves no gap in
   between. */
export function bandsWithoutDrawnPixels(columns: number[], scale: number, width: number, minBandWidth = 40): string[] {
  const bandCount = Math.max(1, Math.floor(width / minBandWidth));
  const bandWidth = width / bandCount;
  const emptyBands: string[] = [];
  for (let band = 0; band < bandCount; band++) {
    const fromColumn = Math.round(band * bandWidth * scale);
    const toColumn = Math.round((band + 1) * bandWidth * scale);
    if (!columns.slice(fromColumn, toColumn).some((count) => count > 0)) {
      emptyBands.push(`${Math.round(band * bandWidth)}–${Math.round((band + 1) * bandWidth)}px`);
    }
  }
  return emptyBands;
}

/* How tall the strokes drawn inside a rectangle of an element (CSS pixels, relative to its
   box) are: in each column of the element's screenshot inside the rectangle, every run of
   vertically adjacent pixels that differ from the element's background colour by more than a
   rounding error on a channel, its height in CSS pixels. A run cut by the top or bottom edge
   of the rectangle counts only its part inside it. */
export async function heightsOfDrawnRunsInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
): Promise<number[]> {
  return element.evaluate(
    async (el, [base64, zone]) => {
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
      context.fillStyle = getComputedStyle(el).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const background = context.getImageData(0, 0, 1, 1).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const heights: number[] = [];
      for (let column = fromColumn; column < toColumn; column++) {
        let run = 0;
        for (let row = fromRow; row <= toRow; row++) {
          const i = 4 * (row * image.width + column);
          const drawn =
            row < toRow && [0, 1, 2].some((channel) => Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE);
          if (drawn) {
            run += 1;
          } else if (run > 0) {
            heights.push(run / scale);
            run = 0;
          }
        }
      }
      return heights;
    },
    [screenshot.toString('base64'), rectangle] as const,
  );
}

/* How bright the strokes drawn inside a rectangle of an element (CSS pixels, relative to its
   box) are at their brightest: for each column of the element's screenshot inside the
   rectangle, from left to right, that shows at least one pixel differing from the element's
   background colour by more than a rounding error on a channel, the luma above the
   background's (Rec. 709 weights, 0–255; darker counts as 0) of its brightest pixel inside
   the rectangle. The brightest pixel of a stroke is one it covers fully: unlike a sum, it
   depends neither on the stroke's length nor on its anti-aliased edges. */
export async function brightestLuminanceAboveBackgroundPerColumnInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
): Promise<number[]> {
  return element.evaluate(
    async (el, [base64, zone]) => {
      const TOLERANCE = 2;
      const luma = (data: Uint8ClampedArray, i: number): number =>
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
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
      context.fillStyle = getComputedStyle(el).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const background = context.getImageData(0, 0, 1, 1).data;
      const backgroundLuma = luma(background, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const brightest: number[] = [];
      for (let column = fromColumn; column < toColumn; column++) {
        let drawn = false;
        let max = 0;
        for (let row = fromRow; row < toRow; row++) {
          const i = 4 * (row * image.width + column);
          if (![0, 1, 2].some((channel) => Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE)) continue;
          drawn = true;
          max = Math.max(max, luma(pixels, i) - backgroundLuma);
        }
        if (drawn) brightest.push(max);
      }
      return brightest;
    },
    [screenshot.toString('base64'), rectangle] as const,
  );
}

/* Number of pixels of the screenshot of an element that differ from the element's background
   colour by more than a rounding error on a channel. */
export async function countPixelsNotOfBackground(element: Locator, screenshot: Buffer): Promise<number> {
  const { columns } = await pixelsNotOfBackgroundPerColumn(element, screenshot);
  return columns.reduce((sum, count) => sum + count, 0);
}
