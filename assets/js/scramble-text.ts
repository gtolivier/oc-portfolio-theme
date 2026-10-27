import { reducedMotionQuery } from './reduced-motion';

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
  private shown = document.createElement('span');

  private tickTimer: ReturnType<typeof setInterval> | undefined;

  connectedCallback(): void {
    const text = this.textContent ?? '';
    this.setAttribute('role', 'text');
    this.setAttribute('aria-label', text);
    this.decode(text);
  }

  private decode(text: string): void {
    const reducedMotion = reducedMotionQuery();
    if (reducedMotion.matches) return;
    this.shown.setAttribute('aria-hidden', 'true');
    this.replaceChildren(invisibleSizer(text), this.shown);
    this.shown.textContent = scramble(text);
    this.revealLeftToRight(text);
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) this.showInClear(text);
    });
  }

  private showInClear(text: string): void {
    clearInterval(this.tickTimer);
    this.textContent = text;
  }

  private revealLeftToRight(text: string): void {
    const letterCount = Array.from(text).length;
    const durationMs = Number(this.getAttribute('duration')) || decodeDurationMs(letterCount);
    const startedAt = performance.now();
    this.tickTimer = setInterval(() => {
      const elapsedMs = performance.now() - startedAt;
      if (elapsedMs >= durationMs) {
        this.showInClear(text);
        return;
      }
      this.shown.textContent = scramble(text, Math.floor((elapsedMs / durationMs) * letterCount));
    }, TICK_MS);
  }
}

customElements.define('scramble-text', ScrambleText);
