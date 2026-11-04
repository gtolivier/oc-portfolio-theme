import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_ANOTHER_CONTACT_INTRO,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';

/* The contact section of a home page, in its main content: a region named by its title. */
function contactSection(page: Page): Locator {
  return page.getByRole('main').getByRole('region', { name: 'Contact', exact: true });
}

/* The intro the example site's French home page declares for its contact section
   (exampleSite/content/_index.md, [params.contact] table, intro key): a fictional clockmaker's. */
const CONTACT_INTRO =
  'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.';

test('on the French home page, a section "Contact" with the anchor #contact comes right after the section "Parcours" and shows the intro the home page declares', async ({
  page,
}) => {
  await page.goto('/fr/');
  const main = page.getByRole('main');
  const background = main.getByRole('region', { name: 'Parcours', exact: true });
  const section = contactSection(page);
  await expect(background).toHaveCount(1);
  await expect(section).toHaveCount(1);
  /* Right after: among the regions of the main content, in document order and leaving out those
     nested in the background section, the one that follows the background section is "Contact". */
  const regions = await main.getByRole('region').elementHandles();
  const backgroundElement = await background.elementHandle();
  const contactElement = await section.elementHandle();
  const order = await page.evaluate(
    ([list, backgroundRegion, contactRegion]) => {
      const outer = list.filter((region) => region === backgroundRegion || !backgroundRegion.contains(region));
      const next = outer[outer.indexOf(backgroundRegion) + 1];
      return { backgroundFound: outer.includes(backgroundRegion), nextIsContact: next === contactRegion };
    },
    [regions, backgroundElement!, contactElement!] as const,
  );
  expect(order.backgroundFound, 'the background section is a region of the main content').toBe(true);
  expect(order.nextIsContact, 'the region right after "Parcours" is "Contact"').toBe(true);
  /* The intro the home page declares, shown in the section. */
  await expect(section.getByText(CONTACT_INTRO)).toBeVisible();
  /* The anchor: opening the home page at #contact, as the menu and the hero's button do, brings
     the section into view. */
  await page.goto('/fr/#contact');
  await expect(section).toBeInViewport();
});

test('on the French home page, the header menu’s "Contact" link brings the heading of the section "Contact" fully into view, below the sticky header', async ({
  page,
}) => {
  await page.goto('/fr/');
  const heading = contactSection(page).getByRole('heading', { level: 2 });
  await expect(heading).toHaveCount(1);
  /* Below the first screen on load, so that the link has to bring it into view. */
  await expect(heading).not.toBeInViewport();
  await page.locator('header nav').getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(heading, 'the heading is fully in view').toBeInViewport({ ratio: 1 });
  /* Below the sticky header, not hidden under it; polled, as the scroll may be smooth. */
  await expect
    .poll(
      async () => {
        const headerBox = (await page.locator('header').boundingBox())!;
        const headingBox = (await heading.boundingBox())!;
        return headingBox.y - (headerBox.y + headerBox.height);
      },
      { message: 'gap between the bottom of the header and the top of the heading' },
    )
    .toBeGreaterThanOrEqual(0);
});

/* The intro tests/fixtures/other-contact/content/_index.md declares for its contact section: a
   fictional bookbinder's. */
const OTHER_CONTACT_INTRO =
  'Ouverte aux commandes de reliure sur mesure, du carnet au registre. Écrivez-moi pour un devis.';

test.describe('home page of another site, with another contact intro', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ANOTHER_CONTACT_INTRO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('on the French home page of another site, the section "Contact" shows the intro that site declares, and not the example site’s', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_ANOTHER_CONTACT_INTRO, siteDirectory);
    await page.goto(`${SITE_WITH_ANOTHER_CONTACT_INTRO.origin}/fr/`);
    const section = contactSection(page);
    await expect(section).toBeVisible();
    await expect(section.getByText(OTHER_CONTACT_INTRO)).toBeVisible();
    await expect(section.getByText(CONTACT_INTRO), 'the example site’s intro').toHaveCount(0);
  });
});

test.describe('home page of another site, without contact params', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITHOUT_HERO);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('a home page whose front matter declares no contact params shows no section "Contact", no #contact anchor and none of the example site’s intro', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITHOUT_HERO, siteDirectory);
    await page.goto(`${SITE_WITHOUT_HERO.origin}/fr/`);
    /* tests/fixtures/without-hero/content/_index.md declares no [params.contact]: its text is
       displayed… */
    const main = page.getByRole('main');
    await expect(main.getByText('Accueil fictif sans hero')).toBeVisible();
    /* …with no contact section, no element to land on at #contact, and not the example site's intro. */
    await expect(contactSection(page)).toHaveCount(0);
    await expect(page.locator('#contact')).toHaveCount(0);
    await expect(page.getByText(CONTACT_INTRO)).toHaveCount(0);
  });
});
