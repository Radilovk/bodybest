/** @jest-environment jsdom */
import { jest } from '@jest/globals';

afterEach(() => {
  jest.resetModules();
});

function setupMocks(selectors) {
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
    todaysPlanMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    currentIntakeMacros: {},
    planHasRecContent: false,
    loadCurrentIntake: jest.fn(),
    currentUserId: 'u1'
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
}

test('създава контейнер, ако липсва макро анализ карта', async () => {
  document.body.innerHTML = `
    <div id="macroMetricsPreview"></div>
    <div id="analyticsCardsContainer"></div>
  `;
  const selectors = {
    macroMetricsPreview: document.getElementById('macroMetricsPreview'),
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: null,
  };
  setupMocks(selectors);
  const { populateDashboardMacros } = await import('../populateUI.js');
  await expect(populateDashboardMacros({ calories: 1000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 })).resolves.not.toThrow();
  const container = document.getElementById('macroAnalyticsCardContainer');
  expect(container).not.toBeNull();
  expect(selectors.analyticsCardsContainer.contains(container)).toBe(true);
  const frame = container.querySelector('#macroAnalyticsCardFrame');
  expect(frame).toBeNull();
});

test('пресъздава контейнер, когато е извън DOM', async () => {
  document.body.innerHTML = `
    <div id="macroMetricsPreview"></div>
    <div id="analyticsCardsContainer"></div>
  `;
  const detached = document.createElement('div');
  detached.id = 'macroAnalyticsCardContainer';
  const selectors = {
    macroMetricsPreview: document.getElementById('macroMetricsPreview'),
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: detached,
  };
  setupMocks(selectors);
  const { populateDashboardMacros } = await import('../populateUI.js');
  await populateDashboardMacros({ calories: 1000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 });
  const container = document.getElementById('macroAnalyticsCardContainer');
  expect(container).not.toBe(detached);
  expect(selectors.analyticsCardsContainer.contains(container)).toBe(true);
});
