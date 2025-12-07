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
  jest.unstable_mockModule('../macroUtils.js', () => ({
    removeMealMacros: jest.fn(),
    registerNutrientOverrides: jest.fn(),
    getNutrientOverride: jest.fn(() => null),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
    scaleMacros: jest.fn()
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

test.skip('извиква nutrient lookup при навигация към стъпка 5 с празни макроси', async () => {
  document.body.innerHTML = `<div id="c">
    <form id="extraMealEntryFormActual">
      <div class="form-step active-step" data-step="1"></div>
      <div class="form-step" data-step="2"></div>
      <div class="form-step" data-step="3"></div>
      <div class="form-step" data-step="4"></div>
      <div class="form-step" data-step="5">
        <div id="extraMealSummary">
          <span data-summary="foodDescription"></span>
          <span data-summary="quantityEstimate"></span>
          <span data-summary="calories"></span>
          <span data-summary="protein"></span>
          <span data-summary="carbs"></span>
          <span data-summary="fat"></span>
          <span data-summary="fiber"></span>
          <span data-summary="reasonPrimary"></span>
          <span data-summary="feelingAfter"></span>
          <span data-summary="replacedPlanned"></span>
        </div>
      </div>
      <div class="form-wizard-navigation">
        <button id="emPrevStepBtn"></button>
        <button id="emNextStepBtn"></button>
        <button id="emSubmitBtn"></button>
        <button id="emCancelBtn"></button>
      </div>
      <div id="stepProgressBar"></div>
      <span id="currentStepNumber"></span>
      <span id="totalStepNumber"></span>
      <textarea id="foodDescription">непозната храна</textarea>
      <div id="foodSuggestionsDropdown"></div>
      <input id="quantityCustom" name="quantityCustom" value="100">
      <input name="quantity" value="100">
      <input name="calories">
      <input name="protein">
      <input name="carbs">
      <input name="fat">
      <input name="fiber">
      <input type="radio" name="reasonPrimary" value="глад" checked>
      <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
      <input type="radio" name="replacedPlanned" value="не" checked>
    </form>
  </div>`;
  const container = document.getElementById('c');
  await initializeExtraMealFormLogic(container);
  
  // Сим улираме навигация към стъпка 5 (последна стъпка) - кликваме next 4 пъти и изчакваме всеки път
  const nextBtn = container.querySelector('#emNextStepBtn');
  
  // Click and wait for async operations
  nextBtn.click();  // -> step 2
  await new Promise(r => setTimeout(r, 50));
  
  nextBtn.click();  // -> step 3
  await new Promise(r => setTimeout(r, 50));
  
  nextBtn.click();  // -> step 4
  await new Promise(r => setTimeout(r, 50));
  
  nextBtn.click();  // -> step 5
  
  // Изчакваме nutrient lookup да завърши (по-дълго време)
  await new Promise(r => setTimeout(r, 300));
  
  expect(global.fetch).toHaveBeenCalledWith('/nutrient-lookup', expect.objectContaining({ method: 'POST' }));
  expect(container.querySelector('input[name="calories"]').value).toBe('100.00');
  expect(container.querySelector('input[name="fiber"]').value).toBe('3.00');
});

test('дебоунс: бързи въвеждания в quantityCustom водят до една заявка', async () => {
  jest.useFakeTimers();
  document.body.innerHTML = `<div id="c">
    <form id="extraMealEntryFormActual">
      <div class="form-step"></div>
      <div class="form-wizard-navigation">
        <button id="emPrevStepBtn"></button>
        <button id="emNextStepBtn"></button>
        <button id="emSubmitBtn"></button>
        <button id="emCancelBtn"></button>
      </div>
      <textarea id="foodDescription">банан</textarea>
      <div id="foodSuggestionsDropdown"></div>
      <input id="quantityCustom" name="quantityCustom">
      <input id="quantity" name="quantity">
      <div id="autoFillMsg" class="hidden"></div>
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
  const input = container.querySelector('#quantityCustom');
  
  // Бързо въвеждане на стойности
  input.value = '1';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  jest.advanceTimersByTime(100);
  
  input.value = '10';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  jest.advanceTimersByTime(100);
  
  input.value = '100';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Изчакваме debounce delay (500ms)
  await jest.advanceTimersByTimeAsync(600);
  
  const nutrientCalls = global.fetch.mock.calls.filter(c => c[0] === '/nutrient-lookup');
  expect(nutrientCalls).toHaveLength(1);
  
  jest.useRealTimers();
});
