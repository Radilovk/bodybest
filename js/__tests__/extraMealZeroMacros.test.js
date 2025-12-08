/** @jest-environment jsdom */
import { jest } from '@jest/globals';

/**
 * Test for the fix: AI macro lookup should accept zero values
 * Some foods naturally have zero values for certain macros (e.g., fiber in many processed foods)
 * The code should accept zero values. Backend now returns errors instead of all-zeros when AI fails.
 */
describe('extraMealForm - zero macro values handling', () => {
  let initializeExtraMealFormLogic;
  let mockFetch;

  beforeEach(async () => {
    jest.resetModules();
    
    // Mock AI nutrient lookup that returns some zero values
    mockFetch = jest.fn((url) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            calories: 140,
            protein: 0,  // Zero protein (e.g., fruit)
            carbs: 35,
            fat: 0,      // Zero fat
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

  test('should accept zero values from AI (not all zeros)', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">портокал</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="number" id="quantityCountInput" name="quantityCountInput" value="2">
            <input type="text" id="quantityCustom" name="quantityCustom" value="2 броя">
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

    // Verify macros were populated INCLUDING the zero values
    const caloriesField = container.querySelector('input[name="calories"]');
    const proteinField = container.querySelector('input[name="protein"]');
    const carbsField = container.querySelector('input[name="carbs"]');
    const fatField = container.querySelector('input[name="fat"]');
    const fiberField = container.querySelector('input[name="fiber"]');
    
    expect(caloriesField.value).toBe('140.00');
    expect(proteinField.value).toBe('0.00'); // Zero should be accepted!
    expect(carbsField.value).toBe('35.00');
    expect(fatField.value).toBe('0.00'); // Zero should be accepted!
    expect(fiberField.value).toBe('3.00');
  });

  test('should reject when backend returns error (AI failure)', async () => {
    // Mock AI returning error response (backend now returns errors instead of zeros)
    mockFetch = jest.fn((url) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: false,
            error: 'AI extraction failed',
            message: 'AI не успя да извлече хранителни данни'
          })
        });
      }
      return Promise.resolve({ json: async () => [] });
    });
    global.fetch = mockFetch;

    // Re-import module with updated fetch
    jest.resetModules();
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

    const { initializeExtraMealFormLogic: initFn } = await import('../extraMealForm.js');

    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">несъществуваща храна xyz123</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="number" id="quantityCountInput" name="quantityCountInput" value="1">
            <input type="text" id="quantityCustom" name="quantityCustom" value="1 броя">
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
    await initFn(container);

    // Navigate to summary step
    const nextBtn = container.querySelector('#emNextStepBtn');
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify that an error was shown (backend error should be handled)
    const summaryBox = container.querySelector('#extraMealSummary');
    const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
    
    expect(loadingIndicator).toBeTruthy();
    // Error message should be shown
    expect(loadingIndicator.textContent).toContain('не могат да бъдат изчислени');

    // Verify macro fields are still empty (error occurred)
    expect(container.querySelector('input[name="calories"]').value).toBe('');
    expect(container.querySelector('input[name="protein"]').value).toBe('');
  });
});
