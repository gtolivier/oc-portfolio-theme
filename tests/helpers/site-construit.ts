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
  /* Chemin sous lequel le site est servi, de la forme '/…/' : '/' pour un
     site servi à la racine de son origine, '/portfolio/' pour un site
     déployé dans un sous-dossier. Il complète l'origine dans la baseURL de
     la construction. */
  sousChemin: string;
  prefixeDuDossier: string;
}

const racineDuTheme = path.resolve(__dirname, '..', '..');

/* Chaque site de test a sa propre origine, donc son propre port : les ports
   sont attribués dans l'ordre de déclaration des sites ci-dessous, à la
   suite de ceux des serveurs Hugo de playwright.config.ts (1314 et 1315). */
const PREMIER_PORT_DES_SITES_DE_TEST = 1316;
let nombreDeSitesDeTest = 0;

/* Le site d'exemple, modifié par la fixture tests/fixtures/<nom>/, servi à
   la racine de son origine ou sous le sous-chemin donné. */
function siteDeTest(nomDeLaFixture: string, { sousChemin = '/' }: { sousChemin?: string } = {}): SiteConstruit {
  const port = PREMIER_PORT_DES_SITES_DE_TEST + nombreDeSitesDeTest++;
  return {
    fixture: path.join(racineDuTheme, 'tests', 'fixtures', nomDeLaFixture),
    origine: `http://localhost:${port}`,
    sousChemin,
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

/* L'accueil français du site d'exemple a un hero dont chaque bouton a une
   destination : ce site-ci remplace cet accueil par celui de
   tests/fixtures/bouton-sans-destination/content, dont le second bouton a un
   label mais ni url ni pageRef. */
export const SITE_A_UN_BOUTON_SANS_DESTINATION = siteDeTest('bouton-sans-destination');

/* Le site d'exemple est servi à la racine de son origine : ce site-ci est
   servi sous /portfolio/, comme un déploiement dans un sous-dossier, et
   remplace l'accueil français par celui de
   tests/fixtures/url-depuis-la-racine/content, dont l'unique bouton déclare
   une url relative à la racine du site, url = '/fr/page-longue/'. */
export const SITE_SOUS_PORTFOLIO_A_UNE_URL_DEPUIS_LA_RACINE = siteDeTest('url-depuis-la-racine', {
  sousChemin: '/portfolio/',
});

/* Le nom de l'auteur du site d'exemple et le titre de son hero sont faits de
   mots courts : ce site-ci change d'autrice, au nom de famille composé de
   plus de 12 caractères, et remplace l'accueil français par celui de
   tests/fixtures/hero-mots-longs/content, au titre « Horlogère-restauratrice »
   (voir tests/fixtures/hero-mots-longs/hugo.toml). */
export const SITE_A_UN_HERO_AUX_MOTS_LONGS = siteDeTest('hero-mots-longs');

/* Le site d'exemple a pour auteur « Jean Exemple », que le titre du hero
   affiche : ce site-ci vide params.author (voir
   tests/fixtures/hero-sans-auteur/hugo.toml) et remplace l'accueil français
   par celui de tests/fixtures/hero-sans-auteur/content, au hero complet. */
export const SITE_A_UN_HERO_SANS_AUTEUR = siteDeTest('hero-sans-auteur');

/* L'accueil français du site d'exemple a un hero dont chaque bouton a une
   seule destination : ce site-ci remplace cet accueil par celui de
   tests/fixtures/bouton-url-et-page-ref/content, dont le second bouton a un
   label et déclare à la fois url = '#contact' et pageRef = '/projets', deux
   destinations valides. */
export const SITE_A_UN_BOUTON_A_URL_ET_PAGE_REF = siteDeTest('bouton-url-et-page-ref');

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
    supprimerUnDossier(dossier);
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
    '--baseURL', `${site.origine}${site.sousChemin}`,
    '--destination', destination,
    '--noBuildLock',
  ];
}

function creerLeDossierDeConstruction(site: SiteConstruit): string {
  return mkdtempSync(path.join(tmpdir(), site.prefixeDuDossier));
}

/* Le dossier construit est rendu au test, qui le supprime avec
   supprimerUnSite ; si la construction échoue, il est supprimé ici, avant
   que l'erreur ne remonte. */
export function construireUnSite(site: SiteConstruit): string {
  const destination = creerLeDossierDeConstruction(site);
  try {
    avecLaConfigurationDuSite(site, (configuration) =>
      execFileSync('hugo', [...argumentsDeConstruction(site, configuration, destination), '--quiet'], {
        cwd: racineDuTheme,
        stdio: 'pipe',
      }),
    );
  } catch (erreur) {
    supprimerUnSite(destination);
    throw erreur;
  }
  return destination;
}

export interface TentativeDeConstruction {
  reussie: boolean;
  /* Ce que Hugo écrit sur sa sortie d'erreur : ses messages d'erreur. */
  erreurs: string;
}

/* Un Hugo bloqué ne doit pas bloquer le test avec lui : passé ce délai, il
   est arrêté, et la tentative lève une exception. */
const DELAI_MAXIMAL_DE_CONSTRUCTION_EN_MS = 60_000;

/* Construit le site comme construireUnSite, mais sans lever d'exception si
   la construction échoue, pour observer ce que Hugo en dit à la personne qui
   construit le site. Sans --quiet, qui ferait taire ses messages d'erreur ;
   --logLevel error n'en garde que les erreurs. Seule une fin normale de Hugo
   compte : reussie vaut true s'il sort avec le code 0, false avec tout autre
   code. S'il ne finit pas normalement (lancement impossible, délai
   DELAI_MAXIMAL_DE_CONSTRUCTION_EN_MS dépassé, arrêt par un signal), la
   tentative lève une exception, pour qu'un test qui attend un échec de la
   construction ne passe pas pour une mauvaise raison. Le dossier temporaire
   est supprimé dans tous les cas. */
export function tenterDeConstruireUnSite(site: SiteConstruit): TentativeDeConstruction {
  const destination = creerLeDossierDeConstruction(site);
  try {
    const resultat = avecLaConfigurationDuSite(site, (configuration) =>
      spawnSync('hugo', [...argumentsDeConstruction(site, configuration, destination), '--logLevel', 'error'], {
        cwd: racineDuTheme,
        encoding: 'utf8',
        timeout: DELAI_MAXIMAL_DE_CONSTRUCTION_EN_MS,
      }),
    );
    if (resultat.error || resultat.signal) {
      throw new Error(
        `Hugo n'a pas fini normalement (signal : ${resultat.signal ?? 'aucun'})` +
          (resultat.error ? ` : ${resultat.error.message}` : ''),
        { cause: resultat.error },
      );
    }
    return { reussie: resultat.status === 0, erreurs: resultat.stderr };
  } finally {
    supprimerUnSite(destination);
  }
}

export function supprimerUnSite(dossier: string): void {
  supprimerUnDossier(dossier);
}

function supprimerUnDossier(dossier: string): void {
  rmSync(dossier, { recursive: true, force: true });
}

/* Seules les adresses sous le sous-chemin du site sont servies : Hugo écrit
   les pages à la racine du dossier construit, le sous-chemin ne figurant que
   dans leurs adresses. */
export async function servirUnSite(context: BrowserContext, site: SiteConstruit, dossier: string): Promise<void> {
  await context.route(`${site.origine}${site.sousChemin}**`, async (route) => {
    const adresse = decodeURIComponent(new URL(route.request().url()).pathname);
    const chemin = `/${adresse.slice(site.sousChemin.length)}`;
    let fichier = path.join(dossier, chemin);
    if (existsSync(fichier) && statSync(fichier).isDirectory()) fichier = path.join(fichier, 'index.html');
    /* Le séparateur écarte un dossier voisin dont le nom commence comme celui du site. */
    if (!fichier.startsWith(dossier + path.sep) || !existsSync(fichier)) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }
    await route.fulfill({ path: fichier });
  });
}
