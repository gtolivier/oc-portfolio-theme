// The theme's TypeScript entry point, compiled by Hugo (js.Build).

const SIGNS = ['|', '/', '\\', '<', '>', '[', ']', '{', '}', '=', '+', '#', '·'];

function randomSign(): string {
  return SIGNS[Math.floor(Math.random() * SIGNS.length)];
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

function scramble(text: string): string {
  return Array.from(text)
    .map((character) => (isWhitespace(character) ? character : randomSign()))
    .join('');
}

/* Right after load, every letter of the text is replaced by a sign. The text
   stays available to assistive technologies through aria-label. */
class ScrambleText extends HTMLElement {
  connectedCallback(): void {
    const text = this.textContent ?? '';
    this.setAttribute('role', 'text');
    this.setAttribute('aria-label', text);
    this.textContent = scramble(text);
  }
}

customElements.define('scramble-text', ScrambleText);
