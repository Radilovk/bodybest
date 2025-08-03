/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('логва предупреждение при липсващ macro-analytics-card компонент', async () => {
  jest.unstable_mockModule('../macroAnalyticsCardComponent.js', () => ({}));
  document.body.innerHTML = `
    <div id="macroMetricsPreview"></div>
    <div id="analyticsCardsContainer"></div>
  `;
  const selectors = {
    macroMetricsPreview: document.getElementById('macroMetricsPreview'),
    analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
  };
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
  jest.unstable_mockModule('../config.js', () => ({ generateId: () => 'id' }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    currentIntakeMacros: {},
    planHasRecContent: false,
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { populateDashboardMacros } = await import('../populateUI.js');
  await populateDashboardMacros({ calories: 1000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 });
  expect(warnSpy).toHaveBeenCalled();
  expect(document.getElementById('macroAnalyticsCard')).toBeNull();
});
