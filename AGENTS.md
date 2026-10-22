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
  `main` (une règle GitHub l'impose aussi). Ne fusionner qu'avec
  l'accord explicite de l'utilisateur.
- **Avant publication** : avant chaque push et chaque publication sur une
  PR, relire tout ce qui part sur ce dépôt public : diff, messages de
  commit, nom de branche, titre et description de la PR, revues et réponses.
  Rien de nouveau qui soit un secret (clé, mot de passe, jeton), une donnée
  personnelle, une URL interne (déploiement, webhook) ou un détail local :
  chemin sur la machine de l'utilisateur, version d'outil installée, contenu
  ou emplacement de sa configuration et de ses fichiers d'instructions
  privés, contenu du dépôt privé `oc-portfolio-site`. Restent permis : ce
  que le dépôt documente déjà et les lignes d'attribution des commits et des
  PR. Si un tel détail apparaît dans le diff, un commit ou le nom de
  branche, ne pas pousser et le signaler à l'utilisateur ; dans la
  description, une revue ou une réponse, le retirer avant de publier, en
  reformulant les remarques de relecture sans en supprimer aucune.
- **CodeRabbit** : sa politique pour les petits dépôts open source l'empêche
  de relire les PR de lui-même (« Review skipped »). Le lancer en commentant
  `@coderabbitai review` à l'ouverture de la PR. Si des commits ont suivi ce
  premier passage de CodeRabbit, le relancer une fois de plus, après le tri
  de la dernière relecture Claude que demande le skill et avant la demande
  d'accord. Ses remarques se trient comme les autres : le skill dit si leurs
  corrections appellent une relance Claude, et la demande d'accord liste
  celles qu'aucune relecture Claude n'a couvertes. Si, après ce second
  passage, arrive un commit autre qu'une correction de tri (« triage fix »,
  défini par le skill ; une proposition approuvée n'en est jamais une), le
  relancer une fois de plus avant de redemander l'accord. Ses remarques
  arrivées avant la fusion sont triées avant de fusionner ; si l'une
  entraîne une correction, redemander l'accord. S'il signale une limite
  atteinte, ne pas l'attendre : le dire dans la demande d'accord. Si sa
  relecture automatique se met à fonctionner, ne plus le lancer.
- **Relecture Claude** : sur chaque PR, quand `/code-review` est
  disponible, lancer `/code-review high <numéro>` (sans `--comment`).
  Publier ses remarques, trier toutes celles de la PR (Claude, CodeRabbit,
  utilisateur), relancer la relecture, demander l'accord et trier les
  remarques tardives comme le décrit le skill `tdd:feature`, dans « Pull
  request and reviews » à partir de « Collect the reviews », puis
  « Approval » et « After approval » ; hors TDD, sauter ce qui suppose une
  liste de comportements. Il faut sa version 0.9.0 ou plus (`claude plugin
  list`) ; sinon, le mettre à jour avant la relecture.
  - **Tri** : hors TDD, il corrige directement la documentation, la
    configuration du dépôt (`.github/`, `.coderabbit.yaml`) et la
    description de la PR ; toute autre remarque (gabarits, styles, `i18n/`,
    `exampleSite/`, scripts, tests, configuration npm ou Playwright)
    devient une proposition, à traiter dans une PR en TDD.
- **Aucune donnée personnelle** dans ce dépôt public : le vrai contenu
  (projets, parcours, coordonnées) va dans `oc-portfolio-site`.
