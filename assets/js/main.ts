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

const FIELD_TICK_WIDTH_PX = 1;

const FIELD_TICK_MIN_HEIGHT_PX = 4;

const FIELD_TICK_MAX_HEIGHT_PX = 10;

const FIELD_ROW_SPACING_PX = 22;

const FIELD_MIN_ALPHA = 0.15;

const FIELD_TOP_FADE_PX = 96;

const FIELD_TOP_FADE_DIMMING = 0.35;

const FIELD_GREEN_UNTIL = 0.25;

const FIELD_CREAM_FROM = 0.9;

const FIELD_HOVER_RADIUS_PX = 60;

const FIELD_HOVER_TICK_WIDTH_PX = 2;

const FIELD_TRAIL_FADE_MS = 1000;

const FIELD_RIPPLE_SPEED_PX_PER_MS = 0.28;

const FIELD_RIPPLE_DURATION_MS = 1800;

const FIELD_RIPPLE_RING_HALF_WIDTH_PX = 20;

const FIELD_RIPPLE_TICK_WIDTH_PX = 12;

/* Where the pointer passed, and since when it lingers there. */
type TrailPoint = { x: number; y: number; at: number };

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
    const distance = Math.hypot(x + FIELD_TICK_WIDTH_PX / 2 - this.ripple.x, y + tickHeight / 2 - this.ripple.y);
    if (Math.abs(distance - age * FIELD_RIPPLE_SPEED_PX_PER_MS) > FIELD_RIPPLE_RING_HALF_WIDTH_PX) return 0;
    return Math.max(0, 1 - age / FIELD_RIPPLE_DURATION_MS);
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
    canvas.width = this.clientWidth;
    canvas.height = this.clientHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = this.tickGradient(context, canvas.width);
    const front = progress * canvas.width;
    for (let x = 0; x < front; x += FIELD_TICK_SPACING_PX) {
      context.globalAlpha = this.tickAlpha(x, canvas.width);
      this.drawTickColumn(context, x, canvas.height, this.tickHeight(x, canvas.width));
      this.drawPointerTrail(context, x);
    }
  }

  private drawTickColumn(context: CanvasRenderingContext2D, x: number, height: number, tickHeight: number): void {
    const columnAlpha = context.globalAlpha;
    for (let y = 0; y < height; y += FIELD_ROW_SPACING_PX) {
      context.globalAlpha = columnAlpha * this.rowAlphaFactor(y);
      context.fillRect(x, y, FIELD_TICK_WIDTH_PX, tickHeight);
      this.drawRippleOnTick(context, x, y, tickHeight);
    }
    context.globalAlpha = columnAlpha;
  }

  private drawRippleOnTick(context: CanvasRenderingContext2D, x: number, y: number, tickHeight: number): void {
    const lighting = this.rippleLighting(x, y, tickHeight);
    if (lighting <= 0) return;
    const tickColor = context.fillStyle;
    context.globalAlpha = lighting;
    context.fillStyle = this.accentColor();
    context.fillRect(x, y, FIELD_RIPPLE_TICK_WIDTH_PX, tickHeight);
    context.fillStyle = tickColor;
  }

  /* Brighter at the top. */
  private rowAlphaFactor(y: number): number {
    return 1 - FIELD_TOP_FADE_DIMMING * Math.min(1, y / FIELD_TOP_FADE_PX);
  }

  /* Taller from left to right. */
  private tickHeight(x: number, width: number): number {
    return Math.round(FIELD_TICK_MIN_HEIGHT_PX + (FIELD_TICK_MAX_HEIGHT_PX - FIELD_TICK_MIN_HEIGHT_PX) * (x / width));
  }

  private drawPointerTrail(context: CanvasRenderingContext2D, x: number): void {
    const tickColor = context.fillStyle;
    for (const point of this.trail) {
      const distanceFromPointer = Math.abs(x - point.x);
      if (distanceFromPointer >= FIELD_HOVER_RADIUS_PX) continue;
      context.globalAlpha = this.pointAlpha(point);
      context.fillStyle = this.accentColor();
      const halfHeight = Math.sqrt(FIELD_HOVER_RADIUS_PX ** 2 - distanceFromPointer ** 2);
      context.fillRect(x, point.y - halfHeight, FIELD_HOVER_TICK_WIDTH_PX, 2 * halfHeight);
    }
    context.fillStyle = tickColor;
  }

  /* Green on the left, cream from the right. */
  private tickGradient(context: CanvasRenderingContext2D, width: number): CanvasGradient {
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(FIELD_GREEN_UNTIL, this.themeColor('--color-accent-dark'));
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
