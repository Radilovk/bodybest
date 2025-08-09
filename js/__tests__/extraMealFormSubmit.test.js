/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleExtraMealFormSubmit;
let fetchMacrosFromAi;
let setNutrientLookupFn;
let extraMealFormModule;
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
  extraMealFormModule = await import('../extraMealForm.js');
  handleExtraMealFormSubmit = extraMealFormModule.handleExtraMealFormSubmit;
  fetchMacrosFromAi = extraMealFormModule.fetchMacrosFromAi;
  setNutrientLookupFn = extraMealFormModule.__setNutrientLookupFn;
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

test('показва грешка при неположително количество', async () => {
  document.body.innerHTML = `<form id="f"><input name="quantity" value="-3"></form>`;
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
    { calories: 120, protein: 10, carbs: 15, fat: 5, fiber: 3 }
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

test('извлича макроси от AI при празни полета', async () => {
  document.body.innerHTML = `<form id="f">
    <input name="foodDescription" value="банан">
    <input name="quantity" value="100">
    <input type="radio" name="quantityEstimateVisual" value="малко" checked>
    <input name="calories">
    <input name="protein">
    <input name="carbs">
    <input name="fat">
    <input name="fiber">
    <div id="extraMealSummary">
      <span data-summary="calories"></span>
      <span data-summary="protein"></span>
      <span data-summary="carbs"></span>
      <span data-summary="fat"></span>
      <span data-summary="fiber"></span>
    </div>
  </form>`;
  const mockAi = jest.fn().mockResolvedValue({
    calories: 50,
    protein: 1,
    carbs: 12,
    fat: 0.2,
    fiber: 2
  });
  setNutrientLookupFn(mockAi);
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  expect(mockAi).toHaveBeenCalledWith('банан', 100);
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.calories).toBe(50);
  expect(form.querySelector('#extraMealSummary [data-summary="protein"]').textContent).toBe('1');
  expect(form.querySelector('#extraMealSummary [data-summary="fiber"]').textContent).toBe('2');
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

test('fetchMacrosFromAi хвърля грешка при неположително количество', async () => {
  await expect(fetchMacrosFromAi('ябълка', 0)).rejects.toThrow('Invalid quantity');
  expect(showToastMock).toHaveBeenCalled();
});
