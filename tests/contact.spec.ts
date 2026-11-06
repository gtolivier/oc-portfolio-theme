import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import {
  SITE_WITHOUT_HERO,
  SITE_WITH_ANOTHER_CONTACT_ACTION,
  SITE_WITH_ANOTHER_CONTACT_INTRO,
  SITE_WITHOUT_CONTACT_ACTION,
  buildSite,
  removeDirectory,
  runBuildTestsInOneProjectOnly,
  serveSite,
  tryToBuildSite,
} from './helpers/built-site';
import { stopClockBeforeLoad } from './helpers/clock';
import { holdRequests } from './helpers/held-requests';
import { tabKey } from './helpers/keyboard';
import { textOnScreen } from './helpers/text-on-screen';

/* The contact section of a home page, in its main content: a region named by its title. */
function contactSection(page: Page): Locator {
  return page.getByRole('main').getByRole('region', { name: 'Contact', exact: true });
}

/* The intro the example site's French home page declares for its contact section
   (exampleSite/content/_index.md, [params.contact] table, intro key): a fictional clockmaker's. */
const CONTACT_INTRO =
  'Disponible pour de nouvelles restaurations, à l’atelier ou à domicile. Parlons de votre pendule.';

/* The theme's default French confirmation for a sent message (the example site gives none of its
   own), shown once the endpoint has sent the visitor back to #contact-sent. */
const CONTACT_CONFIRMATION = 'Merci, je vous réponds sous 48 heures ouvrées.';

/* The theme's default French error message for a message that could not be sent, shown once the
   endpoint has sent the visitor back to #contact-error. */
const CONTACT_ERROR = 'Le message n’a pas pu être envoyé. Veuillez réessayer dans un instant.';

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

/* Whether any part of an element lies within the viewport. */
async function isInViewport(element: Locator): Promise<boolean> {
  const box = await element.boundingBox();
  const viewport = element.page().viewportSize();
  if (!box || !viewport || box.width === 0 || box.height === 0) return false;
  return box.x + box.width > 0 && box.y + box.height > 0 && box.x < viewport.width && box.y < viewport.height;
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

/* A browser's autofill cannot be driven from a test: what it, and assistive technologies, read to
   know the field asks for the visitor's own email address is the field's autofill hint (WCAG
   1.3.5, identify input purpose). */
test('the contact form’s email field tells the browser and assistive technologies it asks for the visitor’s email address, so the browser can offer the one it knows', async ({
  page,
}) => {
  await page.goto('/fr/');
  const { emailField } = contactForm(page);
  await expect(emailField, 'the autofill hint of the email field').toHaveAttribute('autocomplete', 'email');
});

/* The address the example site's configuration gives the contact form to post to
   (exampleSite/hugo.toml, [params], contactAction key): a path on the site's own domain. */
const CONTACT_ACTION = '/api/contact';

/* No endpoint answers on the test servers: the browser's form post to `address`, without
   JavaScript, gets a page here, so that the browser has somewhere to land. */
async function answerWithALandingPage(
  page: Page,
  address: Parameters<Page['route']>[0] = `**${CONTACT_ACTION}`,
): Promise<void> {
  await page.route(address, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Merci</p>' }));
}

/* The endpoint at `address` answers the background request, with JavaScript, with success, in
   JSON. */
async function answerWithSuccess(
  page: Page,
  address: Parameters<Page['route']>[0] = `**${CONTACT_ACTION}`,
): Promise<void> {
  await page.route(address, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
}

/* The contact form of a home page and the controls a visitor uses, its fields found by the names
   they are sent under. */
interface ContactForm {
  form: Locator;
  emailField: Locator;
  messageField: Locator;
  sendButton: Locator;
}

function contactForm(page: Page): ContactForm {
  const form = contactSection(page).getByRole('form');
  return {
    form,
    emailField: form.locator('[name="email"]'),
    messageField: form.locator('[name="message"]'),
    sendButton: form.getByRole('button'),
  };
}

/* What a visitor writes in the form: a fictional clock owner's email and message. */
const VISITOR_EMAIL = 'marie.horloge@exemple.fr';
const VISITOR_MESSAGE = 'Bonjour, ma pendule de cheminée retarde de dix minutes par jour.';

async function fillAsAVisitor({ emailField, messageField }: ContactForm): Promise<void> {
  await emailField.fill(VISITOR_EMAIL);
  await messageField.fill(VISITOR_MESSAGE);
}

/* Opens `address` as a fresh load, not as a jump within an already open page: as after the
   endpoint's redirect, or to start over with a page that has sent nothing yet. */
async function openAsAFreshLoad(page: Page, address: string): Promise<void> {
  await page.goto('about:blank');
  await page.goto(address);
}

/* Sends the form with its button and returns the POST the browser makes, whatever address it
   goes to. */
async function sendAndCatchThePost(page: Page, { sendButton }: ContactForm): Promise<Request> {
  const [request] = await Promise.all([page.waitForRequest((sent) => sent.method() === 'POST'), sendButton.click()]);
  return request;
}

/* The fields a form-encoded POST carries, by name. */
function postedFields(request: Request): URLSearchParams {
  return new URLSearchParams(request.postData() ?? '');
}

test.describe('browser without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, sending the filled contact form posts the email and the message, form-encoded, to the address the site’s contactAction param gives', async ({
    page,
    baseURL,
  }) => {
    await answerWithALandingPage(page);
    await page.goto('/fr/');
    const form = contactForm(page);
    await fillAsAVisitor(form);
    const request = await sendAndCatchThePost(page, form);
    expect(request.url(), 'the address the form posts to').toBe(new URL(CONTACT_ACTION, baseURL).href);
    expect(request.headers()['content-type'], 'the encoding of the form data').toBe(
      'application/x-www-form-urlencoded',
    );
    /* The email and the message filled in, among whatever else the form may send. */
    const body = Object.fromEntries(postedFields(request));
    expect(body, 'the data sent').toEqual(
      expect.objectContaining({
        email: 'marie.horloge@exemple.fr',
        message: 'Bonjour, ma pendule de cheminée retarde de dix minutes par jour.',
      }),
    );
  });

  test('without JavaScript, the contact form also posts a "contact_reference" field, a decoy for spam bots that the visitor does not see, cannot reach with Tab and assistive technologies do not expose: empty when a visitor sends, with what a bot typed in it otherwise', async ({
    page,
    browserName,
  }) => {
    await answerWithALandingPage(page);
    await page.goto('/fr/');
    const contact = contactForm(page);
    const { form, emailField, messageField, sendButton } = contact;
    const decoy = form.locator('[name="contact_reference"]');
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
      if (focus.inForm && focus.name === 'contact_reference') decoyReached = true;
      if (focus.onSendButton) sendButtonReached = true;
      else if (sendButtonReached && !focus.inForm) break;
    }
    expect(sendButtonReached, 'the send button is reached with Tab').toBe(true);
    expect(decoyReached, 'the decoy field is reached with Tab').toBe(false);
    /* Sent as a visitor would: the visible fields filled in, the decoy left as it is. */
    await fillAsAVisitor(contact);
    const request = await sendAndCatchThePost(page, contact);
    const body = postedFields(request);
    expect(body.has('contact_reference'), 'the data sent includes the "contact_reference" field').toBe(true);
    expect(body.get('contact_reference'), 'the value sent for "contact_reference"').toBe('');
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
    const botRequest = await sendAndCatchThePost(page, contact);
    const botBody = postedFields(botRequest);
    expect(botBody.get('contact_reference'), 'the value a bot typed in "contact_reference", sent').toBe(
      'https://montres-pas-cheres.example',
    );
  });

  /* The endpoint, without JavaScript, sends the visitor back to /<lang>/#contact-sent or
     /<lang>/#contact-error: it needs the language of the page the form was sent from. */
  test('without JavaScript, sending the filled contact form from the French home page also posts a field "lang" with the value "fr", which the visitor does not see and assistive technologies do not expose', async ({
    page,
  }) => {
    await answerWithALandingPage(page);
    await page.goto('/fr/');
    const contact = contactForm(page);
    const { form, sendButton } = contact;
    const langField = form.locator('[name="lang"]');
    /* Assistive technologies: the form's textboxes stay the email and the message. */
    const textboxes = form.getByRole('textbox');
    expect(
      await textboxes.evaluateAll((elements) => elements.map((element) => element.getAttribute('name'))),
      'the fields behind the textboxes of the form, as assistive technologies see them',
    ).toEqual(['email', 'message']);
    /* The visitor: with the form in view, the "lang" field is nowhere on screen. */
    await sendButton.scrollIntoViewIfNeeded();
    const langOnScreen = (await langField.isVisible()) && (await isInViewport(langField));
    expect(langOnScreen, 'the "lang" field is shown on screen').toBe(false);
    /* Sent as a visitor would, from the French home page. */
    await fillAsAVisitor(contact);
    const request = await sendAndCatchThePost(page, contact);
    const body = postedFields(request);
    expect(body.get('lang'), 'the value sent for "lang"').toBe('fr');
  });

  test('without JavaScript, sending the filled contact form from the English home page posts "lang" with the value "en"', async ({
    page,
  }) => {
    await answerWithALandingPage(page);
    await page.goto('/en/');
    const contact = contactForm(page);
    await fillAsAVisitor(contact);
    const request = await sendAndCatchThePost(page, contact);
    const body = postedFields(request);
    expect(body.get('lang'), 'the value sent for "lang"').toBe('en');
  });

  test('without JavaScript, opening the home page at #contact-sent, where the endpoint sends the visitor back once the message is sent, shows the confirmation in view instead of the intro and the form; at /fr/ and /fr/#contact the confirmation is not shown', async ({
    page,
  }) => {
    for (const path of ['/fr/', '/fr/#contact']) {
      await openAsAFreshLoad(page, path);
      await expect(contactSection(page).getByRole('form'), `the form on ${path}`).toBeVisible();
      await expect(
        contactSection(page).getByText(CONTACT_CONFIRMATION),
        `the confirmation on ${path}`,
      ).not.toBeVisible();
    }
    await openAsAFreshLoad(page, '/fr/#contact-sent');
    const section = contactSection(page);
    const confirmation = section.getByText(CONTACT_CONFIRMATION);
    await expect(confirmation, 'the confirmation').toBeVisible();
    await expect(confirmation, 'the confirmation is in view').toBeInViewport();
    await expect(section.getByText(CONTACT_INTRO), 'the intro').not.toBeVisible();
    await expect(section.getByRole('form'), 'the form').not.toBeVisible();
  });

  test('without JavaScript, opening the home page at #contact-error, where the endpoint sends the visitor back when the message could not be sent, shows the error message in view above the form, which stays usable; at /fr/ the error message is not shown', async ({
    page,
  }) => {
    await openAsAFreshLoad(page, '/fr/');
    await expect(contactSection(page).getByRole('form'), 'the form on /fr/').toBeVisible();
    await expect(contactSection(page).getByText(CONTACT_ERROR), 'the error message on /fr/').not.toBeVisible();
    await openAsAFreshLoad(page, '/fr/#contact-error');
    const section = contactSection(page);
    const error = section.getByText(CONTACT_ERROR);
    const { form, emailField, messageField, sendButton } = contactForm(page);
    await expect(error, 'the error message').toBeVisible();
    await expect(error, 'the error message is in view').toBeInViewport();
    /* The form stays there, usable, for the visitor to try again. */
    await expect(form, 'the form').toBeVisible();
    await expect(emailField, 'the email field').toBeEditable();
    await expect(messageField, 'the message field').toBeEditable();
    await expect(sendButton, 'the send button').toBeEnabled();
    /* Above the form: the error message ends where the form starts, or higher. */
    const errorBox = (await error.boundingBox())!;
    const formBox = (await form.boundingBox())!;
    expect(errorBox.y + errorBox.height, 'the bottom of the error message').toBeLessThanOrEqual(formBox.y);
    await expect(section.getByText(CONTACT_CONFIRMATION), 'the confirmation').not.toBeVisible();
  });
});

/* Whether a visitor can use a control of the form: it is shown, and a field takes typing or a
   button takes a click. Hidden or disabled, it cannot be used. */
async function isUsable(control: Locator, kind: 'field' | 'button'): Promise<boolean> {
  if (!(await control.isVisible())) return false;
  return kind === 'field' ? control.isEditable() : control.isEnabled();
}

test('with JavaScript, sending the filled contact form posts it in the background to the contactAction address, asking for JSON, without leaving the page, and on a successful answer shows the confirmation, the form no longer usable', async ({
  page,
  baseURL,
}) => {
  await answerWithSuccess(page);
  await page.goto('/fr/');
  const urlBefore = page.url();
  /* A mark left on the page as loaded: a reload or a navigation would wipe it out. */
  await page.evaluate(() => {
    (window as unknown as { samePageMark?: boolean }).samePageMark = true;
  });
  const section = contactSection(page);
  const form = contactForm(page);
  const { emailField, messageField, sendButton } = form;
  await fillAsAVisitor(form);
  const request = await sendAndCatchThePost(page, form);
  expect(request.url(), 'the address the form posts to').toBe(new URL(CONTACT_ACTION, baseURL).href);
  expect(request.headers()['accept'] ?? '', 'the answer the request asks for').toContain('application/json');
  /* On success, the confirmation is shown… */
  await expect(section.getByText(CONTACT_CONFIRMATION), 'the confirmation').toBeVisible();
  /* …on the same page: same address, not reloaded. */
  expect(page.url(), 'the page address').toBe(urlBefore);
  expect(
    await page.evaluate(() => (window as unknown as { samePageMark?: boolean }).samePageMark === true),
    'the page is the one loaded before sending',
  ).toBe(true);
  /* The form can no longer be filled in and sent. */
  await expect.poll(() => isUsable(emailField, 'field'), { message: 'the email field is usable' }).toBe(false);
  await expect.poll(() => isUsable(messageField, 'field'), { message: 'the message field is usable' }).toBe(false);
  await expect.poll(() => isUsable(sendButton, 'button'), { message: 'the send button is usable' }).toBe(false);
});

test('with JavaScript, the background send posts the email, the message and the empty decoy "contact_reference", form-encoded, as the browser does without JavaScript', async ({
  page,
}) => {
  await answerWithSuccess(page);
  await page.goto('/fr/');
  const form = contactForm(page);
  await fillAsAVisitor(form);
  const request = await sendAndCatchThePost(page, form);
  /* The same encoding as without JavaScript; a charset parameter the browser may add aside. */
  const mediaType = (request.headers()['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  expect(mediaType, 'the encoding of the form data').toBe('application/x-www-form-urlencoded');
  /* The same fields as without JavaScript: what the visitor filled in, and the decoy left empty. */
  const body = postedFields(request);
  expect(Object.fromEntries(body), 'the data sent').toEqual(
    expect.objectContaining({ email: VISITOR_EMAIL, message: VISITOR_MESSAGE }),
  );
  expect(body.has('contact_reference'), 'the data sent includes the "contact_reference" field').toBe(true);
  expect(body.get('contact_reference'), 'the value sent for "contact_reference"').toBe('');
});

/* The endpoint words the subject of the mail it sends after "lang": the background send carries
   it as the form post does without JavaScript. */
test('with JavaScript, the background send from the English home page posts "lang" with the value "en", as without JavaScript', async ({
  page,
}) => {
  await answerWithSuccess(page);
  await page.goto('/en/');
  const form = contactForm(page);
  await fillAsAVisitor(form);
  const request = await sendAndCatchThePost(page, form);
  const body = postedFields(request);
  expect(body.get('lang'), 'the value sent for "lang"').toBe('en');
});

test('with JavaScript, when the endpoint answers the background request with an error, the error message shows and the form keeps what the visitor wrote, still usable', async ({
  page,
}) => {
  const email = 'marie.horloge@exemple.fr';
  const message = 'Bonjour, ma pendule de cheminée retarde de dix minutes par jour.';
  /* An error is any answer that is not a success: one the endpoint refuses, one it fails on. */
  for (const status of [422, 500]) {
    await page.unrouteAll();
    await page.route(`**${CONTACT_ACTION}`, (route) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ ok: false }) }),
    );
    await openAsAFreshLoad(page, '/fr/');
    const section = contactSection(page);
    const { emailField, messageField, sendButton } = contactForm(page);
    await emailField.fill(email);
    await messageField.fill(message);
    await Promise.all([page.waitForResponse((answer) => answer.request().method() === 'POST'), sendButton.click()]);
    /* The error message shows, not the confirmation. */
    await expect(section.getByText(CONTACT_ERROR), `the error message after a ${status}`).toBeVisible();
    await expect(section.getByText(CONTACT_CONFIRMATION), `the confirmation after a ${status}`).not.toBeVisible();
    /* The form stays usable, with what the visitor wrote, for them to try again. */
    expect(await isUsable(emailField, 'field'), `the email field is usable after a ${status}`).toBe(true);
    expect(await isUsable(messageField, 'field'), `the message field is usable after a ${status}`).toBe(true);
    expect(await isUsable(sendButton, 'button'), `the send button is usable after a ${status}`).toBe(true);
    await expect(emailField, `the email after a ${status}`).toHaveValue(email);
    await expect(messageField, `the message after a ${status}`).toHaveValue(message);
  }
});

test('with JavaScript, when the background request gets no answer at all (network failure), the error message shows and the form keeps what the visitor wrote, still usable', async ({
  page,
}) => {
  const email = 'marie.horloge@exemple.fr';
  const message = 'Bonjour, ma pendule de cheminée retarde de dix minutes par jour.';
  /* No answer comes back: the request fails on the network, as when the visitor is offline. */
  await page.route(`**${CONTACT_ACTION}`, (route) => route.abort('internetdisconnected'));
  await page.goto('/fr/');
  const section = contactSection(page);
  const { emailField, messageField, sendButton } = contactForm(page);
  await emailField.fill(email);
  await messageField.fill(message);
  await Promise.all([page.waitForEvent('requestfailed', (failed) => failed.method() === 'POST'), sendButton.click()]);
  /* The error message shows, not the confirmation. */
  await expect(section.getByText(CONTACT_ERROR), 'the error message').toBeVisible();
  await expect(section.getByText(CONTACT_CONFIRMATION), 'the confirmation').not.toBeVisible();
  /* The form stays usable, with what the visitor wrote, for them to try again. */
  expect(await isUsable(emailField, 'field'), 'the email field is usable').toBe(true);
  expect(await isUsable(messageField, 'field'), 'the message field is usable').toBe(true);
  expect(await isUsable(sendButton, 'button'), 'the send button is usable').toBe(true);
  await expect(emailField, 'the email').toHaveValue(email);
  await expect(messageField, 'the message').toHaveValue(message);
});

test('with JavaScript, while the message is being sent, the endpoint not having answered yet, sending the form again, by its button or by Enter in the email field, does not post it a second time', async ({
  page,
}) => {
  /* The endpoint answers with success once the test lets the request through; until then it is
     held, as on a slow connection. */
  await answerWithSuccess(page);
  const held = await holdRequests(page, `**${CONTACT_ACTION}`);
  /* Every POST the page sends to the endpoint, held or not. */
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === CONTACT_ACTION) posts.push(request.url());
  });
  try {
    await page.goto('/fr/');
    const section = contactSection(page);
    const form = contactForm(page);
    const { emailField, sendButton } = form;
    await fillAsAVisitor(form);
    await sendButton.click();
    await held.requested;
    /* Sending again, however the visitor can, while the first request is still pending: a click on
       the button, even if it no longer takes one, and Enter in the email field. */
    await sendButton.click({ force: true });
    await emailField.press('Enter');
    /* The first request answered, the confirmation shows: by then any second POST, sent before the
       answer, has reached the endpoint. */
    held.release();
    await expect(section.getByText(CONTACT_CONFIRMATION), 'the confirmation').toBeVisible();
    expect(posts, 'the POST requests that reached the endpoint').toHaveLength(1);
  } finally {
    await held.end();
  }
});

test('with JavaScript, while the message is being sent, the endpoint not having answered yet, the send button is disabled, for visitors and assistive technologies, and focus stays on it', async ({
  page,
}) => {
  /* The endpoint's answer is held, as on a slow connection, for as long as the test checks. */
  const held = await holdRequests(page, `**${CONTACT_ACTION}`);
  try {
    await page.goto('/fr/');
    const form = contactForm(page);
    const { sendButton } = form;
    await fillAsAVisitor(form);
    /* Sent from the button with the keyboard, focus on it, as every browser leaves it after the send
       (a click does not focus a button in every browser). */
    await sendButton.press('Enter');
    await held.requested;
    /* Disabled as Playwright sees it: the disabled attribute or aria-disabled. */
    await expect(sendButton, 'the send button while the message is being sent').toBeDisabled();
    await expect(sendButton, 'the send button while the message is being sent').toBeFocused();
  } finally {
    await held.end();
  }
});

test('with JavaScript, after the endpoint answers a send with an error, the send button is enabled again, for visitors and assistive technologies, and sending again posts the message a second time', async ({
  page,
}) => {
  /* The endpoint fails on every send. */
  await page.route(`**${CONTACT_ACTION}`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false }) }),
  );
  /* Every POST the page sends to the endpoint. */
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === CONTACT_ACTION) posts.push(request.url());
  });
  await page.goto('/fr/');
  const section = contactSection(page);
  const form = contactForm(page);
  const { sendButton } = form;
  await fillAsAVisitor(form);
  await sendButton.click();
  await expect(section.getByText(CONTACT_ERROR), 'the error message after the first send').toBeVisible();
  /* Enabled as Playwright sees it: neither the disabled attribute nor aria-disabled. */
  await expect(sendButton, 'the send button after the error').toBeEnabled();
  /* Trying again posts the message once more. */
  await sendAndCatchThePost(page, form);
  expect(posts, 'the POST requests that reached the endpoint').toHaveLength(2);
});

/* How far the fake clock moves on, in ms, for a send that gets no answer to be given up: a
   generous limit, well past any reasonable wait, not the wait itself. */
const WELL_PAST_ANY_WAIT = 60000;

test('with JavaScript, when the endpoint does not answer the background request for a long while, the send gives up: the error message shows, the form keeps what the visitor wrote and the send button is usable again', async ({
  page,
}) => {
  /* The endpoint's answer never comes, for as long as the test runs; time stands still from before
     the page loads, until the test advances it. */
  const held = await holdRequests(page, `**${CONTACT_ACTION}`);
  await stopClockBeforeLoad(page);
  try {
    await page.goto('/fr/');
    const section = contactSection(page);
    const form = contactForm(page);
    const { emailField, messageField, sendButton } = form;
    await fillAsAVisitor(form);
    await sendButton.click();
    await held.requested;
    /* The send is still pending, not given up at once. */
    await expect(section.getByText(CONTACT_ERROR), 'the error message as the send starts').not.toBeVisible();
    /* A long while later, still no answer. */
    await page.clock.runFor(WELL_PAST_ANY_WAIT);
    /* The error message shows, not the confirmation. */
    await expect(section.getByText(CONTACT_ERROR), 'the error message after a long while').toBeVisible();
    await expect(section.getByText(CONTACT_CONFIRMATION), 'the confirmation after a long while').not.toBeVisible();
    /* The form stays usable, with what the visitor wrote, for them to try again. */
    await expect(sendButton, 'the send button after a long while').toBeEnabled();
    expect(await isUsable(emailField, 'field'), 'the email field is usable').toBe(true);
    expect(await isUsable(messageField, 'field'), 'the message field is usable').toBe(true);
    expect(await isUsable(sendButton, 'button'), 'the send button is usable').toBe(true);
    await expect(emailField, 'the email').toHaveValue(VISITOR_EMAIL);
    await expect(messageField, 'the message').toHaveValue(VISITOR_MESSAGE);
  } finally {
    await held.end();
  }
});

test('with JavaScript, after a successful send, focus moves to the confirmation, which assistive technologies get as a status, the whole sentence at once', async ({
  page,
}) => {
  await answerWithSuccess(page);
  await page.goto('/fr/');
  const section = contactSection(page);
  const form = contactForm(page);
  await fillAsAVisitor(form);
  await form.sendButton.click();
  /* Assistive technologies get the confirmation as a status message (a polite live region)… */
  const status = section.getByRole('status');
  await expect(status, 'the status message of the section "Contact"').toHaveCount(1);
  /* …and, from the first moment it holds any text, the whole sentence, not a first part of it that
     would grow character by character. An empty status reads "- status" alone. */
  let firstAnnounced = '';
  await expect
    .poll(
      async () => {
        firstAnnounced = (await status.ariaSnapshot()).trim();
        return firstAnnounced !== '- status';
      },
      { message: 'the status holds some text', intervals: [10] },
    )
    .toBe(true);
  expect(firstAnnounced, 'what assistive technologies first get of the status').toContain(CONTACT_CONFIRMATION);
  /* Focus has moved to the confirmation: the focused element is the status, or holds it, within the
     section "Contact" — not the page itself, nor the whole section. */
  await expect
    .poll(
      () =>
        status.evaluate((confirmation) => {
          const focused = document.activeElement;
          const contact = confirmation.closest('section');
          return (
            focused !== null &&
            focused !== document.body &&
            focused !== contact &&
            contact !== null &&
            contact.contains(focused) &&
            focused.contains(confirmation)
          );
        }),
      { message: 'the focused element is the confirmation, or holds it' },
    )
    .toBe(true);
});

/* What the form shows on screen, spaces aside: the labels of its fields and the text of its
   button, those that are not empty. Once the form is gone, none of them shows. */
async function textsTheFormShows({ emailField, messageField, sendButton }: ContactForm): Promise<string[]> {
  const labelText = (field: Locator) =>
    field.evaluate((element) =>
      Array.from((element as HTMLInputElement | HTMLTextAreaElement).labels ?? [])
        .map((label) => label.textContent ?? '')
        .join(''),
    );
  return [await labelText(emailField), await labelText(messageField), await textOnScreen(sendButton)]
    .map((text) => text.replace(/\s/g, ''))
    .filter((text) => text !== '');
}

/* A sentence as textOnScreen shows it: without its spaces. */
function lettersOf(sentence: string): string {
  return sentence.replace(/ /g, '');
}

/* The length of the longest start of `sentence` that `shown` holds, spaces aside. */
function startShown(shown: string, sentence: string): number {
  const letters = lettersOf(sentence);
  let length = 0;
  while (length < letters.length && shown.includes(letters.slice(0, length + 1))) length += 1;
  return length;
}

/* The intro's first word: once the intro is erased, not even its start shows. */
const INTRO_START = CONTACT_INTRO.split(' ')[0];

/* How long the fake clock runs, in ms, for the erasing and the typing to be well over: a
   generous limit. */
const WELL_PAST_THE_ANIMATION = 20000;

/* How far the fake clock moves on, in ms, between two looks at the section. */
const SAMPLING_STEP = 25;

/* What the section shows as time moves on in small steps, the answer arriving meanwhile, until
   the whole confirmation shows without the intro, or WELL_PAST_THE_ANIMATION. */
async function sampleUntilConfirmed(section: Locator): Promise<string[]> {
  const samples: string[] = [];
  for (let elapsed = 0; elapsed <= WELL_PAST_THE_ANIMATION; elapsed += SAMPLING_STEP) {
    if (elapsed > 0) await section.page().clock.runFor(SAMPLING_STEP);
    const shown = await textOnScreen(section);
    samples.push(shown);
    const isConfirmed =
      startShown(shown, CONTACT_CONFIRMATION) === lettersOf(CONTACT_CONFIRMATION).length &&
      !shown.includes(INTRO_START);
    if (isConfirmed) break;
  }
  return samples;
}

test('with JavaScript and motion allowed, after a successful send, the intro is erased then the confirmation typed in: partway through, the section shows only the start of the confirmation, and in the end the whole of it', async ({
  page,
}) => {
  await answerWithSuccess(page);
  /* Animations are allowed, and time stands still from before the page loads, until the test
     advances it. */
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const section = contactSection(page);
  const form = contactForm(page);
  await fillAsAVisitor(form);
  /* Before sending, what the section already shows of the confirmation's start by chance (a
     letter or two of a label): showing the start of the confirmation means more than that. */
  const shownByChance = startShown(await textOnScreen(section), CONTACT_CONFIRMATION);
  const wholeConfirmation = lettersOf(CONTACT_CONFIRMATION).length;
  await form.sendButton.click();
  const samples = await sampleUntilConfirmed(section);
  /* Partway through: the section shows a start of the confirmation, not all of it, the intro
     already erased. */
  const partway = samples.find((shown) => {
    const length = startShown(shown, CONTACT_CONFIRMATION);
    return length > shownByChance && length < wholeConfirmation;
  });
  expect(
    partway,
    `a moment when the section shows only the start of the confirmation, among: ${JSON.stringify(samples.slice(-5))}`,
  ).toBeDefined();
  expect(partway ?? '', 'the section partway through the typing').not.toContain(INTRO_START);
  /* In the end, well past the whole animation: the whole confirmation, and no longer the intro. */
  await page.clock.runFor(WELL_PAST_THE_ANIMATION);
  const end = await textOnScreen(section);
  expect(startShown(end, CONTACT_CONFIRMATION), `the confirmation's characters shown in the end, in "${end}"`).toBe(
    wholeConfirmation,
  );
  expect(end, 'the section in the end').not.toContain(INTRO_START);
});

test('with JavaScript and motion allowed, after a successful send, the intro is erased before the confirmation is typed: partway through the erasing, the section shows only the start of the intro, the form already gone, and none of the confirmation', async ({
  page,
}) => {
  await answerWithSuccess(page);
  /* Animations are allowed, and time stands still from before the page loads, until the test
     advances it. */
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const section = contactSection(page);
  const form = contactForm(page);
  await fillAsAVisitor(form);
  const formTexts = await textsTheFormShows(form);
  expect(formTexts, 'the texts the form shows before sending').toHaveLength(3);
  /* Before sending, what the section already shows of the confirmation's start by chance (a
     letter or two of a label): showing the start of the confirmation means more than that. */
  const confirmationByChance = startShown(await textOnScreen(section), CONTACT_CONFIRMATION);
  const wholeIntro = lettersOf(CONTACT_INTRO).length;
  await form.sendButton.click();
  const samples = await sampleUntilConfirmed(section);
  /* In the end, well past the whole animation: what the section still shows of the intro's start
     by chance. Showing a start of the intro means more than that. */
  await page.clock.runFor(WELL_PAST_THE_ANIMATION);
  const introByChance = startShown(await textOnScreen(section), CONTACT_INTRO);
  /* Partway through the erasing: a start of the intro, not all of it, none of the form, and no
     more of the confirmation's start than shows by chance. */
  const partway = samples.find((shown) => {
    const introLength = startShown(shown, CONTACT_INTRO);
    return (
      introLength > introByChance &&
      introLength < wholeIntro &&
      formTexts.every((text) => !shown.includes(text)) &&
      startShown(shown, CONTACT_CONFIRMATION) <= confirmationByChance
    );
  });
  expect(
    partway,
    `a moment when the section shows only the start of the intro, among: ${JSON.stringify([...new Set(samples)].slice(0, 5))}`,
  ).toBeDefined();
});

test('with JavaScript and motion allowed, as soon as focus moves to the confirmation after a successful send, before the intro is erased, assistive technologies get the whole confirmation from the focused element', async ({
  page,
}) => {
  await answerWithSuccess(page);
  /* Animations are allowed, and time stands still from before the page loads: the erasing cannot
     start, nor the typing, until the test advances the clock, which it never does. */
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const section = contactSection(page);
  const form = contactForm(page);
  await fillAsAVisitor(form);
  await Promise.all([page.waitForResponse((answer) => answer.request().method() === 'POST'), form.sendButton.click()]);
  /* The moment focus leaves the send button for the section "Contact", the clock never advanced. */
  await expect
    .poll(
      () =>
        section.evaluate((contact) => {
          const focused = document.activeElement;
          return focused !== null && focused !== contact && contact.contains(focused) && focused.tagName !== 'BUTTON';
        }),
      { message: 'focus has moved within the section "Contact"', intervals: [10] },
    )
    .toBe(true);
  /* The intro is not erased yet: its start still shows. */
  expect(await textOnScreen(section), 'the section as focus moves').toContain(INTRO_START);
  /* What assistive technologies get from the focused element, right then: the whole confirmation. */
  const announced = await page.locator(':focus').ariaSnapshot();
  expect(announced, 'what assistive technologies get from the focused element').toContain(CONTACT_CONFIRMATION);
});

test('with JavaScript and reduced motion, after a successful send, the section shows the whole confirmation at once, without the intro or the form, time standing still', async ({
  page,
}) => {
  await answerWithSuccess(page);
  /* The visitor asks for reduced motion, and time stands still from before the page loads: no
     timer fires and no animation frame runs, so nothing that takes time can show. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stopClockBeforeLoad(page);
  await page.goto('/fr/');
  const section = contactSection(page);
  const form = contactForm(page);
  await fillAsAVisitor(form);
  const formTexts = await textsTheFormShows(form);
  expect(formTexts, 'the texts the form shows before sending').toHaveLength(3);
  const before = await textOnScreen(section);
  await Promise.all([page.waitForResponse((answer) => answer.request().method() === 'POST'), form.sendButton.click()]);
  /* The first time the section shows anything other than before sending, the clock never
     advanced: what it shows then. */
  let reacted = before;
  await expect
    .poll(
      async () => {
        reacted = await textOnScreen(section);
        return reacted !== before;
      },
      { message: 'the section reacts to the successful answer', intervals: [10] },
    )
    .toBe(true);
  /* From that first moment: the whole confirmation, none of the intro, none of the form. */
  expect(reacted, 'the section as it first reacts').toContain(CONTACT_CONFIRMATION.replace(/ /g, ''));
  expect(reacted, 'the section as it first reacts').not.toContain(INTRO_START);
  for (const text of formTexts) expect(reacted, `the section as it first reacts, "${text}"`).not.toContain(text);
});

test('with JavaScript, a successful send from the home page opened at #contact-error, where the endpoint sent the visitor back after a failure without JavaScript, shows the confirmation without the error message', async ({
  page,
}) => {
  await answerWithSuccess(page);
  /* Reduced motion: the confirmation shows whole at once, with no animation to wait for. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAsAFreshLoad(page, '/fr/#contact-error');
  const section = contactSection(page);
  const error = section.getByText(CONTACT_ERROR);
  /* The visitor comes back from a failed send: the error message shows above the form. */
  await expect(error, 'the error message before trying again').toBeVisible();
  const form = contactForm(page);
  await fillAsAVisitor(form);
  await Promise.all([page.waitForResponse((answer) => answer.request().method() === 'POST'), form.sendButton.click()]);
  /* The send succeeded: the confirmation shows, and the earlier error message no longer does. */
  await expect(section.getByText(CONTACT_CONFIRMATION), 'the confirmation').toBeVisible();
  await expect(error, 'the error message after a successful send').not.toBeVisible();
});

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
    /* Whatever address the form posts to, this site's or the example site's. */
    await answerWithALandingPage(
      page,
      (url) => url.pathname === OTHER_CONTACT_ACTION || url.pathname === CONTACT_ACTION,
    );
    await page.goto(`${SITE_WITH_ANOTHER_CONTACT_ACTION.origin}/fr/`);
    const form = contactForm(page);
    await fillAsAVisitor(form);
    const request = await sendAndCatchThePost(page, form);
    expect(request.url(), 'the address the form posts to').toBe(
      new URL(OTHER_CONTACT_ACTION, SITE_WITH_ANOTHER_CONTACT_ACTION.origin).href,
    );
  });
});

test.describe('home page of another site, with another contactAction, in a browser with JavaScript', () => {
  let siteDirectory: string;
  test.beforeAll(() => {
    siteDirectory = buildSite(SITE_WITH_ANOTHER_CONTACT_ACTION);
  });
  test.afterAll(() => {
    removeDirectory(siteDirectory);
  });

  test('with JavaScript and another contactAction, sending the filled contact form posts it in the background to that other address, and not to the example site’s, and on a successful answer shows the confirmation', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_ANOTHER_CONTACT_ACTION, siteDirectory);
    /* Whatever address the form posts to, this site's or the example site's. */
    await answerWithSuccess(page, (url) => url.pathname === OTHER_CONTACT_ACTION || url.pathname === CONTACT_ACTION);
    await page.goto(`${SITE_WITH_ANOTHER_CONTACT_ACTION.origin}/fr/`);
    const form = contactForm(page);
    await fillAsAVisitor(form);
    const request = await sendAndCatchThePost(page, form);
    expect(request.url(), 'the address the form posts to').toBe(
      new URL(OTHER_CONTACT_ACTION, SITE_WITH_ANOTHER_CONTACT_ACTION.origin).href,
    );
    await expect(contactSection(page).getByText(CONTACT_CONFIRMATION), 'the confirmation').toBeVisible();
  });
});

/* The intro tests/fixtures/other-contact/content/_index.md declares for its contact section: a
   fictional bookbinder's. */
const OTHER_CONTACT_INTRO =
  'Ouverte aux commandes de reliure sur mesure, du carnet au registre. Écrivez-moi pour un devis.';

/* The confirmation tests/fixtures/other-contact/content/_index.md declares for its contact section
   ([params.contact] table, sent key), in the same fictional bookbinder's voice. */
const OTHER_CONTACT_SENT = 'Message bien reçu : je reviens vers vous avec un devis dès que mes cahiers sont cousus.';

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

  test('with JavaScript, after a successful send from the French home page of another site, whose contact params give a sent text, the section shows that text as the confirmation, and not the theme’s default one', async ({
    page,
    context,
  }) => {
    await serveSite(context, SITE_WITH_ANOTHER_CONTACT_INTRO, siteDirectory);
    await answerWithSuccess(page);
    /* Reduced motion: the confirmation shows whole at once, with no animation to wait for. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${SITE_WITH_ANOTHER_CONTACT_INTRO.origin}/fr/`);
    const section = contactSection(page);
    const form = contactForm(page);
    await fillAsAVisitor(form);
    await sendAndCatchThePost(page, form);
    await expect(section.getByText(OTHER_CONTACT_SENT), 'the site’s confirmation').toBeVisible();
    await expect(section.getByText(CONTACT_CONFIRMATION), 'the theme’s default confirmation').not.toBeVisible();
  });

  test.describe('browser without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('without JavaScript, opening at #contact-sent the French home page of another site, whose contact params give a sent text, shows that text as the confirmation, and not the theme’s default one', async ({
      page,
      context,
    }) => {
      await serveSite(context, SITE_WITH_ANOTHER_CONTACT_INTRO, siteDirectory);
      await openAsAFreshLoad(page, `${SITE_WITH_ANOTHER_CONTACT_INTRO.origin}/fr/#contact-sent`);
      const section = contactSection(page);
      await expect(section.getByText(OTHER_CONTACT_SENT), 'the site’s confirmation').toBeVisible();
      await expect(section.getByText(CONTACT_CONFIRMATION), 'the theme’s default confirmation').not.toBeVisible();
    });
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

test.describe('contact content errors: build failure', () => {
  runBuildTestsInOneProjectOnly();

  test('a home page with contact params, on a site without the contactAction site param, makes the site build fail with an error message that names contactAction', () => {
    /* tests/fixtures/unaddressed-form leaves out contactAction, while the example site's home pages
       declare contact params: rather than a form with nowhere to post to, the person building the
       site must get a failure whose message names the contactAction site param, so that they know
       what to set, whatever the rest of the wording. */
    const build = tryToBuildSite(SITE_WITHOUT_CONTACT_ACTION);
    expect(build.succeeded, 'the site build should fail').toBe(false);
    expect(build.errors, 'the error message should name contactAction').toMatch(/\bcontactAction\b/);
  });
});
