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

/* The ports and addresses of the two Hugo servers of playwright.config.ts,
   which starts them from these. The first serves the example site at the
   baseURL, where the tests open its pages by their path alone ('/fr/'); the
   second serves it under a subdirectory, /portfolio/. */
export const EXAMPLE_SITE_PORT = 1314;
export const EXAMPLE_SITE = `http://localhost:${EXAMPLE_SITE_PORT}`;
export const EXAMPLE_SITE_UNDER_PORTFOLIO_PORT = EXAMPLE_SITE_PORT + 1;
export const EXAMPLE_SITE_UNDER_PORTFOLIO = `http://localhost:${EXAMPLE_SITE_UNDER_PORTFOLIO_PORT}/portfolio/`;

/* Each test site has its own origin, hence its own port: ports are assigned
   in the order the sites are declared below, after those of the Hugo
   servers of playwright.config.ts. */
const FIRST_TEST_SITE_PORT = EXAMPLE_SITE_UNDER_PORTFOLIO_PORT + 1;
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

/* The example site's English home page has a hero whose every button leads
   to an existing page or to an address: this site replaces that home page
   with the one of tests/fixtures/english-home-page-ref-not-found/content,
   where a button declares pageRef = '/imaginary-missing-page', a page that
   does not exist. */
export const SITE_WITH_AN_ENGLISH_HOME_PAGE_REF_NOT_FOUND = testSite('english-home-page-ref-not-found');

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
export const SITE_UNDER_PORTFOLIO_WITH_A_URL_STARTING_WITH_THE_SUBPATH = testSite('url-starting-with-the-subpath', {
  subpath: '/portfolio/',
});

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

/* The example site's French home page writes its hero tagline as a list of texts, one per line:
   this site replaces that home page with the one of tests/fixtures/motto-as-text/content, without
   clients nor projects, whose hero declares a fictional gilder's title and her tagline as a single
   text, 'Dorure à la feuille et restauration de cadres anciens, à Avignon.', rather than a list.
   Its folder name avoids the words hero, tagline and list, which the error-message assertion
   looks for. */
export const SITE_WITH_A_HERO_TAGLINE_AS_A_TEXT = testSite('motto-as-text');

/* Same as SITE_WITH_A_HERO_TAGLINE_AS_A_TEXT, with the home page of
   tests/fixtures/empty-text-instead-of-motto/content, whose hero declares tagline = '', an empty
   text, instead of a list of lines, and with that of tests/fixtures/false-instead-of-motto/content,
   whose hero declares tagline = false. Their folder names avoid the words hero, tagline and list,
   which the error-message assertions look for, and the language codes. */
export const SITE_WITH_A_HERO_TAGLINE_AS_AN_EMPTY_TEXT = testSite('empty-text-instead-of-motto');
export const SITE_WITH_A_HERO_TAGLINE_AS_FALSE = testSite('false-instead-of-motto');

/* The example site's French home page writes its hero stack as a list of texts: this site
   replaces that home page with the one of tests/fixtures/materials-as-text/content, without
   clients nor projects, whose hero declares a fictional ironworker's title, a one-line tagline
   and her stack as a single text, 'Laiton, Acier', rather than a list. Its folder name avoids
   the words hero, stack and list, which the error-message assertion looks for, and the
   language codes. */
export const SITE_WITH_A_HERO_STACK_AS_A_TEXT = testSite('materials-as-text');

/* The example site's French home page writes its hero title as a single text: this site replaces
   that home page with the one of tests/fixtures/two-trades-heading/content, without clients nor
   projects, whose hero declares a fictional watchmaker's title as a list of two texts,
   ['Horloger', 'Graveur'], rather than a single text, with a valid tagline and stack. Its folder
   name avoids the words hero, title and text, which the error-message assertion looks for, and
   the language codes. */
export const SITE_WITH_A_HERO_TITLE_AS_A_LIST = testSite('two-trades-heading');

/* The example site's French home page has a hero whose every button has a
   single destination: this site replaces that home page with the one of
   tests/fixtures/button-with-two-destinations/content, whose second button
   has a label and declares both url = '#contact' and pageRef = '/projets',
   two valid destinations. */
export const SITE_WITH_A_BUTTON_WITH_URL_AND_PAGE_REF = testSite('button-with-two-destinations');

/* The example site's French home page has a hero whose every button has a single
   destination: these sites replace that home page with the one of
   tests/fixtures/address-and-unfilled-target/content, whose second button has a label and
   declares both url = '#contact' and pageRef = '', an empty text, and with the one of
   tests/fixtures/address-and-false-target/content, whose second button declares both
   url = '#contact' and pageRef = false: two pageRef values that Hugo reads as false. Their
   folder names avoid the words url, pageRef, both and one, which the error-message assertion
   looks for. */
export const SITE_WITH_A_BUTTON_WITH_URL_AND_EMPTY_PAGE_REF = testSite('address-and-unfilled-target');
export const SITE_WITH_A_BUTTON_WITH_URL_AND_FALSE_PAGE_REF = testSite('address-and-false-target');

/* The example site's French home page has a hero whose every pageRef is a
   text, a page reference: these sites replace that home page with the one of
   tests/fixtures/table-as-button-target/content, whose first button declares
   a table, pageRef = { path = '/projets' }, and with the one of
   tests/fixtures/number-as-button-target/content, whose first button
   declares a number, pageRef = 42. Their folder names also avoid the words
   pageRef and page reference, which the error-message assertion looks for,
   and hero, whose error messages are counted. */
export const SITE_WITH_A_PAGE_REF_AS_TABLE = testSite('table-as-button-target');
export const SITE_WITH_A_PAGE_REF_AS_NUMBER = testSite('number-as-button-target');

/* The example site's French home page has a hero whose every pageRef is a text, a page
   reference: these sites replace that home page with the one of
   tests/fixtures/empty-table-as-button-target/content, whose first button declares an empty
   table, pageRef = {}, of tests/fixtures/empty-list-as-button-target/content, an empty list,
   pageRef = [], of tests/fixtures/zero-as-button-target/content, the number zero, pageRef = 0,
   and of tests/fixtures/false-as-button-target/content, the boolean false, pageRef = false:
   four values that are not texts and that Hugo reads as false. Their folder names also avoid
   the words pageRef and page reference, which the error-message assertion looks for, and
   hero, whose error messages are counted. */
export const SITE_WITH_A_PAGE_REF_AS_AN_EMPTY_TABLE = testSite('empty-table-as-button-target');
export const SITE_WITH_A_PAGE_REF_AS_AN_EMPTY_LIST = testSite('empty-list-as-button-target');
export const SITE_WITH_A_PAGE_REF_AS_ZERO = testSite('zero-as-button-target');
export const SITE_WITH_A_PAGE_REF_AS_FALSE = testSite('false-as-button-target');

/* The example site's French home page has a hero whose every pageRef is written without
   whitespace around it: these sites replace that home page with the one of
   tests/fixtures/button-target-with-trailing-space/content, whose first button declares
   pageRef = '/projets ', with a trailing space, and with the one of
   tests/fixtures/button-target-with-leading-tab/content, whose first button declares
   pageRef = "\t/projets", with a leading tab: '/projets' exists, but Hugo does not trim the
   whitespace. Their folder names avoid the word whitespace, which the error-message assertion
   looks for, and hero, whose error messages are counted. */
export const SITE_WITH_A_PAGE_REF_WITH_A_TRAILING_SPACE = testSite('button-target-with-trailing-space');
export const SITE_WITH_A_PAGE_REF_WITH_A_LEADING_TAB = testSite('button-target-with-leading-tab');

/* The example site's French home page has a hero whose every pageRef names a page: this site
   replaces that home page with the one of tests/fixtures/button-target-of-spaces-only/content,
   whose first button declares pageRef = " \t ", a space, a tab and a space, and nothing else.
   Its folder name avoids the words empty and blank, which the error-message assertion looks
   for, and hero, whose error messages are counted. */
export const SITE_WITH_A_WHITESPACE_ONLY_PAGE_REF = testSite('button-target-of-spaces-only');

/* The example site's French home page has a hero whose every pageRef names a page: this site
   replaces that home page with the one of tests/fixtures/button-target-left-unfilled/content,
   whose first button declares pageRef = '', an empty text. Its folder name avoids the words
   empty and blank, which the error-message assertion looks for, and hero, whose error messages
   are counted. */
export const SITE_WITH_AN_EMPTY_PAGE_REF = testSite('button-target-left-unfilled');

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

/* The example site's English home page declares its clients as a list: this site replaces that
   home page with the one of tests/fixtures/english-home-lone-name/content, without a hero, whose
   params.clients is a text, 'Maison Delorme', instead of a list of names. The example site's
   French home page is unchanged. Its folder name avoids the words clients and list and the
   language codes, which the error-message assertions look for. */
export const SITE_WITH_AN_ENGLISH_HOME_WITH_CLIENTS_AS_TEXT = testSite('english-home-lone-name');

/* The example site's French home page declares its clients as a list of
   names: this site replaces that home page with the one of
   tests/fixtures/map-instead-of-name/content, without a hero, whose
   params.clients is a list, as expected, but whose second entry is a table,
   { name = 'Maison Delorme' }, instead of a name, and so is its fourth,
   { name = 'Librairie Vasseur' }. Its folder name avoids the word clients,
   which the error-message assertion looks for. */
export const SITE_WITH_A_CLIENT_AS_MAP = testSite('map-instead-of-name');

/* The example site's French home page declares its clients as a list of
   names: this site replaces that home page with the one of
   tests/fixtures/empty-name/content, without a hero, whose params.clients
   is a list of texts, as expected, but whose second entry is an empty
   text, '', instead of a name. Its folder name avoids the word clients,
   which the error-message assertion looks for. */
export const SITE_WITH_AN_EMPTY_CLIENT_NAME = testSite('empty-name');

/* Same as SITE_WITH_AN_EMPTY_CLIENT_NAME, with the home page of
   tests/fixtures/whitespace-only-name/content, whose third entry, after
   two names, is a text made of three spaces only, '   ', instead of a
   name. */
export const SITE_WITH_A_WHITESPACE_ONLY_CLIENT_NAME = testSite('whitespace-only-name');

/* Same as SITE_WITH_CLIENTS_AS_TEXT, with the home page of
   tests/fixtures/empty-text-instead-of-names/content, whose params.clients is an empty text, '',
   instead of a list of names, and with that of tests/fixtures/false-instead-of-names/content,
   whose params.clients is the boolean false. Their folder names avoid the words clients and list
   and the language codes, which the error-message assertions look for. */
export const SITE_WITH_CLIENTS_AS_AN_EMPTY_TEXT = testSite('empty-text-instead-of-names');
export const SITE_WITH_CLIENTS_AS_FALSE = testSite('false-instead-of-names');

/* The example site's French home page declares its clients under [params]: this site replaces
   that home page with the one of tests/fixtures/clientele-dans-la-banniere/content, whose hero is
   well filled in but whose clients key, a list of two names, is written after the [params.hero]
   header, under the hero's stack, so that TOML puts it in params.hero.clients instead of
   params.clients. Its folder name avoids the words clients, params, hero and before and the
   language codes, which the error-message assertions look for. */
export const SITE_WITH_CLIENTS_UNDER_THE_HERO = testSite('clientele-dans-la-banniere');

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
   section, where featured projects must live: this site replaces that home
   page with the one of tests/fixtures/projects-in-another-section/content,
   without a hero nor clients, which features a single fictional project,
   'realisations/pendule-de-voyage', added in another section, realisations/,
   titled "Réalisations" and published at /fr/realisations/. The example
   site's projets/ section is still built. */
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

/* The example site's featured projects all live in a section, projets/, where featured projects
   must live: this site replaces the French home page with the one of
   tests/fixtures/project-at-the-root/content, without a hero nor clients, which features a single
   fictional project, 'pendule-murale', added at the root of the content, outside any section
   (pendule-murale.md). Its folder name avoids that slug, which the error-message assertion looks
   for. */
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

/* The example site's French home page features projects of the projets/ section alone, where
   featured projects must live: this site replaces that home page with the one of
   tests/fixtures/projects-in-two-sections/content, without a hero nor clients, which features the
   example site's 'projets/restauration-pendule', then 'realisations/coucou-de-chalet', added in
   another section, realisations/, titled "Réalisations". Both sections are published, at
   /fr/projets/ and /fr/realisations/. */
export const SITE_WITH_PROJECTS_IN_TWO_SECTIONS = testSite('projects-in-two-sections');

/* The example site's French home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/single-ref-instead-of-list/content,
   without a hero nor clients, whose params.projects is a text, 'projets/restauration-pendule' (an
   existing page of the example site), instead of a list. Its folder name avoids the word projects,
   which the error-message assertion looks for. */
export const SITE_WITH_PROJECTS_AS_TEXT = testSite('single-ref-instead-of-list');

/* The example site's English home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/english-home-single-ref/content,
   without a hero nor clients, whose params.projects is a text, 'projets/restauration-pendule',
   instead of a list. The example site's French home page is unchanged. Its folder name avoids the
   words projects and list and the language codes, which the error-message assertions look for. */
export const SITE_WITH_AN_ENGLISH_HOME_WITH_PROJECTS_AS_TEXT = testSite('english-home-single-ref');

/* Same as SITE_WITH_PROJECTS_AS_TEXT, with the home page of
   tests/fixtures/empty-text-instead-of-list/content, whose params.projects is an empty text, '',
   instead of a list. */
export const SITE_WITH_PROJECTS_AS_AN_EMPTY_TEXT = testSite('empty-text-instead-of-list');

/* Same as SITE_WITH_PROJECTS_AS_TEXT, with the home page of
   tests/fixtures/false-instead-of-list/content, whose params.projects is the boolean false
   instead of a list. */
export const SITE_WITH_PROJECTS_AS_FALSE = testSite('false-instead-of-list');

/* The example site's French home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/table-instead-of-ref/content,
   without a hero nor clients, whose params.projects is a list (so the check that projects is a
   list lets it through) of 'projets/restauration-pendule', then a table,
   { path = 'projets/restauration-pendule' }, instead of a page reference, then
   'projets/montre-grande-complication', then another table,
   { path = 'projets/montre-grande-complication' }. Its folder name avoids the word projects,
   which the error-message assertion looks for. */
export const SITE_WITH_A_FEATURED_PROJECT_AS_MAP = testSite('table-instead-of-ref');

/* The example site's French home page features its projects as a list of page references: this
   site replaces that home page with the one of tests/fixtures/empty-ref/content, without a hero
   nor clients, whose params.projects is a list of texts, as expected, of
   'projets/restauration-pendule', then an empty text, '', instead of a page reference. Its folder
   name avoids the word projects, which the error-message assertion looks for. */
export const SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF = testSite('empty-ref');

/* Same as SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF, with the home page of
   tests/fixtures/whitespace-only-ref/content, whose third entry, after
   'projets/restauration-pendule' and 'projets/montre-grande-complication', is a text made of
   three spaces only, '   ', instead of a page reference. */
export const SITE_WITH_A_WHITESPACE_ONLY_FEATURED_PROJECT_REF = testSite('whitespace-only-ref');

/* Same as SITE_WITH_AN_EMPTY_FEATURED_PROJECT_REF, with the home page of
   tests/fixtures/padded-ref/content, whose two entries reference existing pages of the example
   site but with whitespace Hugo does not trim: a trailing space, 'projets/restauration-pendule ',
   then a leading tab, "\tprojets/montre-grande-complication". Its folder name avoids the word
   whitespace, which the error-message assertion looks for. */
export const SITE_WITH_FEATURED_PROJECT_REFS_PADDED_WITH_WHITESPACE = testSite('padded-ref');

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

/* The example site's featured projects declare roles, descriptions and stacks made of short
   words: this site replaces the French home page with the one of
   tests/fixtures/long-project-words/content, without a hero nor clients, which features the
   example site's 'projets/restauration-pendule', then "Pendule aux mots longs", a fictional
   project added under projets/ in French only, whose role, description and stack each hold a
   single word, without a hyphen nor a space, wider than a phone-sized card. */
export const SITE_WITH_LONG_PROJECT_WORDS = testSite('long-project-words');

/* The example site's featured projects all declare years: this site replaces the French home
   page with the one of tests/fixtures/long-project-title-without-years/content, without a hero
   nor clients, which features the example site's 'projets/restauration-pendule', then a
   fictional project added under projets/ in French only, whose page declares no years, and a
   title and a description that each hold a single word, without a hyphen nor a space, wider
   than a phone-sized card. */
export const SITE_WITH_A_LONG_PROJECT_TITLE_WITHOUT_YEARS = testSite('long-project-title-without-years');

/* The example site's featured projects set no [build] options: this site replaces the French home
   page with the one of tests/fixtures/unusual-render-values/content, without a hero nor clients,
   which features "Horloge à poids", "Pendulette d’officier", "Montre de gousset" and "Carillon de
   bureau", all added under projets/ in French only. The first page declares [build] render =
   'Always', capitalised, the second [build] render = 'nevr', a typo: Hugo recognises neither and
   treats a value it does not recognise as 'always', so that it publishes both pages, at
   /fr/projets/horloge-a-poids/ and /fr/projets/pendulette-officier/. The third declares [build]
   render = 0, an integer, which Hugo reads as 'never': it publishes nothing at
   /fr/projets/montre-gousset/. The fourth declares [build] render = 'false', a quoted string
   rather than the boolean: Hugo does not recognise it either, and publishes the page at
   /fr/projets/carillon-de-bureau/. */
export const SITE_WITH_UNUSUAL_RENDER_VALUES = testSite('unusual-render-values');

/* The example site's featured projects declare no custom param named build: this site replaces
   the French home page with the one of tests/fixtures/build-param-as-text/content, without a hero
   nor clients, which features the example site's 'projets/restauration-pendule', then "Pendule
   squelette", a fictional project added under projets/ in French only, whose page sets no [build]
   options but declares, under [params], a custom param build = '2020', a text. Hugo publishes that
   page as any other, at /fr/projets/pendule-squelette/. */
export const SITE_WITH_A_BUILD_PARAM_AS_TEXT = testSite('build-param-as-text');

/* Same as SITE_WITH_A_BUILD_PARAM_AS_TEXT, for the English home page: this site replaces that home
   page with the one of tests/fixtures/english-home-year-param/content, without a hero nor clients,
   which features the example site's 'projets/restauration-pendule', then "Skeleton clock", a
   fictional project added under projets/ in English only, whose page sets no [build] options but
   declares, under [params], a custom param build = '2020', a text. The example site's French home
   page is unchanged. Its folder name avoids the word build and the language codes, which the
   error-message assertions look for. */
export const SITE_WITH_AN_ENGLISH_HOME_FEATURING_A_BUILD_PARAM_AS_TEXT = testSite('english-home-year-param');

/* The example site's featured projects declare their stack as a list: this site replaces the
   French home page with the one of tests/fixtures/card-materials-as-text/content, without a hero
   nor clients, which features the example site's 'projets/restauration-pendule', then "Lanterne
   forgée", a fictional project added under projets/ in French only, whose page writes, under
   [params], its stack as a single text, stack = 'Laiton, Acier', rather than a list. Its folder
   name avoids the words stack, list and projects, and the language codes, which the
   error-message assertions look for. */
export const SITE_WITH_A_PROJECT_STACK_AS_A_TEXT = testSite('card-materials-as-text');

/* The example site's French home page features only project pages: this site replaces that home
   page with the one of tests/fixtures/self-ref/content, without a hero nor clients, whose
   params.projects is a list of texts, as expected, of 'projets/restauration-pendule', then '/', a
   reference to the home page itself, which exists but is no project. Its folder name avoids the
   word projects, which the error-message assertion looks for. */
export const SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT = testSite('self-ref');

/* Same as SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT, with the home page of
   tests/fixtures/dot-self-ref/content, whose second entry is '.', the current page, that is the
   home page itself, rather than '/'. */
export const SITE_WITH_THE_HOME_PAGE_AS_FEATURED_PROJECT_WRITTEN_AS_A_DOT = testSite('dot-self-ref');

/* The example site's French home page features only project pages: this site replaces that home
   page with the one of tests/fixtures/section-ref/content, without a hero nor clients, whose
   params.projects is a list of texts, as expected, of 'projets/restauration-pendule', then
   'projets', a reference to the example site's projects section itself, which exists but is a
   section page, no project. Its folder name avoids the word projects, which the error-message
   assertion looks for. */
export const SITE_WITH_A_SECTION_AS_FEATURED_PROJECT = testSite('section-ref');

/* The example site disables the taxonomy and term kinds, which the theme itself does not: this
   site enables them again (tests/fixtures/taxonomy-refs/hugo.toml), with Hugo's default tags
   taxonomy, adds under projets/, in French only, a fictional project, "Pendule étiquetée", that
   carries the tag 'horlogerie', and replaces the French home page with the one of
   tests/fixtures/taxonomy-refs/content, without a hero nor clients, whose params.projects is a
   list of texts, as expected, of 'projets/restauration-pendule', then 'tags/horlogerie', a
   reference to the page of that tag, a taxonomy term page, then 'tags', a reference to the page
   listing every tag, a taxonomy page: both exist, but neither is a project. Its folder name
   avoids the word projects, which the error-message assertion looks for. */
export const SITE_WITH_TAXONOMY_PAGES_AS_FEATURED_PROJECTS = testSite('taxonomy-refs');

/* The example site's French home page features only project pages: this site replaces that home
   page with the one of tests/fixtures/error-page-ref/content, without a hero nor clients, whose
   params.projects is a list of texts, as expected, of 'projets/restauration-pendule', then '/404',
   a reference to the site's 404 page, which Hugo creates even without a 404 template, so that it
   exists, but is no project. Its folder name avoids the word projects and the number 404, which
   the error-message assertions look for. */
export const SITE_WITH_THE_404_PAGE_AS_FEATURED_PROJECT = testSite('error-page-ref');

/* The example site's French home page has a hero whose every button leads to a published page or
   to an address: this site replaces that home page with the one of
   tests/fixtures/never-rendered-ref/content, whose first button declares pageRef =
   '/atelier-ferme', and adds that page, which exists but declares [build] render = 'never', so
   that Hugo publishes nothing for it. Its folder name and that page reference avoid the French
   word for published, which the error-message assertion looks for. */
export const SITE_WITH_A_PAGE_REF_TO_AN_UNPUBLISHED_PAGE = testSite('never-rendered-ref');

/* Same home page replacement, from tests/fixtures/link-rendered-ref/content, whose first button
   declares pageRef = '/atelier-vitrine', and adds that page, which declares
   [build] render = 'link': Hugo gives it an address, but writes no page there. Its folder name and
   that page reference avoid the French word for published, which the error-message assertion
   looks for. */
export const SITE_WITH_A_PAGE_REF_TO_A_LINK_ONLY_PAGE = testSite('link-rendered-ref');

/* The example site's English home page features only project pages, each as a page reference:
   this site replaces that home page with the one of tests/fixtures/english-home-bad-entries/content,
   without a hero nor clients, whose params.projects is a list (so the check that projects is a list
   lets it through) of four bad entries, one of each kind: a table,
   { path = 'projets/restauration-pendule' }, instead of a page reference, as entry 1; an empty
   text, '', as entry 2; 'projets/montre-grande-complication ', an existing page with a trailing
   space Hugo does not trim, as entry 3; and 'projets', the projects section itself, which exists
   but is no project, as entry 4. The example site's French home page is unchanged. Its folder name
   avoids the words projects and whitespace and the language codes, which the error-message
   assertions look for. */
export const SITE_WITH_AN_ENGLISH_HOME_FEATURING_BAD_ENTRIES = testSite('english-home-bad-entries');

/* The example site's French home page features its projects under [params]: this site replaces
   that home page with the one of tests/fixtures/featured-list-in-the-banner/content, without
   clients, whose projects key is written after the [params.hero] header, under the hero's title,
   so that TOML puts it in params.hero.projects instead of params.projects. Its folder name avoids
   the words projects, params, hero and before, which the error-message assertions look for. */
export const SITE_WITH_PROJECTS_UNDER_THE_HERO = testSite('featured-list-in-the-banner');

/* The example site's English home page has a hero whose every button is well filled in: this site
   replaces that home page with the one of tests/fixtures/english-home-bad-buttons/content, whose
   seven hero buttons are each filled in wrong, one of each kind: a pageRef that is a table,
   { path = '/projets' }; an empty pageRef, ''; a pageRef with a trailing space, '/projets ';
   pageRef = '/shut-workshop', a page of the same fixture that exists but declares
   [build] render = 'never'; both url = '#contact' and pageRef = '/projets'; a label but neither
   url nor pageRef; and url = '#contact' but no label. The example site's French home page is
   unchanged. Its folder name and that page reference avoid the words label, author, url,
   published and whitespace and the language codes, which the error-message assertions look
   for. */
export const SITE_WITH_AN_ENGLISH_HOME_WITH_BAD_BUTTONS = testSite('english-home-bad-buttons');

/* The example site's French home page has a hero whose two buttons are well filled in: these
   sites replace that home page with one whose bad button is at the other position than in the
   fixtures above, the other button being well filled in. The second button is the bad one in
   tests/fixtures/table-as-second-target/content, whose pageRef is a table,
   { path = '/projets' }; in tests/fixtures/second-target-left-unfilled/content, an empty
   pageRef, ''; in tests/fixtures/second-target-with-trailing-space/content, a pageRef with a
   trailing space, '/projets '; and in tests/fixtures/second-target-never-rendered/content,
   pageRef = '/atelier-clos', a page of the same fixture that exists but declares
   [build] render = 'never'. The first button is the bad one in
   tests/fixtures/first-with-two-destinations/content, with both url = '#contact' and
   pageRef = '/projets'; in tests/fixtures/first-without-destination/content, with a label but
   neither url nor pageRef; and in tests/fixtures/first-button-unnamed/content, with
   pageRef = '/projets' but no label. Their folder names and that page reference avoid the
   words label, author, url, published and whitespace, which the error-message assertions look
   for, and the word button followed by a number, which the position assertion looks for. */
export const SITE_WITH_A_PAGE_REF_AS_TABLE_ON_THE_SECOND_BUTTON = testSite('table-as-second-target');
export const SITE_WITH_AN_EMPTY_PAGE_REF_ON_THE_SECOND_BUTTON = testSite('second-target-left-unfilled');
export const SITE_WITH_A_PAGE_REF_WITH_A_TRAILING_SPACE_ON_THE_SECOND_BUTTON = testSite(
  'second-target-with-trailing-space',
);
export const SITE_WITH_A_PAGE_REF_TO_AN_UNPUBLISHED_PAGE_ON_THE_SECOND_BUTTON =
  testSite('second-target-never-rendered');
export const SITE_WITH_A_FIRST_BUTTON_WITH_URL_AND_PAGE_REF = testSite('first-with-two-destinations');
export const SITE_WITH_A_FIRST_BUTTON_WITHOUT_DESTINATION = testSite('first-without-destination');
export const SITE_WITH_A_FIRST_BUTTON_WITHOUT_LABEL = testSite('first-button-unnamed');

/* The example site's French home page writes its hero buttons as a list of tables,
   [[params.hero.actions]]: these sites replace that home page with one whose buttons are not a
   list. In tests/fixtures/named-button-tables/content, its two buttons are named tables,
   [params.hero.actions.a] and [params.hero.actions.b]; in tests/fixtures/lone-button-table/content,
   its only button is written [params.hero.actions], with single brackets, a table. Their folder
   names avoid the word hero, whose error messages are counted, and the table name the
   error-message assertion looks for. */
export const SITE_WITH_HERO_BUTTONS_AS_NAMED_TABLES = testSite('named-button-tables');
export const SITE_WITH_A_HERO_BUTTON_AS_A_SINGLE_TABLE = testSite('lone-button-table');

/* Same as SITE_WITH_A_HERO_BUTTON_AS_A_SINGLE_TABLE, with the home page of
   tests/fixtures/empty-text-instead-of-links/content, whose hero declares actions = '', an empty
   text, instead of a list of tables, and with that of
   tests/fixtures/false-instead-of-links/content, whose hero declares actions = false. Their
   folder names avoid the word hero, whose error messages are counted, the table name the
   error-message assertion looks for and the language codes. */
export const SITE_WITH_HERO_BUTTONS_AS_AN_EMPTY_TEXT = testSite('empty-text-instead-of-links');
export const SITE_WITH_HERO_BUTTONS_AS_FALSE = testSite('false-instead-of-links');

/* The example site's French home page declares its clients and projects under [params]: this site
   replaces that home page with the one of tests/fixtures/listes-sous-les-liens/content, without
   [params] table, whose hero is well filled in, with two well filled-in buttons, but whose
   clients key, a list of two names, is written under the first [[params.hero.actions]] header,
   and whose projects key, a list of two of the example site's projects, under the second one, so
   that TOML puts them in the first and second buttons' tables instead of params.clients and
   params.projects. Its folder name avoids the words button, clients, projects, params, hero and
   before and the language codes, which the error-message assertions look for. */
export const SITE_WITH_CLIENTS_AND_PROJECTS_UNDER_HERO_BUTTONS = testSite('listes-sous-les-liens');

/* The example site's French home page writes its hero buttons as a list of tables: this site
   replaces that home page with the one of tests/fixtures/lien-ecrit-sans-accolades/content,
   without clients nor projects, whose hero buttons are a TOML array written inline, actions = [...],
   whose first entry is a well filled-in button, an inline table with a label and
   pageRef = '/projets', and whose second entry is a mere text, 'Contact', rather than a table. Its
   folder name avoids the words button, hero, table, must and be, the numbers and the language
   codes, which the error-message assertions look for. */
export const SITE_WITH_A_TEXT_AS_THE_SECOND_HERO_BUTTON = testSite('lien-ecrit-sans-accolades');

/* The example site's French home page gives each hero button a url or a pageRef that is a text:
   this site replaces that home page with the one of tests/fixtures/address-as-figure-or-dict/content,
   without clients nor projects, whose hero has three buttons, written [[params.hero.actions]], each
   with a label: the first is well filled in, with pageRef = '/projets'; the second declares a
   number, url = 42; the third a table, url = { href = '/contact' }. Its folder name avoids the
   words button, hero, url, text, must and be, the numbers and the language codes, which the
   error-message assertions look for. */
export const SITE_WITH_HERO_BUTTON_URLS_AS_A_NUMBER_AND_A_TABLE = testSite('address-as-figure-or-dict');

/* The example site's French home page gives each hero button a label that is a text: this site
   replaces that home page with the one of tests/fixtures/caption-as-figure-or-dict/content,
   without clients nor projects, whose hero has three buttons, written [[params.hero.actions]],
   each with a destination that is a text: the first is well filled in, with label = 'Voir les
   projets' and pageRef = '/projets'; the second declares a number, label = 42, with
   url = 'tel:+33100000000'; the third a table, label = { text = 'Contact' }, with
   url = '/contact/'. Its folder name avoids the words button, hero, label, text, must and be, the
   numbers and the language codes, which the error-message assertions look for. */
export const SITE_WITH_HERO_BUTTON_LABELS_AS_A_NUMBER_AND_A_TABLE = testSite('caption-as-figure-or-dict');

/* The example site's French home page gives each hero button a label without whitespace at its
   ends: this site replaces that home page with the one of
   tests/fixtures/caption-with-blank-edges/content, without clients nor projects, whose hero has
   three buttons, written [[params.hero.actions]], each with a destination that is a text: the
   first is well filled in, with label = 'Voir les paniers' and pageRef = '/projets'; the second
   declares a label with a leading space, label = ' Voir les projets', with
   url = 'tel:+33100000000'; the third a label with a trailing space, label = 'Contact ', with
   url = '/contact/'. Its folder name avoids the words button, hero, label, whitespace, start and
   end, the numbers and the language codes, which the error-message assertions look for. */
export const SITE_WITH_HERO_BUTTON_LABELS_WITH_A_LEADING_AND_A_TRAILING_SPACE = testSite('caption-with-blank-edges');

/* The example site's French home page gives each hero button a label a visitor can read: this
   site replaces that home page with the one of tests/fixtures/caption-of-spaces-only/content,
   whose hero has two buttons, written [[params.hero.actions]], each with a destination that is a
   text: the first is well filled in, with label = 'Voir les projets' and pageRef = '/projets';
   the second declares label = " \t ", a space, a tab and a space, with url = '#contact'. Its
   folder name avoids the words button, hero, label, empty, blank, whitespace, the numbers and the
   language codes, which the error-message assertions look for. */
export const SITE_WITH_A_SECOND_HERO_BUTTON_WITH_A_WHITESPACE_ONLY_LABEL = testSite('caption-of-spaces-only');

/* The example site's English home page writes its hero tagline as a list of texts and its hero
   buttons as a list of tables, [[params.hero.actions]]: this site replaces that home page with the
   one of tests/fixtures/english-home-text-and-table/content, whose tagline is a single text,
   'Restoring antique clocks and watches, in Besançon.', and whose only button is written
   [params.hero.actions], with single brackets, a table. The example site's French home page is
   unchanged. Its folder name avoids the words hero, tagline and list, the table name and the
   language codes, which the error-message assertions look for. */
export const SITE_WITH_AN_ENGLISH_HOME_WITH_A_TAGLINE_AND_BUTTONS_NOT_AS_LISTS =
  testSite('english-home-text-and-table');

/* The example site's French home page declares a clockmaker's background: this site replaces that
   home page with the one of tests/fixtures/other-background/content, without a hero, clients nor
   projects, which declares a fictional luthier's background, with other numbers of entries than
   the example site's: three key figures ("15" "Ans d’établi", "120+" "Violons montés", "8"
   "Apprentis formés"), two intro lines, a single education entry and three skill groups
   ("Facture", "Vernis", "Réglages") of two, one and three items. */
export const SITE_WITH_ANOTHER_BACKGROUND = testSite('other-background');

/* The example site's French home page declares every part of its background: this site replaces
   that home page with the one of tests/fixtures/skills-only-background/content, without a hero,
   clients nor projects, whose [params.background] declares only skill groups, a fictional
   potter's: "Tournage" of three items and "Émaillage" of one; no key figures, intro lines nor
   education entries. */
export const SITE_WITH_A_SKILLS_ONLY_BACKGROUND = testSite('skills-only-background');

/* The example site's French home page declares every part of its background: this site replaces
   that home page with the one of tests/fixtures/background-without-skills/content, without a hero,
   clients nor projects, whose [params.background] declares a fictional bookbinder's four key
   figures, two long intro lines and two long education entries, and no skill groups. */
export const SITE_WITH_A_BACKGROUND_WITHOUT_SKILLS = testSite('background-without-skills');

/* The example site's French home page declares every part of its background: this site replaces
   that home page with the one of tests/fixtures/empty-background/content, without a hero, clients
   nor projects, whose [params.background] declares its key figures, intro lines, education
   entries and skill groups as empty lists, stats = [], intro = [], education = [], skills = [],
   and one key the theme does not know, expositions, holding a single fictional entry: nothing the
   theme displays. */
export const SITE_WITH_AN_EMPTY_BACKGROUND = testSite('empty-background');

/* The example site's French home page declares a background made of short words: this site
   replaces that home page with the one of tests/fixtures/long-background-words/content, without
   a hero, clients nor projects, whose [params.background] declares only a single education entry,
   holding a school's name, and a single skill group, "Adresses", whose single item is a web
   address; the name and the address are each a single word, without a hyphen nor a space, wider
   than a phone. */
export const SITE_WITH_LONG_BACKGROUND_WORDS = testSite('long-background-words');

/* The example site's French home page declares a background made of short words: this site
   replaces that home page with the one of tests/fixtures/long-intro-and-figure-words/content,
   without a hero, clients nor projects, whose [params.background] declares only a single intro
   line, holding a bindery's name, and a single key figure, "12", whose label is a single word; the
   name and the label are each a single word, without a hyphen nor a space, wider than a phone. */
export const SITE_WITH_LONG_INTRO_AND_FIGURE_WORDS = testSite('long-intro-and-figure-words');

/* The example site's French home page titles its skill groups with short words: this site
   replaces that home page with the one of tests/fixtures/long-skill-group-title/content, without
   a hero, clients nor projects, whose [params.background] declares only a single skill group,
   whose title is a craft's name, a single word, without a hyphen nor a space, wider than a phone,
   and whose single item is a short word, "Engrenages". */
export const SITE_WITH_A_LONG_SKILL_GROUP_TITLE = testSite('long-skill-group-title');

/* The example site's French home page writes its key figures as a list of tables,
   [[params.background.stats]]: this site replaces that home page with the one of
   tests/fixtures/lone-figure-table/content, without a hero, clients nor projects, whose only key
   figure, a fictional blacksmith's ("12" "Ans de forge"), is written [params.background.stats],
   with single brackets, a table rather than a list. Its folder name avoids the words background
   and stats, which the error-message assertion looks for. */
export const SITE_WITH_BACKGROUND_STATS_AS_A_SINGLE_TABLE = testSite('lone-figure-table');

/* The example site's French home page writes its key figures as a list of tables,
   [[params.background.stats]]: this site replaces that home page with the one of
   tests/fixtures/bare-numbers/content, without a hero, clients nor projects, whose background
   declares a fictional cooper's only key figure as a list of texts, stats = ['20'], a bare value
   without a label, rather than a list of tables. Its folder name avoids the words background,
   stats, figure and table, which the error-message assertion looks for. */
export const SITE_WITH_BACKGROUND_STATS_AS_A_LIST_OF_TEXTS = testSite('bare-numbers');

/* The example site's French home page writes each key figure's value starting with a whole number:
   this site replaces that home page with the one of tests/fixtures/number-in-words/content,
   without a hero, clients nor projects, which declares a fictional glassblower's three key
   figures as a list of tables, [[params.background.stats]], the second of which has the value
   'quinze', written in words, between '9' and '300+'. Its folder name avoids the words
   background and figure, and the words "whole number", which the error-message assertion looks
   for. */
export const SITE_WITH_A_KEY_FIGURE_NOT_STARTING_WITH_A_NUMBER = testSite('number-in-words');

/* The example site's French home page writes its skill groups as a list of tables,
   [[params.background.skills]]: this site replaces that home page with the one of
   tests/fixtures/lone-group-table/content, without a hero, clients nor projects, whose only skill
   group, a fictional bookbinder's ("Reliure", of three items), is written
   [params.background.skills], with single brackets, a table rather than a list. Its folder name
   avoids the words background and skills, which the error-message assertion looks for. */
export const SITE_WITH_BACKGROUND_SKILLS_AS_A_SINGLE_TABLE = testSite('lone-group-table');

/* The example site's French home page writes its skill groups as a list of tables,
   [[params.background.skills]]: this site replaces that home page with the one of
   tests/fixtures/bare-crafts/content, without a hero, clients nor projects, whose background
   declares a fictional mechanic's only skill group as a list of texts, skills = ['Mécanique'], a
   bare name without a title nor items, rather than a list of tables. Its folder name avoids the
   words background, skills, group and table, which the error-message assertion looks for. */
export const SITE_WITH_BACKGROUND_SKILLS_AS_A_LIST_OF_TEXTS = testSite('bare-crafts');

/* The example site's French home page writes each skill group's items as a list: this site
   replaces that home page with the one of tests/fixtures/know-how-as-text/content, without a hero,
   clients nor projects, which declares a fictional potter's three skill groups as a list of
   tables, [[params.background.skills]], the second of which ("Émaillage") writes its items as a
   single text, 'Émaux de cendre', rather than a list, between two groups of three items. Its
   folder name avoids the words background, skill, group, items and list, which the error-message
   assertions look for. */
export const SITE_WITH_A_SKILL_GROUP_WHOSE_ITEMS_ARE_A_TEXT = testSite('know-how-as-text');

/* The example site's French home page writes its education entries as a list of texts: this site
   replaces that home page with the one of tests/fixtures/diploma-as-text/content, without a hero,
   clients nor projects, whose background declares a fictional luthier's only education entry as a
   single text, 'CAP de luthier — École nationale de lutherie, Mirecourt, 2008', rather than a
   list. Its folder name avoids the words background, education and list, which the error-message
   assertion looks for. */
export const SITE_WITH_EDUCATION_AS_A_TEXT = testSite('diploma-as-text');

/* The example site's French home page writes its education entries as a list of texts: this site
   replaces that home page with the one of tests/fixtures/diploma-tables/content, without a hero,
   clients nor projects, whose background declares a fictional stonemason's only education entry
   as a list of tables, [[params.background.education]], with a diploma and a school field, rather
   than as a list of texts. Its folder name avoids the words background, education and text, which
   the error-message assertion looks for. */
export const SITE_WITH_EDUCATION_AS_A_LIST_OF_TABLES = testSite('diploma-tables');

/* The example site's French home page writes its background intro as a list of texts, one per
   line: this site replaces that home page with the one of tests/fixtures/preamble-as-text/content,
   without a hero, clients nor projects, whose background declares a fictional clock restorer's
   intro as a single text, 'Restauratrice de pendules comtoises depuis 2005, entre Morez et
   Besançon.', rather than a list. Its folder name avoids the words background, intro and list,
   which the error-message assertion looks for. */
export const SITE_WITH_A_BACKGROUND_INTRO_AS_A_TEXT = testSite('preamble-as-text');

/* The example site's French home page writes its background intro as a list of texts, one per
   line: this site replaces that home page with the one of tests/fixtures/preamble-tables/content,
   without a hero, clients nor projects, whose background declares a fictional bookbinder's only
   intro line as a list of tables, [[params.background.intro]], with a phrase field, rather than as
   a list of texts. Its folder name avoids the words background, intro and text, which the
   error-message assertion looks for. */
export const SITE_WITH_A_BACKGROUND_INTRO_AS_A_LIST_OF_TABLES = testSite('preamble-tables');

/* The example site's French home page declares every part of its background as a list: this site
   replaces that home page with the one of tests/fixtures/blank-background-values/content, without
   a hero, clients nor projects, whose [params.background], a fictional basket weaver's, writes
   its key figures, intro, education and skill groups as empty values rather than leaving them
   out, stats = '', intro = false, education = 0 and skills = false. Its folder name avoids the
   words stats, intro, education, skills and list and the language codes, which the
   error-message assertions look for. */
export const SITE_WITH_BACKGROUND_PARTS_AS_EMPTY_VALUES = testSite('blank-background-values');

/* The example site's French home page writes each skill group's items as a list: this site
   replaces that home page with the one of tests/fixtures/blank-know-how/content, without a hero,
   clients nor projects, whose [params.background] declares only a fictional cabinetmaker's two
   skill groups, "Marqueterie" and "Dorure", whose items are written as empty values rather than
   left out, items = '' and items = false. */
export const SITE_WITH_SKILL_GROUP_ITEMS_AS_EMPTY_VALUES = testSite('blank-know-how');

/* The example site's English home page writes its key figures and skill groups as lists of tables
   and its intro and education as lists of texts: this site replaces that home page with the one of
   tests/fixtures/english-home-four-slips/content, without a hero, clients nor projects, whose
   background writes its intro and its only education entry as single texts rather than lists, and
   its only key figure, "12" "Years at the bench", and its only skill group, "Restoration" of three
   items, [params.background.stats] and [params.background.skills], with single brackets, tables
   rather than lists. The example site's French home page is unchanged. Its folder name avoids the
   words background, stats, skills, intro, education, list and table and the language codes, which
   the error-message assertions look for. */
export const SITE_WITH_AN_ENGLISH_HOME_WITH_BACKGROUND_PARTS_NOT_AS_LISTS = testSite('english-home-four-slips');

/* The example site's French home page gives each hero button a url or a pageRef that names a
   destination: this site replaces that home page with the one of
   tests/fixtures/addresses-unfilled-and-of-spaces/content, whose hero has three buttons, written
   [[params.hero.actions]], each with a label and no pageRef but the first: the first is well
   filled in, with pageRef = '/projets'; the second declares url = '', an empty text; the third
   url = " \t ", a space, a tab and a space. Its folder name avoids the words button, hero, url,
   empty, blank, whitespace, neither, nor, destination, the numbers and the language codes, which
   the error-message assertions look for. */
export const SITE_WITH_HERO_BUTTON_URLS_EMPTY_AND_WHITESPACE_ONLY = testSite('addresses-unfilled-and-of-spaces');

/* The example site's French home page gives each hero button a single destination: this site
   replaces that home page with the one of tests/fixtures/unfilled-address-and-target/content,
   whose hero has two buttons, written [[params.hero.actions]], each with a label: the first is
   well filled in, with pageRef = '/projets'; the second declares url = '', an empty text, next to
   a valid pageRef = '/projets'. Its folder name avoids the words button, hero, url, pageRef,
   both, only, one, empty, the numbers and the language codes, which the error-message assertions
   look for. */
export const SITE_WITH_A_SECOND_HERO_BUTTON_WITH_AN_EMPTY_URL_AND_A_PAGE_REF = testSite('unfilled-address-and-target');

/* The example site's French home page gives each hero button a single destination: this site
   replaces that home page with the one of tests/fixtures/address-next-to-broken-targets/content,
   whose hero has six buttons, written [[params.hero.actions]], each with a label: the first is
   well filled in, with pageRef = '/projets'; each of the others declares a valid url = '#contact'
   next to a wrong pageRef: the second '/projets ', with a trailing space; the third
   { path = '/projets' }, a table; the fourth 42, a number; the fifth '/page-fictive-introuvable',
   which matches no page; the sixth '/atelier-ferme', a page of the same fixture that declares
   [build] render = 'never', so that Hugo publishes nothing for it. Its folder name avoids the
   words button, hero, url, pageRef, both, only, one, empty, whitespace, published, the numbers
   and the language codes, which the error-message assertions look for. */
export const SITE_WITH_HERO_BUTTONS_WITH_A_URL_NEXT_TO_A_WRONG_PAGE_REF = testSite('address-next-to-broken-targets');

/* The example site's French home page gives each hero button a single destination: this site
   replaces that home page with the one of tests/fixtures/target-left-unset-in-yaml/content,
   written with a YAML front matter, whose hero has two buttons, each with a label and no url:
   the first is well filled in, with pageRef: /projets; the second declares pageRef: null, the
   YAML way of leaving a field without a value. Its folder name avoids the words button, hero,
   url, pageRef, both, empty, blank, null, neither, nor, the numbers and the language codes,
   which the error-message assertions look for. */
export const SITE_WITH_A_SECOND_HERO_BUTTON_WITH_A_NULL_PAGE_REF = testSite('target-left-unset-in-yaml');

/* The example site's French home page gives each hero button a single destination: this site
   replaces that home page with the one of tests/fixtures/address-left-unset-in-yaml/content,
   written with a YAML front matter, whose hero has two buttons, each with a label: the first is
   well filled in, with pageRef: /projets; the second declares url: null, the YAML way of leaving
   a field without a value, and no pageRef. Its folder name avoids the words button, hero, url,
   pageRef, both, empty, blank, null, text, neither, nor, the numbers and the language codes,
   which the error-message assertions look for. */
export const SITE_WITH_A_SECOND_HERO_BUTTON_WITH_A_NULL_URL = testSite('address-left-unset-in-yaml');

/* The example site's French home page gives each hero button a pageRef to a page without a custom
   build param: this site replaces that home page with the one of
   tests/fixtures/target-with-a-year-option/content, whose hero has two buttons, written
   [[params.hero.actions]], each with a label and no url: the first is well filled in, with
   pageRef = '/projets'; the second declares pageRef = '/atelier-millesime', a page of the same
   fixture that sets no [build] options but declares under [params] a custom param
   build = '2020', a text rather than a table. Its folder name avoids the words build, param,
   table, text, theme, Hugo, button, hero, url, pageRef, the numbers and the language codes,
   which the error-message assertions look for. */
export const SITE_WITH_A_HERO_BUTTON_TO_A_PAGE_WITH_A_BUILD_PARAM_AS_TEXT = testSite('target-with-a-year-option');

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

/* The arguments of every build of the example site: production, into
   `destination`, without the lock that would keep two builds from running at
   once. */
function baseBuildArguments(destination: string): string[] {
  return [
    'build',
    '--source',
    'exampleSite',
    '--environment',
    'production',
    '--destination',
    destination,
    '--noBuildLock',
  ];
}

function buildArguments(site: BuiltSite, configuration: string, destination: string): string[] {
  return [...baseBuildArguments(destination), '--config', configuration, '--baseURL', `${site.origin}${site.subpath}`];
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

/* The pattern, for a RegExp with the u flag, of a language code (fr, en) as a word that no other
   word follows, so that the letters "en" or "fr" met as a word inside a message's prose, followed
   by more of the sentence, do not pass for the code. */
export function languageCodePattern(language: string): string {
  return `\\b${language}\\b(?!\\s+\\p{L})`;
}

/* A Go template execution error, which would follow a theme's build error message and bury it in
   technical jargon. */
export const TEMPLATE_EXECUTION_ERROR = /execute of template failed|error calling/i;

/* Builds the example site as it is, without a fixture, asking Hugo to warn
   about every translation key a page uses that a language lacks
   (--printI18nWarnings), and returns those warnings, one per missing key and
   language, as Hugo words them ("i18n|MISSING_TRANSLATION|en|someKey").
   Like tryToBuildSite, it throws if Hugo does not exit normally, and also if
   the build fails, so that an empty list always means a complete build. */
export function findMissingTranslations(): string[] {
  const destination = mkdtempSync(path.join(tmpdir(), 'oc-portfolio-translations-'));
  try {
    const result = runHugo([...baseBuildArguments(destination), '--printI18nWarnings', '--logLevel', 'warn']);
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
