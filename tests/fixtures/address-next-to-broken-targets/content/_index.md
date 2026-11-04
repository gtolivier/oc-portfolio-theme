+++
title = 'Accueil'

[params.hero]
title = 'Horloger indépendant'

[[params.hero.actions]]
label = 'Voir les projets'
pageRef = '/projects'

[[params.hero.actions]]
label = 'Contact'
url = '#contact'
pageRef = '/projects '

[[params.hero.actions]]
label = 'Écrire'
url = '#contact'
pageRef = { path = '/projects' }

[[params.hero.actions]]
label = 'Appeler'
url = '#contact'
pageRef = 42

[[params.hero.actions]]
label = 'Venir'
url = '#contact'
pageRef = '/page-fictive-introuvable'

[[params.hero.actions]]
label = 'Visiter'
url = '#contact'
pageRef = '/atelier-ferme'
+++

Accueil fictif dont chaque bouton du hero, sauf le premier, garde une adresse
valide à côté d’une page de destination fautive : suivie d’une espace, écrite
comme une table, comme un nombre, introuvable ou que Hugo ne rend pas.
