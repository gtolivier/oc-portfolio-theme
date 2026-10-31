/* A still pattern of short ticks in rows, drawn anew at every load: no seed, so each visit shows a
   pattern of its own. */

import { customProperty, devicePixelSize, type PixelSize, prepareCanvas, watchPixelDensity } from './canvas-drawing';

/* The box drawn in when the element has no layout of its own, in CSS pixels. */
const PATTERN_FALLBACK_WIDTH_PX = 480;

const PATTERN_FALLBACK_HEIGHT_PX = 96;

/* Where the first column and row of ticks sit, and the empty margin left at the right and bottom. */
const PATTERN_LEFT_PX = 14;

const PATTERN_TOP_PX = 12;

const PATTERN_RIGHT_MARGIN_PX = 8;

const PATTERN_BOTTOM_MARGIN_PX = 14;

const PATTERN_COLUMN_SPACING_PX = 11;

const PATTERN_ROW_SPACING_PX = 20;

const PATTERN_TICK_WIDTH_PX = 1.5;

const PATTERN_TICK_MIN_HEIGHT_PX = 8;

const PATTERN_TICK_MAX_HEIGHT_PX = 12;

/* The share of ticks drawn bright, almost opaque; the others are see-through. */
const PATTERN_BRIGHT_SHARE = 0.06;

const PATTERN_BRIGHT_ALPHA = 0.95;

const PATTERN_MIN_ALPHA = 0.2;

const PATTERN_MAX_ALPHA = 0.5;

/* The share of ticks in the accent colour, bright ones included; the others are paper-coloured. */
const PATTERN_ACCENT_SHARE = 0.6;

/* The box the pattern covers, in CSS pixels. */
type PatternBox = { width: number; height: number };

/* The theme's colours the pattern paints with. */
type PatternColors = { accent: string; paper: string };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/* How many columns or rows of ticks fit, one every spacing from start, each starting before end. */
function tickCount(start: number, end: number, spacing: number): number {
  return Math.max(0, Math.ceil((end - start) / spacing));
}

/* One tick as rolled once, kept so that a redraw shows it again. */
type Tick = { alpha: number; isAccent: boolean; height: number };

function rollTick(): Tick {
  /* One roll sets both its brightness and its colour: every bright tick is in the accent colour. */
  const roll = Math.random();
  return {
    alpha: roll < PATTERN_BRIGHT_SHARE ? PATTERN_BRIGHT_ALPHA : randomBetween(PATTERN_MIN_ALPHA, PATTERN_MAX_ALPHA),
    isAccent: roll < PATTERN_ACCENT_SHARE,
    height: randomBetween(PATTERN_TICK_MIN_HEIGHT_PX, PATTERN_TICK_MAX_HEIGHT_PX),
  };
}

/* One observer for every pattern on the page, each entry handed to the pattern it measured. */
const patternResizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) (entry.target as TickPattern).resize(entry);
});

/* A decorative canvas filling the box, completed with new ticks when the box widens. */
class TickPattern extends HTMLElement {
  private canvas = document.createElement('canvas');

  /* The ticks rolled so far, by column then by row. */
  private columns: Tick[][] = [];

  /* The box last measured, in CSS pixels: a change of density alone changes no size, so its redraw
     reuses it. */
  private box: PatternBox = { width: PATTERN_FALLBACK_WIDTH_PX, height: PATTERN_FALLBACK_HEIGHT_PX };

  /* The canvas size, in device pixels, of the last drawing; none before the first one. */
  private drawnSize?: PixelSize;

  connectedCallback(): void {
    this.prepend(this.canvas);
    /* The observer's first callback, as observing starts, draws the pattern for the first time. */
    patternResizeObserver.observe(this);
    watchPixelDensity(() => this.draw());
  }

  disconnectedCallback(): void {
    patternResizeObserver.unobserve(this);
  }

  /* The entry's content box, unlike offsetWidth, keeps the fractional CSS pixels of the layout. */
  resize(entry: ResizeObserverEntry): void {
    const { width, height } = entry.contentRect;
    this.box = { width: width || PATTERN_FALLBACK_WIDTH_PX, height: height || PATTERN_FALLBACK_HEIGHT_PX };
    if (!this.isDrawnAtBoxSize()) this.draw();
  }

  /* A resize below a device pixel would draw the same pattern again. */
  private isDrawnAtBoxSize(): boolean {
    const size = devicePixelSize(this.box.width, this.box.height);
    return this.drawnSize?.width === size.width && this.drawnSize?.height === size.height;
  }

  private draw(): void {
    const { width, height } = this.box;
    this.drawnSize = devicePixelSize(width, height);
    const context = prepareCanvas(this.canvas, width, height);
    if (!context) return;
    const colors = this.themeColors();
    const columns = tickCount(PATTERN_LEFT_PX, width - PATTERN_RIGHT_MARGIN_PX, PATTERN_COLUMN_SPACING_PX);
    const rows = tickCount(PATTERN_TOP_PX, height - PATTERN_BOTTOM_MARGIN_PX, PATTERN_ROW_SPACING_PX);
    for (let column = 0; column < columns; column += 1) {
      const x = PATTERN_LEFT_PX + column * PATTERN_COLUMN_SPACING_PX;
      for (let row = 0; row < rows; row += 1) {
        const y = PATTERN_TOP_PX + row * PATTERN_ROW_SPACING_PX;
        this.drawTick(context, colors, x, y, this.tickAt(column, row));
      }
    }
  }

  /* The tick kept for that place in the grid, rolled the first time the place is drawn. */
  private tickAt(column: number, row: number): Tick {
    const columnTicks = (this.columns[column] ??= []);
    return (columnTicks[row] ??= rollTick());
  }

  /* One tick, its top-left corner at x, y in CSS pixels. */
  private drawTick(context: CanvasRenderingContext2D, colors: PatternColors, x: number, y: number, tick: Tick): void {
    context.globalAlpha = tick.alpha;
    context.fillStyle = tick.isAccent ? colors.accent : colors.paper;
    context.fillRect(x, y, PATTERN_TICK_WIDTH_PX, tick.height);
  }

  private themeColors(): PatternColors {
    const style = getComputedStyle(this);
    const color = (name: string): string => customProperty(style, name);
    return { accent: color('--color-accent'), paper: color('--color-paper') };
  }
}

customElements.define('tick-pattern', TickPattern);
