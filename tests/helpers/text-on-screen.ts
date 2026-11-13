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
  const text = await element.evaluate((root, onScreenOnly) => {
    type Pseudo = '::before' | '::after';
    const STRING = /"(?:[^"\\]|\\.)*"/.source;
    /* An element or pseudo-element that is not displayed or invisible shows nothing, nor, on
       screen, one fully transparent. */
    const invisible = (style: CSSStyleDeclaration) =>
      style.display === 'none' || style.visibility === 'hidden' || (onScreenOnly && style.opacity === '0');
    /* On screen, an element also hides its text when it is clipped, or reduced to a box of at
       most 1px with its overflow hidden. */
    const hides = (el: Element) => {
      const style = getComputedStyle(el);
      if (invisible(style) || !onScreenOnly) return invisible(style);
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
       at 0 when there is none). Replayed over the whole document, once, on the first counter. */
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
      /* The `name [integer]` pairs of a computed counter property, with the default integer. */
      const pairs = (property: string, implicit: number) =>
        Array.from(style.getPropertyValue(property).matchAll(/([\w-]+)(?:\s+(-?\d+))?/g))
          .filter(([, name]) => name !== 'none')
          .map(([, name, value]) => [name, value === undefined ? implicit : Number(value)] as const);
      for (const [name, value] of pairs('counter-reset', 0)) instantiate(name, value);
      for (const [name, value] of pairs('counter-increment', 1)) change(name, (current) => current + value);
      for (const [name, value] of pairs('counter-set', 0)) change(name, () => value);
      return set;
    };
    const replay = () => {
      const sets: Record<'' | Pseudo, Map<Element, Counter[]>> = {
        '': new Map(),
        '::before': new Map(),
        '::after': new Map(),
      };
      /* An element and its subtree, given the sets of its parent, of its preceding sibling and of
         the box before it: its own set and that of the last box of its subtree. */
      const visit = (el: Element, inherited: Counter[][]): { own: Counter[]; last: Counter[] } | null => {
        const style = getComputedStyle(el);
        if (style.display === 'none') return null;
        const own = countersOf(style, el, el.parentElement, inherited);
        sets[''].set(el, own);
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
      if (listStyle === 'decimal') return String(value);
      if (listStyle === 'decimal-leading-zero')
        return (value < 0 ? '-' : '') + String(Math.abs(value)).padStart(2, '0');
      throw new Error(`text-on-screen: the counter style ${listStyle} is not supported`);
    };
    /* The text of a counter(name, style?) or counters(name, "separator", style?) of a
       pseudo-element: a counter it does not have is 0. */
    const counterText = (el: Element, pseudo: Pseudo, fn: string, args: string) => {
      const match = args.match(new RegExp(`^\\s*([\\w-]+)\\s*(?:,\\s*(${STRING})\\s*)?(?:,\\s*([\\w-]+)\\s*)?$`));
      if (!match) throw new Error(`text-on-screen: cannot read ${fn}(${args})`);
      const [, name, separator, listStyle = 'decimal'] = match;
      counterSets ??= replay();
      const values = (counterSets[pseudo].get(el) ?? []).filter((counter) => counter.name === name);
      const texts = (values.length ? values.map(({ value }) => value) : [0]).map((value) => format(value, listStyle));
      return fn === 'counter'
        ? texts[texts.length - 1]
        : texts.join(separator ? (JSON.parse(separator) as string) : '');
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
    const walk = (el: Element): string => {
      if (hides(el)) return '';
      let result = generated(el, '::before');
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) result += child.textContent ?? '';
        else if (child.nodeType === Node.ELEMENT_NODE) result += walk(child as Element);
      }
      return result + generated(el, '::after');
    };
    return walk(root);
  }, onScreenOnly);
  return text.replace(/\s+/g, ' ').trim();
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
