// personalization.js - Настройки на основни цветове за потребителя
import { colorGroups, sampleThemes } from './themeConfig.js';
import { loadAndApplyColors } from './uiHandlers.js';

const inputs = {};
let activeGroup = 'Dashboard';
let activeVariant = document.body.classList.contains('dark-theme')
  ? 'dark'
  : document.body.classList.contains('vivid-theme')
    ? 'vivid'
    : 'light';

const variants = {
  light: 'Светла',
  dark: 'Тъмна',
  vivid: 'Ярка'
};

const storageMap = {
  Index: 'indexColorThemes',
  Quest: 'questColorThemes',
  Dashboard: 'dashboardColorThemes'
};

function getGroups(name) {
  if (name === 'Dashboard') return colorGroups.filter(g => !['Index', 'Quest'].includes(g.name));
  return colorGroups.filter(g => g.name === name);
}

function getStorageKey(groupName, variant) {
  const base = storageMap[groupName] || storageMap.Dashboard;
  return `${base}.${variant}`;
}

function getCurrentColor(key) {
  const bodyVal = getComputedStyle(document.body)
    .getPropertyValue(`--${key}`).trim();
  if (bodyVal) return bodyVal;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${key}`).trim();
}

function getSavedThemes(groupName, variant = activeVariant) {
  const key = getStorageKey(groupName, variant);
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function storeThemes(groupName, variant, themes) {
  const key = getStorageKey(groupName, variant);
  localStorage.setItem(key, JSON.stringify(themes));
}

export function populateThemeSelect(groupName, variant = activeVariant) {
  const select = document.getElementById('themeSelect');
  if (!select) return;
  select.innerHTML = '';
  const themes = getSavedThemes(groupName, variant);
  Object.keys(themes).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

export function saveNamedTheme(groupName, name, variant = activeVariant) {
  if (!name) return;
  const groups = getGroups(groupName);
  if (groups.length === 0) return;
  const themes = getSavedThemes(groupName, variant);
  const theme = {};
  groups.forEach(g => {
    g.items.forEach(item => {
      const el = inputs[`${groupName}-${item.var}-${variant}`];
      if (el) theme[item.var] = el.value;
    });
  });
  themes[name] = theme;
  storeThemes(groupName, variant, themes);
  populateThemeSelect(groupName, variant);
}

export function loadNamedTheme(groupName, name, variant = activeVariant) {
  const groups = getGroups(groupName);
  if (groups.length === 0) return;
  const themes = getSavedThemes(groupName, variant);
  const theme = themes[name];
  if (!theme) return;
  groups.forEach(g => {
    g.items.forEach(item => {
      const val = theme[item.var];
      const el = inputs[`${groupName}-${item.var}-${variant}`];
      if (val) {
        document.documentElement.style.setProperty(`--${item.var}`, val);
        document.body.style.setProperty(`--${item.var}`, val);
        if (el) el.value = val;
      }
    });
  });
  themes.Custom = theme;
  storeThemes(groupName, variant, themes);
}

export function deleteNamedTheme(groupName, name, variant = activeVariant) {
  const themes = getSavedThemes(groupName, variant);
  if (themes[name]) {
    delete themes[name];
    storeThemes(groupName, variant, themes);
    populateThemeSelect(groupName, variant);
  }
}

export function resetTheme(groupName, variant = activeVariant) {
  const themes = getSavedThemes(groupName, variant);
  if (themes.Custom) {
    delete themes.Custom;
    storeThemes(groupName, variant, themes);
  }
  const groups = getGroups(groupName);
  groups.forEach(g => {
    g.items.forEach(item => {
      document.documentElement.style.removeProperty(`--${item.var}`);
      document.body.style.removeProperty(`--${item.var}`);
      const el = inputs[`${groupName}-${item.var}-${variant}`];
      if (el) el.value = getCurrentColor(item.var);
    });
  });
  populateThemeSelect(groupName, variant);
}

function ensureSampleThemes() {
  const map = {
    Dashboard: sampleThemes.dashboard,
    Index: sampleThemes.index,
    Quest: sampleThemes.quest
  };
  Object.entries(map).forEach(([group, samples]) => {
    Object.keys(variants).forEach(variant => {
      const themes = getSavedThemes(group, variant);
      let changed = false;
      Object.entries(samples || {}).forEach(([name, t]) => {
        if (!themes[name]) {
          themes[name] = t;
          changed = true;
        }
      });
      if (changed) storeThemes(group, variant, themes);
    });
  });
}

export function applyAndStore(groupName, variant = activeVariant) {
  const groups = getGroups(groupName);
  if (groups.length === 0) return;
  const theme = {};
  groups.forEach(g => {
    g.items.forEach(item => {
      const el = inputs[`${groupName}-${item.var}-${variant}`];
      if (el) {
        document.documentElement.style.setProperty(`--${item.var}`, el.value);
        document.body.style.setProperty(`--${item.var}`, el.value);
        theme[item.var] = el.value;
      }
    });
  });
  const key = getStorageKey(groupName, variant);
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  stored.Custom = theme;
  localStorage.setItem(key, JSON.stringify(stored));
}

export function populate(groupName, variant = activeVariant) {
  const groups = getGroups(groupName);
  if (groups.length === 0) return;
  const key = getStorageKey(groupName, variant);
  const themes = JSON.parse(localStorage.getItem(key) || '{}');
  const custom = themes.Custom || {};
  groups.forEach(g => {
    g.items.forEach(item => {
      const el = inputs[`${groupName}-${item.var}-${variant}`];
      if (!el) return;
      el.value = custom[item.var] || getCurrentColor(item.var);
    });
  });
  applyAndStore(groupName, variant);
}

function createTabNavigation(parent) {
  const nav = document.createElement('div');
  nav.className = 'tab-buttons';
  ['Dashboard', 'Index', 'Quest'].forEach((name, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    btn.addEventListener('click', () => switchTab(name));
    if (idx === 0) btn.classList.add('active-tab');
    nav.appendChild(btn);
  });
  parent.appendChild(nav);
  return nav;
}

function createTabContents(parent) {
  const contents = document.createElement('div');
  contents.className = 'tab-contents';
  ['Dashboard', 'Index', 'Quest'].forEach((name, idx) => {
    const panel = document.createElement('div');
    panel.id = `panel-${name}`;
    panel.className = 'tab-panel';
    if (idx !== 0) panel.style.display = 'none';

    const variantNav = document.createElement('div');
    variantNav.className = 'variant-buttons';
    Object.entries(variants).forEach(([key, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.variant = key;
      b.textContent = label;
      if (key === activeVariant) b.classList.add('active-tab');
      b.addEventListener('click', () => switchVariant(name, key));
      variantNav.appendChild(b);
    });
    panel.appendChild(variantNav);

    Object.keys(variants).forEach(v => {
      const varPanel = document.createElement('div');
      varPanel.id = `panel-${name}-${v}`;
      varPanel.className = 'variant-panel';
      if (v !== activeVariant) varPanel.style.display = 'none';
      const groups = name === 'Dashboard'
        ? colorGroups.filter(g => !['Index', 'Quest'].includes(g.name))
        : colorGroups.filter(g => g.name === name);
      groups.forEach(g => {
        g.items.forEach(item => {
          const wrap = document.createElement('div');
          wrap.className = 'form-group';
          const label = document.createElement('label');
          label.textContent = item.label || item.var;
          const input = document.createElement('input');
          input.type = 'color';
          input.id = `${name}-${item.var}-${v}`;
          wrap.appendChild(label);
          wrap.appendChild(input);
          varPanel.appendChild(wrap);
          inputs[input.id] = input;
          input.addEventListener('input', () => applyAndStore(name, v));
        });
      });
      panel.appendChild(varPanel);
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
      switchVariant(name, activeVariant);
    }
  });
}

export function switchVariant(groupName, variant) {
  activeVariant = variant;
  const panel = document.getElementById(`panel-${groupName}`);
  if (!panel) return;
  const buttons = panel.querySelectorAll('.variant-buttons button');
  buttons.forEach(b => {
    const isActive = b.dataset.variant === variant;
    b.classList.toggle('active-tab', isActive);
  });
  panel.querySelectorAll('.variant-panel').forEach(p => {
    const show = p.id === `panel-${groupName}-${variant}`;
    p.style.display = show ? 'block' : 'none';
    if (show) {
      populate(groupName, variant);
      populateThemeSelect(groupName, variant);
    }
  });
}

export function applyStoredTheme(groupName) {
  const groups = getGroups(groupName);
  if (groups.length === 0) return;
  const variant = document.body.classList.contains('dark-theme')
    ? 'dark'
    : document.body.classList.contains('vivid-theme')
      ? 'vivid'
      : 'light';
  const key = getStorageKey(groupName, variant);
  const themes = JSON.parse(localStorage.getItem(key) || '{}');
  const custom = themes.Custom || {};
  groups.forEach(g => {
    g.items.forEach(item => {
      const val = custom[item.var];
      if (val) {
        document.documentElement.style.setProperty(`--${item.var}`, val);
        document.body.style.setProperty(`--${item.var}`, val);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAndApplyColors();
  ['Dashboard', 'Index', 'Quest'].forEach(applyStoredTheme);
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
  const resetBtn = document.getElementById('resetTheme');
  const select = document.getElementById('themeSelect');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name = prompt('Име на шаблон:');
      if (name) saveNamedTheme(activeGroup, name, activeVariant);
    });
  }
  if (loadBtn && select) {
    loadBtn.addEventListener('click', () => loadNamedTheme(activeGroup, select.value, activeVariant));
  }
  if (deleteBtn && select) {
    deleteBtn.addEventListener('click', () => deleteNamedTheme(activeGroup, select.value, activeVariant));
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => resetTheme(activeGroup, activeVariant));
  }
});
