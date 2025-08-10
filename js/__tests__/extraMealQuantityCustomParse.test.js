/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initializeExtraMealFormLogic;
const scaleMacrosImpl = (prod, grams) => {
  const factor = grams / 100;
  return {
    calories: (prod.calories || 0) * factor,
    protein: (prod.protein || 0) * factor,
    carbs: (prod.carbs || 0) * factor,
    fat: (prod.fat || 0) * factor,
    fiber: (prod.fiber || 0) * factor,
  };
};

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
    scaleMacros: jest.fn(scaleMacrosImpl),
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

test('парсира "100гр ябълка" и попълва калории 52', async () => {
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
      <input id="quantityCustom">
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
  const qc = container.querySelector('#quantityCustom');
  qc.value = '100гр ябълка';
  qc.dispatchEvent(new Event('input', { bubbles: true }));
  expect(container.querySelector('#quantity').value).toBe('100');
  const calories = parseFloat(container.querySelector('input[name="calories"]').value);
  expect(calories).toBeCloseTo(52, 0);
});
