// Copie les polices IBM Plex (sous-ensemble latin) des paquets @fontsource
// vers static/fonts/, avec leurs licences OFL : le thème est importé comme
// module Hugo, sans npm install, donc les polices sont versionnées.
import { copyFileSync, mkdirSync } from 'node:fs';

const families = {
  'ibm-plex-mono': [400, 500, 600, 700],
  'ibm-plex-sans': [400, 500, 600],
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
