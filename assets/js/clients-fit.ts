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
const MILLISECONDS_PER_SECOND = 1000;
if (clientsBand && clientsWindow && clientsList && clientsTrack) {
  /* A running loop keeps its elapsed time when its duration changes (when a font swaps in), so
     the names would jump: it resumes from the same point of the loop instead. */
  const setLoopDuration = (seconds: number) => {
    const [loop] = clientsTrack.getAnimations();
    const progress = loop?.effect?.getComputedTiming().progress;
    clientsTrack.style.animationDuration = `${seconds}s`;
    if (loop && progress != null) loop.currentTime = progress * seconds * MILLISECONDS_PER_SECOND;
  };
  const update = () => {
    /* Unrounded widths: a list wider by a fraction of a pixel is cut too. The
       window has no border, padding or scrollbar: its box is what shows. */
    const listWidth = clientsList.getBoundingClientRect().width;
    const isScrolling = listWidth > clientsWindow.getBoundingClientRect().width;
    /* The pace is set before the loop starts, so that it never starts at another one. */
    if (isScrolling) setLoopDuration(listWidth / CLIENTS_PACE_PX_PER_SECOND);
    clientsBand.classList.toggle('is-scrolling', isScrolling);
  };
  /* Until this script runs, the names wrap (see main.css): if it never loads, they stay readable. */
  clientsBand.classList.add('is-measured');
  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(clientsWindow);
  /* The width of the names depends on the font: the list can change width
     on its own, when a font swaps in, while the window keeps its size. */
  resizeObserver.observe(clientsList);
  /* Measured at once, so that the band scrolls as soon as the script runs: some browsers
     deliver the observer's first callback later. */
  update();
}
