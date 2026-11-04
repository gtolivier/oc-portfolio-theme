/* With JavaScript, the contact form is posted in the background, asking the endpoint for JSON, so
   the visitor stays on the page. On success the confirmation replaces the intro and the form; on
   an error answer, or none at all, the error message shows above the form, kept for a retry. */
const form = document.querySelector<HTMLFormElement>('.contact form');

let sending = false;

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (sending) return;
  sending = true;
  void fetch(form.action, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form),
  })
    .then((response) => response.ok)
    .catch(() => false)
    .then((sent) => {
      sending = false;
      const contact = form.closest('.contact');
      contact?.classList.toggle('is-sent', sent);
      contact?.classList.toggle('is-error', !sent);
    });
});
