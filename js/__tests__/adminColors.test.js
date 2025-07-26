/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initColorSettings;
let mockLoad;
let mockSave;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <div id="colorInputs"></div>
    <button id="saveColorConfig"></button>
    <input id="themeNameInput" type="text">
    <button id="saveThemeLocal"></button>
    <select id="savedThemes"></select>
    <button id="applyThemeLocal"></button>
    <button id="deleteThemeLocal"></button>`;

  mockLoad = jest.fn().mockResolvedValue({ colors: { 'primary-color': '#111111', 'secondary-color': '#222222' } });
  mockSave = jest.fn().mockResolvedValue({});
  jest.unstable_mockModule('../adminConfig.js', () => ({
    loadConfig: mockLoad,
    saveConfig: mockSave
  }));
  global.fetch = jest.fn().mockResolvedValue({ text: async () => ':root{--primary-color:#000;--secondary-color:#000;}' });
  ({ initColorSettings } = await import('../adminColors.js'));
});

afterEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
  global.fetch.mockReset();
  document.documentElement.style.cssText = '';
  document.body.style.cssText = '';
});

test('initColorSettings loads config and sets CSS vars', async () => {
  await initColorSettings();
  expect(global.fetch).toHaveBeenCalledWith('css/base_styles.css');
  expect(mockLoad).toHaveBeenCalledWith(['colors']);
  expect(document.getElementById('primary-colorInput').value).toBe('#111111');
  expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#111111');
});

test('falls back to computed colors when config missing', async () => {
  mockLoad.mockResolvedValue({ colors: {} });
  document.documentElement.style.setProperty('--primary-color', '#010203');
  await initColorSettings();
  expect(document.getElementById('primary-colorInput').value).toBe('#010203');
});

test('save button gathers colors and calls saveConfig', async () => {
  await initColorSettings();
  document.getElementById('primary-colorInput').value = '#333333';
  document.getElementById('secondary-colorInput').value = '#444444';
  document.getElementById('saveColorConfig').click();
  expect(mockSave).toHaveBeenCalledWith({ colors: {
    'primary-color': '#333333',
    'secondary-color': '#444444'
  } });
});

test('themes can be saved and applied', async () => {
  mockLoad.mockResolvedValue({ colors: {} });
  await initColorSettings();
  document.getElementById('primary-colorInput').value = '#aaaaaa';
  document.getElementById('themeNameInput').value = 't1';
  document.getElementById('saveThemeLocal').click();
  expect(JSON.parse(localStorage.getItem('colorThemes')).t1['primary-color']).toBe('#aaaaaa');
  document.getElementById('primary-colorInput').value = '#bbbbbb';
  document.getElementById('savedThemes').value = 't1';
  document.getElementById('applyThemeLocal').click();
  expect(document.getElementById('primary-colorInput').value).toBe('#aaaaaa');
});
