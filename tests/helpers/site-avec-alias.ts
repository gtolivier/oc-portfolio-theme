import type { BrowserContext } from '@playwright/test';
import { construireUnSite, servirUnSite, supprimerUnSite } from './site-construit';

/* Le site d'exemple n'a aucune page avec des alias : ce site-ci lui ajoute
   les pages de tests/fixtures/alias/content (une page anglaise qui déclare
   une ancienne adresse, et sa traduction française), et donne à son
   accueil anglais l'ancienne adresse /en/english/ (voir
   tests/fixtures/alias/hugo.toml). Il est servi sous cette adresse. */
export const ORIGINE_SITE_AVEC_ALIAS = 'http://localhost:1316';

export function construireLeSiteAvecAlias(): string {
  return construireUnSite('../tests/fixtures/alias/hugo.toml', ORIGINE_SITE_AVEC_ALIAS, 'oc-portfolio-alias-');
}

export function supprimerLeSiteAvecAlias(dossier: string): void {
  supprimerUnSite(dossier);
}

export async function servirLeSiteAvecAlias(context: BrowserContext, dossier: string): Promise<void> {
  await servirUnSite(context, ORIGINE_SITE_AVEC_ALIAS, dossier);
}
