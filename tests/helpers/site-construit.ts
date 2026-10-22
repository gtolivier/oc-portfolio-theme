import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

/* Un site construit pour un test : le site d'exemple, augmenté d'une
   configuration de surcharge, construit dans un dossier temporaire et servi
   aux navigateurs par interception des requêtes sous sa propre origine,
   sans serveur Hugo de plus. */

const racineDuTheme = path.resolve(__dirname, '..', '..');

export function construireUnSite(surcharge: string, origine: string, prefixeDuDossier: string): string {
  const destination = mkdtempSync(path.join(tmpdir(), prefixeDuDossier));
  execFileSync(
    'hugo',
    [
      'build',
      '--source', 'exampleSite',
      '--config', `hugo.toml,${surcharge}`,
      '--environment', 'production',
      '--baseURL', `${origine}/`,
      '--destination', destination,
      '--noBuildLock',
      '--quiet',
    ],
    { cwd: racineDuTheme, stdio: 'pipe' },
  );
  return destination;
}

export function supprimerUnSite(dossier: string): void {
  rmSync(dossier, { recursive: true, force: true });
}

export async function servirUnSite(context: BrowserContext, origine: string, dossier: string): Promise<void> {
  await context.route(`${origine}/**`, async (route) => {
    const chemin = decodeURIComponent(new URL(route.request().url()).pathname);
    let fichier = path.join(dossier, chemin);
    if (existsSync(fichier) && statSync(fichier).isDirectory()) fichier = path.join(fichier, 'index.html');
    if (!fichier.startsWith(dossier) || !existsSync(fichier)) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }
    await route.fulfill({ path: fichier });
  });
}
