/* What the theme's decorative canvas elements share. */

export function customProperty(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

/* Readies the canvas for a new drawing of a box of width × height CSS pixels: one canvas pixel per
   device pixel, so the strokes stay crisp, cleared, with a context that draws in CSS pixels. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const scale = window.devicePixelRatio || 1;
  resizeCanvas(canvas, Math.round(width * scale), Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return context;
}

/* The window moving to a screen of another pixel density changes no size: redraw when the density
   the canvas was drawn at stops matching, then watch the new one. */
export function watchPixelDensity(redraw: () => void): void {
  const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  query.addEventListener(
    'change',
    () => {
      redraw();
      watchPixelDensity(redraw);
    },
    { once: true },
  );
}

/* Setting a canvas's size reallocates its pixels, even to the same size: only when it changes. */
function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}
