import { test, expect, type Locator, type Page } from '@playwright/test';

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
