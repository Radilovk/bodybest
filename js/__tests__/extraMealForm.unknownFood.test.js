/** @jest-environment jsdom */
import { jest } from '@jest/globals';

/**
 * Tests for handling foods NOT in the product list
 * These tests verify that AI macro calculation works correctly
 * even when the food is not in the local product database
 */
describe('extraMealForm - unknown food handling', () => {
  let initializeExtraMealFormLogic;
  let mockFetch;

  beforeEach(async () => {
    jest.resetModules();
    
    // Mock successful AI nutrient lookup
    mockFetch = jest.fn((url, opts) => {
      if (url === '/nutrient-lookup') {
        // Extract food and quantity from request
        const body = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            calories: 250,
            protein: 12,
            carbs: 30,
            fat: 8,
            fiber: 2
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
    jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
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

  test('should trigger AI lookup when using quantityCountInput + measureInput for unknown food', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">непозната пица</textarea>
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

    // User enters count and measure
    const quantityCountInput = container.querySelector('#quantityCountInput');
    const measureInput = container.querySelector('#measureInput');
    quantityCountInput.value = '2';
    measureInput.value = 'парчета';

    // Trigger input event (should trigger computeQuantityFromManual)
    quantityCountInput.dispatchEvent(new Event('input', { bubbles: true }));
    measureInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check that quantityCustom was populated with descriptive quantity
    const quantityCustom = container.querySelector('#quantityCustom');
    expect(quantityCustom.value).toBe('2 парчета');

    // Verify that fetch was called with proper parameters
    const nutrientCalls = mockFetch.mock.calls.filter(c => c[0] === '/nutrient-lookup');
    expect(nutrientCalls.length).toBeGreaterThan(0);
    
    const lastCall = nutrientCalls[nutrientCalls.length - 1];
    const requestBody = JSON.parse(lastCall[1].body);
    expect(requestBody.food).toBe('непозната пица');
    expect(requestBody.quantity).toBe('2 парчета');
  });

  test('should extract quantity from multiple sources in summary step', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">екзотична храна</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="number" id="quantityCountInput" name="quantityCountInput" value="3">
            <input type="text" id="measureInput" name="measureInput" value="лъжици">
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

    // Navigate to summary step (step 5)
    const nextBtn = container.querySelector('#emNextStepBtn');
    
    // Step 1 -> 2
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 2 -> 3
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 3 -> 4
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 4 -> 5 (summary)
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify fetch was called for AI lookup
    const nutrientCalls = mockFetch.mock.calls.filter(c => c[0] === '/nutrient-lookup');
    expect(nutrientCalls.length).toBeGreaterThan(0);

    // Verify quantity was extracted correctly (should be "3 лъжици")
    const lastCall = nutrientCalls[nutrientCalls.length - 1];
    const requestBody = JSON.parse(lastCall[1].body);
    expect(requestBody.quantity).toBe('3 лъжици');

    // Verify macros were populated
    expect(container.querySelector('input[name="calories"]').value).toBe('250.00');
    expect(container.querySelector('input[name="protein"]').value).toBe('12.00');
  });

  test('should handle empty quantity gracefully in summary', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">храна без количество</textarea>
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

    // Navigate to summary without entering quantity
    const nextBtn = container.querySelector('#emNextStepBtn');
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    // AI should now calculate macros even without quantity (per 100g estimation)
    const summaryBox = container.querySelector('#extraMealSummary');
    const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
    
    // Verify that macros were calculated successfully
    expect(loadingIndicator).toBeTruthy();
    expect(loadingIndicator.textContent).toContain('изчислени автоматично');
    
    // Verify macros were populated
    expect(container.querySelector('input[name="calories"]').value).toBe('250.00');
    expect(container.querySelector('input[name="protein"]').value).toBe('12.00');
  });
});
