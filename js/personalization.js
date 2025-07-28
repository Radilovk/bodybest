// personalization.js - Настройки на основни цветове за потребителя
import { colorGroups } from './themeConfig.js';
import { loadAndApplyColors } from './uiHandlers.js';

const inputs = {};

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
    if (show) populate(name);
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
  const nav = createTabNavigation(container);
  createTabContents(container);
  const first = nav.querySelector('button');
  if (first) switchTab(first.textContent);
});
