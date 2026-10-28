import { reducedMotionQuery } from './reduced-motion';

const FIELD_REVEAL_DELAY_MS = 50;

const FIELD_REVEAL_DURATION_MS = 1100;

/* How long a tick takes to fade in once the reveal front has passed it. */
const FIELD_TICK_FADE_IN_MS = 350;

/* The progress at which the front has crossed the width and the last tick has faded in. */
const FIELD_REVEALED_PROGRESS = 1 + FIELD_TICK_FADE_IN_MS / FIELD_REVEAL_DURATION_MS;

const FIELD_TICK_SPACING_PX = 16;

const FIELD_TICK_WIDTH_PX = 1.6;

const FIELD_TICK_MIN_HEIGHT_PX = 5;

const FIELD_TICK_MAX_HEIGHT_PX = 13;

/* How much of a tick's height its column sets; its row sets the rest. */
const FIELD_TICK_HEIGHT_COLUMN_SHARE = 0.7;

const FIELD_ROW_SPACING_PX = 22;

const FIELD_RESTING_MIN_ALPHA = 0.06;

const FIELD_RESTING_MAX_ALPHA = 0.61;

/* How much of a tick's place along the diagonal its horizontal place sets; the vertical one sets the rest. */
const FIELD_PLACE_HORIZONTAL_SHARE = 0.75;

const FIELD_GREEN_UNTIL = 0.25;

const FIELD_ACCENT_FROM = 0.5;

const FIELD_ACCENT_UNTIL = 0.75;

const FIELD_CREAM_FROM = 0.9;

const FIELD_HOVER_RADIUS_PX = 60;

/* A lit tick grows this much in all, half at each end. */
const FIELD_LIT_TICK_GROWTH_PX = 6;

const FIELD_TRAIL_FADE_MS = 1000;

/* How fast a lit tick's light rises with its lighting: its slope at no lighting, easing into fully opaque. */
const FIELD_LIT_CURVE_EXPONENT = 2;

const FIELD_RIPPLE_SPEED_PX_PER_MS = 0.28;

const FIELD_RIPPLE_DURATION_MS = 1600;

/* The ring fades faster behind its middle than ahead of it. */
const FIELD_RIPPLE_INNER_FALLOFF_PX = 20;

const FIELD_RIPPLE_OUTER_FALLOFF_PX = 34;

/* Beyond this many falloffs from its middle, on either side, a ring lights nothing. */
const FIELD_RIPPLE_CUTOFF_FALLOFFS = 3;

/* In CSS pixels, from the element's top-left corner. */
type Point = { x: number; y: number };

/* Where the pointer passed, and since when it lingers there. */
type TrailPoint = Point & { at: number };

/* A trail point as one drawing sees it: its alpha read once, at the drawing's time. */
type LitPoint = Point & { alpha: number };

/* Where a click started a ring, and when. */
type Ripple = Point & { start: number };

/* A ripple as one drawing sees it: its age read once, at the drawing's time. */
type AgedRipple = Point & { age: number };

/* How many columns and rows of ticks, and where the first one sits. */
type FieldLayout = { columns: number; rows: number; left: number; top: number };

/* What the stylesheet sets for a field, through its --tick-field-* custom properties: its least margins,
   in CSS pixels, and its diagonal's direction. */
type FieldVariant = { minSideMargin: number; minVerticalMargin: number; isDiagonalDescending: boolean };

/* Where a linear gradient starts and ends, in CSS pixels. */
type GradientLine = [x0: number, y0: number, x1: number, y1: number];

/* The theme's colours the field paints with. */
type FieldColors = { green: string; accent: string; cream: string };

/* What every tick of one drawing of the field shares; the width and height are the box's, in CSS pixels. */
type FieldDrawing = {
  context: CanvasRenderingContext2D;
  variant: FieldVariant;
  layout: FieldLayout;
  width: number;
  height: number;
  litColor: string;
  litTrail: LitPoint[];
  agedRipples: AgedRipple[];
  /* Without a trail point or a ripple, no tick is lit: an idle field draws only its base ticks. */
  hasLighting: boolean;
};

/* How far along its line of the grid a column or row sits: 0 for the first, 1 for the last. */
function gridShare(index: number, count: number): number {
  return count > 1 ? index / (count - 1) : 0;
}

/* How strongly a tick shows its lighting: rises fast from none, then eases into full. The reveal's
   fade scales it after that curve, as it scales the tick's resting alpha. */
function litStrength(lighting: number, fadeIn: number): number {
  return fadeIn * (1 - (1 - lighting) ** FIELD_LIT_CURVE_EXPONENT);
}

/* From 0 as the reveal front reaches a tick, widthShare of the way across, to 1 once it has faded in. */
function fadeInAlpha(widthShare: number, progress: number): number {
  const sinceFrontPassedMs = (progress - widthShare) * FIELD_REVEAL_DURATION_MS;
  return Math.min(1, sinceFrontPassedMs / FIELD_TICK_FADE_IN_MS);
}

/* Slow at both ends, from 0 to 1 (smoothstep); a share outside 0–1 is clamped first. */
function easeInOut(share: number): number {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

function customProperty(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

/* A custom property the stylesheet sets in px. A missing or unreadable one counts as 0: NaN would keep
   the layout's search for the number of rows from ever ending. */
function customPropertyPx(style: CSSStyleDeclaration, name: string): number {
  return Number.parseFloat(customProperty(style, name)) || 0;
}

/* A decorative canvas covering the whole box, behind the content. */
class TickField extends HTMLElement {
  private canvas = document.createElement('canvas');

  /* How far the reveal front has crossed the width, up to FIELD_REVEALED_PROGRESS. */
  private progress = 0;

  private revealStart = 0;

  private onScreen = true;

  /* A frame is already requested: its drawing will show every change made until then. */
  private hasPendingFrame = false;

  private trail: TrailPoint[] = [];

  private hovering = false;

  private pressedInside = false;

  private ripples: Ripple[] = [];

  private gradient: CanvasGradient | undefined;

  /* The line and colours the gradient was made for. */
  private gradientKey = '';

  connectedCallback(): void {
    this.canvas.setAttribute('aria-hidden', 'true');
    this.prepend(this.canvas);
    this.addEventListener('pointermove', (event) => {
      if (reducedMotionQuery().matches) return;
      const { x, y } = this.localPoint(event);
      this.hovering = true;
      this.leaveLastPoint();
      this.trail.push({ x, y, at: performance.now() });
      this.requestDraw();
    });
    this.addEventListener('pointerleave', () => {
      this.hovering = false;
      this.leaveLastPoint();
      this.requestDraw();
    });
    /* A tap near the field can be redirected to it by the browser: only the raw press
       point tells whether it was inside. */
    document.addEventListener('pointerdown', (event) => {
      this.pressedInside = this.isInside(event);
    });
    this.addEventListener('click', (event) => {
      /* A click made by the keyboard or by script has no press of its own (detail 0). */
      if (event.detail === 0 || !this.pressedInside || reducedMotionQuery().matches) return;
      this.ripples.push({ ...this.localPoint(event), start: performance.now() });
      this.requestDraw();
    });
    this.revealStart = performance.now();
    this.trackOnScreen();
    this.requestDraw();
    new ResizeObserver(() => this.draw()).observe(this);
    this.watchPixelDensity();
  }

  /* The window moving to a screen of another pixel density changes no size: redraw when the density
     the field was drawn at stops matching, then watch the new one. */
  private watchPixelDensity(): void {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        this.draw();
        this.watchPixelDensity();
      },
      { once: true },
    );
  }

  private localPoint(event: MouseEvent): Point {
    const box = this.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private isInside(event: MouseEvent): boolean {
    const { x, y } = this.localPoint(event);
    return x >= 0 && y >= 0 && x <= this.clientWidth && y <= this.clientHeight;
  }

  /* One drawing per frame, however many changes ask for it. */
  private requestDraw(): void {
    if (this.hasPendingFrame) return;
    this.hasPendingFrame = true;
    requestAnimationFrame(() => {
      this.hasPendingFrame = false;
      this.drawFrame();
    });
  }

  private drawFrame(): void {
    this.advanceAnimations();
    this.draw();
    if (this.isAnimating()) this.requestDraw();
  }

  /* Brings each animation to the current time. The reveal's progress follows real time from
     revealStart: no frame is requested for it while off screen, so it catches up once back. */
  private advanceAnimations(): void {
    if (this.isRevealing()) this.advanceReveal();
    /* Reduced motion turned on while the trail fades or a ripple spreads: both end at once. */
    if (reducedMotionQuery().matches) {
      this.trail = [];
      this.ripples = [];
      return;
    }
    const now = performance.now();
    this.trail = this.trail.filter((point) => this.pointAlpha(point, now) > 0);
    this.ripples = this.ripples.filter((ripple) => now - ripple.start < FIELD_RIPPLE_DURATION_MS);
  }

  /* No frame while off screen, unless the trail or a ripple is still fading. */
  private isAnimating(): boolean {
    return this.isRevealing() || this.hasFadingPoint() || this.ripples.length > 0;
  }

  private isRevealing(): boolean {
    return this.onScreen && this.progress < FIELD_REVEALED_PROGRESS;
  }

  private advanceReveal(): void {
    const elapsedMs = performance.now() - this.revealStart - FIELD_REVEAL_DELAY_MS;
    this.progress = reducedMotionQuery().matches
      ? FIELD_REVEALED_PROGRESS
      : Math.min(FIELD_REVEALED_PROGRESS, Math.max(0, elapsedMs / FIELD_REVEAL_DURATION_MS));
  }

  private trackOnScreen(): void {
    new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      if (this.isRevealing()) this.requestDraw();
    }).observe(this);
  }

  /* Read once per drawing, not once per tick. */
  private agedRipples(): AgedRipple[] {
    const now = performance.now();
    return this.ripples.map((ripple) => ({ x: ripple.x, y: ripple.y, age: now - ripple.start }));
  }

  /* A tick is lit when a ring passes over it; rings add up, but no further than full lighting. */
  private rippleLighting(agedRipples: AgedRipple[], x: number, y: number, tickHeight: number): number {
    const sum = agedRipples.reduce((total, ripple) => total + this.singleRippleLighting(ripple, x, y, tickHeight), 0);
    return Math.min(1, sum);
  }

  private singleRippleLighting(ripple: AgedRipple, x: number, y: number, tickHeight: number): number {
    const { age } = ripple;
    const distance = this.distanceFromTick(x, y, tickHeight, ripple);
    const offset = distance - age * FIELD_RIPPLE_SPEED_PX_PER_MS;
    const spread = offset < 0 ? FIELD_RIPPLE_INNER_FALLOFF_PX : FIELD_RIPPLE_OUTER_FALLOFF_PX;
    if (Math.abs(offset) > FIELD_RIPPLE_CUTOFF_FALLOFFS * spread) return 0;
    const falloff = Math.exp(-((offset / spread) ** 2));
    return Math.max(0, 1 - age / FIELD_RIPPLE_DURATION_MS) * falloff;
  }

  /* The point the pointer leaves starts fading from now, however long it rested there. */
  private leaveLastPoint(): void {
    const last = this.trail[this.trail.length - 1];
    if (last) last.at = performance.now();
  }

  /* The point under the pointer stays fully lit; the others fade with age. */
  private pointAlpha(point: TrailPoint, now: number): number {
    if (this.isUnderPointer(point)) return 1;
    return Math.max(0, 1 - (now - point.at) / FIELD_TRAIL_FADE_MS);
  }

  /* Read once per drawing, not once per tick: a point that no longer lights anything is left out. */
  private litTrail(): LitPoint[] {
    const now = performance.now();
    return this.trail
      .map((point) => ({ x: point.x, y: point.y, alpha: this.pointAlpha(point, now) }))
      .filter((point) => point.alpha > 0);
  }

  private isUnderPointer(point: TrailPoint): boolean {
    return this.hovering && point === this.trail[this.trail.length - 1];
  }

  private hasFadingPoint(): boolean {
    return this.trail.some((point) => !this.isUnderPointer(point));
  }

  private draw(): void {
    /* One canvas pixel per device pixel, so the strokes stay crisp. */
    const scale = window.devicePixelRatio || 1;
    const width = this.clientWidth;
    const height = this.clientHeight;
    this.resizeCanvas(Math.round(width * scale), Math.round(height * scale));
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.resetTransform();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    /* Read once per drawing: the computed style is costly. */
    const style = getComputedStyle(this);
    const colors = this.themeColors(style);
    const variant = this.fieldVariant(style);
    const litTrail = this.litTrail();
    const agedRipples = this.agedRipples();
    const drawing = {
      context,
      variant,
      layout: this.layout(width, height, variant),
      width,
      height,
      litColor: colors.accent,
      litTrail,
      agedRipples,
      hasLighting: litTrail.length > 0 || agedRipples.length > 0,
    };
    context.fillStyle = this.tickGradient(drawing, colors);
    const front = this.progress * width;
    for (let column = 0; column < drawing.layout.columns; column += 1) {
      const x = drawing.layout.left + column * FIELD_TICK_SPACING_PX;
      if (x >= front) break;
      this.drawTickColumn(drawing, x, gridShare(column, drawing.layout.columns), fadeInAlpha(x / width, this.progress));
    }
  }

  /* Setting a canvas's size reallocates its pixels, even to the same size: only when it changes. */
  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  /* The grid of ticks, centred in the box: as many columns and rows as leave the minimum margins. */
  private layout(width: number, height: number, variant: FieldVariant): FieldLayout {
    const sideMargin = variant.minSideMargin;
    const columns = Math.max(
      1,
      Math.floor((width - 2 * sideMargin - FIELD_TICK_WIDTH_PX) / FIELD_TICK_SPACING_PX) + 1,
    );
    const span = (columns - 1) * FIELD_TICK_SPACING_PX + FIELD_TICK_WIDTH_PX;
    /* On whole pixels, so the strokes stay crisp. */
    const left = Math.round((width - span) / 2);
    const verticalMargin = variant.minVerticalMargin;
    let rows = Math.max(1, Math.floor((height - 2 * verticalMargin) / FIELD_ROW_SPACING_PX) + 1);
    for (;; rows -= 1) {
      /* The tallest tick of the last row is the one in the last column. */
      const bottom = (rows - 1) * FIELD_ROW_SPACING_PX + this.tickHeight(1, 1);
      const top = Math.round((height - bottom) / 2);
      if (top >= verticalMargin || rows <= 1) return { columns, rows, left, top };
    }
  }

  /* The stylesheet sets them, and can change them at a breakpoint: on a phone, the hero's field gives
     more of the narrow width to ticks, and its diagonal runs down to the bottom right. */
  private fieldVariant(style: CSSStyleDeclaration): FieldVariant {
    return {
      minSideMargin: customPropertyPx(style, '--tick-field-min-side-margin'),
      minVerticalMargin: customPropertyPx(style, '--tick-field-min-vertical-margin'),
      isDiagonalDescending: customProperty(style, '--tick-field-diagonal') === 'descending',
    };
  }

  private drawTickColumn(drawing: FieldDrawing, x: number, columnShare: number, fadeIn: number): void {
    const { context, layout } = drawing;
    for (let row = 0; row < layout.rows; row += 1) {
      const y = layout.top + row * FIELD_ROW_SPACING_PX;
      const tickHeight = this.tickHeight(columnShare, gridShare(row, layout.rows));
      context.globalAlpha = fadeIn * this.restingAlpha(drawing, x, y);
      context.fillRect(x, y, FIELD_TICK_WIDTH_PX, tickHeight);
      if (drawing.hasLighting) this.drawLighting(drawing, x, y, tickHeight, fadeIn);
    }
  }

  /* The pointer or a ring lights a tick only as far as the reveal has faded it in. */
  private drawLighting(drawing: FieldDrawing, x: number, y: number, tickHeight: number, fadeIn: number): void {
    const tickColor = drawing.context.fillStyle;
    const hover = litStrength(this.hoverLighting(drawing.litTrail, x, y, tickHeight), fadeIn);
    const ripple = litStrength(this.rippleLighting(drawing.agedRipples, x, y, tickHeight), fadeIn);
    this.drawGrownEnds(drawing, x, y, tickHeight, Math.max(hover, ripple));
    this.drawLitTick(drawing, x, y, tickHeight, hover);
    this.drawLitTick(drawing, x, y, tickHeight, ripple);
    drawing.context.fillStyle = tickColor;
  }

  /* The grown ends take the tick's own colour first, so the light over them reads as over the middle. */
  private drawGrownEnds(drawing: FieldDrawing, x: number, y: number, tickHeight: number, strength: number): void {
    const growthAtEachEnd = this.growthAtEachEnd(strength);
    if (growthAtEachEnd <= 0) return;
    drawing.context.fillRect(x, y - growthAtEachEnd, FIELD_TICK_WIDTH_PX, growthAtEachEnd);
    drawing.context.fillRect(x, y + tickHeight, FIELD_TICK_WIDTH_PX, growthAtEachEnd);
  }

  private growthAtEachEnd(strength: number): number {
    return Math.round((FIELD_LIT_TICK_GROWTH_PX / 2) * strength);
  }

  private drawLitTick(drawing: FieldDrawing, x: number, y: number, tickHeight: number, strength: number): void {
    if (strength <= 0) return;
    const { context } = drawing;
    context.globalAlpha = strength;
    context.fillStyle = drawing.litColor;
    const growthAtEachEnd = this.growthAtEachEnd(strength);
    context.fillRect(x, y - growthAtEachEnd, FIELD_TICK_WIDTH_PX, tickHeight + 2 * growthAtEachEnd);
  }

  /* Set by the tick's place along the diagonal: brighter to the right, and towards its bright edge. */
  private restingAlpha(drawing: FieldDrawing, x: number, y: number): number {
    const horizontal = FIELD_PLACE_HORIZONTAL_SHARE * (x / drawing.width);
    const vertical = (1 - FIELD_PLACE_HORIZONTAL_SHARE) * this.verticalPlace(drawing, y);
    return (
      FIELD_RESTING_MIN_ALPHA + (FIELD_RESTING_MAX_ALPHA - FIELD_RESTING_MIN_ALPHA) * easeInOut(horizontal + vertical)
    );
  }

  /* From 0 at the faint edge to 1 at the bright one, the edge the diagonal ends on. */
  private verticalPlace(drawing: FieldDrawing, y: number): number {
    const downShare = y / drawing.height;
    return drawing.variant.isDiagonalDescending ? downShare : 1 - downShare;
  }

  /* Taller from left to right, and taller at the top. */
  private tickHeight(columnShare: number, rowShare: number): number {
    const growth = FIELD_TICK_HEIGHT_COLUMN_SHARE * columnShare + (1 - FIELD_TICK_HEIGHT_COLUMN_SHARE) * (1 - rowShare);
    return Math.round(FIELD_TICK_MIN_HEIGHT_PX + (FIELD_TICK_MAX_HEIGHT_PX - FIELD_TICK_MIN_HEIGHT_PX) * growth);
  }

  /* A tick is lit near where the pointer passed. */
  private hoverLighting(litTrail: LitPoint[], x: number, y: number, tickHeight: number): number {
    const centre = this.tickCentre(x, y, tickHeight);
    let lighting = 0;
    for (const point of litTrail) {
      const dx = centre.x - point.x;
      const dy = centre.y - point.y;
      /* Outside the square around the radius, the point is out of reach: no need for the costlier distance. */
      if (Math.abs(dx) >= FIELD_HOVER_RADIUS_PX || Math.abs(dy) >= FIELD_HOVER_RADIUS_PX) continue;
      const distance = Math.hypot(dx, dy);
      if (distance >= FIELD_HOVER_RADIUS_PX) continue;
      lighting = Math.max(lighting, point.alpha * (1 - distance / FIELD_HOVER_RADIUS_PX));
    }
    return lighting;
  }

  /* Measured from the tick's centre. */
  private distanceFromTick(x: number, y: number, tickHeight: number, point: Point): number {
    const centre = this.tickCentre(x, y, tickHeight);
    return Math.hypot(centre.x - point.x, centre.y - point.y);
  }

  private tickCentre(x: number, y: number, tickHeight: number): Point {
    return { x: x + FIELD_TICK_WIDTH_PX / 2, y: y + tickHeight / 2 };
  }

  /* Made again only when its line or the theme colours change: the key holds every input of createTickGradient. */
  private tickGradient(drawing: FieldDrawing, colors: FieldColors): CanvasGradient {
    const line = this.gradientLine(drawing);
    const key = [...line, colors.green, colors.accent, colors.cream].join(' ');
    if (!this.gradient || key !== this.gradientKey) {
      this.gradient = this.createTickGradient(drawing.context, line, colors);
      this.gradientKey = key;
    }
    return this.gradient;
  }

  /* The field's diagonal, from its green, faint corner to its cream, bright one. */
  private gradientLine(drawing: FieldDrawing): GradientLine {
    const { width, height } = drawing;
    return drawing.variant.isDiagonalDescending ? [0, 0, width, height] : [0, height, width, 0];
  }

  /* Along the line: green at its start, accent in the middle, cream at its end. */
  private createTickGradient(
    context: CanvasRenderingContext2D,
    line: GradientLine,
    colors: FieldColors,
  ): CanvasGradient {
    const gradient = context.createLinearGradient(...line);
    gradient.addColorStop(FIELD_GREEN_UNTIL, colors.green);
    gradient.addColorStop(FIELD_ACCENT_FROM, colors.accent);
    gradient.addColorStop(FIELD_ACCENT_UNTIL, colors.accent);
    gradient.addColorStop(FIELD_CREAM_FROM, colors.cream);
    return gradient;
  }

  private themeColors(style: CSSStyleDeclaration): FieldColors {
    const color = (name: string): string => customProperty(style, name);
    return { green: color('--color-accent-dark'), accent: color('--color-accent'), cream: color('--color-paper') };
  }
}

customElements.define('tick-field', TickField);
