import { loadConfig, saveConfig } from './adminConfig.js';

const inputs = {};

async function fetchColorVars() {
  const res = await fetch('css/base_styles.css');
  const css = await res.text();
  const regex = /--([a-zA-Z0-9-]*(?:-color|-bg|-border)[a-zA-Z0-9-]*)\s*:/g;
  const vars = new Set();
  let m;
  while ((m = regex.exec(css))) vars.add(m[1]);
  return [...vars];
}

function createInput(name, container) {
  const label = document.createElement('label');
  label.textContent = name.replace(/-/g, ' ');
  const input = document.createElement('input');
  input.type = 'color';
  input.id = `${name}Input`;
  label.appendChild(input);
  container.appendChild(label);
  inputs[name] = input;
}
const themeSelectId = 'savedThemes';
const themeNameId = 'themeNameInput';
const saveThemeBtnId = 'saveThemeLocal';
const applyThemeBtnId = 'applyThemeLocal';
const deleteThemeBtnId = 'deleteThemeLocal';

function setCssVar(key, val) {
  document.documentElement.style.setProperty(`--${key}`, val);
  document.body.style.setProperty(`--${key}`, val);
}

function getCurrentColor(key) {
  const bodyVal = getComputedStyle(document.body)
    .getPropertyValue(`--${key}`).trim();
  if (bodyVal) return bodyVal;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${key}`).trim();
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
  const container = document.getElementById('colorInputs');
  const vars = await fetchColorVars();
  if (container) vars.forEach(v => createInput(v, container));
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
