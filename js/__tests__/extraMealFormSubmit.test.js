/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleExtraMealFormSubmit;
let showToastMock;
let addExtraMealWithOverrideMock;
let appendExtraMealCardMock;
let currentIntakeMacrosRef;

beforeEach(async () => {
  jest.resetModules();
  showToastMock = jest.fn();
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showLoading: jest.fn(),
    showToast: showToastMock,
    openModal: jest.fn(),
    closeModal: jest.fn(),
    loadAndApplyColors: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { logExtraMeal: '/api' }
  }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    removeMealMacros: jest.fn(),
    registerNutrientOverrides: jest.fn(),
    getNutrientOverride: jest.fn(() => null),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
    calculateMacroPercents: jest.fn(() => ({ protein_percent: 0, carbs_percent: 0, fat_percent: 0 }))
  }));
  addExtraMealWithOverrideMock = jest.fn();
  appendExtraMealCardMock = jest.fn();
  jest.unstable_mockModule('../populateUI.js', () => ({
    addExtraMealWithOverride: addExtraMealWithOverrideMock,
    populateDashboardMacros: jest.fn(),
    renderPendingMacroChart: jest.fn(),
    appendExtraMealCard: appendExtraMealCardMock
  }));
  jest.unstable_mockModule('../app.js', () => {
    currentIntakeMacrosRef = {};
    return {
      currentUserId: 'u1',
      todaysMealCompletionStatus: {},
      todaysExtraMeals: [],
      currentIntakeMacros: currentIntakeMacrosRef,
      fullDashboardData: { planData: { week1Menu: {}, caloriesMacros: { fiber_percent: 10, fiber_grams: 30 } } },
      planHasRecContent: false,
      loadCurrentIntake: jest.fn(),
      updateMacrosAndAnalytics: jest.fn()
    };
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  ({ handleExtraMealFormSubmit } = await import('../extraMealForm.js'));
  fetch.mockClear();
});

test('показва съобщение при липса на количество', async () => {
  document.body.innerHTML = `<form id="f"><input id="quantityCustom" name="quantityCustom"></form>`;
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  expect(showToastMock).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test('изпраща макро стойности при попълнени полета', async () => {
  document.body.innerHTML = `<form id="f">
    <input type="radio" name="quantityEstimateVisual" value="малко" checked>
    <input name="calories" value="120">
    <input name="protein" value="10">
    <input name="carbs" value="15">
    <input name="fat" value="5">
    <input name="fiber" value="3">
  </form>`;
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.calories).toBe(120);
  expect(body.protein).toBe(10);
  expect(body.carbs).toBe(15);
  expect(body.fat).toBe(5);
  expect(body.fiber).toBe(3);
  expect(addExtraMealWithOverrideMock).toHaveBeenCalledWith(
    undefined,
    { calories: 120, protein: 10, carbs: 15, fat: 5 }
  );
  expect(appendExtraMealCardMock).toHaveBeenCalledWith(undefined, 'малко');
});

test('предава въведено количество без избрана опция', async () => {
  document.body.innerHTML = `<form id="f">
    <input id="quantityCustom" name="quantityCustom" value="200 гр">
  </form>`;
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  expect(appendExtraMealCardMock).toHaveBeenCalledWith(undefined, '200 гр');
});

test('добавя DOM елемент при успешно изпращане', async () => {
  document.body.innerHTML = `
    <ul id="dailyMealList"></ul>
    <form id="f">
      <input type="radio" name="quantityEstimateVisual" value="малко" checked>
    </form>`;
  const selectors = (await import('../uiElements.js')).selectors;
  selectors.dailyMealList = document.getElementById('dailyMealList');
  appendExtraMealCardMock.mockImplementation(() => {
    const li = document.createElement('li');
    li.classList.add('meal-card');
    selectors.dailyMealList.appendChild(li);
  });
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  expect(document.querySelectorAll('#dailyMealList li.meal-card')).toHaveLength(1);
});
