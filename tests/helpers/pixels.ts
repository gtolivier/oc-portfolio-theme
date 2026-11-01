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
): Promise<{
  notOfBackground: number[];
  notOfBackgroundPerRow: number[];
  luminanceAboveBackground: number[];
  scale: number;
}> {
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
   to bottom, the number of such pixels. With a `rectangle` (CSS pixels, relative to the
   element's box), only the pixels inside it count; the rows outside it count 0. With a
   `background` (a CSS colour), it stands for the element's background colour: for an element
   without one of its own, the colour that shows through it. `scale` is the number of
   screenshot rows (and columns) per CSS pixel of the element's size. */
export async function pixelsNotOfBackgroundPerRow(
  element: Locator,
  screenshot: Buffer,
  rectangle?: Rectangle,
  background?: string,
): Promise<{ rows: number[]; scale: number }> {
  const { notOfBackgroundPerRow, scale } = await columnsOverBackground(element, screenshot, rectangle, background);
  return { rows: notOfBackgroundPerRow, scale };
}

/* The horizontal bands, at least `minBandHeight` CSS pixels high each, that show no drawn pixel
   between two rows of drawn pixels: given, for each row of a screenshot, a count of drawn
   pixels (as pixelsNotOfBackgroundPerRow counts them) and `scale`, the number of screenshot
   rows per CSS pixel, each run of adjacent rows without any, with rows that show some both
   above and below it, is described by its extent ("132.0–144.0px"), from top to bottom. */
export function horizontalBandsWithoutDrawnPixels(rows: number[], scale: number, minBandHeight = 4): string[] {
  const firstDrawn = rows.findIndex((count) => count > 0);
  const lastDrawn = rows.findLastIndex((count) => count > 0);
  const bands: string[] = [];
  let bandStart = -1;
  for (let row = firstDrawn + 1; firstDrawn >= 0 && row <= lastDrawn; row++) {
    if (rows[row] === 0 && bandStart < 0) bandStart = row;
    if (rows[row] > 0 && bandStart >= 0) {
      if ((row - bandStart) / scale >= minBandHeight) {
        bands.push(`${(bandStart / scale).toFixed(1)}–${(row / scale).toFixed(1)}px`);
      }
      bandStart = -1;
    }
  }
  return bands;
}

/* Where the separate vertical strokes drawn between two columns of a screenshot (from
   `fromColumn` included to `toColumn` excluded) start, given the drawn pixels of each column,
   as pixelsNotOfBackgroundPerColumn counts them: the first column of each stroke, from left to
   right. A stroke is a run of adjacent columns that each show at least one drawn pixel, and
   strokes are separated by at least one column that shows none. A stroke cut by `fromColumn`
   starts there. */
export function drawnStrokeStarts(columns: number[], fromColumn: number, toColumn: number): number[] {
  const starts: number[] = [];
  for (let column = Math.max(0, fromColumn); column < Math.min(columns.length, toColumn); column++) {
    const drawn = columns[column] > 0;
    const previousDrawn = column > fromColumn && columns[column - 1] > 0;
    if (drawn && !previousDrawn) starts.push(column);
  }
  return starts;
}

/* Number of separate vertical strokes drawn between two columns of a screenshot, as
   drawnStrokeStarts finds them. A stroke cut by `fromColumn` counts as one. */
export function countDrawnStrokes(columns: number[], fromColumn: number, toColumn: number): number {
  return drawnStrokeStarts(columns, fromColumn, toColumn).length;
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
type Channels = { red: number; green: number; blue: number };

/* How much of its own colour an element's canvas shows over the element's background at each of
   several points of the element (CSS pixels, relative to its box), in the same order: its
   opacity there, as the screenshot shows it. The canvas, the element's only one, holds at each of
   its pixels a colour, whatever its opacity; at a point the canvas covers with that colour, the
   screenshot pixel shows background + opacity × (colour − background), channel by channel. The
   opacity is the projection of (screenshot pixel − background) on (colour − background), over
   the length of the latter, squared: it does not depend on which colour the canvas holds there.
   `colour` is that colour; NaN for the opacity where it is the background's own. The colours are
   read through the same colour handling as the screenshot. */
export async function canvasOpacityOverBackgroundAt(
  element: Locator,
  screenshot: Buffer,
  points: { x: number; y: number }[],
): Promise<{ opacity: number; colour: Channels }[]> {
  return element.evaluate(
    async (el, [base64, spots]) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const box = el.getBoundingClientRect();
      const scale = image.width / box.width;
      const decoder = document.createElement('canvas');
      decoder.width = image.width;
      decoder.height = image.height;
      const context = decoder.getContext('2d', { willReadFrequently: true })!;
      context.fillStyle = getComputedStyle(el).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const background = context.getImageData(0, 0, 1, 1).data;
      context.clearRect(0, 0, decoder.width, decoder.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, decoder.width, decoder.height).data;
      const canvas = el.querySelector('canvas')!;
      const canvasBox = canvas.getBoundingClientRect();
      const canvasScale = canvas.width / canvasBox.width;
      const drawn = canvas.getContext('2d')!;
      return spots.map((spot) => {
        const column = Math.min(image.width - 1, Math.max(0, Math.floor(spot.x * scale)));
        const row = Math.min(image.height - 1, Math.max(0, Math.floor(spot.y * scale)));
        const i = 4 * (row * image.width + column);
        const canvasColumn = Math.floor((spot.x + box.left - canvasBox.left) * canvasScale);
        const canvasRow = Math.floor((spot.y + box.top - canvasBox.top) * canvasScale);
        const [red, green, blue] = drawn.getImageData(canvasColumn, canvasRow, 1, 1).data;
        const way = [red - background[0], green - background[1], blue - background[2]];
        const length = way.reduce((sum, value) => sum + value * value, 0);
        const along = [0, 1, 2].reduce(
          (sum, channel) => sum + (pixels[i + channel] - background[channel]) * way[channel],
          0,
        );
        return { opacity: length === 0 ? NaN : along / length, colour: { red, green, blue } };
      });
    },
    [screenshot.toString('base64'), points] as const,
  );
}

/* Where two screenshots of the same element, taken at different times, differ by more than
   `tolerance` levels (0–255) on a channel — by default a rounding error; 0 counts any change
   at all: for each column of the screenshots, from left to right, the number of such pixels
   inside a rectangle of the element (CSS pixels, relative to its box). For an element without
   a background colour of its own, whose background is whatever shows through it. `scale` is
   the number of screenshot columns per CSS pixel of the element's width. */
export async function pixelsChangedPerColumnInRectangle(
  element: Locator,
  before: Buffer,
  after: Buffer,
  rectangle: Rectangle,
  tolerance = 2,
): Promise<{ columns: number[]; scale: number }> {
  return element.evaluate(
    async (el, [beforeBase64, afterBase64, zone, TOLERANCE]) => {
      const decode = async (base64: string): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(image, 0, 0);
        return {
          pixels: context.getImageData(0, 0, image.width, image.height).data,
          width: image.width,
          height: image.height,
        };
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
          if (
            [0, 1, 2].some((channel) => Math.abs(first.pixels[i + channel] - second.pixels[j + channel]) > TOLERANCE)
          ) {
            columns[column] += 1;
          }
        }
      }
      return { columns, scale };
    },
    [before.toString('base64'), after.toString('base64'), rectangle, tolerance] as const,
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
        return {
          pixels: context.getImageData(0, 0, image.width, image.height).data,
          width: image.width,
          height: image.height,
        };
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

/* How much of the brightness of what an element draws over its background a layer laid over
   the drawing keeps, inside a rectangle of the element (CSS pixels, relative to its box), given
   two screenshots of it, the same in all but the layer: `bare`, without the layer, and
   `covered`, with it. The drawn pixels are those of `bare` that differ from `background` (a CSS
   colour, the element's background) by more than a rounding error on a channel. `drawn` is the
   brightness they show in `bare`: the sum of their luma above the background's (Rec. 709
   weights, 0–255). `kept` is the share of it they show in `covered`, above the luma the other
   pixels of the rectangle show there, where the layer covers the background alone: whatever
   the layer adds of its own colour, and its dithering, counts on both sides and cancels out. */
export async function brightnessKeptUnderLayerInRectangle(
  element: Locator,
  bare: Buffer,
  covered: Buffer,
  rectangle: Rectangle,
  background: string,
): Promise<{ drawn: number; kept: number }> {
  return element.evaluate(
    async (el, [bareBase64, coveredBase64, zone, backgroundColour]) => {
      const TOLERANCE = 2;
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
        return {
          pixels: context.getImageData(0, 0, image.width, image.height).data,
          width: image.width,
          height: image.height,
        };
      };
      const without = await decode(bareBase64);
      const withLayer = await decode(coveredBase64);
      const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      context.fillStyle = backgroundColour;
      context.fillRect(0, 0, 1, 1);
      const backgroundPixel = context.getImageData(0, 0, 1, 1).data;
      const backgroundLuma = luma(backgroundPixel, 0);
      const width = Math.min(without.width, withLayer.width);
      const height = Math.min(without.height, withLayer.height);
      const scale = without.width / el.getBoundingClientRect().width;
      const fromColumn = Math.max(0, Math.round(zone.x * scale));
      const toColumn = Math.min(width, Math.round((zone.x + zone.width) * scale));
      const fromRow = Math.max(0, Math.round(zone.y * scale));
      const toRow = Math.min(height, Math.round((zone.y + zone.height) * scale));
      let drawn = 0;
      let drawnUnderLayer = 0;
      let drawnCount = 0;
      let backgroundUnderLayer = 0;
      let backgroundCount = 0;
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const i = 4 * (row * without.width + column);
          const j = 4 * (row * withLayer.width + column);
          const isDrawn = [0, 1, 2].some(
            (channel) => Math.abs(without.pixels[i + channel] - backgroundPixel[channel]) > TOLERANCE,
          );
          if (isDrawn) {
            drawn += luma(without.pixels, i) - backgroundLuma;
            drawnUnderLayer += luma(withLayer.pixels, j);
            drawnCount += 1;
          } else {
            backgroundUnderLayer += luma(withLayer.pixels, j);
            backgroundCount += 1;
          }
        }
      }
      const layerOverBackground = backgroundCount === 0 ? backgroundLuma : backgroundUnderLayer / backgroundCount;
      const keptBrightness = drawnUnderLayer - drawnCount * layerOverBackground;
      return { drawn, kept: drawn > 0 ? keptBrightness / drawn : 0 };
    },
    [bare.toString('base64'), covered.toString('base64'), rectangle, background] as const,
  );
}

/* The adjacent vertical bands, at least `minBandWidth` CSS pixels wide each and `height`
   high, into which a width of `width` CSS pixels splits from its left edge (x = 0) to its
   right edge, as rectangles: the first starts at the left edge, the last ends at the right
   edge. The same split as bandsWithoutDrawnPixels. */
export function verticalBands(width: number, height: number, minBandWidth = 40): Rectangle[] {
  const bandCount = Math.max(1, Math.floor(width / minBandWidth));
  const bandWidth = width / bandCount;
  return Array.from({ length: bandCount }, (_, band) => ({ x: band * bandWidth, y: 0, width: bandWidth, height }));
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

/* How strongly a colour shows at its strongest inside a rectangle of an element (CSS pixels,
   relative to its box): over the pixels of the element's screenshot inside the rectangle, the
   largest share of the way from the element's background colour to `colour` (a CSS colour)
   that a pixel lies, measured along that way (the projection of pixel − background on
   colour − background, over the length of colour − background, squared); 0 when no pixel is
   on that side of the background. A stroke of that colour drawn with an opacity shows it, at a
   pixel it covers fully, as that share: unlike a sum, it depends neither on the stroke's
   length nor on its anti-aliased edges. The colour is read through the same colour handling as
   the screenshot. */
export async function strongestShareOfColourInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
  colour: string,
): Promise<number> {
  return element.evaluate(
    async (el, [base64, zone, cssColour]) => {
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
      context.fillStyle = cssColour;
      context.fillRect(0, 0, 1, 1);
      const target = context.getImageData(0, 0, 1, 1).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const way = [0, 1, 2].map((channel) => target[channel] - background[channel]);
      const length = way.reduce((sum, value) => sum + value * value, 0);
      let strongest = 0;
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const i = 4 * (row * image.width + column);
          const along = [0, 1, 2].reduce(
            (sum, channel) => sum + (pixels[i + channel] - background[channel]) * way[channel],
            0,
          );
          strongest = Math.max(strongest, along / length);
        }
      }
      return strongest;
    },
    [screenshot.toString('base64'), rectangle, colour] as const,
  );
}

/* The separate strokes drawn inside a rectangle of an element (CSS pixels, relative to its
   box): in the element's screenshot, each group of pixels that differ from the element's
   background colour by more than a rounding error on a channel and touch one another (sides or
   corners), as the box around it, in CSS pixels relative to the element's box. Groups that
   touch an edge of the rectangle, which it may cut, are left out. */
export async function drawnStrokesInRectangle(
  element: Locator,
  screenshot: Buffer,
  rectangle: Rectangle,
): Promise<Rectangle[]> {
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
      const inside = (column: number, row: number): boolean =>
        column >= fromColumn && column < toColumn && row >= fromRow && row < toRow;
      const drawn = (column: number, row: number): boolean => {
        const i = 4 * (row * image.width + column);
        return [0, 1, 2].some((channel) => Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE);
      };
      const seen = new Set<number>();
      const strokes: { x: number; y: number; width: number; height: number }[] = [];
      for (let row = fromRow; row < toRow; row++) {
        for (let column = fromColumn; column < toColumn; column++) {
          const key = row * image.width + column;
          if (seen.has(key) || !drawn(column, row)) continue;
          seen.add(key);
          let left = column;
          let right = column;
          let top = row;
          let bottom = row;
          const pending = [[column, row]];
          while (pending.length > 0) {
            const [c, r] = pending.pop()!;
            left = Math.min(left, c);
            right = Math.max(right, c);
            top = Math.min(top, r);
            bottom = Math.max(bottom, r);
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nc = c + dc;
                const nr = r + dr;
                const neighbourKey = nr * image.width + nc;
                if (!inside(nc, nr) || seen.has(neighbourKey) || !drawn(nc, nr)) continue;
                seen.add(neighbourKey);
                pending.push([nc, nr]);
              }
            }
          }
          const touchesEdge = left === fromColumn || right === toColumn - 1 || top === fromRow || bottom === toRow - 1;
          if (touchesEdge) continue;
          strokes.push({
            x: left / scale,
            y: top / scale,
            width: (right + 1 - left) / scale,
            height: (bottom + 1 - top) / scale,
          });
        }
      }
      return strokes;
    },
    [screenshot.toString('base64'), rectangle] as const,
  );
}

/* How far the ticks drawn over an element reach, its anti-aliased edges counted by how much of a
   pixel they cover: the left edge of its leftmost column of ticks, the right edge of its
   rightmost one, the top edge of its highest tick and the bottom edge of its lowest one, in CSS
   pixels relative to the element's box. The ticks must stand in columns, each column of the
   screenshot with a drawn pixel (one that differs from the element's background colour by more
   than a rounding error on a channel) belonging to a single column of ticks, and within each
   column of ticks, apart from one another, each tick in one colour with one opacity. A pixel's
   strength is the sum, over the red, green and blue channels, of its distance from the
   background: a pixel a stroke half covers shows about half the strength of one it covers
   fully, whatever the stroke's colour, so that a bright stroke and a dim one, drawn at the same
   place, reach equally far, although the faint edge of the bright one shows more pixels that
   differ from the background. Across a stroke (a column of ticks, or a tick down its column),
   the strengths summed per line of the screenshot give its middle, their weighted average
   position, and its size, their sum over the typical line it covers fully (the median of those
   that give at least half the most); its edges lie half its size on either side of its middle. */
export async function extentOfDrawnTicks(
  element: Locator,
  screenshot: Buffer,
): Promise<{ left: number; right: number; top: number; bottom: number }> {
  return element.evaluate(async (el, base64) => {
    const TOLERANCE = 2;
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const scale = image.width / el.getBoundingClientRect().width;
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
    const strength = (column: number, row: number): number => {
      const i = 4 * (row * image.width + column);
      const distances = [0, 1, 2].map((channel) => Math.abs(pixels[i + channel] - background[channel]));
      return distances.some((distance) => distance > TOLERANCE) ? distances.reduce((sum, value) => sum + value, 0) : 0;
    };
    /* Runs of adjacent lines (columns or rows) with some strength, as [first, last]. */
    const runs = (lines: number[]): [number, number][] => {
      const found: [number, number][] = [];
      lines.forEach((value, index) => {
        if (value <= 0) return;
        const last = found[found.length - 1];
        if (last && last[1] === index - 1) last[1] = index;
        else found.push([index, index]);
      });
      return found;
    };
    /* The edges of a stroke across the lines first…last, in screenshot pixels. */
    const edges = (lines: number[], [first, last]: [number, number]): [number, number] => {
      const across = lines.slice(first, last + 1);
      const total = across.reduce((sum, value) => sum + value, 0);
      const middle = first + across.reduce((sum, value, index) => sum + (index + 0.5) * value, 0) / total;
      const strongest = Math.max(...across);
      const full = across.filter((value) => value >= strongest / 2).sort((a, b) => a - b);
      const half = Math.floor(full.length / 2);
      const typical = full.length % 2 === 1 ? full[half] : (full[half - 1] + full[half]) / 2;
      const size = total / typical;
      return [middle - size / 2, middle + size / 2];
    };
    const columns = new Array<number>(image.width).fill(0);
    for (let row = 0; row < image.height; row++) {
      for (let column = 0; column < image.width; column++) columns[column] += strength(column, row);
    }
    const tickColumns = runs(columns);
    if (tickColumns.length === 0) return { left: NaN, right: NaN, top: NaN, bottom: NaN };
    let top = Infinity;
    let bottom = -Infinity;
    for (const [first, last] of tickColumns) {
      const rows = new Array<number>(image.height).fill(0);
      for (let row = 0; row < image.height; row++) {
        for (let column = first; column <= last; column++) rows[row] += strength(column, row);
      }
      const ticks = runs(rows);
      top = Math.min(top, edges(rows, ticks[0])[0]);
      bottom = Math.max(bottom, edges(rows, ticks[ticks.length - 1])[1]);
    }
    return {
      left: edges(columns, tickColumns[0])[0] / scale,
      right: edges(columns, tickColumns[tickColumns.length - 1])[1] / scale,
      top: top / scale,
      bottom: bottom / scale,
    };
  }, screenshot.toString('base64'));
}

/* Number of pixels of the screenshot of an element that differ from the element's background
   colour by more than a rounding error on a channel. */
export async function countPixelsNotOfBackground(element: Locator, screenshot: Buffer): Promise<number> {
  const { columns } = await pixelsNotOfBackgroundPerColumn(element, screenshot);
  return columns.reduce((sum, count) => sum + count, 0);
}
