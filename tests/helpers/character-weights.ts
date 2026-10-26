import { type Locator } from '@playwright/test';
import { textPieceStyles } from './text-piece-styles';

/* Each visible character of the element's text, in document order, with the computed weight of
   the element that holds it: "<character> <weight>", such as "| 700". */
export async function characterWeights(element: Locator): Promise<string[]> {
  return (await textPieceStyles(element)).flatMap(({ text, fontWeight }) =>
    [...text].filter((character) => character.trim() !== '').map((character) => `${character} ${fontWeight}`),
  );
}
