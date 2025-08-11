/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initializeExtraMealFormLogic;

const scale = (m, g) => {
  const f = g / 100;
  return {
    calories: (m.calories || 0) * f,
    protein: (m.protein || 0) * f,
    carbs: (m.carbs || 0) * f,
    fat: (m.fat || 0) * f,
    fiber: (m.fiber || 0) * f,
  };
};

beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showLoading: jest.fn(),
    showToast: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    removeMealMacros: jest.fn(),
    registerNutrientOverrides: jest.fn(),
    getNutrientOverride: jest.fn(),
    loadProductMacros: jest.fn().mockResolvedValue({
      overrides: {},
      products: [{ name: 'банан', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 }]
    }),
    scaleMacros: jest.fn(scale)
  }));
  jest.unstable_mockModule('../populateUI.js', () => ({ addExtraMealWithOverride: jest.fn(), populateDashboardMacros: jest.fn(), appendExtraMealCard: jest.fn() }));
  jest.unstable_mockModule('../app.js', () => ({
    currentUserId: 'u1',
    todaysExtraMeals: [],
    todaysMealCompletionStatus: {},
    currentIntakeMacros: {},
    fullDashboardData: { planData: { week1Menu: {}, caloriesMacros: { fiber_percent: 10, fiber_grams: 30 } } },
    loadCurrentIntake: jest.fn(),
    updateMacrosAndAnalytics: jest.fn()
  }));
  ({ initializeExtraMealFormLogic } = await import('../extraMealForm.js'));
});

test('изчислява грамове и попълва макроси', async () => {
  document.body.innerHTML = `<div id="c">
    <form id="extraMealEntryFormActual">
      <div class="form-step"></div>
      <div class="form-wizard-navigation">
        <button id="emPrevStepBtn"></button>
        <button id="emNextStepBtn"></button>
        <button id="emSubmitBtn"></button>
        <button id="emCancelBtn"></button>
      </div>
      <textarea id="foodDescription"></textarea>
      <div id="foodSuggestionsDropdown"></div>
      <input id="quantityCountInput">
      <input id="measureInput" list="measureSuggestionList">
      <datalist id="measureSuggestionList"></datalist>
      <input id="quantity">
      <input id="quantityCustom">
      <div class="macro-inputs-grid">
        <input name="calories">
        <input name="protein">
        <input name="carbs">
        <input name="fat">
        <input name="fiber">
      </div>
      <div class="form-step"></div>
    </form>
  </div>`;
  const container = document.getElementById('c');
  await initializeExtraMealFormLogic(container);
  const desc = container.querySelector('#foodDescription');
  desc.value = 'банан';
  desc.dispatchEvent(new Event('input', { bubbles: true }));
  const count = container.querySelector('#quantityCountInput');
  const measure = container.querySelector('#measureInput');
  count.value = '2';
  measure.value = 'среден';
  count.dispatchEvent(new Event('input', { bubbles: true }));
  measure.dispatchEvent(new Event('input', { bubbles: true }));
  expect(container.querySelector('#quantity').value).toBe('240');
  expect(container.querySelector('#quantityCustom').value).toBe('240 гр');
  expect(container.querySelector('input[name="calories"]').value).toBe('213.60');
  expect(container.querySelector('input[name="protein"]').value).toBe('2.64');
  expect(container.querySelector('input[name="carbs"]').value).toBe('55.20');
  expect(container.querySelector('input[name="fat"]').value).toBe('0.72');
  expect(container.querySelector('input[name="fiber"]').value).toBe('6.24');
  expect(container.querySelector('#autoFillMsg').classList.contains('hidden')).toBe(false);
});
