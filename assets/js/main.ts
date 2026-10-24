// The theme's TypeScript entry point, compiled by Hugo (js.Build).

const SIGNS = ['|', '/', '\\', '<', '>', '[', ']', '{', '}', '=', '+', '#', '·'];

const MIN_DURATION_MS = 1500;

const DURATION_PER_LETTER_MS = 100;

const TICK_MS = 25;

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
  return Math.max(MIN_DURATION_MS, letterCount * DURATION_PER_LETTER_MS);
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
  sizer.style.visibility = 'hidden';
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
    this.replaceChildren(invisibleSizer(text), this.shown);
    const reducedMotion = reducedMotionQuery();
    if (reducedMotion.matches) {
      this.shown.textContent = text;
      return;
    }
    this.shown.textContent = scramble(text);
    const delayMs = Number(this.getAttribute('delay')) || 0;
    this.startTimer = setTimeout(() => this.revealLeftToRight(text), delayMs);
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) this.showInClearAtOnce(text);
    });
  }

  private startTimer: ReturnType<typeof setTimeout> | undefined;

  private tickTimer: ReturnType<typeof setInterval> | undefined;

  private showInClearAtOnce(text: string): void {
    clearTimeout(this.startTimer);
    clearInterval(this.tickTimer);
    this.shown.textContent = text;
  }

  private revealLeftToRight(text: string): void {
    const letterCount = Array.from(text).length;
    const totalTicks = decodeDurationMs(letterCount) / TICK_MS;
    let tick = 0;
    this.tickTimer = setInterval(() => {
      tick += 1;
      if (tick >= totalTicks) {
        clearInterval(this.tickTimer);
        this.shown.textContent = text;
        return;
      }
      this.shown.textContent = scramble(text, Math.floor((tick / totalTicks) * letterCount));
    }, TICK_MS);
  }
}

customElements.define('scramble-text', ScrambleText);
