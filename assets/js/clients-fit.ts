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
const MS_PER_SECOND = 1000;
const loopSeconds = (listWidth: number): number => listWidth / CLIENTS_PACE_PX_PER_SECOND;
if (clientsBand && clientsWindow && clientsList && clientsTrack) {
  /* The list width the running loop's duration was set for; undefined while the names are still.
     Resizing the window fires the observer every frame: the loop is left alone (no style write)
     unless it starts or the list changes width. */
  let loopListWidth: number | undefined;
  /* A running loop keeps its elapsed time when its duration changes (when a font swaps in). That
     time counts whole loops of the old length, which are not whole loops of the new one: only the
     part of the current loop is kept. The pace being the same, the names then stay where they
     were, modulo one loop: they do not jump. */
  const setLoopFor = (listWidth: number): void => {
    const runningLoop = loopListWidth === undefined ? undefined : clientsTrack.getAnimations()[0];
    const elapsedMs = Number(runningLoop?.currentTime ?? 0);
    clientsTrack.style.animationDuration = `${loopSeconds(listWidth)}s`;
    if (runningLoop && loopListWidth !== undefined) {
      runningLoop.currentTime = elapsedMs % (loopSeconds(loopListWidth) * MS_PER_SECOND);
    }
  };
  /* Where the last name's text ends: its margin and its separator, which shows only while the
     names loop, are space after it, and names ending within that space still fit. */
  const namesWidth = (): number => {
    const lastItem = clientsList.lastElementChild;
    if (!lastItem) {
      return 0;
    }
    const range = document.createRange();
    range.selectNodeContents(lastItem);
    return range.getBoundingClientRect().right - clientsList.getBoundingClientRect().left;
  };
  /* The room the names have: from the window's left edge to the band's content edge. While the
     names scroll, the pause button takes part of it from the window; once they stop, the window
     gets it back. Measured the same way in both states, or the names would never stop. */
  const namesRoom = (): number => {
    const bandStyle = getComputedStyle(clientsBand);
    const contentRight =
      clientsBand.getBoundingClientRect().right -
      parseFloat(bandStyle.borderRightWidth) -
      parseFloat(bandStyle.paddingRight);
    return contentRight - clientsWindow.getBoundingClientRect().left;
  };
  const update = () => {
    /* Unrounded widths: a list wider by a fraction of a pixel is cut too. */
    const isScrolling = namesWidth() > namesRoom();
    clientsBand.classList.toggle('is-scrolling', isScrolling);
    if (!isScrolling) {
      loopListWidth = undefined;
      return;
    }
    /* Measured once the class is on: while the names loop, the last name's separator shows too.
       The pace is still set before the loop's first frame, so that it never starts at another one. */
    const listWidth = clientsList.getBoundingClientRect().width;
    if (listWidth !== loopListWidth) {
      setLoopFor(listWidth);
    }
    loopListWidth = listWidth;
  };
  const pauseButton = clientsBand.querySelector<HTMLButtonElement>('.clients-pause');
  pauseButton?.addEventListener('click', () => {
    const isPaused = pauseButton.getAttribute('aria-pressed') !== 'true';
    pauseButton.setAttribute('aria-pressed', String(isPaused));
    clientsTrack.classList.toggle('is-paused', isPaused);
  });
  const resizeObserver = new ResizeObserver(update);
  /* Without this class, once head/js.html drops theme-script-pending, the names wrap (see main.css):
     if this script never runs, they stay readable. Like theme-script-pending, it marks the root
     element, so that main.css also lays out the first screen around the band. */
  document.documentElement.classList.add('clients-measured');
  resizeObserver.observe(clientsWindow);
  /* The width of the names depends on the font: the list can change width
     on its own, when a font swaps in, while the window keeps its size. */
  resizeObserver.observe(clientsList);
  /* Measured at once, so that the band scrolls as soon as the script runs: some browsers
     deliver the observer's first callback later. */
  update();
}
