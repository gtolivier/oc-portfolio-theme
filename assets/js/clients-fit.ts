/* The client names stay still by default. Only when they do not all fit in
   the band do they loop, with the copy that makes the loop seamless (the
   `is-scrolling` class). CSS cannot compare the list's width with the band's. */
const clientsBand = document.querySelector<HTMLElement>('.clients');
const clientsWindow = clientsBand?.querySelector<HTMLElement>('.clients-window');
const clientsTrack = clientsBand?.querySelector<HTMLElement>('.clients-track');
const clientsList = clientsTrack?.querySelector<HTMLElement>(':scope > ul');
/* The names scroll at this pace, whatever the clients: the loop lasts as long as it takes to
   slide by one list, half of the track. */
const CLIENTS_PACE_PX_PER_SECOND = 39;
if (clientsBand && clientsWindow && clientsList && clientsTrack) {
  const update = () => {
    /* Unrounded widths: a list wider by a fraction of a pixel is cut too. The
       window has no border, padding or scrollbar: its box is what shows. */
    const listWidth = clientsList.getBoundingClientRect().width;
    const isScrolling = listWidth > clientsWindow.getBoundingClientRect().width;
    /* The pace is set before the loop starts, so that it never starts at another one. */
    if (isScrolling) clientsTrack.style.animationDuration = `${listWidth / CLIENTS_PACE_PX_PER_SECOND}s`;
    clientsBand.classList.toggle('is-scrolling', isScrolling);
  };
  /* The observer also calls update once each element is first laid out. */
  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(clientsWindow);
  /* The width of the names depends on the font: the list can change width
     on its own, when a font swaps in, while the window keeps its size. */
  resizeObserver.observe(clientsList);
}
