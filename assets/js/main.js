// Point d'entrée JavaScript du thème.

// Un choix explicite de langue l'emporte ensuite sur les langues du
// navigateur quand la redirection de / (layouts/alias.html) le relit.
// Le clic du milieu compte aussi : il ouvre la page dans un nouvel onglet.
function rememberLanguage(event) {
  const link = event.target.closest?.('a[data-lang-key]');
  if (!link) return;
  try {
    localStorage.setItem(link.dataset.langKey, link.getAttribute('hreflang'));
  } catch (e) {}
}

document.addEventListener('click', rememberLanguage);
document.addEventListener('auxclick', rememberLanguage);
