import { type Locator } from '@playwright/test';

/* The signs a scrambled letter can be replaced with. */
export const SIGNS = '|/\\<>[]{}=+#·';

/* Text an element shows on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements that show (without the alternative text
   of a `content: "…" / "…"`, with the values its counters take), whitespace excluded. Text that
   only assistive technologies get is left out: under an element that is not displayed,
   invisible, fully transparent, clipped, or reduced to a box of at most 1px with its overflow
   hidden. Independent of the chosen markup. */
export async function textOnScreen(element: Locator): Promise<string> {
  return (await renderedText(element, true)).replace(/ /g, '');
}

/* The text of textOnScreen (onScreenOnly) or displayedText, with its spaces kept: every run of
   whitespace becomes a single space, as the browser renders it, and leading and trailing
   whitespace is dropped. */
async function renderedText(element: Locator, onScreenOnly: boolean): Promise<string> {
  const pieces = await renderedPieces(element, { onScreenOnly, painted: false });
  return pieces
    .map(({ text }) => text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

type Pseudo = '::before' | '::after';

/* A piece of the text an element displays: a text node, as written, or the generated content of
   a ::before or ::after (pseudo). */
type Piece = { text: string; pseudo: Pseudo | null };

/* A piece of displayedText with how it is painted: its text color, the background colors behind
   it, nearest first (for a pseudo-element, its own, then those of the element that holds it and
   its ancestors; for a text node, those of its element and its ancestors), its font size in px
   and its font weight. */
type DisplayedPiece = Piece & { color: string; backgrounds: string[]; fontSize: number; fontWeight: number };

/* The pieces of the text of textOnScreen (onScreenOnly) or displayedText, in rendering order,
   with how each is painted when asked (painted). */
async function renderedPieces(
  element: Locator,
  options: { onScreenOnly: boolean; painted: true },
): Promise<DisplayedPiece[]>;
async function renderedPieces(element: Locator, options: { onScreenOnly: boolean; painted: false }): Promise<Piece[]>;
async function renderedPieces(
  element: Locator,
  options: { onScreenOnly: boolean; painted: boolean },
): Promise<Piece[]> {
  return element.evaluate((root, { onScreenOnly, painted }) => {
    const STRING = /"(?:[^"\\]|\\.)*"/.source;
    /* A counter or counter style name, which can hold non-ASCII characters (`étape`). */
    const IDENTIFIER = /(?:[\w-]|[^\x00-\x7F])+/.source;
    /* An element or pseudo-element that is not displayed or invisible shows nothing, nor, on
       screen, one fully transparent. */
    const invisible = (style: CSSStyleDeclaration) =>
      style.display === 'none' || style.visibility === 'hidden' || (onScreenOnly && style.opacity === '0');
    /* On screen, an element also hides its text when it is clipped, or reduced to a box of at
       most 1px with its overflow hidden. */
    const hides = (el: Element) => {
      const style = getComputedStyle(el);
      if (invisible(style)) return true;
      if (!onScreenOnly) return false;
      const box = el.getBoundingClientRect();
      return (
        style.clipPath !== 'none' ||
        (style.clip !== '' && style.clip !== 'auto') ||
        (style.overflow !== 'visible' && (box.width <= 1 || box.height <= 1))
      );
    };

    /* CSS counters, as the browser computes them (CSS Lists 3, "Creating and Inheriting
       Counters"): every box (a displayed element, or its ::before or ::after with content) gets
       a copy of its parent's counter instances, completed by those of its preceding sibling
       whose name it lacks, valued as they stand at the box just before it in document order.
       Then its counter-reset creates new instances (replacing one a sibling created), its
       counter-increment and counter-set change the innermost instance of their name (created
       at 0 when there is none). Replayed over the whole document, once, on the first counter. A
       counter-reset `reversed(name)` without an integer (that of an <ol reversed>) starts from a
       value that depends on the number of list items, which the replay does not count: its value
       is unknown (NaN), an error only if a counter shows it. The replay reads only the computed
       counter properties, so it misses the list-item counter that list items increment
       implicitly: showing list-item is an error. */
    type Counter = { name: string; value: number; origin: object; originParent: object | null };
    const countersOf = (
      style: CSSStyleDeclaration,
      node: object,
      parentNode: object | null,
      [parent, sibling, previous]: Counter[][],
    ) => {
      const set = parent.map((counter) => ({ ...counter }));
      for (const counter of sibling) if (!set.some(({ name }) => name === counter.name)) set.push({ ...counter });
      for (const counter of set) {
        const source = previous.find(({ name, origin }) => name === counter.name && origin === counter.origin);
        if (source) counter.value = source.value;
      }
      const innermost = (name: string) => set.findLast((counter) => counter.name === name);
      const instantiate = (name: string, value: number) => {
        const last = innermost(name);
        if (last && (last.origin === node || last.originParent === parentNode)) set.splice(set.indexOf(last), 1);
        set.push({ name, value, origin: node, originParent: parentNode });
      };
      const change = (name: string, update: (value: number) => number) => {
        if (!innermost(name)) instantiate(name, 0);
        const counter = innermost(name)!;
        counter.value = update(counter.value);
      };
      /* The `name [integer]` pairs of a computed counter property, with the default integer. A
         `reversed(name) [integer]` pair stands for name, valued NaN without an integer; any other
         function cannot be read. */
      const pairs = (property: string, implicit: number) => {
        const value = style.getPropertyValue(property);
        const reversed = `reversed\\(\\s*(${IDENTIFIER})\\s*\\)`;
        if (value.replace(new RegExp(reversed, 'g'), '').includes('('))
          throw new Error(`text-on-screen: cannot read ${property}: ${value}`);
        return Array.from(value.matchAll(new RegExp(`(?:${reversed}|(${IDENTIFIER}))(?:\\s+(-?\\d+))?`, 'g')))
          .filter(([, , name]) => name !== 'none')
          .map(([, reversedName, name, integer]) => {
            const fallback = reversedName === undefined ? implicit : NaN;
            return [reversedName ?? name, integer === undefined ? fallback : Number(integer)] as const;
          });
      };
      for (const [name, value] of pairs('counter-reset', 0)) instantiate(name, value);
      for (const [name, value] of pairs('counter-increment', 1)) change(name, (current) => current + value);
      for (const [name, value] of pairs('counter-set', 0)) change(name, () => value);
      return set;
    };
    const replay = () => {
      const sets: Record<Pseudo, Map<Element, Counter[]>> = {
        '::before': new Map(),
        '::after': new Map(),
      };
      /* An element and its subtree, given the sets of its parent, of its preceding sibling and of
         the box before it: its own set and that of the last box of its subtree. */
      const visit = (el: Element, inherited: Counter[][]): { own: Counter[]; last: Counter[] } | null => {
        const style = getComputedStyle(el);
        if (style.display === 'none') return null;
        const own = countersOf(style, el, el.parentElement, inherited);
        let [sibling, last] = [[] as Counter[], own];
        const pseudo = (which: Pseudo) => {
          const pseudoStyle = getComputedStyle(el, which);
          if (pseudoStyle.display === 'none' || ['none', 'normal'].includes(pseudoStyle.content)) return;
          sibling = last = countersOf(pseudoStyle, {}, el, [own, sibling, last]);
          sets[which].set(el, last);
        };
        pseudo('::before');
        for (const child of Array.from(el.children)) {
          const visited = visit(child, [own, sibling, last]);
          if (visited) [sibling, last] = [visited.own, visited.last];
        }
        pseudo('::after');
        return { own, last };
      };
      visit(document.documentElement, [[], [], []]);
      return sets;
    };
    let counterSets: ReturnType<typeof replay> | undefined;
    const format = (value: number, listStyle: string) => {
      if (listStyle === 'none') return '';
      if (Number.isNaN(value))
        throw new Error(
          'text-on-screen: cannot show a counter reset by reversed() without an integer: its value depends on the number of list items',
        );
      if (listStyle === 'decimal') return String(value);
      /* The pad is reduced by the length of the negative sign (CSS Counter Styles 3), so a
         negative value shows unpadded. */
      if (listStyle === 'decimal-leading-zero') return value < 0 ? String(value) : String(value).padStart(2, '0');
      throw new Error(`text-on-screen: the counter style ${listStyle} is not supported`);
    };
    /* The text of a counter(name, style?) or counters(name, "separator", style?) of a
       pseudo-element: a counter it does not have is 0. Only the instances it shows are formatted:
       the innermost for counter(), all of them for counters(). */
    const counterText = (el: Element, pseudo: Pseudo, fn: string, args: string) => {
      const match = args.match(
        new RegExp(`^\\s*(${IDENTIFIER})\\s*(?:,\\s*(${STRING})\\s*)?(?:,\\s*(${IDENTIFIER})\\s*)?$`),
      );
      if (!match) throw new Error(`text-on-screen: cannot read ${fn}(${args})`);
      const [, name, separator, listStyle = 'decimal'] = match;
      if (name === 'list-item')
        throw new Error(
          `text-on-screen: cannot show ${fn}(${args}): list items increment the list-item counter implicitly, which the replay does not see`,
        );
      counterSets ??= replay();
      const values = (counterSets[pseudo].get(el) ?? [])
        .filter((counter) => counter.name === name)
        .map(({ value }) => value);
      if (!values.length) values.push(0);
      if (fn === 'counter') return format(values[values.length - 1], listStyle);
      return values.map((value) => format(value, listStyle)).join(separator ? (JSON.parse(separator) as string) : '');
    };

    /* The generated content of a pseudo-element that shows: its strings and counters, up to the
       slash that starts its alternative text; other functions (url(), attr()…) show no text. */
    const generated = (el: Element, pseudo: Pseudo) => {
      const style = getComputedStyle(el, pseudo);
      if (invisible(style)) return '';
      const tokens = new RegExp(`${STRING}|/|([\\w-]+)\\(((?:${STRING}|[^)"])*)\\)`, 'g');
      let text = '';
      for (const [token, fn, args] of style.content.matchAll(tokens)) {
        if (token === '/') break;
        if (token.startsWith('"')) text += JSON.parse(token) as string;
        else if (fn === 'counter' || fn === 'counters') text += counterText(el, pseudo, fn, args);
      }
      return text;
    };
    /* Background colors of an element and its ancestors, nearest first. */
    const chainOf = (el: Element) => {
      const chain: string[] = [];
      for (let current: Element | null = el; current; current = current.parentElement)
        chain.push(getComputedStyle(current).backgroundColor);
      return chain;
    };
    /* How a piece held by an element, in a pseudo-element or not, is painted (see DisplayedPiece). */
    const paintingOf = (el: Element, pseudo: Pseudo | null) => {
      const style = getComputedStyle(el, pseudo);
      return {
        color: style.color,
        backgrounds: pseudo ? [style.backgroundColor, ...chainOf(el)] : chainOf(el),
        fontSize: parseFloat(style.fontSize),
        fontWeight: parseFloat(style.fontWeight),
      };
    };
    const pieces: (Piece | DisplayedPiece)[] = [];
    const add = (el: Element, text: string, pseudo: Pseudo | null) =>
      pieces.push(painted ? { text, pseudo, ...paintingOf(el, pseudo) } : { text, pseudo });
    const walk = (el: Element) => {
      if (hides(el)) return;
      const addGenerated = (pseudo: Pseudo) => {
        const text = generated(el, pseudo);
        if (text) add(el, text, pseudo);
      };
      addGenerated('::before');
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent ?? '';
          /* Unpainted, whitespace separates words; painted, a blank text is dropped anyway, so
             its painting is not worth reading. */
          if (!painted || text.trim()) add(el, text, null);
        } else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
      }
      addGenerated('::after');
    };
    walk(root);
    return pieces;
  }, options);
}

/* The opacity an element is seen with: the product of its own opacity and those of its
   ancestors. */
export async function effectiveOpacity(element: Locator): Promise<number> {
  return element.evaluate((el) => {
    let product = 1;
    for (let node: Element | null = el; node; node = node.parentElement) {
      product *= parseFloat(getComputedStyle(node).opacity);
    }
    return product;
  });
}

/* Text an element displays on screen, in rendering order: its text nodes and the generated
   content of its ::before and ::after pseudo-elements (without the alternative text of a
   `content: "…" / "…"`, with the values its counters take), hidden elements excluded.
   Independent of the chosen markup. Unlike textOnScreen, its spaces are kept (every run of
   whitespace becomes a single space, leading and trailing whitespace dropped) and only elements
   and pseudo-elements that are not displayed or invisible are left out. */
export async function displayedText(element: Locator): Promise<string> {
  return renderedText(element, false);
}

/* A text of displayedTexts with how it is painted (see DisplayedPiece). */
export type DisplayedTextPiece = Omit<DisplayedPiece, 'pseudo'>;

/* Every text an element displays — its text nodes and the generated content of the ::before and
   ::after pseudo-elements of it and its descendants, read as displayedText reads them — hidden
   elements excluded, each with how it is painted: its text color, the background colors behind
   it, nearest first, its font size in px and its font weight. A text node's whitespace is
   collapsed and trimmed, a pseudo-element's trimmed and its text prefixed with the
   pseudo-element (`::before …`); texts left empty are dropped. */
export async function displayedTexts(root: Locator): Promise<DisplayedTextPiece[]> {
  const pieces = await renderedPieces(root, { onScreenOnly: false, painted: true });
  return pieces.flatMap(({ text, pseudo, ...painting }) => {
    const shown = pseudo ? text.trim() : text.replace(/\s+/g, ' ').trim();
    if (!shown) return [];
    return [{ text: pseudo ? `${pseudo} ${shown}` : shown, ...painting }];
  });
}
