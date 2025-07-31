export function initBasicNav() {
  const body = document.body;
  const nav = document.getElementById('nav');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (mobileMenuBtn && nav) {
    const applyHeaderColor = () => {
      const rootStyles = getComputedStyle(document.documentElement);
      const bg =
        rootStyles.getPropertyValue('--mobile-menu-bg').trim() ||
        rootStyles.getPropertyValue('--header-bg-solid').trim();
      if (bg) nav.style.background = bg;
    };
    const close = () => {
      body.classList.remove('nav-open');
      nav.style.background = '';
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    };
    const toggle = () => {
      applyHeaderColor();
      const open = body.classList.toggle('nav-open');
      mobileMenuBtn.setAttribute('aria-expanded', open);
    };
    mobileMenuBtn.addEventListener('click', toggle);
    document.addEventListener('click', e => {
      if (
        body.classList.contains('nav-open') &&
        !nav.contains(e.target) &&
        !mobileMenuBtn.contains(e.target)
      ) {
        close();
      }
    });
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', close);
    });
  }
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    const icons = {
      light: '<i class="bi bi-moon-stars-fill"></i>',
      dark: '<i class="bi bi-palette-fill"></i>',
      vivid: '<i class="bi bi-brightness-high-fill"></i>'
    };
    const themeOrder = ['light', 'dark', 'vivid'];
    const getCurrent = () =>
      document.body.classList.contains('dark-theme')
        ? 'dark'
        : document.body.classList.contains('vivid-theme')
        ? 'vivid'
        : 'light';
    const apply = t => {
      document.body.classList.remove('light-theme', 'dark-theme', 'vivid-theme');
      document.body.classList.add(
        t === 'dark' ? 'dark-theme' : t === 'vivid' ? 'vivid-theme' : 'light-theme'
      );
    };
    const updateIcon = () => {
      const next = themeOrder[(themeOrder.indexOf(getCurrent()) + 1) % themeOrder.length];
      themeToggleBtn.innerHTML = icons[next];
    };
    const stored = localStorage.getItem('theme');
    if (['light', 'dark', 'vivid'].includes(stored)) apply(stored);
    updateIcon();
    themeToggleBtn.addEventListener('click', () => {
      const current = getCurrent();
      const next = themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
      localStorage.setItem('theme', next);
      apply(next);
      updateIcon();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBasicNav);
} else {
  initBasicNav();
}
