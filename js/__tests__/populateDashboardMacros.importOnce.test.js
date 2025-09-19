/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('динамичният импорт на macroAnalyticsCardComponent се изпълнява само веднъж', async () => {
  jest.resetModules();
  document.body.innerHTML = '<div id="macroMetricsPreview"></div><div id="analyticsCardsContainer"></div>';
  const selectors = {
    macroMetricsPreview: document.getElementById('macroMetricsPreview'),
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: null,
  };
  let importCount = 0;
  jest.unstable_mockModule('../macroAnalyticsCardComponent.js', () => {
    importCount++;
    return {};
  });
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../utils.js', () => ({
    safeGet: () => {},
    safeParseFloat: () => {},
    capitalizeFirstLetter: () => {},
    escapeHtml: () => {},
    applyProgressFill: () => {},
    getCssVar: () => '',
    formatDateBgShort: () => ''
  }));
  jest.unstable_mockModule('../config.js', () => ({
    generateId: () => 'id',
    standaloneMacroUrl: 'macroAnalyticsCardStandalone.html',
    apiEndpoints: { dashboard: '/api/dashboardData' }
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    todaysPlanMacros: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      protein_percent: 0,
      carbs_percent: 0,
      fat_percent: 0,
      fiber_percent: 0
    },
    currentIntakeMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    planHasRecContent: false,
    loadCurrentIntake: jest.fn(),
    currentUserId: 'u1',
    recalculateCurrentIntakeMacros: jest.fn(),
    resetAppState: jest.fn(),
    resetDailyIntake: jest.fn(),
    updateMacrosAndAnalytics: jest.fn()
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    getNutrientOverride: jest.fn(),
    addMealMacros: jest.fn(),
    scaleMacros: jest.fn(),
    calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0, fiber_percent: 0 })),
    calculatePlanMacros: jest.fn()
  }));
  jest.unstable_mockModule('../../utils/debug.js', () => ({ logMacroPayload: jest.fn() }));
  const eventListenersMock = {
    ensureMacroAnalyticsElement: jest.fn(() => {
      const el = document.createElement('macro-analytics-card');
      el.setData = jest.fn();
      if (!selectors.macroAnalyticsCardContainer) {
        selectors.macroAnalyticsCardContainer = document.createElement('div');
        selectors.macroAnalyticsCardContainer.id = 'macroAnalyticsCardContainer';
        selectors.analyticsCardsContainer.appendChild(selectors.macroAnalyticsCardContainer);
      }
      selectors.macroAnalyticsCardContainer.appendChild(el);
      return el;
    }),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn()
  };
  jest.unstable_mockModule('../eventListeners.js', () => eventListenersMock);
  const { populateDashboardMacros } = await import('../populateUI.js');
  const macros = { calories: 1000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 };
  await populateDashboardMacros(macros);
  await populateDashboardMacros(macros);
  expect(importCount).toBe(1);
});
