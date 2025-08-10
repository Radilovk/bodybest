/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initializeExtraMealFormLogic;

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
  const overrides = { 'ябълка': { calories: 60, protein: 1, carbs: 15, fat: 0.5, fiber: 3 } };
  jest.unstable_mockModule('../macroUtils.js', () => ({
    removeMealMacros: jest.fn(),
    registerNutrientOverrides: jest.fn(),
    getNutrientOverride: jest.fn(key => overrides[key]),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] })
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

test('автопопълва макросите при override само по име', async () => {
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
      <input type="radio" name="quantityEstimateVisual" value="x" checked>
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
  const input = container.querySelector('#foodDescription');
  input.value = 'Ябълка';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('60');
  expect(container.querySelector('input[name="protein"]').value).toBe('1');
  expect(container.querySelector('input[name="carbs"]').value).toBe('15');
  expect(container.querySelector('input[name="fat"]').value).toBe('0.5');
  expect(container.querySelector('input[name="fiber"]').value).toBe('3');
  const autoFillMsg = container.querySelector('#autoFillMsg');
  expect(autoFillMsg).not.toBeNull();
  expect(autoFillMsg.classList.contains('hidden')).toBe(false);
});
