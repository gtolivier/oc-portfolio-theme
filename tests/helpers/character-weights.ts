import { type Locator } from '@playwright/test';

/* Each visible character of the element's text, in document order, with the computed weight of
   the element that holds it: "<character> <weight>", such as "| 700". */
export async function characterWeights(element: Locator): Promise<string[]> {
  return element.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const values: string[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const weight = getComputedStyle(node.parentElement!).fontWeight;
      for (const character of node.textContent!) {
        if (character.trim() !== '') values.push(`${character} ${weight}`);
      }
    }
    return values;
  });
}
