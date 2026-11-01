+++
title = 'Accueil'

[params.hero]
title = 'Horloger indépendant'

[[params.hero.actions]]
label = 'Voir les projets'
pageRef = '/projets'

[[params.hero.actions]]
label = 'Contact'
url = '#contact'
pageRef = false
+++

Accueil fictif dont le second bouton du hero a un libellé, une url valide et,
par erreur, un pageRef déclaré comme le booléen faux : deux destinations
déclarées pour un seul bouton.
