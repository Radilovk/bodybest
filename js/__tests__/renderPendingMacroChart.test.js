/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('renderPendingMacroChart', () => {
  let renderPendingMacroChart;
  let populateDashboardMacros;
  let appState;
  let selectors;
  let populateModule;
  let ensureMacroAnalyticsElement;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule('../macroAnalyticsCardComponent.js', () => ({}));
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
      currentUserId: 'u1',
      recalculateCurrentIntakeMacros: jest.fn(),
      resetAppState: jest.fn(),
      updateMacrosAndAnalytics: jest.fn()
    }));
    jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
    jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
    jest.unstable_mockModule('../macroUtils.js', () => ({ calculatePlanMacros: jest.fn().mockReturnValue({ calories: 850, protein: 72, carbs: 70, fat: 28 }), getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), scaleMacros: jest.fn(), calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0 })) }));
    const eventListenersMock = {
      ensureMacroAnalyticsElement: jest.fn(() => {
        let el = document.querySelector('macro-analytics-card');
        if (!el) {
          el = document.createElement('macro-analytics-card');
          el.setData = jest.fn();
          selectors.macroAnalyticsCardContainer.appendChild(el);
        }
        return el;
      })
    };
    jest.unstable_mockModule('../eventListeners.js', () => eventListenersMock);
    appState = await import('../app.js');
    populateModule = await import('../populateUI.js');
    ({ renderPendingMacroChart, populateDashboardMacros } = populateModule);
    ({ ensureMacroAnalyticsElement } = await import('../eventListeners.js'));
  });

  test('обновява елемента за макро анализ при всяко рендериране', async () => {
    const macros = { calories: 1800, protein_percent: 30, carbs_percent: 40, fat_percent: 30, protein_grams: 135, carbs_grams: 180, fat_grams: 60 };
    Object.assign(appState.todaysPlanMacros, { calories: 850, protein: 72, carbs: 70, fat: 28 });
    await populateDashboardMacros(macros);
    const card = selectors.macroAnalyticsCardContainer.querySelector('macro-analytics-card');
    ensureMacroAnalyticsElement.mockClear();
    card.setData.mockClear();
    renderPendingMacroChart();
    expect(ensureMacroAnalyticsElement).toHaveBeenCalledTimes(1);
    expect(card.setData).toHaveBeenCalledWith(
      expect.objectContaining({ plan: expect.objectContaining({ protein_grams: 72 }) })
    );

    appState.currentIntakeMacros.calories = 1500;
    await populateDashboardMacros(macros);
    ensureMacroAnalyticsElement.mockClear();
    const sameCard = selectors.macroAnalyticsCardContainer.querySelector('macro-analytics-card');
    sameCard.setData.mockClear();
    renderPendingMacroChart();
    expect(ensureMacroAnalyticsElement).toHaveBeenCalledTimes(1);
    expect(sameCard.setData).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.objectContaining({ calories: 1500 }) })
    );
  });

  test('създава елемент за макро анализ при липса', () => {
    document.querySelector('macro-analytics-card')?.remove();
    renderPendingMacroChart();
    expect(ensureMacroAnalyticsElement).toHaveBeenCalledTimes(1);
  });
});
