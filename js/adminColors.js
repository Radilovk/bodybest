import { loadConfig, saveConfig } from './adminConfig.js';

const inputSelectors = {
  primary: '#primaryColorInput',
  secondary: '#secondaryColorInput',
  accent: '#accentColorInput',
  tertiary: '#tertiaryColorInput'
};

const inputs = {};
const themeSelectId = 'savedThemes';
const themeNameId = 'themeNameInput';
const saveThemeBtnId = 'saveThemeLocal';
const applyThemeBtnId = 'applyThemeLocal';
const deleteThemeBtnId = 'deleteThemeLocal';

function setCssVar(key, val) {
  document.documentElement.style.setProperty(`--${key}-color`, val);
  document.body.style.setProperty(`--${key}-color`, val);
}

function getCurrentColor(key) {
  const bodyVal = getComputedStyle(document.body)
    .getPropertyValue(`--${key}-color`).trim();
  if (bodyVal) return bodyVal;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${key}-color`).trim();
}

function getSavedThemes() {
  try {
    return JSON.parse(localStorage.getItem('colorThemes') || '{}');
  } catch {
    return {};
  }
}

function storeThemes(themes) {
  localStorage.setItem('colorThemes', JSON.stringify(themes));
}

function populateThemeSelect() {
  const select = document.getElementById(themeSelectId);
  if (!select) return;
  select.innerHTML = '';
  const themes = getSavedThemes();
  Object.keys(themes).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

function saveTheme() {
  const nameInput = document.getElementById(themeNameId);
  if (!nameInput || !nameInput.value) return;
  const themes = getSavedThemes();
  const colors = {};
  Object.entries(inputs).forEach(([k, el]) => {
    if (el) colors[k] = el.value;
  });
  themes[nameInput.value] = colors;
  storeThemes(themes);
  populateThemeSelect();
}

function applyThemeFromSelect() {
  const select = document.getElementById(themeSelectId);
  if (!select) return;
  const themes = getSavedThemes();
  const theme = themes[select.value];
  if (!theme) return;
  Object.entries(theme).forEach(([k, val]) => {
    const el = inputs[k];
    if (el) {
      el.value = val;
      setCssVar(k, val);
    }
  });
}

function deleteSelectedTheme() {
  const select = document.getElementById(themeSelectId);
  if (!select) return;
  const themes = getSavedThemes();
  if (themes[select.value]) {
    delete themes[select.value];
    storeThemes(themes);
    populateThemeSelect();
  }
}

export async function initColorSettings() {
  for (const [key, sel] of Object.entries(inputSelectors)) {
    inputs[key] = document.querySelector(sel);
  }
  const saveBtn = document.getElementById('saveColorConfig');
  populateThemeSelect();
  const saveThemeBtn = document.getElementById(saveThemeBtnId);
  const applyThemeBtn = document.getElementById(applyThemeBtnId);
  const deleteThemeBtn = document.getElementById(deleteThemeBtnId);
  if (!saveBtn) return;
  try {
    const { colors = {} } = await loadConfig(['colors']);
    Object.entries(inputs).forEach(([k, el]) => {
      if (!el) return;
      const current = getCurrentColor(k);
      el.value = colors[k] || current;
      setCssVar(k, el.value);
      el.addEventListener('input', () => setCssVar(k, el.value));
    });
  } catch (err) {
    console.warn('Неуспешно зареждане на цветовете', err);
    Object.entries(inputs).forEach(([k, el]) => {
      if (!el) return;
      const current = getCurrentColor(k);
      el.value = current;
      el.addEventListener('input', () => setCssVar(k, el.value));
    });
  }

  saveBtn.addEventListener('click', async () => {
    const colors = {};
    Object.entries(inputs).forEach(([k, el]) => {
      if (el) colors[k] = el.value;
    });
    try {
      await saveConfig({ colors });
      alert('Цветовете са записани.');
    } catch (err) {
      console.error('Грешка при запис на цветовете', err);
      alert('Грешка при запис на цветовете.');
    }
  });

  if (saveThemeBtn) saveThemeBtn.addEventListener('click', saveTheme);
  if (applyThemeBtn) applyThemeBtn.addEventListener('click', applyThemeFromSelect);
  if (deleteThemeBtn) deleteThemeBtn.addEventListener('click', deleteSelectedTheme);
}

document.addEventListener('DOMContentLoaded', initColorSettings);
