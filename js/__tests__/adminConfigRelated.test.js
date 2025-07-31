/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('adminConfig.loadConfig and saveConfig', () => {
  let loadConfig, saveConfig;
  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule('../config.js', () => ({
      apiEndpoints: { getAiConfig: '/get', setAiConfig: '/set' }
    }));
    ({ loadConfig, saveConfig } = await import('../adminConfig.js'));
  });
  afterEach(() => {
    global.fetch && global.fetch.mockRestore();
    sessionStorage.clear();
    localStorage.clear();
  });

  test('loadConfig returns full config', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, config: { a: 1 } }) });
    const cfg = await loadConfig();
    expect(global.fetch).toHaveBeenCalledWith('/get');
    expect(cfg).toEqual({ a: 1 });
  });

  test('loadConfig can filter keys', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, config: { a: 1, b: 2 } }) });
    const res = await loadConfig(['b']);
    expect(res).toEqual({ b: 2 });
  });

  test('saveConfig posts updates with token', async () => {
    sessionStorage.setItem('adminToken', 't');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await saveConfig({ a: 2 });
    expect(global.fetch).toHaveBeenCalledWith('/set', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify({ updates: { a: 2 } })
    }));
  });
});

describe('adminColors.initColorSettings', () => {
  let initColorSettings;
  let mockLoad;
  let mockSave;
  let styleEl;
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
      <button id="renameThemeLocal"></button>`;
    mockLoad = jest.fn().mockResolvedValue({ colors: { 'code-bg': '#111111', 'code-text-primary': '#222222' } });
    mockSave = jest.fn().mockResolvedValue({});
    jest.unstable_mockModule('../adminConfig.js', () => ({
      loadConfig: mockLoad,
      saveConfig: mockSave
    }));
    styleEl = document.createElement('style');
    styleEl.textContent =
      'body{--code-bg:#ccc;--code-text-primary:#111;}' +
      'body.dark-theme{--code-bg:#ddd;--code-text-primary:#222;}' +
      'body.vivid-theme{--code-bg:#eee;--code-text-primary:#333;}';
    document.head.appendChild(styleEl);
    ({ initColorSettings } = await import('../adminColors.js'));
  });
  afterEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
    if (styleEl) styleEl.remove();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    delete global.prompt;
  });

  test('initColorSettings loads config and sets CSS vars', async () => {
    await initColorSettings();
    expect(mockLoad).toHaveBeenCalledWith(['colors']);
    expect(document.documentElement.style.getPropertyValue('--code-bg')).toBe('#111111');
  });

  test('falls back to computed colors when config missing', async () => {
    mockLoad.mockResolvedValue({ colors: {} });
    document.documentElement.style.setProperty('--code-bg', '#010203');
    await initColorSettings();
    expect(document.documentElement.style.getPropertyValue('--code-bg')).toBe('#010203');
  });

  test('save button gathers colors and calls saveConfig', async () => {
    await initColorSettings();
    document.getElementById('code-bgInput').value = '#333333';
    document.getElementById('code-text-primaryInput').value = '#444444';
    document.getElementById('saveColorConfig').click();
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      colors: expect.objectContaining({
        'code-bg': '#333333',
        'code-text-primary': '#444444'
      })
    }));
  });

  test('themes can be saved and applied', async () => {
    mockLoad.mockResolvedValue({ colors: {} });
    await initColorSettings();
    document.getElementById('code-bgInput').value = '#aaaaaa';
    document.getElementById('themeNameInput').value = 't1';
    document.getElementById('saveThemeLocal').click();
    expect(JSON.parse(localStorage.getItem('colorThemes')).t1['code-bg']).toBe('#aaaaaa');
    document.getElementById('code-bgInput').value = '#bbbbbb';
    document.getElementById('savedThemes').value = 't1';
    document.getElementById('applyThemeLocal').click();
    expect(document.getElementById('code-bgInput').value).toBe('#aaaaaa');
  });

  test('initializes default themes', async () => {
    mockLoad.mockResolvedValue({ colors: {} });
    await initColorSettings();
    const themes = JSON.parse(localStorage.getItem('colorThemes'));
    expect(themes.Light['code-bg']).toBe('#ccc');
    expect(themes.Dark['code-bg']).toBe('#ddd');
    expect(themes.Vivid['code-bg']).toBe('#eee');
    const opts = Array.from(document.getElementById('savedThemes').options).map(o => o.value);
    expect(opts).toEqual(expect.arrayContaining(['Light', 'Dark', 'Vivid']));
  });

  test('apply built-in themes updates inputs', async () => {
    mockLoad.mockResolvedValue({ colors: {} });
    await initColorSettings();
    const select = document.getElementById('savedThemes');
    const applyBtn = document.getElementById('applyThemeLocal');

    select.value = 'Dark';
    applyBtn.click();
    expect(document.getElementById('code-bgInput').value).toBe('#ddd');

    select.value = 'Vivid';
    applyBtn.click();
    expect(document.getElementById('code-bgInput').value).toBe('#eee');

    select.value = 'Light';
    applyBtn.click();
    expect(document.getElementById('code-bgInput').value).toBe('#ccc');
  });

  test('selected theme can be renamed', async () => {
    mockLoad.mockResolvedValue({ colors: {} });
    await initColorSettings();
    const select = document.getElementById('savedThemes');
    const renameBtn = document.getElementById('renameThemeLocal');
    select.value = 'Light';
    global.prompt = jest.fn().mockReturnValue('Bright');
    renameBtn.click();
    const themes = JSON.parse(localStorage.getItem('colorThemes'));
    expect(themes.Bright).toBeDefined();
    expect(themes.Light).toBeUndefined();
    expect(select.querySelector('option[value="Bright"]')).not.toBeNull();
  });
});

describe('uiHandlers.loadAndApplyColors', () => {
  let loadAndApplyColors;
  let mockLoad;
  beforeEach(async () => {
    jest.resetModules();
    mockLoad = jest.fn().mockResolvedValue({ colors: { 'code-bg': '#111111', 'code-text-primary': '#222222' } });
    jest.unstable_mockModule('../adminConfig.js', () => ({ loadConfig: mockLoad }));
    jest.unstable_mockModule('../app.js', () => ({
      fullDashboardData: {},
      activeTooltip: null,
      setActiveTooltip: jest.fn()
    }));
    ({ loadAndApplyColors } = await import('../uiHandlers.js'));
  });
  afterEach(() => {
    mockLoad.mockReset();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  test('зарежда и прилага цветовете', async () => {
    await loadAndApplyColors();
    expect(mockLoad).toHaveBeenCalledWith(['colors']);
    expect(document.documentElement.style.getPropertyValue('--code-bg')).toBe('#111111');
    expect(document.body.style.getPropertyValue('--code-text-primary')).toBe('#222222');
  });

  test('не променя цветовете при грешка', async () => {
    document.documentElement.style.setProperty('--code-bg', '#000000');
    document.body.style.setProperty('--code-bg', '#000000');
    mockLoad.mockRejectedValue(new Error('fail'));
    await loadAndApplyColors();
    expect(document.documentElement.style.getPropertyValue('--code-bg')).toBe('#000000');
  });
});

describe('admin email settings flags', () => {
  let loadEmailSettings, saveEmailSettings;
  let mockLoad, mockSave;
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <form id="emailSettingsForm"></form>
      <input id="welcomeEmailSubject">
      <textarea id="welcomeEmailBody"></textarea>
      <input id="questionnaireEmailSubject">
      <textarea id="questionnaireEmailBody"></textarea>
      <input id="analysisEmailSubject">
      <textarea id="analysisEmailBody"></textarea>
      <div id="welcomeEmailPreview"></div>
      <div id="questionnaireEmailPreview"></div>
      <div id="analysisEmailPreview"></div>
      <input id="sendQuestionnaireEmail" type="checkbox">
      <input id="sendWelcomeEmail" type="checkbox">
      <input id="sendAnalysisEmail" type="checkbox">
      <button id="showStats"></button>
    `;
    mockLoad = jest.fn().mockResolvedValue({
      welcome_email_subject: 's1',
      welcome_email_body: '<b>w</b>',
      questionnaire_email_subject: 's2',
      questionnaire_email_body: '<i>q</i>',
      analysis_email_subject: 's3',
      analysis_email_body: '<u>a</u>',
      send_questionnaire_email: '0',
      send_welcome_email: '1',
      send_analysis_email: '0'
    });
    mockSave = jest.fn().mockResolvedValue({});
    jest.unstable_mockModule('../adminConfig.js', () => ({
      loadConfig: mockLoad,
      saveConfig: mockSave
    }));
    ({ loadEmailSettings, saveEmailSettings } = await import('../admin.js'));
  });
  afterEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
  });

  test('loadEmailSettings populates form and flags', async () => {
    await loadEmailSettings();
    expect(mockLoad).toHaveBeenCalledWith([
      'from_email_name',
      'welcome_email_subject',
      'welcome_email_body',
      'questionnaire_email_subject',
      'questionnaire_email_body',
      'analysis_email_subject',
      'analysis_email_body',
      'send_questionnaire_email',
      'send_welcome_email',
      'send_analysis_email'
    ]);
    expect(document.getElementById('sendWelcomeEmail').checked).toBe(true);
    expect(document.getElementById('sendAnalysisEmail').checked).toBe(false);
  });

  test('saveEmailSettings sends updated flags', async () => {
    document.getElementById('sendQuestionnaireEmail').checked = true;
    document.getElementById('sendWelcomeEmail').checked = false;
    document.getElementById('sendAnalysisEmail').checked = true;
    await saveEmailSettings();
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      send_questionnaire_email: '1',
      send_welcome_email: '0',
      send_analysis_email: '1'
    }));
  });
});
