/** @jest-environment jsdom */
import { jest } from '@jest/globals';

/**
 * Test for the specific bug fix: handling "count x product" pattern
 * when product is not in the database
 */
describe('extraMealForm - unknown food with count pattern', () => {
  let initializeExtraMealFormLogic;
  let mockFetch;

  beforeEach(async () => {
    jest.resetModules();
    
    // Mock successful AI nutrient lookup
    mockFetch = jest.fn((url) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            calories: 300,
            protein: 15,
            carbs: 35,
            fat: 10,
            fiber: 3
          })
        });
      }
      return Promise.resolve({ json: async () => [] });
    });
    global.fetch = mockFetch;

    jest.unstable_mockModule('../uiHandlers.js', () => ({
      showLoading: jest.fn(),
      showToast: jest.fn(),
      openModal: jest.fn(),
      closeModal: jest.fn()
    }));
    jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: { nutrientLookup: '/nutrient-lookup' } }));
    jest.unstable_mockModule('../macroUtils.js', () => ({
      removeMealMacros: jest.fn(),
      registerNutrientOverrides: jest.fn(),
      getNutrientOverride: jest.fn(() => null),
      loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
      scaleMacros: jest.fn()
    }));
    jest.unstable_mockModule('../populateUI.js', () => ({
      addExtraMealWithOverride: jest.fn(),
      populateDashboardMacros: jest.fn(),
      appendExtraMealCard: jest.fn()
    }));
    jest.unstable_mockModule('../app.js', () => ({
      currentUserId: 'u1',
      todaysExtraMeals: [],
      todaysMealCompletionStatus: {},
      currentIntakeMacros: {},
      fullDashboardData: { planData: { week1Menu: {}, caloriesMacros: { fiber_percent: 10, fiber_grams: 30 } } },
      loadCurrentIntake: jest.fn(),
      updateMacrosAndAnalytics: jest.fn()
    }));
    jest.unstable_mockModule('../debounce.js', () => ({
      debounce: (fn) => {
        fn.cancel = jest.fn();
        return fn;
      }
    }));

    ({ initializeExtraMealFormLogic } = await import('../extraMealForm.js'));
  });

  test('should trigger AI lookup for "2 парчета" pattern when product not in database', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">екзотична пица</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="number" id="quantityCountInput" name="quantityCountInput">
            <input type="text" id="measureInput" name="measureInput">
            <datalist id="measureSuggestionList"></datalist>
            <input type="text" id="quantityCustom" name="quantityCustom">
            <input type="number" id="quantity" name="quantity" class="hidden">
            <div id="macroFieldsContainer" class="hidden">
              <div class="macro-inputs-grid">
                <input type="number" name="calories">
                <input type="number" name="protein">
                <input type="number" name="carbs">
                <input type="number" name="fat">
                <input type="number" name="fiber">
              </div>
            </div>
          </div>
          <div class="form-step" data-step="3" style="display:none">
            <input type="radio" name="reasonPrimary" value="глад" checked>
            <input type="text" id="reasonOtherText" name="reasonOtherText" class="hidden">
          </div>
          <div class="form-step" data-step="4" style="display:none">
            <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
            <input type="radio" name="replacedPlanned" value="не" checked>
            <select id="skippedMeal" name="skippedMeal" class="hidden"></select>
          </div>
          <div class="form-step" data-step="5" style="display:none">
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
            <button type="button" id="emPrevStepBtn"></button>
            <button type="button" id="emNextStepBtn"></button>
            <button type="submit" id="emSubmitBtn"></button>
            <button type="button" id="emCancelBtn"></button>
          </div>
          <div id="stepProgressBar"></div>
          <span id="currentStepNumber"></span>
          <span id="totalStepNumber"></span>
        </form>
      </div>
    `;

    const container = document.getElementById('container');
    await initializeExtraMealFormLogic(container);

    const quantityCustom = container.querySelector('#quantityCustom');
    
    // User enters "2 парчета" - this matches the pattern but product is not in DB
    quantityCustom.value = '2 парчета';
    quantityCustom.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify that fetch was called with proper parameters
    const nutrientCalls = mockFetch.mock.calls.filter(c => c[0] === '/nutrient-lookup');
    expect(nutrientCalls.length).toBeGreaterThan(0);
    
    const lastCall = nutrientCalls[nutrientCalls.length - 1];
    const requestBody = JSON.parse(lastCall[1].body);
    expect(requestBody.food).toBe('екзотична пица');
    expect(requestBody.quantity).toBe('2 парчета');

    // Verify macros were populated
    expect(container.querySelector('input[name="calories"]').value).toBe('300.00');
    expect(container.querySelector('input[name="protein"]').value).toBe('15.00');
  });

  test('should trigger AI lookup for "3 x непознат продукт" pattern', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">специална торта</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="number" id="quantityCountInput" name="quantityCountInput">
            <input type="text" id="measureInput" name="measureInput">
            <datalist id="measureSuggestionList"></datalist>
            <input type="text" id="quantityCustom" name="quantityCustom">
            <input type="number" id="quantity" name="quantity" class="hidden">
            <div id="macroFieldsContainer" class="hidden">
              <div class="macro-inputs-grid">
                <input type="number" name="calories">
                <input type="number" name="protein">
                <input type="number" name="carbs">
                <input type="number" name="fat">
                <input type="number" name="fiber">
              </div>
            </div>
          </div>
          <div class="form-step" data-step="3" style="display:none">
            <input type="radio" name="reasonPrimary" value="глад" checked>
            <input type="text" id="reasonOtherText" name="reasonOtherText" class="hidden">
          </div>
          <div class="form-step" data-step="4" style="display:none">
            <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
            <input type="radio" name="replacedPlanned" value="не" checked>
            <select id="skippedMeal" name="skippedMeal" class="hidden"></select>
          </div>
          <div class="form-step" data-step="5" style="display:none">
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
            <button type="button" id="emPrevStepBtn"></button>
            <button type="button" id="emNextStepBtn"></button>
            <button type="submit" id="emSubmitBtn"></button>
            <button type="button" id="emCancelBtn"></button>
          </div>
          <div id="stepProgressBar"></div>
          <span id="currentStepNumber"></span>
          <span id="totalStepNumber"></span>
        </form>
      </div>
    `;

    const container = document.getElementById('container');
    await initializeExtraMealFormLogic(container);

    const quantityCustom = container.querySelector('#quantityCustom');
    
    // User enters "3 x порция" where "порция" is not in DB
    quantityCustom.value = '3 x порция';
    quantityCustom.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify that fetch was called
    const nutrientCalls = mockFetch.mock.calls.filter(c => c[0] === '/nutrient-lookup');
    expect(nutrientCalls.length).toBeGreaterThan(0);
    
    const lastCall = nutrientCalls[nutrientCalls.length - 1];
    const requestBody = JSON.parse(lastCall[1].body);
    expect(requestBody.food).toBe('специална торта');
    expect(requestBody.quantity).toBe('3 порция');
  });
});
