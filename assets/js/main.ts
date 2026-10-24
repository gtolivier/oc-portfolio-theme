// The theme's TypeScript entry point, compiled by Hugo (js.Build).

const SIGNS = ['|', '/', '\\', '<', '>', '[', ']', '{', '}', '=', '+', '#', '·'];

/* Right after load, every letter of the text is replaced by a sign. The text
   stays available to assistive technologies through aria-label. */
class ScrambleText extends HTMLElement {
  connectedCallback(): void {
    const text = this.textContent ?? '';
    this.setAttribute('role', 'text');
    this.setAttribute('aria-label', text);
    this.textContent = Array.from(text)
      .map((character) =>
        /\s/.test(character) ? character : SIGNS[Math.floor(Math.random() * SIGNS.length)],
      )
      .join('');
  }
}

customElements.define('scramble-text', ScrambleText);
