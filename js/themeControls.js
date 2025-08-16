const themes = ['light', 'dark', 'vivid'];
let systemThemeMediaQuery;

function handleSystemThemeChange(e) {
  const pref = localStorage.getItem('theme') || 'system';
  if (pref === 'system') {
    applyTheme(e.matches ? 'dark' : 'light');
    updateThemeButtonText();
  }
}

export function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'system';
  systemThemeMediaQuery = systemThemeMediaQuery || window.matchMedia('(prefers-color-scheme: dark)');
  const systemTheme = systemThemeMediaQuery.matches ? 'dark' : 'light';
  if (!systemThemeMediaQuery.onchange) {
    systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
  }
  let theme = savedTheme === 'system' ? systemTheme : savedTheme;
  if (!themes.includes(theme)) theme = 'light';
  applyTheme(theme);
  updateThemeButtonText();
}

export function applyTheme(theme) {
  document.body.classList.remove('light-theme', 'dark-theme', 'vivid-theme');
  const cls = theme === 'dark' ? 'dark-theme' : theme === 'vivid' ? 'vivid-theme' : 'light-theme';
  document.body.classList.add(cls);
  document.dispatchEvent(new Event('themechange'));
  document.dispatchEvent(new Event('progressChartThemeChange'));
}

export function toggleTheme() {
  const current = document.body.classList.contains('dark-theme')
    ? 'dark'
    : document.body.classList.contains('vivid-theme')
    ? 'vivid'
    : 'light';
  const idx = themes.indexOf(current);
  const nextTheme = themes[(idx + 1) % themes.length];
  localStorage.setItem('theme', nextTheme);
  applyTheme(nextTheme);
  updateThemeButtonText();
}

export function updateThemeButtonText() {
  const menu = document.getElementById('theme-toggle-menu');
  if (!menu) return;
  const themeTextSpan = menu.querySelector('.theme-text');
  const themeIconSpan = menu.querySelector('.menu-icon');
  const current = document.body.classList.contains('dark-theme')
    ? 'dark'
    : document.body.classList.contains('vivid-theme')
    ? 'vivid'
    : 'light';
  const nextTheme = themes[(themes.indexOf(current) + 1) % themes.length];
  const labels = { light: 'Светла Тема', dark: 'Тъмна Тема', vivid: 'Ярка Тема' };
  const icons = {
    light: '<i class="bi bi-moon"></i>',
    dark: '<i class="bi bi-palette-fill"></i>',
    vivid: '<i class="bi bi-sun"></i>'
  };
  if (current === 'vivid') {
    if (themeTextSpan) themeTextSpan.textContent = 'Цветна Тема';
    if (themeIconSpan) themeIconSpan.innerHTML = '<i class="bi bi-palette"></i>';
  } else {
    if (themeTextSpan) themeTextSpan.textContent = labels[nextTheme];
    if (themeIconSpan) themeIconSpan.innerHTML = icons[nextTheme];
  }
}
