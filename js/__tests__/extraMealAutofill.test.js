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
  jest.unstable_mockModule('../populateUI.js', () => ({ addExtraMealWithOverride: jest.fn(), populateDashboardMacros: jest.fn(), renderPendingMacroChart: jest.fn(), appendExtraMealCard: jest.fn() }));
  jest.unstable_mockModule('../app.js', () => ({
    currentUserId: 'u1',
    todaysExtraMeals: [],
    todaysMealCompletionStatus: {},
    currentIntakeMacros: {},
    fullDashboardData: { planData: { week1Menu: {}, caloriesMacros: { fiber_percent: 10, fiber_grams: 30 } } },
    loadCurrentIntake: jest.fn()
  }));
  ({ initializeExtraMealFormLogic } = await import('../extraMealForm.js'));
});

test('автопопълва макросите при разпозната храна', async () => {
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
  const input = container.querySelector('#foodDescription');
  input.value = 'ябълка';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('52');
  expect(container.querySelector('input[name="protein"]').value).toBe('0.3');
});
