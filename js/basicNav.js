export function initBasicNav() {
  const body = document.body;
  const nav = document.getElementById('nav');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (mobileMenuBtn && nav) {
    const close = () => {
      body.classList.remove('nav-open');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    };
    const toggle = () => {
      const open = body.classList.toggle('nav-open');
      mobileMenuBtn.setAttribute('aria-expanded', open);
    };
    mobileMenuBtn.addEventListener('click', toggle);
    document.addEventListener('click', e => {
      if (
        body.classList.contains('nav-open') &&
        !nav.contains(e.target) &&
        e.target !== mobileMenuBtn
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
    const updateIcon = () => {
      const dark = document.body.classList.contains('dark-theme');
      themeToggleBtn.innerHTML = dark
        ? '<i class="bi bi-brightness-high-fill"></i>'
        : '<i class="bi bi-moon-stars-fill"></i>';
    };
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      document.body.classList.add(stored === 'dark' ? 'dark-theme' : 'light-theme');
    }
    updateIcon();
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      document.body.classList.toggle('light-theme');
      const isDark = document.body.classList.contains('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateIcon();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBasicNav);
} else {
  initBasicNav();
}
