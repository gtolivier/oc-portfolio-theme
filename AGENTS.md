# oc-portfolio-theme

Thème Hugo (public) du portfolio d'Olivier Charvoz. Le contenu vit dans un
dépôt séparé et privé, `oc-portfolio-site`, qui importe ce thème comme module
Hugo (`github.com/gtolivier/oc-portfolio-theme`). Le design d'origine vient
du projet Claude Design « Portfolio ».

## Organisation

- `layouts/`, `assets/`, `i18n/` : le thème.
- `exampleSite/` : site de démonstration bilingue (FR par défaut, EN). Il sert
  de terrain aux tests ; son contenu est fictif.
- `tests/` : tests e2e Playwright, lancés contre `exampleSite`.

La roadmap (une conversation par fonctionnalité) vit dans le dépôt privé
`oc-portfolio-site`, à côté de ce dépôt : `../site/ROADMAP.md`.

## Commandes

- `hugo server --source exampleSite` : site d'exemple en local.
- `npm test` : tests Playwright (démarre Hugo tout seul, port 1314).
- `npx playwright test --project=chromium` : un seul navigateur.

## Règles

- **TDD obligatoire** : toute fonctionnalité passe par le skill `tdd:feature`
  (branche dédiée, cycles red/green/refactor, pull request). Pas de code de
  production sans test qui échoue d'abord.
- **Tests e2e avec Playwright** : un test décrit un comportement visible par
  le visiteur (texte, lien, navigation, rendu à une taille d'écran), pas un
  détail d'implémentation.
- **Mobile first** : les styles de base visent le téléphone ; les écrans plus
  larges sont enrichis via `@media (min-width: …)`. Les projets Playwright
  `mobile-chrome` et `mobile-safari` vérifient chaque comportement sur
  téléphone.
- **Site statique** : pas de JavaScript indispensable à la lecture du contenu.
  Les animations sont un enrichissement et respectent
  `prefers-reduced-motion`.
- **Outils déterministes** : passer par les CLI (`hugo`, `npm`, `npx`, `git`,
  `gh`) plutôt que par une manipulation manuelle dès qu'ils couvrent
  l'opération.
- **Pull requests** : tout changement passe par une branche et une PR, même
  une simple correction de documentation ; jamais de commit direct sur
  `main`. Ne fusionner qu'avec l'accord explicite de l'utilisateur.
- **CodeRabbit** : sa politique pour les petits dépôts open source l'empêche
  de relire les PR de lui-même (« Review skipped »). Le lancer en commentant
  `@coderabbitai review` à l'ouverture de la PR, puis une seule fois de plus
  avant la demande d'accord si des commits ont suivi. S'il signale une limite
  atteinte, ne pas l'attendre : le dire dans la demande d'accord. Si sa
  relecture automatique se met à fonctionner, ne plus le lancer.
- **Relecture Claude** : sur chaque PR, quand `/code-review` est disponible,
  lancer `/code-review high <numéro>` (sans `--comment`), publier ses
  remarques et les trier comme le décrit le skill `tdd:feature`, y compris
  hors TDD : un comportement mal implémenté passe par un nouveau cycle, une
  amélioration du code de production par `refactor`, un nouveau
  comportement devient une proposition ; la documentation et la
  configuration se corrigent directement. Si le tri a poussé des
  corrections, relancer la relecture une seule fois, publier son résultat
  de la même façon, même sans remarque, sans répéter celles déjà publiées,
  et le trier. Pas de relance après celle-ci : la demande d'accord liste les
  corrections qu'elle a entraînées, non relues.
- **Aucune donnée personnelle** dans ce dépôt public : le vrai contenu
  (projets, parcours, coordonnées) va dans `oc-portfolio-site`.
