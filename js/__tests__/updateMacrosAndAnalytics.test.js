/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('updateMacrosAndAnalytics', () => {
  let updateMacrosAndAnalytics;
  let selectors;
  let appState;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule('../macroAnalyticsCardComponent.js', () => ({}));
    document.body.innerHTML = `
      <div id="macroMetricsPreview"></div>
      <div id="analyticsCardsContainer"></div>
    `;
    selectors = {
      macroMetricsPreview: document.getElementById('macroMetricsPreview'),
      analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
      macroAnalyticsCardContainer: document.getElementById('analyticsCardsContainer')
    };
    jest.unstable_mockModule('../uiElements.js', () => ({
      selectors,
      trackerInfoTexts: {},
      detailedMetricInfoTexts: {},
      initializeSelectors: jest.fn(),
      loadInfoTexts: jest.fn()
    }));
    jest.unstable_mockModule('../uiHandlers.js', () => ({
      showToast: jest.fn(),
      openModal: jest.fn(),
      closeModal: jest.fn(),
      showLoading: jest.fn(),
      updateTabsOverflowIndicator: jest.fn(),
      initializeTheme: jest.fn(),
      loadAndApplyColors: jest.fn(),
      activateTab: jest.fn()
    }));
    jest.unstable_mockModule('../utils.js', () => ({
      safeGet: jest.fn(),
      safeParseFloat: jest.fn(),
      capitalizeFirstLetter: jest.fn(),
      escapeHtml: jest.fn(),
      applyProgressFill: jest.fn(),
      getCssVar: jest.fn(),
      formatDateBgShort: jest.fn(),
      getLocalDate: jest.fn(),
      fileToDataURL: jest.fn(),
      normalizeDailyLogs: jest.fn()
    }));
    jest.unstable_mockModule('../config.js', () => ({
      generateId: () => 'id',
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html',
      apiEndpoints: { dashboard: '/api/dashboardData' },
      initialBotMessage: '',
      isLocalDevelopment: false
    }));
    const ensureMock = jest.fn(() => {
      let el = document.querySelector('macro-analytics-card');
      if (!el) {
        el = document.createElement('macro-analytics-card');
        el.setData = jest.fn();
        selectors.macroAnalyticsCardContainer.appendChild(el);
      }
      return el;
    });
    jest.unstable_mockModule('../eventListeners.js', () => ({
      ensureMacroAnalyticsElement: ensureMock,
      setupStaticEventListeners: jest.fn(),
      setupDynamicEventListeners: jest.fn(),
      initializeCollapsibleCards: jest.fn()
    }));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    appState = await import('../app.js');
    ({ updateMacrosAndAnalytics } = appState);
    Object.assign(appState.todaysPlanMacros, {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fat: 70,
      fiber: 30,
      protein_percent: 30,
      carbs_percent: 50,
      fat_percent: 20,
      fiber_percent: 0
    });
    Object.assign(appState.currentIntakeMacros, { calories: 1000, protein: 80, carbs: 120, fat: 40, fiber: 15 });
  });

  test('обновява macro-analytics-card само веднъж на извикване', async () => {
    updateMacrosAndAnalytics();
    await new Promise(r => setTimeout(r, 0));
    const card = selectors.macroAnalyticsCardContainer.querySelector('macro-analytics-card');
    expect(card.setData).toHaveBeenCalledTimes(1);

    card.setData.mockClear();
    updateMacrosAndAnalytics();
    await new Promise(r => setTimeout(r, 0));
    expect(card.setData).toHaveBeenCalledTimes(1);
  });
});
