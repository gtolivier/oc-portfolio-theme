/* When all the client names fit in the band, there is nothing to loop: the
   names stay still and the copies that make the loop seamless go away (the
   `is-still` class). CSS cannot compare the list's width with the band's. */
const clientsBand = document.querySelector<HTMLElement>('.clients');
const clientsWindow = clientsBand?.querySelector<HTMLElement>('.clients-window');
const clientsList = clientsBand?.querySelector<HTMLElement>('.clients-track > ul');
if (clientsBand && clientsWindow && clientsList) {
  const update = () => {
    clientsBand.classList.toggle('is-still', clientsList.offsetWidth <= clientsWindow.clientWidth);
  };
  new ResizeObserver(update).observe(clientsWindow);
  /* The width of the names depends on the font. */
  void document.fonts.ready.then(update);
  update();
}
