/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('преобразува стойности 1 и 4 в 20% и 80%', async () => {
  document.body.innerHTML = `
    <div id="analyticsCardsContainer"></div>
    <div id="macroAnalyticsCardContainer"></div>
    <div id="detailedAnalyticsContent"></div>
    <div id="dashboardTextualAnalysis"></div>
  `;
  const selectors = {
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: document.getElementById('macroAnalyticsCardContainer'),
    detailedAnalyticsContent: document.getElementById('detailedAnalyticsContent'),
    dashboardTextualAnalysis: document.getElementById('dashboardTextualAnalysis')
  };
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    ensureMacroAnalyticsElement: jest.fn(),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn(),
  }));
  jest.unstable_mockModule('../extraMealForm.js', () => ({ openExtraMealModal: jest.fn() }));
  jest.unstable_mockModule('../utils.js', () => ({
    safeGet: (obj, path, def) => path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ?? def,
    safeParseFloat: (v) => parseFloat(v),
    capitalizeFirstLetter: (s) => s,
    escapeHtml: (s) => s,
    applyProgressFill: jest.fn(),
    getCssVar: jest.fn(),
    formatDateBgShort: () => ''
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {
      userName: 'Иван',
      analytics: {
        current: {},
        streak: {},
        detailed: [
          { label: 'Mood', currentValueText: '1', currentValueNumeric: 1 },
          { label: 'Energy', currentValueText: '4', currentValueNumeric: 4 }
        ]
      },
      planData: {},
      dailyLogs: [],
      currentStatus: {},
      initialData: {},
      initialAnswers: {}
    },
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
    currentIntakeMacros: {},
    planHasRecContent: false,
    loadCurrentIntake: jest.fn(),
    recalculateCurrentIntakeMacros: jest.fn(),
    currentUserId: 'u1',
    updateMacrosAndAnalytics: jest.fn()
  }));
  const { populateUI } = await import('../populateUI.js');
  await populateUI();
  const bars = document.querySelectorAll('#analyticsCardsContainer .analytics-card .mini-progress-bar');
  expect(bars[0].getAttribute('aria-valuenow')).toBe('20');
  expect(bars[1].getAttribute('aria-valuenow')).toBe('80');
});
