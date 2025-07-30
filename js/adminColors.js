import { loadConfig, saveConfig } from './adminConfig.js';
import { colorGroups } from './themeConfig.js';
import {
  getSavedThemes as loadThemes,
  storeThemes as saveThemes,
  populateThemeSelect as fillThemeSelect
} from './themeStorage.js';

const inputs = {};

function getAllVars() {
  return colorGroups.flatMap(g => g.items.filter(it => it.type !== 'range').map(it => it.var));
}

function readDefaultTheme(variant) {
  const className = variant === 'dark'
    ? 'dark-theme'
    : variant === 'vivid'
      ? 'vivid-theme'
      : null;
  if (className) document.body.classList.add(className);
  const styles = getComputedStyle(document.body);
  const theme = {};
  getAllVars().forEach(key => {
    theme[key] = styles.getPropertyValue(`--${key}`).trim();
  });
  if (className) document.body.classList.remove(className);
  return theme;
}

function createInput(item, container) {
  const label = document.createElement('label');
  label.textContent = item.label || item.var;

  const infoBtn = document.createElement('button');
  infoBtn.type = 'button';
  infoBtn.className = 'button-icon-only info-btn';
  infoBtn.innerHTML = '<svg class="icon"><use href="#icon-info"></use></svg>';
  infoBtn.title = item.description || 'Цвят на елемент';
  label.appendChild(infoBtn);
  const input = document.createElement('input');
  if (item.type === 'range') {
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
  } else {
    input.type = 'color';
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
const renameThemeBtnId = 'renameThemeLocal';
const previewThemeBtnId = 'previewTheme';
const exportThemeBtnId = 'exportTheme';
const importThemeInputId = 'importTheme';
const importThemeBtnId = 'importThemeBtn';

// По-ярка тема, базирана на основните цветове на таблото
const vividTheme = {
  'primary-color': '#5BC0BE',
  'secondary-color': '#FFD166',
  'accent-color': '#FF6B6B',
  'tertiary-color': '#FF9C9C',
  'progress-end-color': '#80FF80'
};

function setCssVar(key, val) {
  document.documentElement.style.setProperty(`--${key}`, val);
  document.body.style.setProperty(`--${key}`, val);
}

function normalizeColor(val) {
  const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(val);
  if (m) {
    return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  }
  return val;
}

function getCurrentColor(key) {
  const rootVal = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${key}`).trim();
  if (rootVal) return rootVal;
  return getComputedStyle(document.body)
    .getPropertyValue(`--${key}`).trim();
}

function getSavedThemes() {
  return loadThemes();
}

function storeThemes(themes) {
  saveThemes(themes);
}

function populateThemeSelect() {
  fillThemeSelect(themeSelectId);
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
      const norm = normalizeColor(val);
      el.value = norm;
      setCssVar(k, norm);
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

function renameSelectedTheme() {
  const select = document.getElementById(themeSelectId);
  if (!select) return;
  const themes = getSavedThemes();
  const oldName = select.value;
  if (!themes[oldName]) return;
  const newName = prompt('Ново име на тема:', oldName);
  if (!newName || newName === oldName) return;
  if (themes[newName]) {
    alert('Вече съществува тема с това име.');
    return;
  }
  themes[newName] = themes[oldName];
  delete themes[oldName];
  storeThemes(themes);
  populateThemeSelect();
  select.value = newName;
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
  if (container) {
    const filteredGroups = colorGroups.filter(
      g => !['Index', 'Quest', 'Code'].includes(g.name)
    );
    filteredGroups.forEach(group => {
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend');
      lg.textContent = group.name;
      fs.appendChild(lg);
      group.items.forEach(item => createInput(item, fs));
      container.appendChild(fs);
    });
  }
  const defaults = {
    light: readDefaultTheme('light'),
    dark: readDefaultTheme('dark'),
    vivid: readDefaultTheme('vivid')
  };
  const stored = getSavedThemes();
  let changed = false;
  if (!stored.Light) { stored.Light = defaults.light; changed = true; }
  if (!stored.Dark) { stored.Dark = defaults.dark; changed = true; }
  if (!stored.Vivid) {
    stored.Vivid = Object.keys(defaults.vivid).length ? defaults.vivid : vividTheme;
    changed = true;
  }
  if (changed) storeThemes(stored);
  const saveBtn = document.getElementById('saveColorConfig');
  populateThemeSelect();
  const saveThemeBtn = document.getElementById(saveThemeBtnId);
  const applyThemeBtn = document.getElementById(applyThemeBtnId);
  const deleteThemeBtn = document.getElementById(deleteThemeBtnId);
  const renameThemeBtn = document.getElementById(renameThemeBtnId);
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
      if (el.type === 'range' && !el.value) el.value = 1;
      setCssVar(k, el.value);
      el.addEventListener('input', () => setCssVar(k, el.value));
    });
  } catch (err) {
    console.warn('Неуспешно зареждане на цветовете', err);
    Object.entries(inputs).forEach(([k, el]) => {
      if (!el) return;
      const current = getCurrentColor(k);
      el.value = current;
      if (el.type === 'range' && !el.value) el.value = 1;
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
  if (renameThemeBtn) renameThemeBtn.addEventListener('click', renameSelectedTheme);
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
