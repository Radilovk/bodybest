/** @jest-environment jsdom */
import { jest } from '@jest/globals';

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = `
    <span id="currentWeightHeader"></span>
    <span id="planStatus"></span>
    <span id="planStatusBadge"></span>
    <div id="macroCards"></div>
    <canvas id="macro-chart-plan"></canvas>
    <canvas id="macro-chart-analytics"></canvas>
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
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn(async () => global.Chart) }));
});

test('fillDashboard initializes doughnut charts and destroys previous', async () => {
  const charts = [
    { destroy: jest.fn() },
    { destroy: jest.fn() },
    { destroy: jest.fn() },
    { destroy: jest.fn() }
  ];
  const ChartMock = jest
    .fn()
    .mockReturnValueOnce(charts[0])
    .mockReturnValueOnce(charts[1])
    .mockReturnValueOnce(charts[2])
    .mockReturnValueOnce(charts[3]);
  global.Chart = ChartMock;
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
        fat_grams: 44,
        fiber_percent: 10,
        fiber_grams: 30
      },
      week1Menu: {},
      allowedForbiddenFoods: {},
      hydrationCookingSupplements: {}
    },
    dailyLogs: [],
    analytics: { streak: { dailyStatusArray: [] } },
    currentStatus: {}
  };

  await fillDashboard(data);
  await fillDashboard(data);
  expect(charts[0].destroy).toHaveBeenCalled();
  expect(charts[1].destroy).toHaveBeenCalled();
  expect(ChartMock.mock.calls[0][1].type).toBe('doughnut');
  expect(ChartMock).toHaveBeenCalledTimes(4);
});
