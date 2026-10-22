import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

/* Le site d'exemple n'a aucune page avec des alias : ce site-ci lui ajoute
   les pages de tests/fixtures/alias/content (une page anglaise qui déclare
   une ancienne adresse, et sa traduction française). Il est construit dans
   un dossier temporaire et servi aux navigateurs par interception des
   requêtes, sous cette adresse. */
export const ORIGINE_SITE_AVEC_ALIAS = 'http://localhost:1316';

const racineDuTheme = path.resolve(__dirname, '..', '..');

export function construireLeSiteAvecAlias(): string {
  const destination = mkdtempSync(path.join(tmpdir(), 'oc-portfolio-alias-'));
  execFileSync(
    'hugo',
    [
      'build',
      '--source', 'exampleSite',
      '--config', 'hugo.toml,../tests/fixtures/alias/hugo.toml',
      '--environment', 'production',
      '--baseURL', `${ORIGINE_SITE_AVEC_ALIAS}/`,
      '--destination', destination,
      '--noBuildLock',
      '--quiet',
    ],
    { cwd: racineDuTheme, stdio: 'pipe' },
  );
  return destination;
}

export function supprimerLeSiteAvecAlias(dossier: string): void {
  rmSync(dossier, { recursive: true, force: true });
}

export async function servirLeSiteAvecAlias(context: BrowserContext, dossier: string): Promise<void> {
  await context.route(`${ORIGINE_SITE_AVEC_ALIAS}/**`, async (route) => {
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
