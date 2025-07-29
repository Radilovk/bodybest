export function updateMenuIcon(btn, open) {
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.classList.toggle('fa-bars', !open);
  icon.classList.toggle('fa-times', open);
}

export function toggleNav(body = document.body, nav = document.getElementById('nav'), btn = document.querySelector('.mobile-menu-btn')) {
  if (!btn || !nav) return false;
  const open = body.classList.toggle('nav-open');
  btn.setAttribute('aria-expanded', open);
  if (open) window.scrollTo({ top: 0 });
  updateMenuIcon(btn, open);
  return open;
}

export function initNavMenu() {
  const nav = document.getElementById('nav');
  const btn = document.querySelector('.mobile-menu-btn');
  if (!nav || !btn) return;
  const toggle = () => toggleNav(document.body, nav, btn);
  btn.addEventListener('click', toggle);
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (document.body.classList.contains('nav-open')) toggle();
    });
  });
  updateMenuIcon(btn, document.body.classList.contains('nav-open'));
}
