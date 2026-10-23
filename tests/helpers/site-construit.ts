import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

/* Un site construit pour un test : le site d'exemple, modifié par une
   fixture, construit dans un dossier temporaire et servi aux navigateurs par
   interception des requêtes sous sa propre origine, sans serveur Hugo de
   plus. */

export interface SiteConstruit {
  /* Dossier tests/fixtures/<nom>/ de la fixture. Son hugo.toml, s'il
     existe, s'ajoute à exampleSite/hugo.toml ; son dossier content/, s'il
     existe, est monté devant le contenu du site d'exemple, dont il remplace
     les pages de même chemin. */
  fixture: string;
  origine: string;
  prefixeDuDossier: string;
}

const racineDuTheme = path.resolve(__dirname, '..', '..');

/* Chaque site de test a sa propre origine, donc son propre port : les ports
   sont attribués dans l'ordre de déclaration des sites ci-dessous, à la
   suite de ceux des serveurs Hugo de playwright.config.ts (1314 et 1315). */
const PREMIER_PORT_DES_SITES_DE_TEST = 1316;
let nombreDeSitesDeTest = 0;

/* Le site d'exemple, modifié par la fixture tests/fixtures/<nom>/. */
function siteDeTest(nomDeLaFixture: string): SiteConstruit {
  const port = PREMIER_PORT_DES_SITES_DE_TEST + nombreDeSitesDeTest++;
  return {
    fixture: path.join(racineDuTheme, 'tests', 'fixtures', nomDeLaFixture),
    origine: `http://localhost:${port}`,
    prefixeDuDossier: `oc-portfolio-${nomDeLaFixture}-`,
  };
}

/* Le site d'exemple n'a aucune page avec des alias : ce site-ci lui ajoute
   les pages de tests/fixtures/alias/content (une page anglaise qui déclare
   une ancienne adresse, et sa traduction française), et donne à son
   accueil anglais l'ancienne adresse /en/english/ (voir
   tests/fixtures/alias/hugo.toml). */
export const SITE_AVEC_ALIAS = siteDeTest('alias');

/* Le site d'exemple est bilingue : ce site-ci est le même, construit en
   français seulement (tests/fixtures/une-langue/hugo.toml désactive
   l'anglais). */
export const SITE_D_UNE_LANGUE = siteDeTest('une-langue');

/* L'accueil français du site d'exemple a un hero : ce site-ci remplace cet
   accueil par celui de tests/fixtures/sans-hero/content, sans bloc
   [params.hero]. */
export const SITE_SANS_HERO = siteDeTest('sans-hero');

/* Le site d'exemple a pour auteur « Jean Exemple » et un hero d'horloger :
   ce site-ci change d'autrice et remplace l'accueil français par celui de
   tests/fixtures/autre-hero/content, au hero complet mais différent (voir
   tests/fixtures/autre-hero/hugo.toml). */
export const SITE_A_UN_AUTRE_HERO = siteDeTest('autre-hero');

/* L'accueil français du site d'exemple a un hero dont chaque bouton mène à
   une page existante ou à une adresse : ce site-ci remplace cet accueil par
   celui de tests/fixtures/page-ref-introuvable/content, dont un bouton
   déclare pageRef = '/page-fictive-introuvable', page qui n'existe pas. */
export const SITE_A_UN_PAGE_REF_INTROUVABLE = siteDeTest('page-ref-introuvable');

/* L'accueil français du site d'exemple a un hero dont chaque bouton a un
   libellé : ce site-ci remplace cet accueil par celui de
   tests/fixtures/bouton-sans-libelle/content, dont le second bouton a une
   url = '#contact' valide mais pas de label. */
export const SITE_A_UN_BOUTON_SANS_LIBELLE = siteDeTest('bouton-sans-libelle');

/* Hugo ne lit une configuration que dans un fichier : celle qui monte le
   contenu de la fixture est écrite dans un dossier temporaire à part, pour
   ne pas finir parmi les pages construites, et supprimée après la
   construction. */
function avecLaConfigurationDuSite<T>(site: SiteConstruit, construire: (configuration: string) => T): T {
  const dossier = mkdtempSync(path.join(tmpdir(), `${site.prefixeDuDossier}configuration-`));
  try {
    const fichiers = ['hugo.toml', ...montageDuContenuDeLaFixture(site, dossier), ...configurationDeLaFixture(site)];
    return construire(fichiers.join(','));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

function montageDuContenuDeLaFixture(site: SiteConstruit, dossierDeLaConfiguration: string): string[] {
  const contenu = path.join(site.fixture, 'content');
  if (!existsSync(contenu)) return [];
  const fichier = path.join(dossierDeLaConfiguration, 'contenu.json');
  /* Le premier montage l'emporte sur le second pour une page de même
     chemin. */
  const montages = [
    { source: contenu, target: 'content' },
    { source: 'content', target: 'content' },
  ];
  writeFileSync(fichier, JSON.stringify({ module: { mounts: montages } }));
  return [fichier];
}

function configurationDeLaFixture(site: SiteConstruit): string[] {
  const fichier = path.join(site.fixture, 'hugo.toml');
  return existsSync(fichier) ? [fichier] : [];
}

function argumentsDeConstruction(site: SiteConstruit, configuration: string, destination: string): string[] {
  return [
    'build',
    '--source', 'exampleSite',
    '--config', configuration,
    '--environment', 'production',
    '--baseURL', `${site.origine}/`,
    '--destination', destination,
    '--noBuildLock',
  ];
}

function creerLeDossierDeConstruction(site: SiteConstruit): string {
  return mkdtempSync(path.join(tmpdir(), site.prefixeDuDossier));
}

export function construireUnSite(site: SiteConstruit): string {
  const destination = creerLeDossierDeConstruction(site);
  avecLaConfigurationDuSite(site, (configuration) =>
    execFileSync('hugo', [...argumentsDeConstruction(site, configuration, destination), '--quiet'], {
      cwd: racineDuTheme,
      stdio: 'pipe',
    }),
  );
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
  const destination = creerLeDossierDeConstruction(site);
  try {
    const resultat = avecLaConfigurationDuSite(site, (configuration) =>
      spawnSync('hugo', [...argumentsDeConstruction(site, configuration, destination), '--logLevel', 'error'], {
        cwd: racineDuTheme,
        encoding: 'utf8',
      }),
    );
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
