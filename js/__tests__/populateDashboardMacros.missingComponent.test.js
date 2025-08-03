/** @jest-environment jsdom */
import { jest } from '@jest/globals';

test('не хвърля грешка при липсващ iframe', async () => {
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
  jest.unstable_mockModule('../config.js', () => ({ generateId: () => 'id', standaloneMacroUrl: 'macroAnalyticsCardStandalone.html' }));
  jest.unstable_mockModule('../app.js', () => ({
    fullDashboardData: {},
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    currentIntakeMacros: {},
    planHasRecContent: false,
  }));
  jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
  const { populateDashboardMacros } = await import('../populateUI.js');
  await expect(populateDashboardMacros({ calories: 1000, protein_percent: 30, carbs_percent: 40, fat_percent: 30 })).resolves.not.toThrow();
});
