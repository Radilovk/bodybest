/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('макро картата остава видима след обновяване на аналитиката', async () => {
  document.body.innerHTML = `
    <div id="analyticsCardsContainer"></div>
    <div id="macroAnalyticsCardContainer"></div>
    <div id="detailedAnalyticsContent"></div>
    <div id="dashboardTextualAnalysis"></div>
    <div id="macroMetricsPreview"></div>
  `;
  const selectors = {
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: document.getElementById('macroAnalyticsCardContainer'),
    detailedAnalyticsContent: document.getElementById('detailedAnalyticsContent'),
    dashboardTextualAnalysis: document.getElementById('dashboardTextualAnalysis'),
    macroMetricsPreview: document.getElementById('macroMetricsPreview')
  };
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../utils.js', () => ({
    safeGet: (obj, path, def) => path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ?? def,
    safeParseFloat: v => parseFloat(v),
    capitalizeFirstLetter: s => s,
    escapeHtml: s => s,
    applyProgressFill: jest.fn(),
    getCssVar: jest.fn(() => '#000'),
    formatDateBgShort: jest.fn(() => '')
  }));
  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { dashboard: '/api/dashboard' },
    standaloneMacroUrl: '',
    generateId: () => 'id'
  }));
  jest.unstable_mockModule('../macroAnalyticsCardComponent.js', () => ({}));
  const ensureMock = jest.fn(() => {
    let el = selectors.macroAnalyticsCardContainer.querySelector('macro-analytics-card');
    if (!el) {
      el = document.createElement('macro-analytics-card');
      el.setData = jest.fn();
      selectors.macroAnalyticsCardContainer.appendChild(el);
    }
    return el;
  });
  jest.unstable_mockModule('../eventListeners.js', () => ({ ensureMacroAnalyticsElement: ensureMock }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    loadCurrentIntake: jest.fn(),
    planHasRecContent: false,
    currentIntakeMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    currentUserId: 'u1',
    todaysPlanMacros: { calories: 2000, protein: 150, carbs: 250, fat: 70, fiber: 30 },
    updateMacrosAndAnalytics: jest.fn()
  }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    getNutrientOverride: jest.fn(),
    scaleMacros: jest.fn(),
    calculatePlanMacros: jest.fn(),
    calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0 }))
  }));
  jest.unstable_mockModule('../../utils/debug.js', () => ({ logMacroPayload: jest.fn() }));

  const { populateDashboardMacros, updateAnalyticsSections } = await import('../populateUI.js');

  await populateDashboardMacros({ calories: 2000 });
  expect(selectors.macroAnalyticsCardContainer.querySelector('macro-analytics-card')).not.toBeNull();

  updateAnalyticsSections({ current: {}, detailed: [] });
  await Promise.resolve();

  expect(selectors.macroAnalyticsCardContainer.querySelector('macro-analytics-card')).not.toBeNull();
});
