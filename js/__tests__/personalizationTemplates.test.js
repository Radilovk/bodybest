/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let saveNamedTheme, loadNamedTheme, deleteNamedTheme, switchTab;

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
    colorGroups: [{ name: 'Dashboard', items: [{ var: 'primary-color', label: '' }] }],
    sampleThemes: { dashboard: { Light: { 'primary-color': '#010101' } } }
  }));
  ({ saveNamedTheme, loadNamedTheme, deleteNamedTheme, switchTab } = await import('../personalization.js'));
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await Promise.resolve();
  switchTab('Dashboard');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.style.cssText = '';
  document.body.style.cssText = '';
});

test('saves, loads and deletes theme', () => {
  const input = document.getElementById('Dashboard-primary-color');
  input.value = '#aaaaaa';
  saveNamedTheme('Dashboard', 't1');
  expect(JSON.parse(localStorage.getItem('dashboardColorThemes')).t1['primary-color']).toBe('#aaaaaa');
  input.value = '#bbbbbb';
  loadNamedTheme('Dashboard', 't1');
  expect(input.value).toBe('#aaaaaa');
  deleteNamedTheme('Dashboard', 't1');
  expect(JSON.parse(localStorage.getItem('dashboardColorThemes')).t1).toBeUndefined();
});
