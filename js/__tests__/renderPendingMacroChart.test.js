/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('renderPendingMacroChart', () => {
  let renderPendingMacroChart;
  let populateDashboardMacros;
  let appState;
  let selectors;
  let populateModule;
  let __setLastMacroPayload;
  let ensureMacroAnalyticsFrame;

  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="macroMetricsPreview"></div>
      <div id="analyticsCardsContainer"></div>
    `;
    selectors = {
      macroMetricsPreview: document.getElementById('macroMetricsPreview'),
      analyticsCardsContainer: document.getElementById('analyticsCardsContainer'),
      macroAnalyticsCardContainer: document.getElementById('analyticsCardsContainer'),
    };
    jest.unstable_mockModule('../uiElements.js', () => ({ selectors, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
    jest.unstable_mockModule('../utils.js', () => ({ safeGet: jest.fn(), safeParseFloat: jest.fn(), capitalizeFirstLetter: jest.fn(), escapeHtml: jest.fn(), applyProgressFill: jest.fn(), getCssVar: jest.fn(), formatDateBgShort: jest.fn() }));
    jest.unstable_mockModule('../config.js', () => ({
      generateId: () => 'id',
      standaloneMacroUrl: 'macroAnalyticsCardStandalone.html',
      apiEndpoints: { dashboard: '/api/dashboardData' }
    }));
    jest.unstable_mockModule('../app.js', () => ({
      fullDashboardData: {},
      todaysMealCompletionStatus: {},
      currentIntakeMacros: { calories: 1000, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      planHasRecContent: false,
      todaysExtraMeals: [],
      todaysPlanMacros: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      loadCurrentIntake: jest.fn(),
      currentUserId: 'u1'
    }));
    jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
    jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
    jest.unstable_mockModule('../macroUtils.js', () => ({ calculatePlanMacros: jest.fn().mockReturnValue({ calories: 850, protein: 72, carbs: 70, fat: 28 }), getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), scaleMacros: jest.fn() }));
    const eventListenersMock = { ensureMacroAnalyticsFrame: jest.fn() };
    jest.unstable_mockModule('../eventListeners.js', () => eventListenersMock);
    appState = await import('../app.js');
    populateModule = await import('../populateUI.js');
    ({ renderPendingMacroChart, populateDashboardMacros, __setLastMacroPayload } = populateModule);
    ({ ensureMacroAnalyticsFrame } = await import('../eventListeners.js'));
  });

  test('posts updated macro data to iframe on each render', async () => {
    const macros = { calories: 1800, protein_percent: 30, carbs_percent: 40, fat_percent: 30, protein_grams: 135, carbs_grams: 180, fat_grams: 60 };
    Object.assign(appState.todaysPlanMacros, { calories: 850, protein: 72, carbs: 70, fat: 28 });
    await populateDashboardMacros(macros);
    ensureMacroAnalyticsFrame.mockClear();
    const frame = document.createElement('iframe');
    frame.id = 'macroAnalyticsCardFrame';
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage: jest.fn(), document: { readyState: 'complete' } } });
    selectors.macroAnalyticsCardContainer.appendChild(frame);
    renderPendingMacroChart();
    expect(ensureMacroAnalyticsFrame).not.toHaveBeenCalled();
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'macro-data', data: expect.objectContaining({ plan: expect.objectContaining({ protein_grams: 72 }) }) },
      '*'
    );

    appState.currentIntakeMacros.calories = 1500;
    await populateDashboardMacros(macros);
    ensureMacroAnalyticsFrame.mockClear();
    selectors.macroAnalyticsCardContainer.appendChild(frame);
    frame.contentWindow.postMessage.mockClear();
    renderPendingMacroChart();
    expect(ensureMacroAnalyticsFrame).not.toHaveBeenCalled();
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'macro-data', data: expect.objectContaining({ current: expect.objectContaining({ calories: 1500 }) }) },
      '*'
    );
  });

  test('updates existing chart data without destroying it', () => {
    const chartMock = {
      data: { datasets: [{ data: [] }, { data: [] }] },
      update: jest.fn(),
      destroy: jest.fn()
    };
    __setLastMacroPayload({
      plan: { protein_grams: 10, carbs_grams: 20, fat_grams: 30, fiber_grams: 40 },
      current: { protein_grams: 5, carbs_grams: 10, fat_grams: 15, fiber_grams: 20 }
    });
    const ctx = { chart: chartMock };
    renderPendingMacroChart.call(ctx);
    __setLastMacroPayload({
      plan: { protein_grams: 1, carbs_grams: 2, fat_grams: 3, fiber_grams: 4 },
      current: { protein_grams: 0, carbs_grams: 1, fat_grams: 2, fiber_grams: 3 }
    });
    renderPendingMacroChart.call(ctx);
    expect(chartMock.destroy).not.toHaveBeenCalled();
    expect(chartMock.update).toHaveBeenCalledTimes(2);
    expect(chartMock.data.datasets[0].data).toEqual([1, 2, 3, 4]);
    expect(chartMock.data.datasets[1].data).toEqual([0, 1, 2, 3]);
  });

  test('creates analytics frame when missing', () => {
    __setLastMacroPayload({ plan: { protein_grams: 1, carbs_grams: 2, fat_grams: 3, fiber_grams: 4 } });
    renderPendingMacroChart();
    expect(ensureMacroAnalyticsFrame).toHaveBeenCalledTimes(1);
  });
});
