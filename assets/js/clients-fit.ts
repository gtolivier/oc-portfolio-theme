/* When all the client names fit in the band, there is nothing to loop: the
   names stay still and the copies that make the loop seamless go away (the
   `is-still` class). CSS cannot compare the list's width with the band's. */
const clientsBand = document.querySelector<HTMLElement>('.clients');
const clientsWindow = clientsBand?.querySelector<HTMLElement>('.clients-window');
const clientsList = clientsBand?.querySelector<HTMLElement>('.clients-track > ul');
const clientsTrack = clientsBand?.querySelector<HTMLElement>('.clients-track');
/* The names scroll at this pace, whatever the clients: the loop lasts as long as it takes to
   slide by one half of the track. */
const CLIENTS_PACE_PX_PER_SECOND = 180;
if (clientsBand && clientsWindow && clientsList && clientsTrack) {
  const update = () => {
    const isStill = clientsList.offsetWidth <= clientsWindow.clientWidth;
    clientsBand.classList.toggle('is-still', isStill);
    if (!isStill) {
      const halfWidth = clientsTrack.scrollWidth / 2;
      clientsTrack.style.animationDuration = `${halfWidth / CLIENTS_PACE_PX_PER_SECOND}s`;
    }
  };
  new ResizeObserver(update).observe(clientsWindow);
  /* The width of the names depends on the font. */
  void document.fonts.ready.then(update);
  update();
}
