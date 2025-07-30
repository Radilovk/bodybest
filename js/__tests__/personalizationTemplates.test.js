/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let saveNamedTheme, loadNamedTheme, deleteNamedTheme, switchTab, switchVariant;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="colorControls"></div>
    <select id="themeSelect"></select>
    <button id="saveTheme"></button>
    <button id="loadTheme"></button>
    <button id="deleteTheme"></button>
  `;
  jest.unstable_mockModule('../uiHandlers.js', () => ({ loadAndApplyColors: jest.fn() }));
  jest.unstable_mockModule('../themeConfig.js', () => ({
    colorGroups: [
      { name: 'Dashboard', items: [
        { var: 'primary-color', label: '' },
        { var: 'progress-end-color', label: '' }
      ] },
      { name: 'Code', items: [{ var: 'code-bg', label: '' }] }
    ],
    sampleThemes: {
      dashboard: { Light: {
        'primary-color': '#010101',
        'progress-end-color': '#030303'
      } },
      code: { Light: { 'code-bg': '#020202' } }
    }
  }));
  ({ saveNamedTheme, loadNamedTheme, deleteNamedTheme, switchTab, switchVariant } = await import('../personalization.js'));
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await Promise.resolve();
  switchTab('Dashboard');
  switchVariant('Dashboard', 'light');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.style.cssText = '';
  document.body.style.cssText = '';
});

test('saves, loads and deletes theme', () => {
  const input = document.getElementById('Dashboard-primary-color-light');
  input.value = '#aaaaaa';
  saveNamedTheme('Dashboard', 't1', 'light');
  expect(JSON.parse(localStorage.getItem('dashboardColorThemes.light')).t1['primary-color']).toBe('#aaaaaa');
  input.value = '#bbbbbb';
  loadNamedTheme('Dashboard', 't1', 'light');
  expect(input.value).toBe('#aaaaaa');
  deleteNamedTheme('Dashboard', 't1', 'light');
  expect(JSON.parse(localStorage.getItem('dashboardColorThemes.light')).t1).toBeUndefined();
});

test('variant navigation lists all three variants', () => {
  const buttons = document.querySelectorAll('.variant-buttons button');
  const labels = Array.from(buttons).map(b => b.textContent);
  expect(labels).toEqual(expect.arrayContaining(['Светла', 'Тъмна', 'Ярка']));
});

test('saves and loads theme for Code group', () => {
  switchTab('Code');
  switchVariant('Code', 'light');
  const input = document.getElementById('Code-code-bg-light');
  input.value = '#cccccc';
  saveNamedTheme('Code', 'c1', 'light');
  expect(JSON.parse(localStorage.getItem('codeColorThemes.light')).c1['code-bg']).toBe('#cccccc');
  input.value = '#dddddd';
  loadNamedTheme('Code', 'c1', 'light');
  expect(input.value).toBe('#cccccc');
});
