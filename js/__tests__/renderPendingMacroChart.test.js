/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('renderPendingMacroChart', () => {
  let renderPendingMacroChart;
  let populateDashboardMacros;
  let appState;

  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="macroMetricsPreview"></div>
      <div id="analyticsCardsContainer"><iframe id="macroAnalyticsCardFrame"></iframe></div>
    `;
    const selectors = {
      macroMetricsPreview: document.getElementById('macroMetricsPreview'),
      analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
    };
    jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
    jest.unstable_mockModule('../utils.js', () => ({ safeGet: jest.fn(), safeParseFloat: jest.fn(), capitalizeFirstLetter: jest.fn(), escapeHtml: jest.fn(), applyProgressFill: jest.fn(), getCssVar: jest.fn(), formatDateBgShort: jest.fn() }));
    jest.unstable_mockModule('../config.js', () => ({ generateId: () => 'id', standaloneMacroUrl: 'macroAnalyticsCardStandalone.html' }));
    jest.unstable_mockModule('../app.js', () => ({ fullDashboardData: {}, todaysMealCompletionStatus: {}, currentIntakeMacros: { calories: 1000, protein: 0, carbs: 0, fat: 0, fiber: 0 }, planHasRecContent: false, todaysExtraMeals: [], loadCurrentIntake: jest.fn() }));
    jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
    jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
    jest.unstable_mockModule('../macroUtils.js', () => ({ calculatePlanMacros: jest.fn().mockReturnValue({ calories: 850, protein: 72, carbs: 70, fat: 28 }), getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), scaleMacros: jest.fn() }));
    appState = await import('../app.js');
    const mod = await import('../populateUI.js');
    ({ renderPendingMacroChart, populateDashboardMacros } = mod);
  });

  test('posts updated macro data to iframe on each render', async () => {
    const frame = document.getElementById('macroAnalyticsCardFrame');
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: jest.fn(), document: { readyState: 'complete' } } });
    const macros = { calories: 1800, protein_percent: 30, carbs_percent: 40, fat_percent: 30, protein_grams: 135, carbs_grams: 180, fat_grams: 60 };
    await populateDashboardMacros(macros);
    frame.contentWindow.postMessage.mockClear();
    renderPendingMacroChart();
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'macro-data', data: expect.objectContaining({ target: macros }) },
      '*'
    );

    appState.currentIntakeMacros.calories = 1500;
    await populateDashboardMacros(macros);
    frame.contentWindow.postMessage.mockClear();
    renderPendingMacroChart();
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'macro-data', data: expect.objectContaining({ current: expect.objectContaining({ calories: 1500 }) }) },
      '*'
    );
  });
});
