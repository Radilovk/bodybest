export function initMobileMenu() {
  const body = document.body;
  const nav = document.getElementById('nav');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (!nav || !mobileMenuBtn) {
    console.warn('mobileMenu.js: липсва елемент за мобилно меню', {
      navExists: !!nav,
      btnExists: !!mobileMenuBtn
    });
    return;
  }
  const closeNav = () => {
    body.classList.remove('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
  };
  const toggleNav = () => {
    const open = body.classList.toggle('nav-open');
    mobileMenuBtn.setAttribute('aria-expanded', open);
  };
  mobileMenuBtn.addEventListener('click', toggleNav);
  document.addEventListener('click', (e) => {
    if (
      body.classList.contains('nav-open') &&
      !nav.contains(e.target) &&
      !mobileMenuBtn.contains(e.target)
    ) {
      closeNav();
    }
  });
  nav.addEventListener('click', (e) => { if (e.target === nav) closeNav(); });
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeNav);
  });
}
