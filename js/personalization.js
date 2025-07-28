// personalization.js - Настройки на основни цветове за потребителя
import { colorGroups, sampleThemes } from './themeConfig.js';
import { loadAndApplyColors } from './uiHandlers.js';

const inputs = {};
let activeGroup = 'Dashboard';

const storageMap = {
  Index: 'indexColorThemes',
  Quest: 'questColorThemes',
  Dashboard: 'dashboardColorThemes'
};

function getStorageKey(groupName) {
  return storageMap[groupName] || storageMap.Dashboard;
}

function getCurrentColor(key) {
  const bodyVal = getComputedStyle(document.body)
    .getPropertyValue(`--${key}`).trim();
  if (bodyVal) return bodyVal;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${key}`).trim();
}

function getSavedThemes(groupName) {
  const key = getStorageKey(groupName);
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function storeThemes(groupName, themes) {
  const key = getStorageKey(groupName);
  localStorage.setItem(key, JSON.stringify(themes));
}

export function populateThemeSelect(groupName) {
  const select = document.getElementById('themeSelect');
  if (!select) return;
  select.innerHTML = '';
  const themes = getSavedThemes(groupName);
  Object.keys(themes).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

export function saveNamedTheme(groupName, name) {
  if (!name) return;
  const group = colorGroups.find(g => g.name === groupName);
  if (!group) return;
  const themes = getSavedThemes(groupName);
  const theme = {};
  group.items.forEach(item => {
    const el = inputs[`${groupName}-${item.var}`];
    if (el) theme[item.var] = el.value;
  });
  themes[name] = theme;
  storeThemes(groupName, themes);
  populateThemeSelect(groupName);
}

export function loadNamedTheme(groupName, name) {
  const group = colorGroups.find(g => g.name === groupName);
  if (!group) return;
  const themes = getSavedThemes(groupName);
  const theme = themes[name];
  if (!theme) return;
  group.items.forEach(item => {
    const val = theme[item.var];
    const el = inputs[`${groupName}-${item.var}`];
    if (val) {
      document.documentElement.style.setProperty(`--${item.var}`, val);
      document.body.style.setProperty(`--${item.var}`, val);
      if (el) el.value = val;
    }
  });
  themes.Custom = theme;
  storeThemes(groupName, themes);
}

export function deleteNamedTheme(groupName, name) {
  const themes = getSavedThemes(groupName);
  if (themes[name]) {
    delete themes[name];
    storeThemes(groupName, themes);
    populateThemeSelect(groupName);
  }
}

function ensureSampleThemes() {
  const map = {
    Dashboard: sampleThemes.dashboard,
    Index: sampleThemes.index,
    Quest: sampleThemes.quest
  };
  Object.entries(map).forEach(([group, samples]) => {
    const themes = getSavedThemes(group);
    let changed = false;
    Object.entries(samples || {}).forEach(([name, t]) => {
      if (!themes[name]) {
        themes[name] = t;
        changed = true;
      }
    });
    if (changed) storeThemes(group, themes);
  });
}

export function applyAndStore(groupName) {
  const group = colorGroups.find(g => g.name === groupName);
  if (!group) return;
  const theme = {};
  group.items.forEach(item => {
    const el = inputs[`${groupName}-${item.var}`];
    if (el) {
      document.documentElement.style.setProperty(`--${item.var}`, el.value);
      document.body.style.setProperty(`--${item.var}`, el.value);
      theme[item.var] = el.value;
    }
  });
  const key = getStorageKey(groupName);
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  stored.Custom = theme;
  localStorage.setItem(key, JSON.stringify(stored));
}

export function populate(groupName) {
  const group = colorGroups.find(g => g.name === groupName);
  if (!group) return;
  const key = getStorageKey(groupName);
  const themes = JSON.parse(localStorage.getItem(key) || '{}');
  const custom = themes.Custom || {};
  group.items.forEach(item => {
    const el = inputs[`${groupName}-${item.var}`];
    if (!el) return;
    el.value = custom[item.var] || getCurrentColor(item.var);
  });
  applyAndStore(groupName);
}

function createTabNavigation(parent) {
  const nav = document.createElement('div');
  nav.className = 'tab-buttons';
  colorGroups.forEach((group, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = group.name;
    btn.addEventListener('click', () => switchTab(group.name));
    if (idx === 0) btn.classList.add('active-tab');
    nav.appendChild(btn);
  });
  parent.appendChild(nav);
  return nav;
}

function createTabContents(parent) {
  const contents = document.createElement('div');
  contents.className = 'tab-contents';
  colorGroups.forEach((group, idx) => {
    const panel = document.createElement('div');
    panel.id = `panel-${group.name}`;
    panel.className = 'tab-panel';
    if (idx !== 0) panel.style.display = 'none';
    group.items.forEach(item => {
      const wrap = document.createElement('div');
      wrap.className = 'form-group';
      const label = document.createElement('label');
      label.textContent = item.label || item.var;
      const input = document.createElement('input');
      input.type = 'color';
      input.id = `${group.name}-${item.var}`;
      wrap.appendChild(label);
      wrap.appendChild(input);
      panel.appendChild(wrap);
      inputs[input.id] = input;
      input.addEventListener('input', () => applyAndStore(group.name));
    });
    contents.appendChild(panel);
  });
  parent.appendChild(contents);
}

export function switchTab(name) {
  const nav = document.querySelector('.tab-buttons');
  const panels = document.querySelectorAll('.tab-panel');
  nav.querySelectorAll('button').forEach(btn => {
    const isActive = btn.textContent === name;
    btn.classList.toggle('active-tab', isActive);
  });
  panels.forEach(panel => {
    const show = panel.id === `panel-${name}`;
    panel.style.display = show ? 'block' : 'none';
    if (show) {
      activeGroup = name;
      populate(name);
      populateThemeSelect(name);
    }
  });
}

export function applyStoredTheme(groupName) {
  const group = colorGroups.find(g => g.name === groupName);
  if (!group) return;
  const key = getStorageKey(groupName);
  const themes = JSON.parse(localStorage.getItem(key) || '{}');
  const custom = themes.Custom || {};
  group.items.forEach(item => {
    const val = custom[item.var];
    if (val) {
      document.documentElement.style.setProperty(`--${item.var}`, val);
      document.body.style.setProperty(`--${item.var}`, val);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAndApplyColors();
  const container = document.getElementById('colorControls');
  if (!container) return;
  ensureSampleThemes();
  const nav = createTabNavigation(container);
  createTabContents(container);
  const first = nav.querySelector('button');
  if (first) switchTab(first.textContent);
  const saveBtn = document.getElementById('saveTheme');
  const loadBtn = document.getElementById('loadTheme');
  const deleteBtn = document.getElementById('deleteTheme');
  const select = document.getElementById('themeSelect');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name = prompt('Име на шаблон:');
      if (name) saveNamedTheme(activeGroup, name);
    });
  }
  if (loadBtn && select) {
    loadBtn.addEventListener('click', () => loadNamedTheme(activeGroup, select.value));
  }
  if (deleteBtn && select) {
    deleteBtn.addEventListener('click', () => deleteNamedTheme(activeGroup, select.value));
  }
});
