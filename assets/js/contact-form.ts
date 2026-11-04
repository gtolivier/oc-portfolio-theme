/* With JavaScript, the contact form is posted in the background, asking the endpoint for JSON, so
   the visitor stays on the page. On success the confirmation replaces the intro and the form. */
const form = document.querySelector<HTMLFormElement>('.contact form');

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  void fetch(form.action, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new FormData(form),
  })
    .then((response) => response.ok)
    .catch(() => false)
    .then((sent) => {
      const contact = form.closest('.contact');
      contact?.classList.toggle('is-sent', sent);
      contact?.classList.toggle('is-error', !sent);
    });
});
