import { execFileSync, spawnSync } from 'node:child_process';
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

/* Le site d'exemple a pour auteur « Jean Exemple » et un hero d'horloger :
   ce site-ci change d'autrice et remplace l'accueil français par celui de
   tests/fixtures/autre-hero/content, au hero complet mais différent (voir
   tests/fixtures/autre-hero/hugo.toml). */
export const SITE_A_UN_AUTRE_HERO: SiteConstruit = {
  surcharge: '../tests/fixtures/autre-hero/hugo.toml',
  origine: 'http://localhost:1319',
  prefixeDuDossier: 'oc-portfolio-autre-hero-',
};

/* L'accueil français du site d'exemple a un hero dont chaque bouton mène à
   une page existante ou à une adresse : ce site-ci remplace cet accueil par
   celui de tests/fixtures/page-ref-introuvable/content, dont un bouton
   déclare pageRef = '/page-fictive-introuvable', page qui n'existe pas
   (voir tests/fixtures/page-ref-introuvable/hugo.toml). */
export const SITE_A_UN_PAGE_REF_INTROUVABLE: SiteConstruit = {
  surcharge: '../tests/fixtures/page-ref-introuvable/hugo.toml',
  origine: 'http://localhost:1320',
  prefixeDuDossier: 'oc-portfolio-page-ref-introuvable-',
};

/* L'accueil français du site d'exemple a un hero dont chaque bouton a un
   libellé : ce site-ci remplace cet accueil par celui de
   tests/fixtures/bouton-sans-libelle/content, dont le second bouton a une
   url = '#contact' valide mais pas de label (voir
   tests/fixtures/bouton-sans-libelle/hugo.toml). */
export const SITE_A_UN_BOUTON_SANS_LIBELLE: SiteConstruit = {
  surcharge: '../tests/fixtures/bouton-sans-libelle/hugo.toml',
  origine: 'http://localhost:1321',
  prefixeDuDossier: 'oc-portfolio-bouton-sans-libelle-',
};

const racineDuTheme = path.resolve(__dirname, '..', '..');

function argumentsDeConstruction(site: SiteConstruit, destination: string): string[] {
  return [
    'build',
    '--source', 'exampleSite',
    '--config', `hugo.toml,${site.surcharge}`,
    '--environment', 'production',
    '--baseURL', `${site.origine}/`,
    '--destination', destination,
    '--noBuildLock',
  ];
}

export function construireUnSite(site: SiteConstruit): string {
  const destination = mkdtempSync(path.join(tmpdir(), site.prefixeDuDossier));
  execFileSync('hugo', [...argumentsDeConstruction(site, destination), '--quiet'], {
    cwd: racineDuTheme,
    stdio: 'pipe',
  });
  return destination;
}

export interface TentativeDeConstruction {
  reussie: boolean;
  /* Ce que Hugo écrit sur sa sortie d'erreur : ses messages d'erreur. */
  erreurs: string;
}

/* Construit le site comme construireUnSite, mais sans lever d'exception si
   la construction échoue, pour observer ce que Hugo en dit à la personne qui
   construit le site. Sans --quiet, qui ferait taire ses messages d'erreur ;
   --logLevel error n'en garde que les erreurs. Le dossier temporaire est
   supprimé dans tous les cas. */
export function tenterDeConstruireUnSite(site: SiteConstruit): TentativeDeConstruction {
  const destination = mkdtempSync(path.join(tmpdir(), site.prefixeDuDossier));
  try {
    const resultat = spawnSync('hugo', [...argumentsDeConstruction(site, destination), '--logLevel', 'error'], {
      cwd: racineDuTheme,
      encoding: 'utf8',
    });
    if (resultat.error) throw resultat.error;
    return { reussie: resultat.status === 0, erreurs: resultat.stderr };
  } finally {
    supprimerUnSite(destination);
  }
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
