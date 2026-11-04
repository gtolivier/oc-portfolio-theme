import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_ANOTHER_CONTACT_ACTION,
  SITE_WITH_ANOTHER_CONTACT_INTRO,
  buildSite,
  removeDirectory,
  serveSite,
} from './helpers/built-site';
import { tabKey } from './helpers/keyboard';

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

/* Whether a form field is required as the browser sees it: left empty, it fails the form's
   constraint validation for a missing value (the native `required`, also exposed to assistive
   technologies). */
function isRequired(field: Locator): Promise<boolean> {
  return field.evaluate((element) => (element as HTMLInputElement | HTMLTextAreaElement).validity.valueMissing);
}

/* Whether a field takes an email address, as the browser sees it: a value that is not one fails
   the form's constraint validation for its type. */
async function takesAnEmail(field: Locator): Promise<boolean> {
  await field.fill('not-an-email');
  const mismatch = await field.evaluate((element) => (element as HTMLInputElement).validity.typeMismatch);
  await field.fill('');
  return mismatch;
}

test('the section "Contact" holds a form with a required email field, a required message field and a send button, named "Votre email", "Message" and "Envoyer" on the French home page and "Your email", "Message" and "Send" on the English one', async ({
  page,
}) => {
  for (const { path, email, message, send } of [
    { path: '/fr/', email: 'Votre email', message: 'Message', send: 'Envoyer' },
    { path: '/en/', email: 'Your email', message: 'Message', send: 'Send' },
  ]) {
    await page.goto(path);
    const form = contactSection(page).getByRole('form');
    await expect(form, `a form in the section "Contact" of ${path}`).toHaveCount(1);
    const emailField = form.getByRole('textbox', { name: email, exact: true });
    const messageField = form.getByRole('textbox', { name: message, exact: true });
    const sendButton = form.getByRole('button', { name: send, exact: true });
    await expect(emailField, `the field "${email}" on ${path}`).toBeEditable();
    await expect(messageField, `the field "${message}" on ${path}`).toBeEditable();
    await expect(sendButton, `the button "${send}" on ${path}`).toBeVisible();
    expect(await takesAnEmail(emailField), `the field "${email}" on ${path} takes an email address`).toBe(true);
    expect(await isRequired(emailField), `the field "${email}" on ${path} is required`).toBe(true);
    expect(await isRequired(messageField), `the field "${message}" on ${path} is required`).toBe(true);
  }
});

/* The address the example site's configuration gives the contact form to post to
   (exampleSite/hugo.toml, [params], contactAction key): a path on the site's own domain. */
const CONTACT_ACTION = '/api/contact';

test.describe('browser without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, sending the filled contact form posts the email and the message, form-encoded, to the address the site’s contactAction param gives', async ({
    page,
    baseURL,
  }) => {
    /* No endpoint answers on the example site's server: the request is answered here, so the
       browser has somewhere to land. */
    await page.route(`**${CONTACT_ACTION}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' }),
    );
    await page.goto('/fr/');
    const form = contactSection(page).getByRole('form');
    await form.locator('[name="email"]').fill('marie.horloge@exemple.fr');
    await form.locator('[name="message"]').fill('Bonjour, ma pendule de cheminée retarde de dix minutes par jour.');
    /* Whatever the form posts to, the browser's POST is recorded. */
    const [request] = await Promise.all([
      page.waitForRequest((sent) => sent.method() === 'POST'),
      form.getByRole('button').click(),
    ]);
    expect(request.url(), 'the address the form posts to').toBe(new URL(CONTACT_ACTION, baseURL).href);
    expect(request.headers()['content-type'], 'the encoding of the form data').toBe(
      'application/x-www-form-urlencoded',
    );
    /* The email and the message filled in, among whatever else the form may send. */
    const body = Object.fromEntries(new URLSearchParams(request.postData() ?? ''));
    expect(body, 'the data sent').toEqual(
      expect.objectContaining({
        email: 'marie.horloge@exemple.fr',
        message: 'Bonjour, ma pendule de cheminée retarde de dix minutes par jour.',
      }),
    );
  });

  test('without JavaScript, the contact form also posts a "website" field, a decoy for spam bots that the visitor does not see, cannot reach with Tab and assistive technologies do not expose: empty when a visitor sends, with what a bot typed in it otherwise', async ({
    page,
    browserName,
  }) => {
    await page.route(`**${CONTACT_ACTION}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' }),
    );
    await page.goto('/fr/');
    const form = contactSection(page).getByRole('form');
    const emailField = form.locator('[name="email"]');
    const messageField = form.locator('[name="message"]');
    const decoy = form.locator('[name="website"]');
    const sendButton = form.getByRole('button');
    /* Assistive technologies: the form's only textboxes are the email and the message. */
    const textboxes = form.getByRole('textbox');
    await expect(textboxes, 'the textboxes of the form, as assistive technologies see them').toHaveCount(2);
    expect(
      await textboxes.evaluateAll((elements) => elements.map((element) => element.getAttribute('name'))),
      'the fields behind those textboxes',
    ).toEqual(['email', 'message']);
    /* The visitor: with the form in view, the decoy is nowhere on screen. */
    await sendButton.scrollIntoViewIfNeeded();
    const decoyOnScreen = (await decoy.isVisible()) && (await isInViewport(decoy));
    expect(decoyOnScreen, 'the decoy field is shown on screen').toBe(false);
    /* The keyboard: tabbing through the page, from its start until the focus has gone past the
       send button and out of the form, never lands on the decoy. */
    const sendButtonElement = await sendButton.elementHandle();
    let sendButtonReached = false;
    let decoyReached = false;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press(tabKey(browserName));
      const focus = await form.evaluate(
        (formElement, button) => ({
          name: document.activeElement?.getAttribute('name') ?? null,
          inForm: formElement.contains(document.activeElement),
          onSendButton: document.activeElement === button,
        }),
        sendButtonElement,
      );
      if (focus.inForm && focus.name === 'website') decoyReached = true;
      if (focus.onSendButton) sendButtonReached = true;
      else if (sendButtonReached && !focus.inForm) break;
    }
    expect(sendButtonReached, 'the send button is reached with Tab').toBe(true);
    expect(decoyReached, 'the decoy field is reached with Tab').toBe(false);
    /* Sent as a visitor would: the visible fields filled in, the decoy left as it is. */
    await emailField.fill('marie.horloge@exemple.fr');
    await messageField.fill('Bonjour, ma pendule de cheminée retarde de dix minutes par jour.');
    const [request] = await Promise.all([page.waitForRequest((sent) => sent.method() === 'POST'), sendButton.click()]);
    const body = new URLSearchParams(request.postData() ?? '');
    expect(body.has('website'), 'the data sent includes the "website" field').toBe(true);
    expect(body.get('website'), 'the value sent for "website"').toBe('');
    /* Sent as a bot would: a program that reads the markup fills every text field of the form,
       the decoy included, however it is hidden, and sends what it typed there. A field that is
       not a text field (a hidden input) would be skipped, and would not catch it. */
    await page.goto('/fr/');
    await emailField.fill('robot@exemple.fr');
    await messageField.fill('Achetez des montres pas chères.');
    const typedByBot = await decoy.evaluate((element, value) => {
      const textField =
        element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement && ['text', 'email', 'url', 'search', 'tel'].includes(element.type));
      if (textField) element.value = value;
      return textField;
    }, 'https://montres-pas-cheres.example');
    expect(typedByBot, 'the decoy is a text field, which a bot fills').toBe(true);
    const [botRequest] = await Promise.all([
      page.waitForRequest((sent) => sent.method() === 'POST'),
      sendButton.click(),
    ]);
    const botBody = new URLSearchParams(botRequest.postData() ?? '');
    expect(botBody.get('website'), 'the value a bot typed in "website", sent').toBe(
      'https://montres-pas-cheres.example',
    );
  });

  test('without JavaScript, opening the home page at #contact-sent, where the endpoint sends the visitor back once the message is sent, shows the confirmation in view instead of the intro and the form; at /fr/ and /fr/#contact the confirmation is not shown', async ({
    page,
  }) => {
    /* Each address is opened as a fresh load, as after the endpoint's redirect, not as a jump
       within an already open page. */
    for (const path of ['/fr/', '/fr/#contact']) {
      await page.goto('about:blank');
      await page.goto(path);
      await expect(contactSection(page).getByRole('form'), `the form on ${path}`).toBeVisible();
      await expect(
        contactSection(page).getByText(CONTACT_CONFIRMATION),
        `the confirmation on ${path}`,
      ).not.toBeVisible();
    }
    await page.goto('about:blank');
    await page.goto('/fr/#contact-sent');
    const section = contactSection(page);
    const confirmation = section.getByText(CONTACT_CONFIRMATION);
    await expect(confirmation, 'the confirmation').toBeVisible();
    await expect(confirmation, 'the confirmation is in view').toBeInViewport();
    await expect(section.getByText(CONTACT_INTRO), 'the intro').not.toBeVisible();
    await expect(section.getByRole('form'), 'the form').not.toBeVisible();
  });
});

/* The theme's default French confirmation for a sent message (the example site gives none of its
   own), shown once the endpoint has sent the visitor back to #contact-sent. */
const CONTACT_CONFIRMATION = 'Merci, je vous réponds sous 48 heures ouvrées.';

/* Whether any part of an element lies within the viewport. */
async function isInViewport(element: Locator): Promise<boolean> {
  const box = await element.boundingBox();
  const viewport = element.page().viewportSize();
  if (!box || !viewport || box.width === 0 || box.height === 0) return false;
  return box.x + box.width > 0 && box.y + box.height > 0 && box.x < viewport.width && box.y < viewport.height;
}

/* The address tests/fixtures/other-contact-address/hugo.toml gives the contact form to post to,
   instead of the example site's: another path on the site's own domain. */
const OTHER_CONTACT_ACTION = '/messages/envoyer';

test.describe('home page of another site, with another contactAction, in a browser without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ANOTHER_CONTACT_ACTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('with another contactAction, sending the filled contact form posts to that other address, and not to the example site’s', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_ANOTHER_CONTACT_ACTION, siteDirectory);
    /* No endpoint answers on the built site: whatever address the form posts to, the request is
       answered here, so the browser has somewhere to land. */
    await page.route(
      (url) => url.pathname === OTHER_CONTACT_ACTION || url.pathname === CONTACT_ACTION,
      (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' }),
    );
    await page.goto(`${SITE_WITH_ANOTHER_CONTACT_ACTION.origin}/fr/`);
    const form = contactSection(page).getByRole('form');
    await form.locator('[name="email"]').fill('marie.horloge@exemple.fr');
    await form.locator('[name="message"]').fill('Bonjour, ma pendule de cheminée retarde de dix minutes par jour.');
    /* Whatever the form posts to, the browser's POST is recorded. */
    const [request] = await Promise.all([
      page.waitForRequest((sent) => sent.method() === 'POST'),
      form.getByRole('button').click(),
    ]);
    expect(request.url(), 'the address the form posts to').toBe(
      new URL(OTHER_CONTACT_ACTION, SITE_WITH_ANOTHER_CONTACT_ACTION.origin).href,
    );
  });
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

  test.describe('browser without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('without JavaScript, opening at #contact-sent the French home page of another site, whose contact params give a sent text, shows that text as the confirmation, and not the theme’s default one', async ({
      page,
      context,
    }) => {
      await serveSite(context, SITE_WITH_ANOTHER_CONTACT_INTRO, siteDirectory);
      /* A fresh load, as after the endpoint's redirect. */
      await page.goto('about:blank');
      await page.goto(`${SITE_WITH_ANOTHER_CONTACT_INTRO.origin}/fr/#contact-sent`);
      const section = contactSection(page);
      await expect(section.getByText(OTHER_CONTACT_SENT), 'the site’s confirmation').toBeVisible();
      await expect(section.getByText(CONTACT_CONFIRMATION), 'the theme’s default confirmation').not.toBeVisible();
    });
  });
});

/* The confirmation tests/fixtures/other-contact/content/_index.md declares for its contact section
   ([params.contact] table, sent key), in the same fictional bookbinder's voice. */
const OTHER_CONTACT_SENT = 'Message bien reçu : je reviens vers vous avec un devis dès que mes cahiers sont cousus.';

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
