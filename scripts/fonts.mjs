// Copies the IBM Plex fonts (latin subset) from the @fontsource packages
// to static/fonts/, with their OFL licenses: the theme is imported as a
// Hugo module, without npm install, so the fonts are committed.
import { copyFileSync, mkdirSync } from 'node:fs';

// Only the weights declared with @font-face in assets/css/main.css:
// add a weight here when a step needs it, and declare it there.
const families = {
  'ibm-plex-mono': [400, 600, 700],
  'ibm-plex-sans': [400],
};
const target = 'static/fonts';
mkdirSync(target, { recursive: true });

for (const [family, weights] of Object.entries(families)) {
  const source = `node_modules/@fontsource/${family}`;
  for (const weight of weights) {
    const file = `${family}-latin-${weight}-normal.woff2`;
    copyFileSync(`${source}/files/${file}`, `${target}/${file}`);
  }
  copyFileSync(`${source}/LICENSE`, `${target}/${family}-LICENSE.txt`);
}
