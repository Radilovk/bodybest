/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initializeExtraMealFormLogic;

beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn((url, opts) => {
    if (typeof url === 'string' && url === '/nutrient-lookup') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ calories: 100, protein: 20, carbs: 10, fat: 5, fiber: 3 })
      });
    }
    return Promise.resolve({ json: async () => [] });
  });
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showLoading: jest.fn(),
    showToast: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
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

test('извиква nutrient lookup при непозната храна', async () => {
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
  input.value = 'непозната храна';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  expect(global.fetch).toHaveBeenCalledWith('/nutrient-lookup', expect.objectContaining({ method: 'POST' }));
  expect(container.querySelector('input[name="calories"]').value).toBe('100');
  expect(container.querySelector('input[name="fiber"]').value).toBe('3');
});

test('дебоунс: бързи въвеждания водят до една заявка', async () => {
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
  input.value = 'първо';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.value = 'второ';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  const nutrientCalls = global.fetch.mock.calls.filter(c => c[0] === '/nutrient-lookup');
  expect(nutrientCalls).toHaveLength(1);
});
