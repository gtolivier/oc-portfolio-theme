/* With JavaScript, the contact form is posted in the background, form-encoded, asking the endpoint
   for JSON, so the visitor stays on the page. On success the confirmation replaces the intro and
   the form: unless motion is reduced, the form goes at once, the intro is erased letter by letter,
   then the confirmation typed in letter by letter. On an error answer, or none at all, the error
   message shows above the form, kept for a retry. */
import { reducedMotionQuery } from './reduced-motion';

/* The mockup's pace: the intro starts to go once the form has begun to fold, is erased faster than
   the confirmation is typed. */
const ERASE_DELAY_MS = 340;
const ERASE_TICK_MS = 26;
const TYPING_TICK_MS = 50;

/* How long a send may wait for the endpoint's answer before it is given up. */
const SEND_TIMEOUT_MS = 15000;

const form = document.querySelector<HTMLFormElement>('.contact form');

let isSending = false;

/* An empty status message, present from the start so that assistive technologies announce what is
   put in it, the whole sentence at once. */
const status = document.createElement('div');
status.setAttribute('role', 'status');
status.tabIndex = -1;
status.className = 'contact-status';
if (form) form.parentElement?.insertBefore(status, form);

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isSending) return;
  isSending = true;
  /* aria-disabled rather than disabled: the button keeps the focus while the message is sent. */
  const sendButton = form.querySelector('button');
  sendButton?.setAttribute('aria-disabled', 'true');
  /* A send the endpoint never answers is given up after a while, as an error. */
  const abortion = new AbortController();
  const giveUp = setTimeout(() => abortion.abort(), SEND_TIMEOUT_MS);
  void fetch(form.action, {
    method: 'POST',
    signal: abortion.signal,
    headers: { Accept: 'application/json' },
    /* Form-encoded, as the browser posts the form without JavaScript, so the endpoint gets one
       encoding; the form has no file field, so every value is a string. */
    body: new URLSearchParams(Array.from(new FormData(form), ([name, value]) => [name, String(value)])),
  })
    .then((response) => response.ok)
    .catch(() => false)
    .then((sent) => {
      clearTimeout(giveUp);
      isSending = false;
      sendButton?.removeAttribute('aria-disabled');
      const contact = form.closest('.contact');
      if (sent) showConfirmation(contact);
      contact?.classList.toggle('is-error', !sent);
    });
});

/* Focuses the status message and moves the confirmation's sentence into it, in place of the intro
   and the form. Assistive technologies get the whole sentence at once, from the focused status;
   with motion allowed, the eyes get it typed in once the intro is erased. */
function showConfirmation(contact: Element | null): void {
  const confirmation = contact?.querySelector('.contact-sent');
  const sentence = confirmation?.textContent ?? '';
  confirmation?.remove();
  /* An error left by an earlier failed send, such as the one #contact-error targets, no longer applies. */
  contact?.querySelector('.contact-error')?.remove();
  status.focus();
  if (reducedMotionQuery().matches) {
    contact?.classList.add('is-confirmed');
    status.textContent = sentence;
    return;
  }
  status.replaceChildren(wholeSentence(sentence));
  contact?.classList.add('is-erasing');
  setTimeout(() => {
    eraseIntro(contact?.querySelector('.contact-intro'), () => {
      contact?.classList.add('is-confirmed');
      typeIn(sentence);
    });
  }, ERASE_DELAY_MS);
}

/* Erases the intro one letter at a time, from the end, then calls done. */
function eraseIntro(intro: Element | null | undefined, done: () => void): void {
  const text = intro?.textContent ?? '';
  const letters = Array.from(text);
  if (!intro || letters.length === 0) {
    done();
    return;
  }
  /* One text node, shortened by its last letter on each tick rather than rebuilt. */
  const shown = new Text(text);
  intro.replaceChildren(shown);
  const timer = setInterval(() => {
    const last = letters.pop() ?? '';
    shown.deleteData(shown.length - last.length, last.length);
    if (letters.length === 0) {
      clearInterval(timer);
      done();
    }
  }, ERASE_TICK_MS);
}

/* Assistive technologies get the whole sentence at once; the typed letters are for the eyes. */
function wholeSentence(sentence: string): HTMLSpanElement {
  const whole = document.createElement('span');
  whole.className = 'contact-status-whole';
  whole.textContent = sentence;
  return whole;
}

/* Types the sentence into the status message, after its whole sentence, one letter at a time. */
function typeIn(sentence: string): void {
  const letters = Array.from(sentence);
  let typedCount = 0;
  const typed = document.createElement('span');
  typed.setAttribute('aria-hidden', 'true');
  /* One text node, grown by the next letter on each tick rather than rebuilt. */
  const typedLetters = new Text();
  typed.append(typedLetters);
  status.append(typed);
  const timer = setInterval(() => {
    typedLetters.appendData(letters[typedCount] ?? '');
    typedCount += 1;
    if (typedCount >= letters.length) clearInterval(timer);
  }, TYPING_TICK_MS);
}
