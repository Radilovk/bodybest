/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let populateModule;
let populateDashboardMacros;
let renderPendingMacroChart;
let selectors;
let appState;
let macroUtils;

jest.unstable_mockModule('../eventListeners.js', () => ({
  ensureMacroAnalyticsElement: jest.fn(() => {
    let el = document.querySelector('macro-analytics-card');
    if (!el) {
      el = document.createElement('macro-analytics-card');
      el.setData = jest.fn();
      const container = document.getElementById('macroAnalyticsCardContainer');
      if (container) container.appendChild(el);
    }
    return el;
  }),
  setupStaticEventListeners: jest.fn(),
  setupDynamicEventListeners: jest.fn(),
  initializeCollapsibleCards: jest.fn()
}));
beforeAll(async () => {
  appState = await import('../app.js');
  populateModule = await import('../populateUI.js');
  ({ populateDashboardMacros, renderPendingMacroChart } = populateModule);
  ({ selectors } = await import('../uiElements.js'));
  macroUtils = await import('../macroUtils.js');
});

function setupDom() {
  document.body.innerHTML = '<div id="macroMetricsPreview"></div><div id="analyticsCardsContainer"></div>';
  selectors.macroMetricsPreview = document.getElementById('macroMetricsPreview');
  selectors.analyticsCardsContainer = document.getElementById('analyticsCardsContainer');
}

test('recalculates macros automatically and shows spinner while loading', async () => {
  setupDom();
  appState.setCurrentUserId('u1');
  const macros = {
    calories: 1800,
    protein_percent: 30,
    carbs_percent: 40,
    fat_percent: 30,
    protein_grams: 135,
    carbs_grams: 180,
    fat_grams: 60,
    fiber_percent: 10,
    fiber_grams: 30
  };
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const dayMenu = [
    { id: 'z-01', meal_name: 'Протеинов шейк' },
    { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
  ];
  appState.fullDashboardData.planData = { week1Menu: { [currentDayKey]: dayMenu } };
  Object.assign(appState.todaysPlanMacros, macroUtils.calculatePlanMacros(dayMenu));

  const originalFetch = global.fetch;
  let resolveFetch;
  global.fetch = jest.fn().mockImplementation(() => new Promise(res => {
    resolveFetch = () => res({ ok: true, json: async () => ({ planData: { caloriesMacros: macros } }) });
  }));

  const promise = populateDashboardMacros(null);
  const container = selectors.macroAnalyticsCardContainer;
  expect(container.innerHTML).toContain('spinner-border');
  expect(selectors.macroMetricsPreview.classList.contains('hidden')).toBe(true);
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('recalcMacros=1'));

  resolveFetch();
  await promise;

  expect(selectors.macroMetricsPreview.classList.contains('hidden')).toBe(false);
  expect(selectors.macroMetricsPreview.textContent).toContain('1800');
  expect(container.innerHTML).not.toContain('spinner-border');
  global.fetch = originalFetch;
  const card = container.querySelector('macro-analytics-card');
  expect(card).not.toBeNull();
  card.setData.mockClear();
  renderPendingMacroChart();
  expect(card.setData).toHaveBeenCalled();
  const expectedCurrent = {
    calories: appState.currentIntakeMacros.calories,
    protein_grams: appState.currentIntakeMacros.protein,
    carbs_grams: appState.currentIntakeMacros.carbs,
    fat_grams: appState.currentIntakeMacros.fat,
    fiber_grams: appState.currentIntakeMacros.fiber
  };
  const [payload] = card.setData.mock.calls[0];
  expect(payload).toMatchObject({
    plan: expect.objectContaining({ calories: 850, protein_grams: 72, carbs_grams: 70, fat_grams: 28 }),
    current: expectedCurrent
  });
});

test('валидира и отхвърля некоректни макро данни', async () => {
  setupDom();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  appState.fullDashboardData.planData = { week1Menu: { [currentDayKey]: [] } };
  Object.assign(appState.todaysPlanMacros, { calories: 2000, protein: 'bad', carbs: 200, fat: 60, fiber: 30 });
  await populateDashboardMacros({});
  expect(document.querySelector('macro-analytics-card')).toBeNull();
});

test('calculatePlanMacros се извиква само веднъж при кеширани стойности', async () => {
  jest.resetModules();
  const calcMock = jest.fn().mockReturnValue({ calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 3 });
  jest.unstable_mockModule('../macroUtils.js', () => ({ loadProductMacros: jest.fn(), calculateCurrentMacros: jest.fn(), calculatePlanMacros: calcMock, getNutrientOverride: jest.fn(), addMealMacros: jest.fn(), removeMealMacros: jest.fn(), scaleMacros: jest.fn(), registerNutrientOverrides: jest.fn() }));
  const app = await import('../app.js');
  const populate = await import('../populateUI.js');
  const { populateDashboardMacros } = populate;
  const { selectors } = await import('../uiElements.js');
  document.body.innerHTML = '<div id="macroMetricsPreview"></div><div id="analyticsCardsContainer"></div>';
  selectors.macroMetricsPreview = document.getElementById('macroMetricsPreview');
  selectors.analyticsCardsContainer = document.getElementById('analyticsCardsContainer');
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  const dayMenu = [{ macros: { calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 3 } }];
  app.fullDashboardData.planData = { week1Menu: { [currentDayKey]: dayMenu } };
  Object.assign(app.todaysPlanMacros, calcMock(dayMenu));
  await populateDashboardMacros({});
  await populateDashboardMacros({});
  expect(calcMock).toHaveBeenCalledTimes(1);
});
