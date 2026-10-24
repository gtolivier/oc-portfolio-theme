import { type Locator } from '@playwright/test';

/* Where the pixels of the screenshot of an element differ from the element's background
   colour by more than a rounding error on a channel: for each column of the screenshot, from
   left to right, the number of such pixels. `scale` is the number of screenshot columns per
   CSS pixel of the element's width. Decoded in the page, so that the background colour is
   read through the same colour handling as the screenshot. */
export async function pixelsNotOfBackgroundPerColumn(
  element: Locator,
  screenshot: Buffer,
): Promise<{ columns: number[]; scale: number }> {
  return element.evaluate(async (el, base64) => {
    const TOLERANCE = 2;
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
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
    const columns = new Array<number>(image.width).fill(0);
    for (let i = 0; i < pixels.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        if (Math.abs(pixels[i + channel] - background[channel]) > TOLERANCE) {
          columns[(i / 4) % image.width] += 1;
          break;
        }
      }
    }
    return { columns, scale: image.width / el.getBoundingClientRect().width };
  }, screenshot.toString('base64'));
}

/* Number of pixels of the screenshot of an element that differ from the element's background
   colour by more than a rounding error on a channel. */
export async function countPixelsNotOfBackground(element: Locator, screenshot: Buffer): Promise<number> {
  const { columns } = await pixelsNotOfBackgroundPerColumn(element, screenshot);
  return columns.reduce((sum, count) => sum + count, 0);
}
