/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('updateAnalyticsSections обновява прогрес баровете', async () => {
  document.body.innerHTML = `
    <div id="goalCard"><div id="goalProgressBar"></div><div id="goalProgressFill"></div><span id="goalProgressText"></span></div>
    <div id="engagementCard"><div id="engagementProgressBar"></div><div id="engagementProgressFill"></div><span id="engagementProgressText"></span></div>
    <div id="healthCard"><div id="healthProgressBar"></div><div id="healthProgressFill"></div><span id="healthProgressText"></span></div>
    <div id="analyticsCardsContainer"></div>
    <div id="macroAnalyticsCardContainer"></div>
    <div id="detailedAnalyticsContent"></div>
    <div id="dashboardTextualAnalysis"></div>
  `;
  const selectors = {
    goalCard: document.getElementById('goalCard'),
    goalProgressBar: document.getElementById('goalProgressBar'),
    goalProgressFill: document.getElementById('goalProgressFill'),
    goalProgressText: document.getElementById('goalProgressText'),
    engagementCard: document.getElementById('engagementCard'),
    engagementProgressBar: document.getElementById('engagementProgressBar'),
    engagementProgressFill: document.getElementById('engagementProgressFill'),
    engagementProgressText: document.getElementById('engagementProgressText'),
    healthCard: document.getElementById('healthCard'),
    healthProgressBar: document.getElementById('healthProgressBar'),
    healthProgressFill: document.getElementById('healthProgressFill'),
    healthProgressText: document.getElementById('healthProgressText'),
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    macroAnalyticsCardContainer: document.getElementById('macroAnalyticsCardContainer'),
    detailedAnalyticsContent: document.getElementById('detailedAnalyticsContent'),
    dashboardTextualAnalysis: document.getElementById('dashboardTextualAnalysis')
  };

  jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  jest.unstable_mockModule('../eventListeners.js', () => ({ ensureMacroAnalyticsElement: jest.fn() }));

  const applyProgressFill = jest.fn();
  jest.unstable_mockModule('../utils.js', () => ({
    safeGet: (obj, path, def) => path.split('.').reduce((o,k)=> (o && o[k] !== undefined ? o[k] : undefined), obj) ?? def,
    safeParseFloat: v => parseFloat(v),
    capitalizeFirstLetter: s => s,
    escapeHtml: s => s,
    applyProgressFill,
    getCssVar: jest.fn(),
    formatDateBgShort: () => ''
  }));

  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: { analytics: {}, initialAnswers: {}, initialData: {} },
    todaysMealCompletionStatus: {},
    currentIntakeMacros: {},
    planHasRecContent: false,
    todaysExtraMeals: [],
    loadCurrentIntake: jest.fn(),
    recalculateCurrentIntakeMacros: jest.fn(),
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
    refreshAnalytics: jest.fn()
  }));

  const { updateAnalyticsSections } = await import('../populateUI.js');

  const analytics = {
    current: { goalProgress: 30, engagementScore: 50, overallHealthScore: 80 },
    detailed: [],
    textualAnalysis: ''
  };
  updateAnalyticsSections(analytics);

  expect(applyProgressFill).toHaveBeenCalledWith(selectors.goalProgressFill, 30);
  expect(selectors.goalProgressBar.getAttribute('aria-valuenow')).toBe('30');
  expect(applyProgressFill).toHaveBeenCalledWith(selectors.engagementProgressFill, 50);
  expect(selectors.engagementProgressBar.getAttribute('aria-valuenow')).toBe('50');
  expect(applyProgressFill).toHaveBeenCalledWith(selectors.healthProgressFill, 80);
  expect(selectors.healthProgressBar.getAttribute('aria-valuenow')).toBe('80');
});
