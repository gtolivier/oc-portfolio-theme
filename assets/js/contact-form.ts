/* With JavaScript, the contact form is posted in the background, asking the endpoint for JSON, so
   the visitor stays on the page. On success the confirmation replaces the intro and the form:
   unless motion is reduced, the form goes at once, the intro is erased letter by letter, then the
   confirmation typed in letter by letter. On an error answer, or none at all, the error message
   shows above the form, kept for a retry. */
import { reducedMotionQuery } from './reduced-motion';

/* The mockup's pace: the intro starts to go once the form has begun to fold, is erased faster than
   the confirmation is typed. */
const ERASE_DELAY_MS = 340;
const ERASE_TICK_MS = 26;
const TYPING_TICK_MS = 50;

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
  void fetch(form.action, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form),
  })
    .then((response) => response.ok)
    .catch(() => false)
    .then((sent) => {
      isSending = false;
      const contact = form.closest('.contact');
      if (sent) showConfirmation(contact);
      contact?.classList.toggle('is-error', !sent);
    });
});

/* Focuses the status message and moves the confirmation's sentence into it, in place of the intro
   and the form; with motion allowed, the sentence comes once the intro is erased. */
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
  /* Focused while still empty, the status message is named after the whole sentence, so that
     assistive technologies get it right away, before it is typed. */
  status.setAttribute('aria-label', sentence);
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
  const letters = Array.from(intro?.textContent ?? '');
  if (!intro || letters.length === 0) {
    done();
    return;
  }
  const timer = setInterval(() => {
    letters.pop();
    intro.textContent = letters.join('');
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

/* Types the sentence into the status message, one letter at a time. */
function typeIn(sentence: string): void {
  const letters = Array.from(sentence);
  let typedCount = 0;
  const typed = document.createElement('span');
  typed.setAttribute('aria-hidden', 'true');
  status.removeAttribute('aria-label');
  status.replaceChildren(wholeSentence(sentence), typed);
  const timer = setInterval(() => {
    typedCount += 1;
    typed.textContent = letters.slice(0, typedCount).join('');
    if (typedCount >= letters.length) clearInterval(timer);
  }, TYPING_TICK_MS);
}
