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

function decodeDurationMs(letterCount: number): number {
  return Math.max(MIN_DURATION_MS, letterCount * DURATION_PER_LETTER_MS);
}

function scramble(text: string, clearCount = 0): string {
  return Array.from(text)
    .map((character, index) => (index < clearCount || isWhitespace(character) ? character : randomSign()))
    .join('');
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

  private decode(text: string): void {
    this.textContent = scramble(text);
    const delayMs = Number(this.getAttribute('delay')) || 0;
    setTimeout(() => this.revealLeftToRight(text), delayMs);
  }

  private revealLeftToRight(text: string): void {
    const letterCount = Array.from(text).length;
    const totalTicks = decodeDurationMs(letterCount) / TICK_MS;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      if (tick >= totalTicks) {
        clearInterval(timer);
        this.textContent = text;
        return;
      }
      this.textContent = scramble(text, Math.floor((tick / totalTicks) * letterCount));
    }, TICK_MS);
  }
}

customElements.define('scramble-text', ScrambleText);
