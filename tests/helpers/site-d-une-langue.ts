import type { BrowserContext } from '@playwright/test';
import { construireUnSite, servirUnSite, supprimerUnSite } from './site-construit';

/* Le site d'exemple est bilingue : ce site-ci est le même, construit en
   français seulement (tests/fixtures/une-langue/hugo.toml désactive
   l'anglais). Il est servi sous cette adresse. */
export const ORIGINE_SITE_D_UNE_LANGUE = 'http://localhost:1317';

export function construireLeSiteDUneLangue(): string {
  return construireUnSite('../tests/fixtures/une-langue/hugo.toml', ORIGINE_SITE_D_UNE_LANGUE, 'oc-portfolio-une-langue-');
}

export function supprimerLeSiteDUneLangue(dossier: string): void {
  supprimerUnSite(dossier);
}

export async function servirLeSiteDUneLangue(context: BrowserContext, dossier: string): Promise<void> {
  await servirUnSite(context, ORIGINE_SITE_D_UNE_LANGUE, dossier);
}
