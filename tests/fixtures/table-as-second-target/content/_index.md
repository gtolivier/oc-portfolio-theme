+++
title = 'Accueil'

[params.hero]
title = 'Horloger indépendant'

[[params.hero.actions]]
label = 'Voir les projets'
pageRef = '/projets'

[[params.hero.actions]]
label = 'Contact'
pageRef = { path = '/projets' }
+++

Accueil fictif dont le premier bouton du hero est bien rempli, mais dont le
second déclare par erreur son pageRef comme une table avec un champ path plutôt
que comme une référence de page.
