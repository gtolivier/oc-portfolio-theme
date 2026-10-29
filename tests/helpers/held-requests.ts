import { type Page, type Route } from '@playwright/test';

/* The URL of the theme's bundle, fingerprinted or not, on any origin or on the given one. */
export function themeScriptUrl(origin = '**'): string {
  return `${origin}/js/main*.js`;
}

/* The URL of the theme's stylesheet, fingerprinted or not, on any origin or on the given one. */
export function themeStylesheetUrl(origin = '**'): string {
  return `${origin}/css/main*.css`;
}

/* The URL of any font file, on any origin or on the given one. */
export function fontFilesUrl(origin = '**'): string {
  return `${origin}/**/*.{woff,woff2,ttf,otf}`;
}

export interface HeldRequests {
  /* Settles once the page has asked for a matching resource: its request is then held. */
  requested: Promise<void>;
  /* Lets the held requests through, and any later one, as when the slow resource finally arrives:
     the page's next route (such as the one serving a built site) or the server answers them. To
     follow with `end`, in a `finally`, which then only removes the route. */
  release(): void;
  /* Ends the hold, once the test has checked what it needs: the held requests fail, as if the
     connection dropped (unless `release` let them through first), and the route holding them is removed, the page's other routes left in
     place, without failing on a request still in flight as the test ends. Not letting them
     through: a page route removed while its request is held hands that request back to the
     browser, so a context route, such as the one serving a built site, would then answer a
     request already answered. To call in a `finally`. */
  end(): Promise<void>;
}

/* Holds back every request of the page to `url`, as on a very slow connection, until the test
   releases or ends the hold. */
export async function holdRequests(page: Page, url: string): Promise<HeldRequests> {
  /* How the hold ends: the first of `release` and `end` called decides. */
  let endHold!: (outcome: 'released' | 'failed') => void;
  const holdEnded = new Promise<'released' | 'failed'>((resolve) => {
    endHold = resolve;
  });
  let markRequested!: () => void;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  const hold = async (route: Route): Promise<void> => {
    markRequested();
    const outcome = await holdEnded;
    /* A request still in flight as the test ends, its page closing, cannot be handled any more. */
    if (outcome === 'released') {
      await route.fallback().catch(() => {});
    } else {
      await route.abort().catch(() => {});
    }
  };
  await page.route(url, hold);
  return {
    requested,
    release: () => endHold('released'),
    end: async () => {
      endHold('failed');
      await page.unroute(url, hold);
    },
  };
}

/* Blocks every request of the page to `url`: each one fails at once, as if a network or an
   extension refused it. A page route takes precedence over a context route, such as the one
   serving a built site. Returns the list, filled as the page asks for them, of the blocked URLs. */
export async function blockRequests(page: Page, url: string): Promise<string[]> {
  const blockedUrls: string[] = [];
  await page.route(url, async (route) => {
    blockedUrls.push(route.request().url());
    await route.abort();
  });
  return blockedUrls;
}
