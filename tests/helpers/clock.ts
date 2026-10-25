import { type Page } from '@playwright/test';

/* The fake clock starts at CLOCK_INSTALL_TIME and stops at CLOCK_STOP_TIME, later: real time
   keeps moving between the two calls, and Firefox refuses to pause at a time already past
   ("Cannot fast-forward to the past"). */
const CLOCK_INSTALL_TIME = new Date('2026-01-01T09:00:00');
const CLOCK_STOP_TIME = new Date('2026-01-01T09:00:01');

/* Time stands still from before the page loads: no animation frame runs and no timer fires
   until the test advances the clock. To call before page.goto, so that moving the clock to
   CLOCK_STOP_TIME affects no page timer. */
export async function stopClockBeforeLoad(page: Page): Promise<void> {
  await page.clock.install({ time: CLOCK_INSTALL_TIME });
  await page.clock.pauseAt(CLOCK_STOP_TIME);
}
