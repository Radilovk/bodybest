/** @jest-environment jsdom */
import { jest } from '@jest/globals';

describe('renderPendingMacroChart', () => {
  let renderPendingMacroChart;

  beforeEach(async () => {
    jest.resetModules();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: '',
        caloriesLabel: '',
        macros: { protein: '', carbs: '', fat: '', fiber: '' },
        fromGoal: 'от целта',
        subtitle: '{percent} от целта',
        totalCaloriesLabel: '',
        exceedWarning: ''
      })
    });
    document.body.innerHTML = `
      <macro-analytics-card id="macroAnalyticsCard"></macro-analytics-card>
      <iframe id="macroAnalyticsCardFrame"></iframe>
    `;
    await import('../macroAnalyticsCardComponent.js');
    jest.unstable_mockModule('../uiElements.js', () => ({ selectors: {}, trackerInfoTexts: {}, detailedMetricInfoTexts: {} }));
    jest.unstable_mockModule('../utils.js', () => ({ safeGet: jest.fn(), safeParseFloat: jest.fn(), capitalizeFirstLetter: jest.fn(), escapeHtml: jest.fn(), applyProgressFill: jest.fn(), getCssVar: jest.fn(), formatDateBgShort: jest.fn() }));
    jest.unstable_mockModule('../config.js', () => ({ generateId: () => 'id' }));
    jest.unstable_mockModule('../app.js', () => ({ fullDashboardData: {}, todaysMealCompletionStatus: {}, currentIntakeMacros: {}, planHasRecContent: false, todaysExtraMeals: [], loadCurrentIntake: jest.fn() }));
    jest.unstable_mockModule('../uiHandlers.js', () => ({ showToast: jest.fn() }));
    jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn() }));
    jest.unstable_mockModule('../macroUtils.js', () => ({ calculatePlanMacros: jest.fn(), getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), scaleMacros: jest.fn() }));
    ({ renderPendingMacroChart } = await import('../populateUI.js'));
  });

  test('posts updated macro data to iframe on each render', () => {
    const card = document.getElementById('macroAnalyticsCard');
    card.renderChart = jest.fn();
    card.chart = {};
    card.targetData = { calories: 2000 };
    card.planData = { calories: 1900 };
    card.currentData = { calories: 1000 };
    const frame = document.getElementById('macroAnalyticsCardFrame');
    frame.contentWindow = { postMessage: jest.fn() };

    renderPendingMacroChart();
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'macro-data', data: { target: card.targetData, plan: card.planData, current: card.currentData } },
      '*'
    );

    frame.contentWindow.postMessage.mockClear();
    card.currentData = { calories: 1500 };
    renderPendingMacroChart();
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { type: 'macro-data', data: { target: card.targetData, plan: card.planData, current: card.currentData } },
      '*'
    );
  });
});
