// The theme's TypeScript entry point, compiled by Hugo (js.Build).

const SIGNS = ['|', '/', '\\', '<', '>', '[', ']', '{', '}', '=', '+', '#', '·'];

const TICK_MS = 25;

const MIN_DECODE_DURATION_MS = 1500;
const MAX_DECODE_DURATION_MS = 2000;
const DECODE_DURATION_PER_LETTER_MS = 100;

function randomSign(): string {
  return SIGNS[Math.floor(Math.random() * SIGNS.length)];
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

function reducedMotionQuery(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function decodeDurationMs(letterCount: number): number {
  return Math.min(
    MAX_DECODE_DURATION_MS,
    Math.max(MIN_DECODE_DURATION_MS, letterCount * DECODE_DURATION_PER_LETTER_MS),
  );
}

function scramble(text: string, clearCount = 0): string {
  return Array.from(text)
    .map((character, index) => (index < clearCount || isWhitespace(character) ? character : randomSign()))
    .join('');
}

/* The final text stays in the box, invisible, so the box keeps its size while
   the visible text changes. */
function invisibleSizer(text: string): HTMLSpanElement {
  const sizer = document.createElement('span');
  sizer.setAttribute('aria-hidden', 'true');
  sizer.style.opacity = '0';
  sizer.textContent = text;
  return sizer;
}

/* Right after load, every letter of the text is replaced by a sign, then the
   text decodes left to right. The text stays available to assistive
   technologies through aria-label. */
class ScrambleText extends HTMLElement {
  connectedCallback(): void {
    const text = this.textContent ?? '';
    this.setAttribute('role', 'text');
    this.setAttribute('aria-label', text);
    this.decode(text);
  }

  private shown = document.createElement('span');

  private decode(text: string): void {
    const reducedMotion = reducedMotionQuery();
    if (reducedMotion.matches) return;
    this.replaceChildren(invisibleSizer(text), this.shown);
    this.shown.textContent = scramble(text);
    const delayMs = Number(this.getAttribute('delay')) || 0;
    this.startTimer = setTimeout(() => this.revealLeftToRight(text), delayMs);
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) this.showInClear(text);
    });
  }

  private startTimer: ReturnType<typeof setTimeout> | undefined;

  private tickTimer: ReturnType<typeof setInterval> | undefined;

  private showInClear(text: string): void {
    clearTimeout(this.startTimer);
    clearInterval(this.tickTimer);
    this.textContent = text;
  }

  private revealLeftToRight(text: string): void {
    const letterCount = Array.from(text).length;
    const durationMs = Number(this.getAttribute('duration')) || decodeDurationMs(letterCount);
    const totalTicks = durationMs / TICK_MS;
    let tick = 0;
    this.tickTimer = setInterval(() => {
      tick += 1;
      if (tick >= totalTicks) {
        this.showInClear(text);
        return;
      }
      this.shown.textContent = scramble(text, Math.floor((tick / totalTicks) * letterCount));
    }, TICK_MS);
  }
}

customElements.define('scramble-text', ScrambleText);

const FIELD_REVEAL_DELAY_MS = 50;

const FIELD_REVEAL_DURATION_MS = 1100;

const FIELD_TICK_SPACING_PX = 16;

const FIELD_TICK_WIDTH_PX = 1.6;

const FIELD_TICK_MIN_HEIGHT_PX = 5;

const FIELD_TICK_MAX_HEIGHT_PX = 13;

/* How much of a tick's height its column sets; its row sets the rest. */
const FIELD_TICK_HEIGHT_COLUMN_SHARE = 0.7;

const FIELD_ROW_SPACING_PX = 22;

const FIELD_MIN_SIDE_MARGIN_PX = 24;

const FIELD_MIN_VERTICAL_MARGIN_PX = 18;

const FIELD_MIN_ALPHA = 0.15;

/* How much dimmer the bottom of the field is than its top. */
const FIELD_BOTTOM_DIMMING = 0.75;

const FIELD_GREEN_UNTIL = 0.25;

const FIELD_CREAM_FROM = 0.9;

const FIELD_HOVER_RADIUS_PX = 60;

/* A lit tick grows this much at both ends. */
const FIELD_LIT_TICK_GROWTH_PX = 6;

const FIELD_TRAIL_FADE_MS = 1000;

const FIELD_RIPPLE_SPEED_PX_PER_MS = 0.28;

const FIELD_RIPPLE_DURATION_MS = 1600;

const FIELD_RIPPLE_RING_HALF_WIDTH_PX = 45;

/* The ring fades faster behind its middle than ahead of it. */
const FIELD_RIPPLE_INNER_FALLOFF_PX = 14;

const FIELD_RIPPLE_OUTER_FALLOFF_PX = 26;

/* Where the pointer passed, and since when it lingers there. */
type TrailPoint = { x: number; y: number; at: number };

/* How many columns and rows of ticks, and where the first one sits. */
type FieldLayout = { columns: number; rows: number; left: number; top: number };

/* How far along its line of the grid a column or row sits: 0 for the first, 1 for the last. */
function gridShare(index: number, count: number): number {
  return count > 1 ? index / (count - 1) : 0;
}

/* A decorative canvas covering the whole box, behind the content. */
class TickField extends HTMLElement {
  connectedCallback(): void {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    this.prepend(canvas);
    this.addEventListener('pointermove', (event) => {
      if (reducedMotionQuery().matches) return;
      const { x, y } = this.localPoint(event);
      this.hovering = true;
      this.trail.push({ x, y, at: performance.now() });
      this.fadeTrail(canvas);
    });
    this.addEventListener('pointerleave', () => {
      this.hovering = false;
      const last = this.trail[this.trail.length - 1];
      if (last) last.at = performance.now();
      this.fadeTrail(canvas);
    });
    /* A tap near the field can be redirected to it by the browser: only the raw press
       point tells whether it was inside. */
    document.addEventListener('pointerdown', (event) => {
      this.pressedInside = this.isInside(event);
    });
    this.addEventListener('click', (event) => {
      if (!this.pressedInside || reducedMotionQuery().matches) return;
      const { x, y } = this.localPoint(event);
      this.startRipple(canvas, x, y);
    });
    this.revealLeftToRight(canvas);
    new ResizeObserver(() => this.draw(canvas, this.progress)).observe(this);
  }

  private localPoint(event: MouseEvent): { x: number; y: number } {
    const box = this.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private isInside(event: MouseEvent): boolean {
    const { x, y } = this.localPoint(event);
    return x >= 0 && y >= 0 && x <= this.clientWidth && y <= this.clientHeight;
  }

  private pressedInside = false;

  private ripple: { x: number; y: number; start: number } | undefined;

  private startRipple(canvas: HTMLCanvasElement, x: number, y: number): void {
    this.ripple = { x, y, start: performance.now() };
    const step = (): void => {
      if (this.rippleAge() >= FIELD_RIPPLE_DURATION_MS) this.ripple = undefined;
      else requestAnimationFrame(step);
      this.draw(canvas, this.progress);
    };
    requestAnimationFrame(step);
  }

  private rippleAge(): number {
    return this.ripple ? performance.now() - this.ripple.start : 0;
  }

  /* A tick is lit when the ring passes over it. */
  private rippleLighting(x: number, y: number, tickHeight: number): number {
    if (!this.ripple) return 0;
    const age = this.rippleAge();
    const distance = this.distanceFromTick(x, y, tickHeight, this.ripple);
    const offset = distance - age * FIELD_RIPPLE_SPEED_PX_PER_MS;
    if (Math.abs(offset) > FIELD_RIPPLE_RING_HALF_WIDTH_PX) return 0;
    const spread = offset < 0 ? FIELD_RIPPLE_INNER_FALLOFF_PX : FIELD_RIPPLE_OUTER_FALLOFF_PX;
    const falloff = Math.exp(-((offset / spread) ** 2));
    return Math.max(0, 1 - age / FIELD_RIPPLE_DURATION_MS) * falloff;
  }

  private fadeTrail(canvas: HTMLCanvasElement): void {
    this.draw(canvas, this.progress);
    if (this.fading) return;
    this.fading = true;
    const step = (): void => {
      this.trail = this.trail.filter((point) => this.pointAlpha(point) > 0);
      this.draw(canvas, this.progress);
      if (this.hasFadingPoint()) requestAnimationFrame(step);
      else this.fading = false;
    };
    requestAnimationFrame(step);
  }

  private trail: TrailPoint[] = [];

  private hovering = false;

  private fading = false;

  /* The point under the pointer stays fully lit; the others fade with age. */
  private pointAlpha(point: TrailPoint): number {
    if (this.isUnderPointer(point)) return 1;
    return Math.max(0, 1 - (performance.now() - point.at) / FIELD_TRAIL_FADE_MS);
  }

  private isUnderPointer(point: TrailPoint): boolean {
    return this.hovering && point === this.trail[this.trail.length - 1];
  }

  private hasFadingPoint(): boolean {
    return this.trail.some((point) => !this.isUnderPointer(point));
  }

  private progress = 0;

  private onScreen = true;

  private revealing = false;

  private revealLeftToRight(canvas: HTMLCanvasElement): void {
    const start = performance.now();
    const step = (): void => {
      if (!this.onScreen) {
        this.revealing = false;
        return;
      }
      const elapsedMs = performance.now() - start - FIELD_REVEAL_DELAY_MS;
      this.progress = reducedMotionQuery().matches
        ? 1
        : Math.min(1, Math.max(0, elapsedMs / FIELD_REVEAL_DURATION_MS));
      this.draw(canvas, this.progress);
      if (this.progress < 1) requestAnimationFrame(step);
      else this.revealing = false;
    };
    const resume = (): void => {
      if (this.revealing || this.progress >= 1) return;
      this.revealing = true;
      requestAnimationFrame(step);
    };
    this.trackOnScreen(resume);
    resume();
  }

  private trackOnScreen(onBackOnScreen: () => void): void {
    new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      if (this.onScreen) onBackOnScreen();
    }).observe(this);
  }

  private draw(canvas: HTMLCanvasElement, progress: number): void {
    /* One canvas pixel per device pixel, so the strokes stay crisp. */
    const scale = window.devicePixelRatio || 1;
    const width = this.clientWidth;
    const height = this.clientHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(scale, scale);
    context.fillStyle = this.tickGradient(context, width, height);
    const front = progress * width;
    const layout = this.layout(width, height);
    for (let column = 0; column < layout.columns; column += 1) {
      const x = layout.left + column * FIELD_TICK_SPACING_PX;
      if (x >= front) break;
      context.globalAlpha = this.tickAlpha(x, width);
      this.drawTickColumn(context, x, gridShare(column, layout.columns), layout);
    }
  }

  /* The grid of ticks, centred in the box: as many columns and rows as leave the minimum margins. */
  private layout(width: number, height: number): FieldLayout {
    const columns = Math.max(
      1,
      Math.floor((width - 2 * FIELD_MIN_SIDE_MARGIN_PX - FIELD_TICK_WIDTH_PX) / FIELD_TICK_SPACING_PX) + 1,
    );
    const span = (columns - 1) * FIELD_TICK_SPACING_PX + FIELD_TICK_WIDTH_PX;
    /* On whole pixels, so the strokes stay crisp. */
    const left = Math.round((width - span) / 2);
    let rows = Math.max(1, Math.floor((height - 2 * FIELD_MIN_VERTICAL_MARGIN_PX) / FIELD_ROW_SPACING_PX) + 1);
    for (;; rows -= 1) {
      /* The tallest tick of the last row is the one in the last column. */
      const bottom = (rows - 1) * FIELD_ROW_SPACING_PX + this.tickHeight(1, 1);
      const top = Math.round((height - bottom) / 2);
      if (top >= FIELD_MIN_VERTICAL_MARGIN_PX || rows <= 1) return { columns, rows, left, top };
    }
  }

  private drawTickColumn(
    context: CanvasRenderingContext2D,
    x: number,
    columnShare: number,
    layout: FieldLayout,
  ): void {
    const columnAlpha = context.globalAlpha;
    for (let row = 0; row < layout.rows; row += 1) {
      const y = layout.top + row * FIELD_ROW_SPACING_PX;
      const tickHeight = this.tickHeight(columnShare, gridShare(row, layout.rows));
      context.globalAlpha = columnAlpha * this.rowAlphaFactor(y);
      context.fillRect(x, y, FIELD_TICK_WIDTH_PX, tickHeight);
      this.drawLighting(context, x, y, tickHeight);
    }
    context.globalAlpha = columnAlpha;
  }

  private drawLighting(context: CanvasRenderingContext2D, x: number, y: number, tickHeight: number): void {
    const tickColor = context.fillStyle;
    this.drawLitTick(context, x, y, tickHeight, this.hoverLighting(x, y, tickHeight), this.accentColor());
    this.drawLitTick(context, x, y, tickHeight, this.rippleLighting(x, y, tickHeight), this.accentColor());
    context.fillStyle = tickColor;
  }

  private drawLitTick(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    tickHeight: number,
    lighting: number,
    color: string,
  ): void {
    if (lighting <= 0) return;
    context.globalAlpha = lighting;
    context.fillStyle = color;
    const growth = Math.round(FIELD_LIT_TICK_GROWTH_PX * lighting);
    context.fillRect(x, y - growth, FIELD_TICK_WIDTH_PX, tickHeight + 2 * growth);
  }

  /* Brighter at the top, dimming down the whole height. */
  private rowAlphaFactor(y: number): number {
    return 1 - FIELD_BOTTOM_DIMMING * Math.min(1, y / this.clientHeight);
  }

  /* Taller from left to right, and taller at the top. */
  private tickHeight(columnShare: number, rowShare: number): number {
    const growth = FIELD_TICK_HEIGHT_COLUMN_SHARE * columnShare + (1 - FIELD_TICK_HEIGHT_COLUMN_SHARE) * (1 - rowShare);
    return Math.round(FIELD_TICK_MIN_HEIGHT_PX + (FIELD_TICK_MAX_HEIGHT_PX - FIELD_TICK_MIN_HEIGHT_PX) * growth);
  }

  /* A tick is lit near where the pointer passed. */
  private hoverLighting(x: number, y: number, tickHeight: number): number {
    let lighting = 0;
    for (const point of this.trail) {
      const distance = this.distanceFromTick(x, y, tickHeight, point);
      if (distance >= FIELD_HOVER_RADIUS_PX) continue;
      lighting = Math.max(lighting, this.pointAlpha(point) * (1 - distance / FIELD_HOVER_RADIUS_PX));
    }
    return lighting;
  }

  /* Measured from the tick's centre. */
  private distanceFromTick(x: number, y: number, tickHeight: number, point: { x: number; y: number }): number {
    return Math.hypot(x + FIELD_TICK_WIDTH_PX / 2 - point.x, y + tickHeight / 2 - point.y);
  }

  /* Along the diagonal: green at the bottom left, accent in the middle, cream at the top right. */
  private tickGradient(context: CanvasRenderingContext2D, width: number, height: number): CanvasGradient {
    const gradient = context.createLinearGradient(0, height, width, 0);
    gradient.addColorStop(FIELD_GREEN_UNTIL, this.themeColor('--color-accent-dark'));
    gradient.addColorStop(0.5, this.accentColor());
    gradient.addColorStop(0.75, this.accentColor());
    gradient.addColorStop(FIELD_CREAM_FROM, this.themeColor('--color-paper'));
    return gradient;
  }

  private accentColor(): string {
    return this.themeColor('--color-accent');
  }

  private themeColor(customProperty: string): string {
    return getComputedStyle(this).getPropertyValue(customProperty).trim();
  }

  /* Brighter from left to right. */
  private tickAlpha(x: number, width: number): number {
    return FIELD_MIN_ALPHA + (1 - FIELD_MIN_ALPHA) * (x / width);
  }
}

customElements.define('tick-field', TickField);
