import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

/* Le site d'exemple est bilingue : ce site-ci est le même, construit en
   français seulement (tests/fixtures/une-langue/hugo.toml désactive
   l'anglais). Il est construit dans un dossier temporaire et servi aux
   navigateurs par interception des requêtes, sous cette adresse. */
export const ORIGINE_SITE_D_UNE_LANGUE = 'http://localhost:1317';

const racineDuTheme = path.resolve(__dirname, '..', '..');

export function construireLeSiteDUneLangue(): string {
  const destination = mkdtempSync(path.join(tmpdir(), 'oc-portfolio-une-langue-'));
  execFileSync(
    'hugo',
    [
      'build',
      '--source', 'exampleSite',
      '--config', 'hugo.toml,../tests/fixtures/une-langue/hugo.toml',
      '--environment', 'production',
      '--baseURL', `${ORIGINE_SITE_D_UNE_LANGUE}/`,
      '--destination', destination,
      '--noBuildLock',
      '--quiet',
    ],
    { cwd: racineDuTheme, stdio: 'pipe' },
  );
  return destination;
}

export function supprimerLeSiteDUneLangue(dossier: string): void {
  rmSync(dossier, { recursive: true, force: true });
}

export async function servirLeSiteDUneLangue(context: BrowserContext, dossier: string): Promise<void> {
  await context.route(`${ORIGINE_SITE_D_UNE_LANGUE}/**`, async (route) => {
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
