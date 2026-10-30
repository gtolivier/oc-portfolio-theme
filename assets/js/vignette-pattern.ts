/* Draws each project vignette's tick pattern anew at every load: the stylesheet
   paints the ticks from these custom properties, and this sets them at random. */

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

for (const vignette of document.querySelectorAll<HTMLElement>('.project-vignette')) {
  vignette.style.setProperty('--vignette-tick-pitch', `${randomBetween(8, 14)}px`);
  vignette.style.setProperty('--vignette-row-pitch', `${randomBetween(10, 16)}px`);
  vignette.style.setProperty('--vignette-long-tick-length', `${randomBetween(5, 8)}px`);
}
