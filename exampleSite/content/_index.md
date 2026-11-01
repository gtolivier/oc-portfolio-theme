+++
title = 'Accueil'

[params]
clients = [
  'Bijouterie Valmont',
  'Antiquités Roussel',
  'Château de Mirevent',
  'Galerie Aubertin',
  'Maison Delorme',
]
projects = [
  'projets/restauration-pendule',
  'projets/montre-grande-complication',
  'projets/horloge-astronomique',
  'projets/regulateur-noyer',
]

[params.background]
intro = [
  'Formé à l’horlogerie ancienne dans le Jura.',
  'Atelier indépendant depuis 2004.',
  'Pendules, régulateurs et montres de poche.',
]
education = [
  'CFC d’horloger rhabilleur — École d’horlogerie de Porrentruy, 2001',
  'Brevet de restaurateur de pendules — Lycée Victor-Bérard, Morez, 2003',
]

[[params.background.stats]]
value = '20+'
label = 'Ans de métier'

[[params.background.stats]]
value = '350'
label = 'Pendules restaurées'

[[params.background.skills]]
title = 'Mécanique'
items = ['Restauration de mouvements', 'Taillage d’engrenages']

[[params.background.skills]]
title = 'Finitions'
items = ['Anglage', 'Perlage', 'Dorure à la feuille']

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
