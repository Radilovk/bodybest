/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initColorSettings;
let mockLoad;
let mockSave;

beforeEach(async () => {
  jest.resetModules();
  document.body.innerHTML = `
    <input id="primaryColorInput" type="color">
    <input id="secondaryColorInput" type="color">
    <input id="accentColorInput" type="color">
    <input id="tertiaryColorInput" type="color">
    <button id="saveColorConfig"></button>`;

  mockLoad = jest.fn().mockResolvedValue({ colors: { primary: '#111111', secondary: '#222222' } });
  mockSave = jest.fn().mockResolvedValue({});
  jest.unstable_mockModule('../adminConfig.js', () => ({
    loadConfig: mockLoad,
    saveConfig: mockSave
  }));
  ({ initColorSettings } = await import('../adminColors.js'));
});

afterEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
});

test('initColorSettings loads config and sets CSS vars', async () => {
  await initColorSettings();
  expect(mockLoad).toHaveBeenCalledWith(['colors']);
  expect(document.getElementById('primaryColorInput').value).toBe('#111111');
  expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#111111');
});

test('save button gathers colors and calls saveConfig', async () => {
  await initColorSettings();
  document.getElementById('primaryColorInput').value = '#333333';
  document.getElementById('secondaryColorInput').value = '#444444';
  document.getElementById('saveColorConfig').click();
  expect(mockSave).toHaveBeenCalledWith({ colors: {
    primary: '#333333',
    secondary: '#444444',
    accent: document.getElementById('accentColorInput').value,
    tertiary: document.getElementById('tertiaryColorInput').value
  } });
});
