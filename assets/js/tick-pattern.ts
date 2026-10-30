/* A still pattern of short ticks in rows, drawn anew at every load: no seed, so each visit shows a
   pattern of its own. */

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

/* A decorative canvas filling the box, completed with new ticks when the box widens. */
class TickPattern extends HTMLElement {
  private canvas = document.createElement('canvas');

  /* The ticks rolled so far, by column then by row. */
  private columns: Tick[][] = [];

  private observer?: ResizeObserver;

  connectedCallback(): void {
    this.prepend(this.canvas);
    this.draw();
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this);
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
  }

  private draw(): void {
    /* One canvas pixel per device pixel, so the strokes stay crisp. */
    const scale = window.devicePixelRatio || 1;
    const width = this.offsetWidth || PATTERN_FALLBACK_WIDTH_PX;
    const height = this.offsetHeight || PATTERN_FALLBACK_HEIGHT_PX;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
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
    const color = (name: string): string => style.getPropertyValue(name).trim();
    return { accent: color('--color-accent'), paper: color('--color-paper') };
  }
}

customElements.define('tick-pattern', TickPattern);
