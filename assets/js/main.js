// Point d'entrée JavaScript du thème.

// Mémorise le choix explicite d'une langue (clic ou clic du milieu).
function rememberLanguage(event) {
  const link = event.target.closest?.('a[data-lang-key]');
  if (!link) return;
  try {
    localStorage.setItem(link.dataset.langKey, link.getAttribute('hreflang'));
  } catch (e) {}
}

document.addEventListener('click', rememberLanguage);
document.addEventListener('auxclick', rememberLanguage);
