/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('buildMacroCardUrl appends user threshold', async () => {
  jest.unstable_mockModule('../config.js', () => ({
    standaloneMacroUrl: 'macroAnalyticsCardStandalone.html',
    generateId: () => 'id',
    apiEndpoints: {}
  }));
  jest.unstable_mockModule('../uiElements.js', () => ({ selectors: {}, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    getNutrientOverride: jest.fn(),
    addMealMacros: jest.fn(),
    scaleMacros: jest.fn(),
    calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0, fiber_percent: 0 })),
    calculatePlanMacros: jest.fn()
  }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    ensureMacroAnalyticsElement: jest.fn(),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn(),
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    currentIntakeMacros: {},
    planHasRecContent: false,
    todaysExtraMeals: [],
    loadCurrentIntake: jest.fn(),
    updateMacrosAndAnalytics: jest.fn(),
    currentUserId: 'u1',
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
    recalculateCurrentIntakeMacros: jest.fn(),
    resetAppState: jest.fn(),
    ensureFreshDailyIntake: jest.fn()
  }));
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
  const { setMacroExceedThreshold, buildMacroCardUrl } = await import('../populateUI.js');
  setMacroExceedThreshold(1.05);
  expect(buildMacroCardUrl()).toBe('macroAnalyticsCardStandalone.html?threshold=1.05');
});

test('setMacroExceedThreshold обновява атрибута на съществуващата карта', async () => {
  jest.resetModules();
  document.body.innerHTML = '<div id="macroAnalyticsCardContainer"><macro-analytics-card exceed-threshold="1.15"></macro-analytics-card></div>';
  const container = document.getElementById('macroAnalyticsCardContainer');
  const card = container.querySelector('macro-analytics-card');
  jest.unstable_mockModule('../config.js', () => ({
    standaloneMacroUrl: 'macroAnalyticsCardStandalone.html',
    generateId: () => 'id',
    apiEndpoints: {}
  }));
  jest.unstable_mockModule('../uiElements.js', () => ({
    selectors: { macroAnalyticsCardContainer: container },
    trackerInfoTexts: {},
    detailedMetricInfoTexts: {}
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    getNutrientOverride: jest.fn(),
    addMealMacros: jest.fn(),
    scaleMacros: jest.fn(),
    calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0, fiber_percent: 0 })),
    calculatePlanMacros: jest.fn()
  }));
  jest.unstable_mockModule('../eventListeners.js', () => ({
    ensureMacroAnalyticsElement: jest.fn(() => {
      card.setData = jest.fn();
      return card;
    }),
    setupStaticEventListeners: jest.fn(),
    setupDynamicEventListeners: jest.fn(),
    initializeCollapsibleCards: jest.fn()
  }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    currentIntakeMacros: {},
    planHasRecContent: false,
    todaysExtraMeals: [],
    loadCurrentIntake: jest.fn(),
    updateMacrosAndAnalytics: jest.fn(),
    currentUserId: 'u1',
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
    recalculateCurrentIntakeMacros: jest.fn(),
    resetAppState: jest.fn(),
    ensureFreshDailyIntake: jest.fn()
  }));
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
  const { setMacroExceedThreshold } = await import('../populateUI.js');
  expect(card.getAttribute('exceed-threshold')).toBe('1.15');
  setMacroExceedThreshold(1.25);
  expect(card.getAttribute('exceed-threshold')).toBe('1.25');
});
