+++
title = 'Home'

[params.hero]
title = 'Independent clockmaker'

[[params.hero.actions]]
label = 'View projects'
pageRef = { path = '/projets' }

[[params.hero.actions]]
label = 'View projects'
pageRef = ''

[[params.hero.actions]]
label = 'View projects'
pageRef = '/projets '

[[params.hero.actions]]
label = 'See the workshop'
pageRef = '/shut-workshop'

[[params.hero.actions]]
label = 'Contact'
url = '#contact'
pageRef = '/projets'

[[params.hero.actions]]
label = 'Contact'

[[params.hero.actions]]
url = '#contact'
+++

Fictional home page whose hero buttons are all filled in by mistake: the first
declares its pageRef as a table, the second as an empty text, the third with a
trailing space, the fourth leads to a page Hugo does not render, the fifth has
both a url and a pageRef, the sixth neither, and the seventh no label.
