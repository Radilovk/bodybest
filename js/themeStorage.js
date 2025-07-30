export const DEFAULT_KEY = 'colorThemes';

export function getSavedThemes(storageKey = DEFAULT_KEY) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch {
    return {};
  }
}

export function storeThemes(storageKey, themes) {
  if (typeof themes === 'undefined') {
    themes = storageKey;
    storageKey = DEFAULT_KEY;
  }
  localStorage.setItem(storageKey, JSON.stringify(themes));
}

export function populateThemeSelect(selectId = 'savedThemes', storageKey = DEFAULT_KEY) {
  const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
  if (!select) return;
  select.innerHTML = '';
  const themes = getSavedThemes(storageKey);
  Object.keys(themes).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}
