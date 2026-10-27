import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

/* Font files with chosen vertical metrics, built in memory for the tests from
   the IBM Plex Mono files of the @fontsource package: the same glyphs, but a
   normal line height the test picks, the same on every machine, whatever
   fallback fonts it has installed. */

const fontsourceFiles = path.resolve(__dirname, '..', '..', 'node_modules', '@fontsource', 'ibm-plex-mono', 'files');

interface Table {
  tag: string;
  data: Buffer;
}

/* The tables of a WOFF 1.0 file, decompressed. */
function tablesOfWoff(woff: Buffer): { flavor: number; tables: Table[] } {
  if (woff.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF 1.0 file');
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables: Table[] = [];
  for (let index = 0; index < numTables; index++) {
    const entry = 44 + index * 20;
    const tag = woff.toString('latin1', entry, entry + 4);
    const offset = woff.readUInt32BE(entry + 4);
    const compLength = woff.readUInt32BE(entry + 8);
    const origLength = woff.readUInt32BE(entry + 12);
    const stored = woff.subarray(offset, offset + compLength);
    tables.push({ tag, data: compLength < origLength ? inflateSync(stored) : Buffer.from(stored) });
  }
  return { flavor, tables };
}

function checksum(data: Buffer): number {
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
  data.copy(padded);
  let sum = 0;
  for (let offset = 0; offset < padded.length; offset += 4) sum = (sum + padded.readUInt32BE(offset)) >>> 0;
  return sum;
}

/* An OpenType (sfnt) file holding `tables`, sorted by tag as the format requires. */
function sfntOf(flavor: number, tables: Table[]): Buffer {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const numTables = sorted.length;
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);
  const bodies: Buffer[] = [];
  let offset = header.length;
  sorted.forEach(({ tag, data }, index) => {
    const record = 12 + index * 16;
    header.write(tag, record, 'latin1');
    header.writeUInt32BE(checksum(data), record + 4);
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(data.length, record + 12);
    const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
    data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  const font = Buffer.concat([header, ...bodies]);
  /* head.checkSumAdjustment, so the whole file sums to the magic number. */
  const headIndex = sorted.findIndex((table) => table.tag === 'head');
  if (headIndex !== -1) {
    const headOffset = header.readUInt32BE(12 + headIndex * 16 + 8);
    font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8);
  }
  return font;
}

/* The IBM Plex Mono font file `fileName` (such as 'ibm-plex-mono-latin-400-normal'), with
   its ascent and descent set to `ascent` and `descent` em and no line gap, in every table a
   browser may read them from (hhea, and OS/2's typographic and Windows metrics): its normal
   line height is `ascent + descent` em on any system. */
export function plexMonoWithLineHeight(fileName: string, { ascent, descent }: { ascent: number; descent: number }): Buffer {
  const { flavor, tables } = tablesOfWoff(readFileSync(path.join(fontsourceFiles, `${fileName}.woff`)));
  const table = (tag: string): Buffer => {
    const found = tables.find((candidate) => candidate.tag === tag);
    if (!found) throw new Error(`${fileName} has no ${tag} table`);
    return found.data;
  };
  const unitsPerEm = table('head').readUInt16BE(18);
  const ascentUnits = Math.round(ascent * unitsPerEm);
  const descentUnits = Math.round(descent * unitsPerEm);
  const hhea = table('hhea');
  hhea.writeInt16BE(ascentUnits, 4);
  hhea.writeInt16BE(-descentUnits, 6);
  hhea.writeInt16BE(0, 8);
  const os2 = table('OS/2');
  os2.writeInt16BE(ascentUnits, 68);
  os2.writeInt16BE(-descentUnits, 70);
  os2.writeInt16BE(0, 72);
  os2.writeUInt16BE(ascentUnits, 74);
  os2.writeUInt16BE(descentUnits, 76);
  return sfntOf(flavor, tables);
}

/* Serves, in place of the IBM Plex Mono font files of the site served at `origin`, the same
   font with the given ascent and descent, in em. A page route takes precedence over the
   context route that serves the site. Returns the list, filled as the page asks for them, of
   the replaced font URLs. */
export async function replacePlexMonoFiles(page: Page, origin: string, metrics: { ascent: number; descent: number }): Promise<string[]> {
  const replacedFonts: string[] = [];
  await page.route(`${origin}/**/ibm-plex-mono-*.woff2`, async (route) => {
    const url = route.request().url();
    replacedFonts.push(url);
    const fileName = path.basename(new URL(url).pathname, '.woff2');
    await route.fulfill({ contentType: 'font/ttf', body: plexMonoWithLineHeight(fileName, metrics) });
  });
  return replacedFonts;
}
