/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('adminColors contrast warnings', () => {
  let initColorSettings;
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="colorInputs"></div>
      <button id="saveColorConfig"></button>
      <input id="themeNameInput" type="text">
      <button id="saveThemeLocal"></button>
      <select id="savedThemes"></select>
      <button id="applyThemeLocal"></button>
      <button id="deleteThemeLocal"></button>
      <button id="renameThemeLocal"></button>
      <button id="previewTheme"></button>
      <button id="exportTheme"></button>
      <input id="importTheme" type="file">
      <button id="importThemeBtn"></button>`;
    jest.unstable_mockModule('../adminConfig.js', () => ({
      loadConfig: jest.fn().mockResolvedValue({ colors: {} }),
      saveConfig: jest.fn()
    }));
    jest.unstable_mockModule('../themeConfig.js', () => ({
      colorGroups: [
        { name: 'Code', items: [
          { var: 'code-text-primary', label: 'T' },
          { var: 'code-bg', label: 'B' }
        ] }
      ]
    }));
    jest.unstable_mockModule('../themeStorage.js', () => ({
      getSavedThemes: jest.fn(() => ({})),
      storeThemes: jest.fn(),
      populateThemeSelect: jest.fn()
    }));
    ({ initColorSettings } = await import('../adminColors.js'));
    await initColorSettings();
  });

  test('shows and removes contrast warning', () => {
    const textInput = document.getElementById('code-text-primaryInput');
    const bgInput = document.getElementById('code-bgInput');
    // Low contrast
    textInput.value = '#777777';
    bgInput.value = '#777777';
    textInput.dispatchEvent(new Event('input'));
    let warning = textInput.parentNode.querySelector('.contrast-warning');
    expect(warning).not.toBeNull();
    expect(warning.textContent).toMatch(/контраст/i);

    // High contrast
    textInput.value = '#ffffff';
    bgInput.value = '#000000';
    textInput.dispatchEvent(new Event('input'));
    warning = textInput.parentNode.querySelector('.contrast-warning');
    expect(warning).toBeNull();
  });
});
