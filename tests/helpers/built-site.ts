import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type BrowserContext } from '@playwright/test';

/* A site built for a test: the example site, modified by a fixture, built
   in a temporary directory and served to the browsers by intercepting the
   requests under its own origin, without one more Hugo server. */

export interface BuiltSite {
  /* The fixture's tests/fixtures/<name>/ directory. Its hugo.toml, if it
     exists, is added to exampleSite/hugo.toml; its content/ directory, if
     it exists, is mounted in front of the example site's content, whose
     pages with the same path it replaces. */
  fixture: string;
  origin: string;
  /* Path under which the site is served, of the form '/…/': '/' for a site
     served at the root of its origin, '/portfolio/' for a site deployed in
     a subdirectory. It completes the origin in the build's baseURL. */
  subpath: string;
  directoryPrefix: string;
}

const themeRoot = path.resolve(__dirname, '..', '..');

/* Each test site has its own origin, hence its own port: ports are assigned
   in the order the sites are declared below, after those of the Hugo
   servers of playwright.config.ts (1314 and 1315). */
const FIRST_TEST_SITE_PORT = 1316;
let testSiteCount = 0;

/* The example site, modified by the tests/fixtures/<name>/ fixture, served
   at the root of its origin or under the given subpath. */
function testSite(fixtureName: string, { subpath = '/' }: { subpath?: string } = {}): BuiltSite {
  const port = FIRST_TEST_SITE_PORT + testSiteCount++;
  return {
    fixture: path.join(themeRoot, 'tests', 'fixtures', fixtureName),
    origin: `http://localhost:${port}`,
    subpath,
    directoryPrefix: `oc-portfolio-${fixtureName}-`,
  };
}

/* The example site has no page with aliases: this site adds to it the pages
   of tests/fixtures/alias/content (an English page that declares an old
   address, and its French translation), and gives its English home page
   the old address /en/english/ (see tests/fixtures/alias/hugo.toml). */
export const SITE_WITH_ALIASES = testSite('alias');

/* The example site is bilingual: this site is the same, built in French
   only (tests/fixtures/single-language/hugo.toml disables English). */
export const SITE_WITH_A_SINGLE_LANGUAGE = testSite('single-language');

/* The example site's French home page has a hero: this site replaces that
   home page with the one of tests/fixtures/without-hero/content, without a
   [params.hero] block. */
export const SITE_WITHOUT_HERO = testSite('without-hero');

/* The example site's author is "Jean Exemple" and its hero is a
   clockmaker's: this site changes author and replaces the French home page
   with the one of tests/fixtures/other-hero/content, with a complete but
   different hero (see tests/fixtures/other-hero/hugo.toml). */
export const SITE_WITH_ANOTHER_HERO = testSite('other-hero');

/* The example site's French home page has a hero whose every button leads
   to an existing page or to an address: this site replaces that home page
   with the one of tests/fixtures/page-ref-not-found/content, where a button
   declares pageRef = '/page-fictive-introuvable', a page that does not
   exist. */
export const SITE_WITH_A_PAGE_REF_NOT_FOUND = testSite('page-ref-not-found');

/* The fixture folders of the build-failure sites below avoid the words
   label, author and url: a folder name shows up in temporary paths, hence
   possibly in Hugo's error output, which the error-message assertions must
   not match instead of the real message. */

/* The example site's French home page has a hero whose every button has a
   label: this site replaces that home page with the one of
   tests/fixtures/unlabeled-button/content, whose second button has a
   valid url = '#contact' but no label. */
export const SITE_WITH_A_BUTTON_WITHOUT_LABEL = testSite('unlabeled-button');

/* The example site's French home page has a hero whose every button has a
   destination: this site replaces that home page with the one of
   tests/fixtures/button-without-destination/content, whose second button
   has a label but neither url nor pageRef. */
export const SITE_WITH_A_BUTTON_WITHOUT_DESTINATION = testSite('button-without-destination');

/* The example site is served at the root of its origin: this site is served
   under /portfolio/, like a deployment in a subdirectory, and replaces the
   French home page with the one of tests/fixtures/url-from-the-root/content,
   whose only button declares a url relative to the site root,
   url = '/fr/page-longue/'. */
export const SITE_UNDER_PORTFOLIO_WITH_A_URL_FROM_THE_ROOT = testSite('url-from-the-root', {
  subpath: '/portfolio/',
});

/* The example site is served at the root of its origin: this site is served
   under /portfolio/ and adds the pages of
   tests/fixtures/url-starting-with-the-subpath/content: a French home page
   whose only button declares a url relative to the site root that starts
   with the same word as the subpath, url = '/portfolio/galerie/', and the
   page it points to, published at that address from the site root
   (url = '/portfolio/galerie/' in its front matter). */
export const SITE_UNDER_PORTFOLIO_WITH_A_URL_STARTING_WITH_THE_SUBPATH = testSite(
  'url-starting-with-the-subpath',
  { subpath: '/portfolio/' },
);

/* The example site's author name and hero title are made of short words:
   this site changes author, whose compound last name has more than 12
   characters, and replaces the French home page with the one of
   tests/fixtures/hero-with-long-words/content, titled
   "Horlogère-restauratrice" (see tests/fixtures/hero-with-long-words/hugo.toml). */
export const SITE_WITH_A_HERO_WITH_LONG_WORDS = testSite('hero-with-long-words');

/* The example site's author is "Jean Exemple", whom the hero title
   displays: this site empties params.author (see
   tests/fixtures/authorless-hero/hugo.toml) and replaces the French
   home page with the one of tests/fixtures/authorless-hero/content,
   with a complete hero. */
export const SITE_WITH_A_HERO_WITHOUT_AUTHOR = testSite('authorless-hero');

/* The example site's French home page has a hero whose every button has a
   single destination: this site replaces that home page with the one of
   tests/fixtures/button-with-two-destinations/content, whose second button
   has a label and declares both url = '#contact' and pageRef = '/projets',
   two valid destinations. */
export const SITE_WITH_A_BUTTON_WITH_URL_AND_PAGE_REF = testSite('button-with-two-destinations');

/* The component catalog: the example site, plus the pages of
   tests/fixtures/catalog/content, each of which places one component of the
   theme on its own, as raw HTML (allowed by tests/fixtures/catalog/hugo.toml).
   /fr/scramble-text/ holds a single <scramble-text> whose text is
   "Échappement". */
export const CATALOG_SITE = testSite('catalog');

/* The example site's French home page has a hero with a title, displayed
   after the author name: this site replaces that home page with the one of
   tests/fixtures/untitled-hero/content, whose hero has a tagline but no
   title, so that its main heading holds the author name only. */
export const SITE_WITH_A_HERO_WITHOUT_TITLE = testSite('untitled-hero');

/* The example site's default language is French, which also has the
   smallest weight: this site makes English the default language (see
   tests/fixtures/english-by-default/hugo.toml), while keeping the weights
   fr = 1 and en = 2, so that the default language is the heaviest one. */
export const SITE_WITH_ENGLISH_BY_DEFAULT = testSite('english-by-default');

/* The example site's French main menu has three short links, which fit on a
   single line even in a 320 px wide window: this site replaces that menu
   with six links, "Accueil", "Projets", "Parcours", "Compétences",
   "Publications" and "Contact", too long for a single line at 320 px (see
   tests/fixtures/long-menu/hugo.toml). */
export const SITE_WITH_A_LONG_MENU = testSite('long-menu');

/* The example site's French home page declares five clients: this site
   replaces that home page with the one of
   tests/fixtures/other-clients/content, without a hero, which declares
   three other fictional clients, in an order that is not alphabetical:
   "Reliure Marchetti", "Atelier Bonnefoy", "Librairie Castagne". */
export const SITE_WITH_OTHER_CLIENTS = testSite('other-clients');

/* The example site's French home page declares five clients: this site
   replaces that home page with the one of
   tests/fixtures/single-short-client/content, without a hero, which declares
   a single fictional client with a three-letter name, "Oko". */
export const SITE_WITH_A_SINGLE_SHORT_CLIENT = testSite('single-short-client');

/* The example site's French home page declares five clients with names of
   14 to 19 characters: this site replaces that home page with the one of
   tests/fixtures/long-client-names/content, without a hero, which declares
   three fictional clients with names of 36 to 40 characters,
   "Manufacture de porcelaine Vercors-Aubrac", "Fonderie Castellane et fils
   associés" and "Ateliers réunis de lutherie Sainte-Odile", wider together
   than the band on a phone and on a 1280 px desktop. */
export const SITE_WITH_LONG_CLIENT_NAMES = testSite('long-client-names');

/* The example site's French home page has a hero followed by a client band:
   this site replaces that home page with the one of
   tests/fixtures/hero-without-clients/content, with the same hero but
   without params.clients, so that its first screen holds the hero alone. */
export const SITE_WITH_A_HERO_WITHOUT_CLIENTS = testSite('hero-without-clients');

/* The example site's French home page declares five clients whose names
   are made of short words: this site replaces that home page with the one
   of tests/fixtures/one-word-client-name/content, without a hero, which
   declares two fictional clients, "Kunstschmiedewerkstattgenossenschaft",
   a single word of 36 letters, without space or hyphen, wider than the
   band of a 320 px phone, and "Atelier Bonnefoy". */
export const SITE_WITH_A_ONE_WORD_CLIENT_NAME = testSite('one-word-client-name');

/* The example site's French home page declares its clients as a list: this
   site replaces that home page with the one of
   tests/fixtures/text-instead-of-list/content, without a hero, whose
   params.clients is a text, 'Maison Delorme', instead of a list of names. Its
   folder name avoids the word clients, which the error-message assertion
   looks for. */
export const SITE_WITH_CLIENTS_AS_TEXT = testSite('text-instead-of-list');

/* The example site's French home page declares its clients as a list of
   names: this site replaces that home page with the one of
   tests/fixtures/map-instead-of-name/content, without a hero, whose
   params.clients is a list, as expected, but whose second entry is a table,
   { name = 'Maison Delorme' }, instead of a name. Its folder name avoids
   the word clients, which the error-message assertion looks for. */
export const SITE_WITH_A_CLIENT_AS_MAP = testSite('map-instead-of-name');

/* The example site's French home page declares its clients as a list of
   names: this site replaces that home page with the one of
   tests/fixtures/empty-name/content, without a hero, whose params.clients
   is a list of texts, as expected, but whose second entry is an empty
   text, '', instead of a name. Its folder name avoids the word clients,
   which the error-message assertion looks for. */
export const SITE_WITH_AN_EMPTY_CLIENT_NAME = testSite('empty-name');

/* Same as SITE_WITH_AN_EMPTY_CLIENT_NAME, with the home page of
   tests/fixtures/whitespace-only-name/content, whose second entry is a
   text made of three spaces only, '   ', instead of a name. */
export const SITE_WITH_A_WHITESPACE_ONLY_CLIENT_NAME = testSite('whitespace-only-name');

/* The example site's French home page features four projects: this site
   replaces that home page with the one of
   tests/fixtures/other-projects/content, without a hero nor clients, which
   features three other fictional projects, added under projets/, in an
   order that is neither alphabetical nor reverse alphabetical: "Coucou de
   la Forêt-Noire", "Baromètre à mercure", "Chronomètre de marine". The
   barometer's page declares a title and a description only, without role,
   years nor stack. The marine chronometer has no detail page: its page
   declares [build] render = 'never', so that Hugo publishes nothing at
   /fr/projets/chronometre-marine/. */
export const SITE_WITH_OTHER_PROJECTS = testSite('other-projects');

/* The example site's French home page features projects of the projets/
   section: this site replaces that home page with the one of
   tests/fixtures/projects-in-another-section/content, without a hero nor
   clients, which features a single fictional project, "Pendule de voyage",
   added in another section, realisations/, titled "Réalisations" and
   published at /fr/realisations/. The example site's projets/ section is
   still built. */
export const SITE_WITH_PROJECTS_IN_ANOTHER_SECTION = testSite('projects-in-another-section');

/* The example site's French home page features only projects whose pages
   exist: this site replaces that home page with the one of
   tests/fixtures/featured-ref-without-page/content, without a hero nor
   clients, which features an existing project, 'projets/restauration-pendule',
   then 'projets/sablier-introuvable', a page that does not exist. Its folder
   name avoids that slug, which the error-message assertion looks for. */
export const SITE_WITH_A_FEATURED_PROJECT_NOT_FOUND = testSite('featured-ref-without-page');

/* The example site's featured projects each set their own [build] options, if any: this site
   replaces the French home page with the one of
   tests/fixtures/section-without-detail-pages/content, without a hero nor clients, which
   features the example site's 'projets/restauration-pendule', then "Régulateur de parquet",
   added in another section, esquisses/. That project's page sets no [build] options of its own:
   its section's _index.md declares [cascade.build] render = 'never', so that Hugo publishes
   nothing at /fr/esquisses/regulateur-de-parquet/. */
export const SITE_WITH_A_SECTION_WITHOUT_DETAIL_PAGES = testSite('section-without-detail-pages');

/* The example site's featured projects all have a published page: this site replaces the French
   home page with the one of tests/fixtures/projects-without-published-pages/content, without a
   hero nor clients, which features "Horloge comtoise", the example site's
   'projets/restauration-pendule', then "Sablier de marine", both added under projets/. Neither
   added project has a published page: the clock's declares [build] render = 'link', so that Hugo
   gives it an address, /fr/projets/horloge-comtoise/, but publishes nothing there; the
   hourglass's declares [build] render = false, so that it has no address at all. */
export const SITE_WITH_PROJECTS_WITHOUT_PUBLISHED_PAGES = testSite('projects-without-published-pages');

/* The example site's featured projects all live in a section, projets/: this site replaces the
   French home page with the one of tests/fixtures/project-at-the-root/content, without a hero nor
   clients, which features a single fictional project, "Pendule murale", added at the root of the
   content, outside any section (pendule-murale.md, published at /fr/pendule-murale/). The example
   site's projets/ section is still built. */
export const SITE_WITH_A_PROJECT_AT_THE_CONTENT_ROOT = testSite('project-at-the-root');

/* The example site's featured projects live in a published section, projets/: this site replaces
   the French home page with the one of tests/fixtures/unpublished-projects-section/content,
   without a hero nor clients, which features a single fictional project, "Pendule œil-de-bœuf",
   added in another section, carnets/, whose _index.md declares [cascade.build] render = 'never':
   neither the section nor its project has a published page, so that Hugo publishes nothing at
   /fr/carnets/. */
export const SITE_WITH_AN_UNPUBLISHED_PROJECTS_SECTION = testSite('unpublished-projects-section');

/* Same as SITE_WITH_AN_UNPUBLISHED_PROJECTS_SECTION, with the French home page of
   tests/fixtures/unpublished-section-page/content, which features a single fictional project,
   "Horloge de gare", added in another section, ebauches/, whose _index.md declares a plain
   [build] render = 'never', without cascade: Hugo publishes nothing at /fr/ebauches/, while the
   project's own page is still published, at /fr/ebauches/horloge-de-gare/. */
export const SITE_WITH_AN_UNPUBLISHED_SECTION_PAGE = testSite('unpublished-section-page');

/* The example site's French home page features projects of a single section, projets/: this site
   replaces that home page with the one of tests/fixtures/projects-in-two-sections/content, without
   a hero nor clients, which features the example site's 'projets/restauration-pendule', then
   "Coucou de chalet", added in another section, realisations/, titled "Réalisations". Both
   sections are published, at /fr/projets/ and /fr/realisations/. */
export const SITE_WITH_PROJECTS_IN_TWO_SECTIONS = testSite('projects-in-two-sections');

/* The example site's French home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/single-ref-instead-of-list/content,
   without a hero nor clients, whose params.projects is a text, 'projets/restauration-pendule' (an
   existing page of the example site), instead of a list. Its folder name avoids the word projects,
   which the error-message assertion looks for. */
export const SITE_WITH_PROJECTS_AS_TEXT = testSite('single-ref-instead-of-list');

/* The example site's French home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/table-instead-of-ref/content,
   without a hero nor clients, whose params.projects is a list (so the check that projects is a
   list lets it through) of 'projets/restauration-pendule', then a table,
   { path = 'projets/restauration-pendule' }, instead of a page reference. Its folder name avoids
   the word projects, which the error-message assertion looks for. */
export const SITE_WITH_A_FEATURED_PROJECT_AS_MAP = testSite('table-instead-of-ref');

/* The example site's French home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/empty-ref/content, without a hero
   nor clients, whose params.projects is a list of texts, as expected, of
   'projets/restauration-pendule', then an empty text, '', instead of a page reference. Its folder
   name avoids the word projects, which the error-message assertion looks for. */
export const SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF = testSite('empty-ref');

/* Same as SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF, with the home page of
   tests/fixtures/whitespace-only-ref/content, whose second entry is a text made of three spaces
   only, '   ', instead of a page reference. */
export const SITE_WITH_A_WHITESPACE_ONLY_FEATURED_PROJECT_REF = testSite('whitespace-only-ref');

/* The example site's home pages feature only projects translated in their own language: this site
   replaces the French home page with the one of tests/fixtures/english-only-project/content,
   without a hero nor clients, which features the example site's 'projets/restauration-pendule',
   then 'projets/carillon-westminster', a fictional project, "Westminster chime", added under
   projets/ in English only (carillon-westminster.en.md, without a French page). */
export const SITE_WITH_A_FRENCH_HOME_FEATURING_AN_ENGLISH_ONLY_PROJECT = testSite('english-only-project');

/* The other way round: this site replaces the English home page with the one of
   tests/fixtures/french-only-project/content, without a hero nor clients, which features the
   example site's 'projets/restauration-pendule', then 'projets/horloge-morbier', a fictional
   project, "Horloge de Morbier", added under projets/ in French only (horloge-morbier.md, without
   an English page). The example site's French home page is unchanged. */
export const SITE_WITH_AN_ENGLISH_HOME_FEATURING_A_FRENCH_ONLY_PROJECT = testSite('french-only-project');

/* The example site's French home page features only published projects: this site replaces that
   home page with the one of tests/fixtures/draft-ref/content, without a hero nor clients, which
   features the example site's 'projets/restauration-pendule', then 'projets/pendule-portique', a
   fictional project, "Pendule portique", added under projets/ in French only, whose page declares
   draft = true: the production build leaves it out. Its folder name avoids that slug and the
   French words for a draft, a future date and an expired page, which the error-message assertions
   look for. */
export const SITE_WITH_A_DRAFT_FEATURED_PROJECT = testSite('draft-ref');

/* The example site's featured projects declare short years, such as '2019 – 2020': this site
   replaces the French home page with the one of tests/fixtures/long-project-years/content, without
   a hero nor clients, which features the example site's 'projets/restauration-pendule', then
   "Pendule de voyage", a fictional project added under projets/ in French only, whose page
   declares years = '1998 – 2003, puis 2011 – 2014, puis de 2019 à aujourd’hui', made of short
   words but wider on one line than a phone-sized card. */
export const SITE_WITH_LONG_PROJECT_YEARS = testSite('long-project-years');

/* The example site's featured projects declare roles, descriptions and stacks made of short
   words: this site replaces the French home page with the one of
   tests/fixtures/long-project-words/content, without a hero nor clients, which features the
   example site's 'projets/restauration-pendule', then "Pendule aux mots longs", a fictional
   project added under projets/ in French only, whose role, description and stack each hold a
   single word, without a hyphen nor a space, wider than a phone-sized card. */
export const SITE_WITH_LONG_PROJECT_WORDS = testSite('long-project-words');

/* Hugo only reads a configuration from a file: the one that mounts the
   fixture's content is written to a separate temporary directory, so that
   it does not end up among the built pages, and removed after the build. */
function withSiteConfiguration<T>(site: BuiltSite, build: (configuration: string) => T): T {
  const directory = mkdtempSync(path.join(tmpdir(), `${site.directoryPrefix}configuration-`));
  try {
    const files = ['hugo.toml', ...fixtureContentMount(site, directory), ...fixtureConfiguration(site)];
    return build(files.join(','));
  } finally {
    removeDirectory(directory);
  }
}

function fixtureContentMount(site: BuiltSite, configurationDirectory: string): string[] {
  const content = path.join(site.fixture, 'content');
  if (!existsSync(content)) return [];
  const file = path.join(configurationDirectory, 'content.json');
  /* The first mount wins over the second for a page with the same path. */
  const mounts = [
    { source: content, target: 'content' },
    { source: 'content', target: 'content' },
  ];
  writeFileSync(file, JSON.stringify({ module: { mounts } }));
  return [file];
}

function fixtureConfiguration(site: BuiltSite): string[] {
  const file = path.join(site.fixture, 'hugo.toml');
  return existsSync(file) ? [file] : [];
}

function buildArguments(site: BuiltSite, configuration: string, destination: string): string[] {
  return [
    'build',
    '--source', 'exampleSite',
    '--config', configuration,
    '--environment', 'production',
    '--baseURL', `${site.origin}${site.subpath}`,
    '--destination', destination,
    '--noBuildLock',
  ];
}

function createBuildDirectory(site: BuiltSite): string {
  return mkdtempSync(path.join(tmpdir(), site.directoryPrefix));
}

/* The built directory is handed to the test, which removes it with
   removeDirectory; if the build fails, it is removed here, before the error
   propagates. */
export function buildSite(site: BuiltSite): string {
  const destination = createBuildDirectory(site);
  try {
    withSiteConfiguration(site, (configuration) =>
      execFileSync('hugo', [...buildArguments(site, configuration, destination), '--quiet'], {
        cwd: themeRoot,
        stdio: 'pipe',
      }),
    );
  } catch (error) {
    removeDirectory(destination);
    throw error;
  }
  return destination;
}

export interface BuildAttempt {
  succeeded: boolean;
  /* What Hugo writes to its standard error: its error messages. */
  errors: string;
}

/* A stuck Hugo must not hang the test with it: past this delay, it is
   killed, and the attempt throws. */
const MAX_BUILD_DURATION_IN_MS = 60_000;

/* Runs Hugo with the given arguments and returns its result, whatever its
   exit code. If Hugo does not exit normally (cannot be started,
   MAX_BUILD_DURATION_IN_MS exceeded, killed by a signal), it throws, so that
   a test does not read a truncated output as a real one. */
function runHugo(hugoArguments: string[]): SpawnSyncReturns<string> {
  const result = spawnSync('hugo', hugoArguments, {
    cwd: themeRoot,
    encoding: 'utf8',
    timeout: MAX_BUILD_DURATION_IN_MS,
  });
  if (result.error || result.signal) {
    throw new Error(
      `Hugo did not exit normally (signal: ${result.signal ?? 'none'})` +
        (result.error ? `: ${result.error.message}` : ''),
      { cause: result.error },
    );
  }
  return result;
}

/* Builds the site like buildSite, but without throwing if the build fails,
   to observe what Hugo tells the person building the site about it. Without
   --quiet, which would silence its error messages; --logLevel error keeps
   only the errors. Only a normal exit of Hugo counts: succeeded is true if
   it exits with code 0, false with any other code. If it does not exit
   normally, the attempt throws (see runHugo), so that a test expecting the
   build to fail does not pass for the wrong reason. The temporary directory
   is removed in every case. */
export function tryToBuildSite(site: BuiltSite): BuildAttempt {
  const destination = createBuildDirectory(site);
  try {
    const result = withSiteConfiguration(site, (configuration) =>
      runHugo([...buildArguments(site, configuration, destination), '--logLevel', 'error']),
    );
    return { succeeded: result.status === 0, errors: result.stderr };
  } finally {
    removeDirectory(destination);
  }
}

/* Builds the example site as it is, without a fixture, asking Hugo to warn
   about every translation key a page uses that a language lacks
   (--printI18nWarnings), and returns those warnings, one per missing key and
   language, as Hugo words them ("i18n|MISSING_TRANSLATION|en|someKey").
   Like tryToBuildSite, it throws if Hugo does not exit normally, and also if
   the build fails, so that an empty list always means a complete build. */
export function findMissingTranslations(): string[] {
  const destination = mkdtempSync(path.join(tmpdir(), 'oc-portfolio-translations-'));
  try {
    const result = runHugo([
      'build',
      '--source', 'exampleSite',
      '--environment', 'production',
      '--destination', destination,
      '--noBuildLock',
      '--printI18nWarnings',
      '--logLevel', 'warn',
    ]);
    if (result.status !== 0) {
      throw new Error(`Hugo did not build the example site (exit code: ${result.status}):\n${result.stderr}`);
    }
    return `${result.stdout}\n${result.stderr}`
      .split('\n')
      .filter((line) => line.includes('i18n|MISSING_TRANSLATION'))
      .map((line) => line.slice(line.indexOf('i18n|')).trim());
  } finally {
    removeDirectory(destination);
  }
}

/* Tests that only run hugo build, without a browser: running them in every
   Playwright project would repeat the same build five times. */
const BUILD_TESTS_PROJECT = 'chromium';

/* Called inside a test.describe of such tests, runs them in BUILD_TESTS_PROJECT
   only and skips them in the other projects. */
export function runBuildTestsInOneProjectOnly(): void {
  test.skip(
    () => test.info().project.name !== BUILD_TESTS_PROJECT,
    `build without a browser, identical in every project: run in ${BUILD_TESTS_PROJECT} only`,
  );
}

export function removeDirectory(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}

/* Only the addresses under the site's subpath are served: Hugo writes the
   pages at the root of the built directory, the subpath only appearing in
   their addresses. */
export async function serveSite(context: BrowserContext, site: BuiltSite, directory: string): Promise<void> {
  await context.route(`${site.origin}${site.subpath}**`, async (route) => {
    const address = decodeURIComponent(new URL(route.request().url()).pathname);
    const relativePath = `/${address.slice(site.subpath.length)}`;
    let file = path.join(directory, relativePath);
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    /* The separator rules out a sibling directory whose name starts like the site's. */
    if (!file.startsWith(directory + path.sep) || !existsSync(file)) {
      await route.fulfill({ status: 404, body: 'Not found' });
      return;
    }
    await route.fulfill({ path: file });
  });
}
