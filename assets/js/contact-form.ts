/* With JavaScript, the contact form is posted in the background, asking the endpoint for JSON, so
   the visitor stays on the page. On success the confirmation replaces the intro and the form; on
   an error answer, or none at all, the error message shows above the form, kept for a retry. */
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

/* Moves the confirmation's sentence into the status message, in place of the intro and the form,
   and focuses it. */
function showConfirmation(contact: Element | null): void {
  const confirmation = contact?.querySelector('.contact-sent');
  status.textContent = confirmation?.textContent ?? '';
  confirmation?.remove();
  contact?.classList.add('is-confirmed');
  status.focus();
}
