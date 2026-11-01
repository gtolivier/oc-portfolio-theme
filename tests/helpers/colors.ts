/* Computed colors read as numbers, and their contrast as WCAG defines it. */

export type Rgb = { red: number; green: number; blue: number };

/* Components of a computed color, however the browser serializes it (`rgb(…)`, `rgba(…)` or
   `color(srgb …)`): red, green and blue from 0 to 255, alpha from 0 to 1, unrounded. */
export function colorComponents(color: string): Rgb & { alpha: number } {
  const number = '([\\d.]+%?)';
  const toUnit = (value: string) => (value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value));
  const rgb = color.match(new RegExp(`^rgba?\\(\\s*${number}[\\s,]+${number}[\\s,]+${number}(?:\\s*[,/]\\s*${number})?\\s*\\)$`));
  const srgb = color.match(new RegExp(`^color\\(srgb\\s+${number}\\s+${number}\\s+${number}(?:\\s*/\\s*${number})?\\s*\\)$`));
  const match = rgb ?? srgb;
  if (!match) throw new Error(`unrecognized color: ${color}`);
  const scale = rgb ? 1 : 255;
  const [red, green, blue] = match.slice(1, 4).map((value) => (value.endsWith('%') ? toUnit(value) * 255 : parseFloat(value) * scale));
  const alpha = match[4] === undefined ? 1 : toUnit(match[4]);
  return { red, green, blue, alpha };
}

/* Relative luminance of an opaque color, as WCAG defines it: from 0 (black) to 1 (white). */
export function relativeLuminance({ red, green, blue }: Rgb): number {
  const [r, g, b] = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* Contrast ratio between two opaque colors, as WCAG defines it: from 1 (same luminance) to 21
   (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
