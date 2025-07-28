/** @jest-environment jsdom */
import { jest } from '@jest/globals';

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = `
    <span id="currentWeightHeader"></span>
    <span id="planStatus"></span>
    <span id="planStatusBadge"></span>
    <div id="macroCards"></div>
    <canvas id="macro-chart"></canvas>
    <textarea id="planJson"></textarea>
    <div id="planMenu"></div>
    <div id="allowedFoodsContainer"></div>
    <div id="forbiddenFoodsContainer"></div>
    <div id="principlesSection"></div>
    <div id="hydrationContainer"></div>
    <div id="cookingMethodsContainer"></div>
    <table><tbody id="logsTableBody"></tbody></table>
    <div id="analyticsInfo"></div>
    <div id="goalProgress"></div>
    <div id="engagementScore"></div>
    <div id="healthScore"></div>
    <div id="goalProgressBar"></div>
    <div id="engagementBar"></div>
    <div id="healthBar"></div>
    <div id="streakCalendar"></div>
  `;
  jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
  jest.unstable_mockModule('../labelMap.js', () => ({ labelMap: {}, statusMap: {} }));
  jest.unstable_mockModule('../planEditor.js', () => ({ initPlanEditor: jest.fn(), gatherPlanFormData: jest.fn(() => ({})) }));
});

test('fillDashboard initializes doughnut chart and destroys previous', async () => {
  const first = { destroy: jest.fn() };
  const second = { destroy: jest.fn() };
  global.Chart = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const { fillDashboard } = await import('../clientProfile.js');
  const data = {
    planData: {
      caloriesMacros: {
        calories: 2000,
        protein_percent: 40,
        carbs_percent: 40,
        fat_percent: 20,
        protein_grams: 120,
        carbs_grams: 200,
        fat_grams: 44
      },
      week1Menu: {},
      allowedForbiddenFoods: {},
      hydrationCookingSupplements: {}
    },
    dailyLogs: [],
    analytics: { streak: { dailyStatusArray: [] } },
    currentStatus: {}
  };

  fillDashboard(data);
  fillDashboard(data);
  expect(first.destroy).toHaveBeenCalled();
  expect(global.Chart.mock.calls[0][1].type).toBe('doughnut');
  expect(global.Chart).toHaveBeenCalledTimes(2);
});
