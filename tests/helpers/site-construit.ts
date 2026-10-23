import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

/* Un site construit pour un test : le site d'exemple, augmenté d'une
   configuration de surcharge, construit dans un dossier temporaire et servi
   aux navigateurs par interception des requêtes sous sa propre origine,
   sans serveur Hugo de plus. */

export interface SiteConstruit {
  /* Chemin relatif à exampleSite/, dossier source de la construction. */
  surcharge: string;
  origine: string;
  prefixeDuDossier: string;
}

/* Le site d'exemple n'a aucune page avec des alias : ce site-ci lui ajoute
   les pages de tests/fixtures/alias/content (une page anglaise qui déclare
   une ancienne adresse, et sa traduction française), et donne à son
   accueil anglais l'ancienne adresse /en/english/ (voir
   tests/fixtures/alias/hugo.toml). */
export const SITE_AVEC_ALIAS: SiteConstruit = {
  surcharge: '../tests/fixtures/alias/hugo.toml',
  origine: 'http://localhost:1316',
  prefixeDuDossier: 'oc-portfolio-alias-',
};

/* Le site d'exemple est bilingue : ce site-ci est le même, construit en
   français seulement (tests/fixtures/une-langue/hugo.toml désactive
   l'anglais). */
export const SITE_D_UNE_LANGUE: SiteConstruit = {
  surcharge: '../tests/fixtures/une-langue/hugo.toml',
  origine: 'http://localhost:1317',
  prefixeDuDossier: 'oc-portfolio-une-langue-',
};

/* L'accueil français du site d'exemple a un hero : ce site-ci remplace cet
   accueil par celui de tests/fixtures/sans-hero/content, sans bloc
   [params.hero] (voir tests/fixtures/sans-hero/hugo.toml). */
export const SITE_SANS_HERO: SiteConstruit = {
  surcharge: '../tests/fixtures/sans-hero/hugo.toml',
  origine: 'http://localhost:1318',
  prefixeDuDossier: 'oc-portfolio-sans-hero-',
};

const racineDuTheme =path.resolve(__dirname, '..', '..');

export function construireUnSite(site: SiteConstruit): string {
  const destination = mkdtempSync(path.join(tmpdir(), site.prefixeDuDossier));
  execFileSync(
    'hugo',
    [
      'build',
      '--source', 'exampleSite',
      '--config', `hugo.toml,${site.surcharge}`,
      '--environment', 'production',
      '--baseURL', `${site.origine}/`,
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

export async function servirUnSite(context: BrowserContext, site: SiteConstruit, dossier: string): Promise<void> {
  await context.route(`${site.origine}/**`, async (route) => {
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
