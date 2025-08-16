import { loadTemplateInto } from './templateLoader.js';
import { initMobileMenu } from './mobileMenu.js';

export async function loadNav() {
  await loadTemplateInto('partials/nav.html', 'nav-placeholder');
  adjustNavLinks();
  initMobileMenu();
}

function adjustNavLinks() {
  const onIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
  if (onIndex) {
    document.querySelectorAll('#nav a[href^="index.html"]').forEach(link => {
      const hash = link.getAttribute('href').replace('index.html', '');
      link.setAttribute('href', hash);
    });
  }
}
