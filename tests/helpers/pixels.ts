import { type Locator } from '@playwright/test';

/* Column by column, from left to right, what the screenshot of an element shows on top of the
   element's background colour:
   - `notOfBackground`: the number of pixels that differ from the background by more than a
     rounding error on a channel;
   - `luminanceAboveBackground`: the sum, over the pixels of the column, of how much brighter
     each pixel is than the background (luma, Rec. 709 weights, 0–255; darker pixels count
     as 0).
   `scale` is the number of screenshot columns per CSS pixel of the element's width. Decoded in
   the page, so that the background colour is read through the same colour handling as the
   screenshot. */
async function columnsOverBackground(
  element: Locator,
  screenshot: Buffer,
): Promise<{ notOfBackground: number[]; luminanceAboveBackground: number[]; scale: number }> {
  return element.evaluate(async (el, base64) => {
    const TOLERANCE = 2;
    const luma = (data: Uint8ClampedArray, i: number): number =>
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
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
      for (let channel = 0; channel < 3; channel++) {
        if (Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE) {
          notOfBackground[column] += 1;
          luminanceAboveBackground[column] += Math.max(0, luma(pixels, i) - backgroundLuma);
          break;
        }
      }
    }
    return { notOfBackground, luminanceAboveBackground, scale: image.width / el.getBoundingClientRect().width };
  }, screenshot.toString('base64'));
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

/* Number of pixels of the screenshot of an element that differ from the element's background
   colour by more than a rounding error on a channel. */
export async function countPixelsNotOfBackground(element: Locator, screenshot: Buffer): Promise<number> {
  const { columns } = await pixelsNotOfBackgroundPerColumn(element, screenshot);
  return columns.reduce((sum, count) => sum + count, 0);
}
