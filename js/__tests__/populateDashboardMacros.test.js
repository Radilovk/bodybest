/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let populateModule;
let populateDashboardMacros;
let renderPendingMacroChart;
let selectors;
let appState;
beforeAll(async () => {
  appState = await import('../app.js');
  populateModule = await import('../populateUI.js');
  ({ populateDashboardMacros, renderPendingMacroChart } = populateModule);
  ({ selectors } = await import('../uiElements.js'));
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
  expect(document.getElementById('macroAnalyticsCardFrame')).toBeNull();

  const frame = document.createElement('iframe');
  frame.id = 'macroAnalyticsCardFrame';
  Object.defineProperty(frame, 'contentWindow', { value: { postMessage: jest.fn(), document: { readyState: 'complete' } } });
  selectors.macroAnalyticsCardContainer.appendChild(frame);
  renderPendingMacroChart();
  expect(frame.contentWindow.postMessage).toHaveBeenCalled();
  const expectedCurrent = {
    calories: appState.currentIntakeMacros.calories,
    protein_grams: appState.currentIntakeMacros.protein,
    carbs_grams: appState.currentIntakeMacros.carbs,
    fat_grams: appState.currentIntakeMacros.fat,
    fiber_grams: appState.currentIntakeMacros.fiber
  };
  const [msg, origin] = frame.contentWindow.postMessage.mock.calls[0];
  expect(origin).toBe('*');
  expect(msg).toMatchObject({
    type: 'macro-data',
    data: {
      target: macros,
      plan: expect.objectContaining({ calories: 850, protein: 72, carbs: 70, fat: 28 }),
      current: expectedCurrent
    }
  });
});

test('валидира и отхвърля некоректни макро данни', async () => {
  setupDom();
  const previous = populateModule.lastMacroPayload;
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const currentDayKey = dayNames[new Date().getDay()];
  appState.fullDashboardData.planData = { week1Menu: { [currentDayKey]: [] } };
  const badMacros = { calories: 2000, protein_grams: 'bad', carbs_grams: 200, fat_grams: 60, fiber_percent: 10, fiber_grams: 30 };
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await populateDashboardMacros(badMacros);
  expect(warnSpy).toHaveBeenCalled();
  expect(populateModule.lastMacroPayload).toBe(previous);
  warnSpy.mockRestore();
});
