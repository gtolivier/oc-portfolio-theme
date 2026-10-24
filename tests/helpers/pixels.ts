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
   With a `rectangle`, only the pixels inside it count. `scale` is the number of screenshot
   columns per CSS pixel of the element's width. Decoded in the page, so that the background
   colour is read through the same colour handling as the screenshot. */
async function columnsOverBackground(
  element: Locator,
  screenshot: Buffer,
  rectangle?: Rectangle,
): Promise<{ notOfBackground: number[]; luminanceAboveBackground: number[]; scale: number }> {
  return element.evaluate(
    async (el, [base64, zone]) => {
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
      context.fillStyle = getComputedStyle(el).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const background = context.getImageData(0, 0, 1, 1).data;
      const backgroundLuma = luma(background, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const notOfBackground = new Array<number>(image.width).fill(0);
      const luminanceAboveBackground = new Array<number>(image.width).fill(0);
      for (let i = 0; i < pixels.length; i += 4) {
        const column = (i / 4) % image.width;
        const row = Math.floor(i / 4 / image.width);
        if (column < fromColumn || column >= toColumn || row < fromRow || row >= toRow) continue;
        for (let channel = 0; channel < 3; channel++) {
          if (Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE) {
            notOfBackground[column] += 1;
            luminanceAboveBackground[column] += Math.max(0, luma(pixels, i) - backgroundLuma);
            break;
          }
        }
      }
      return { notOfBackground, luminanceAboveBackground, scale };
    },
    [screenshot.toString('base64'), rectangle ?? null] as const,
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
   counts it. */
export async function luminanceAboveBackgroundInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
): Promise<number> {
  const { luminanceAboveBackground } = await columnsOverBackground(element, screenshot, rectangle);
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

/* Number of pixels of the screenshot of an element that differ from the element's background
   colour by more than a rounding error on a channel. */
export async function countPixelsNotOfBackground(element: Locator, screenshot: Buffer): Promise<number> {
  const { columns } = await pixelsNotOfBackgroundPerColumn(element, screenshot);
  return columns.reduce((sum, count) => sum + count, 0);
}
