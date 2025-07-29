import { loadConfig, saveConfig } from './adminConfig.js';
import { colorGroups } from './themeConfig.js';

const inputs = {};

async function fetchBaseStyles() {
  const res = await fetch('css/base_styles.css');
  return res.text();
}

function getAllVars() {
  return colorGroups.flatMap(g => g.items.map(it => it.var));
}

function parseDefaultThemes(css, keys) {
  const light = {};
  const dark = {};
  const rootMatch = css.match(/:root\s*{([^}]*)}/s);
  const darkMatch = css.match(/body\.dark-theme\s*{([^}]*)}/s);
  if (rootMatch) {
    rootMatch[1].split(';').forEach(line => {
      const m = line.match(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+)/);
      if (m && keys.includes(m[1])) light[m[1]] = m[2].trim();
    });
  }
  if (darkMatch) {
    darkMatch[1].split(';').forEach(line => {
      const m = line.match(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+)/);
      if (m && keys.includes(m[1])) dark[m[1]] = m[2].trim();
    });
  }
  return { light, dark };
}

function createInput(item, container) {
  const label = document.createElement('label');
  label.textContent = item.label || item.var;
  if (item.description) label.title = item.description;
  const input = document.createElement('input');
  input.type = item.type || 'color';
  if (item.type === 'range') {
    if (item.min !== undefined) input.min = item.min;
    if (item.max !== undefined) input.max = item.max;
    if (item.step !== undefined) input.step = item.step;
  }
  input.id = `${item.var}Input`;
  label.appendChild(input);
  container.appendChild(label);
  inputs[item.var] = input;
}
const themeSelectId = 'savedThemes';
const themeNameId = 'themeNameInput';
const saveThemeBtnId = 'saveThemeLocal';
const applyThemeBtnId = 'applyThemeLocal';
const deleteThemeBtnId = 'deleteThemeLocal';
const previewThemeBtnId = 'previewTheme';
const exportThemeBtnId = 'exportTheme';
const importThemeInputId = 'importTheme';
const importThemeBtnId = 'importThemeBtn';

const vividTheme = {
  'primary-color': '#00FFFF',
  'secondary-color': '#FFFF00',
  'accent-color': '#008080',
  'tertiary-color': '#AAAA55',
  'progress-end-color': '#80FF80'
};

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
  Object.keys(themes).sort().forEach(name => {
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

function previewCurrentTheme() {
  Object.entries(inputs).forEach(([k, el]) => {
    if (el) setCssVar(k, el.value);
  });
}

function exportThemeToFile() {
  const colors = {};
  Object.entries(inputs).forEach(([k, el]) => { if (el) colors[k] = el.value; });
  const blob = new Blob([JSON.stringify(colors, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'theme.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importThemeFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Object.entries(data).forEach(([k, v]) => {
        const el = inputs[k];
        if (el) { el.value = v; setCssVar(k, v); }
      });
    } catch {
      alert('Невалиден файл');
    }
  };
  reader.readAsText(file);
}

export async function initColorSettings() {
  const container = document.getElementById('colorInputs');
  const css = await fetchBaseStyles();
  const vars = getAllVars();
  if (container) {
    colorGroups.forEach(group => {
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend');
      lg.textContent = group.name;
      fs.appendChild(lg);
      group.items.forEach(item => createInput(item, fs));
      container.appendChild(fs);
    });
  }
  const defaults = parseDefaultThemes(css, vars);
  const stored = getSavedThemes();
  let changed = false;
  if (!stored.Light) { stored.Light = defaults.light; changed = true; }
  if (!stored.Dark) { stored.Dark = defaults.dark; changed = true; }
  if (!stored.Vivid) { stored.Vivid = vividTheme; changed = true; }
  if (changed) storeThemes(stored);
  const saveBtn = document.getElementById('saveColorConfig');
  populateThemeSelect();
  const saveThemeBtn = document.getElementById(saveThemeBtnId);
  const applyThemeBtn = document.getElementById(applyThemeBtnId);
  const deleteThemeBtn = document.getElementById(deleteThemeBtnId);
  const previewBtn = document.getElementById(previewThemeBtnId);
  const exportBtn = document.getElementById(exportThemeBtnId);
  const importInput = document.getElementById(importThemeInputId);
  const importBtn = document.getElementById(importThemeBtnId);
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
  if (previewBtn) previewBtn.addEventListener('click', previewCurrentTheme);
  if (exportBtn) exportBtn.addEventListener('click', exportThemeToFile);
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
      importThemeFile(importInput.files[0]);
      importInput.value = '';
    });
  }
}

document.addEventListener('DOMContentLoaded', initColorSettings);
