/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initializeExtraMealFormLogic;
const scaleMacrosMock = jest.fn(() => ({
  calories: 104,
  protein: 0.6,
  carbs: 28,
  fat: 0.4,
  fiber: 0
}));

beforeEach(async () => {
  jest.resetModules();
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showLoading: jest.fn(),
    showToast: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
  }));
  jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    removeMealMacros: jest.fn(),
    registerNutrientOverrides: jest.fn(),
    getNutrientOverride: jest.fn(),
    loadProductMacros: jest.fn().mockResolvedValue({
      overrides: {},
      products: [{ name: 'ябълка', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 0 }]
    }),
    scaleMacros: scaleMacrosMock,
  }));
  jest.unstable_mockModule('../populateUI.js', () => ({
    addExtraMealWithOverride: jest.fn(),
    appendExtraMealCard: jest.fn(),
  }));
  jest.unstable_mockModule('../app.js', () => ({
    currentUserId: 'u1',
    todaysExtraMeals: [],
    currentIntakeMacros: {},
    fullDashboardData: {},
    loadCurrentIntake: jest.fn(),
    updateMacrosAndAnalytics: jest.fn(),
  }));
  ({ initializeExtraMealFormLogic } = await import('../extraMealForm.js'));
});

test('computeQuantity използва scaleMacros за попълване на макроси', async () => {
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
      <div id="measureOptions">
        <label class="quantity-card-option"><input type="radio" name="measureOption" data-grams="200" checked><span class="card-content"></span></label>
      </div>
      <input id="quantity">
      <input name="calories">
      <input name="protein">
      <input name="carbs">
      <input name="fat">
      <input name="fiber">
      <div class="form-step"></div>
    </form>
  </div>`;
  const container = document.getElementById('c');
  await initializeExtraMealFormLogic(container);
  const desc = container.querySelector('#foodDescription');
  desc.value = 'ябълка';
  const measureRadio = container.querySelector('#measureOptions input');
  measureRadio.dispatchEvent(new Event('change', { bubbles: true }));
  expect(scaleMacrosMock).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'ябълка' }),
    200
  );
  expect(container.querySelector('input[name="calories"]').value).toBe('104.00');
  expect(container.querySelector('input[name="protein"]').value).toBe('0.60');
  expect(container.querySelector('input[name="carbs"]').value).toBe('28.00');
  expect(container.querySelector('input[name="fat"]').value).toBe('0.40');
});
