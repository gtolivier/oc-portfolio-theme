+++
title = 'Accueil'

[params.hero]
title = 'Horloger indépendant'
tagline = [
  'Montres mécaniques sur mesure — 20 ans d’atelier.',
  'Conception, réparation et entretien',
  'de pendules et de montres anciennes.',
]
stack = ['Laiton', 'Acier', 'Rubis', 'Émail']

# Chaque bouton a un label et une seule destination :
# - pageRef : une page du site, dont le thème calcule l'adresse ;
# - url : une ancre (« #contact »), une adresse externe (« https://… »,
#   « mailto:… »), ou une adresse qui commence par « / ». Celle-ci s'écrit
#   depuis la racine du site, sans le sous-chemin de la baseURL : si le site
#   est servi sous /portfolio/, url = '/fr/page-longue/' mène à
#   /portfolio/fr/page-longue/ (et url = '/portfolio/…' à
#   /portfolio/portfolio/…).
[[params.hero.actions]]
label = 'Voir les projets'
pageRef = '/projets'

[[params.hero.actions]]
label = 'Contact'
url = '#contact'
+++

Bienvenue sur ce site de démonstration : un texte d’exemple, fictif, pour le
corps de la page d’accueil. Il mène aussi vers les [projets d’exemple](/projets/).
