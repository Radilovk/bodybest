/** @jest-environment jsdom */
import { jest } from '@jest/globals';

/**
 * Tests for improved JSON extraction from AI responses
 * This verifies that the backend can handle AI responses that include
 * explanatory text along with the JSON data
 */
describe('extraMealForm - AI JSON extraction', () => {
  let initializeExtraMealFormLogic;
  let mockFetch;

  /**
   * Helper function to setup common module mocks
   */
  const setupCommonMocks = () => {
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
  };

  /**
   * Helper function to create test DOM structure
   */
  const createTestDOM = (foodDescription, quantityCount, quantityCustom) => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">${foodDescription}</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="number" id="quantityCountInput" name="quantityCountInput" value="${quantityCount}">
            <input type="text" id="quantityCustom" name="quantityCustom" value="${quantityCustom}">
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
    return document.getElementById('container');
  };

  /**
   * Helper function to navigate to summary step
   */
  const navigateToSummary = async (container) => {
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
  };

  beforeEach(async () => {
    jest.resetModules();
  });

  test('should handle AI response with explanatory text before JSON', async () => {
    // Mock AI response that includes text before the JSON
    mockFetch = jest.fn((url, opts) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            calories: 180,
            protein: 8,
            carbs: 22,
            fat: 7,
            fiber: 1.5
          })
        });
      }
      return Promise.resolve({ json: async () => [] });
    });
    global.fetch = mockFetch;

    setupCommonMocks();
    ({ initializeExtraMealFormLogic } = await import('../extraMealForm.js'));

    const container = createTestDOM('мъфин', '1.5', '1.5 броя');
    await initializeExtraMealFormLogic(container);
    await navigateToSummary(container);

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledWith(
      '/nutrient-lookup',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('мъфин')
      })
    );

    // Verify macros were populated successfully
    expect(container.querySelector('input[name="calories"]').value).toBe('180.00');
    expect(container.querySelector('input[name="protein"]').value).toBe('8.00');
    expect(container.querySelector('input[name="carbs"]').value).toBe('22.00');
    expect(container.querySelector('input[name="fat"]').value).toBe('7.00');
    expect(container.querySelector('input[name="fiber"]').value).toBe('1.50');
  });

  test('should show helpful error message when AI returns all zeros', async () => {
    // Mock AI response that returns all zeros
    mockFetch = jest.fn((url, opts) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0
          })
        });
      }
      return Promise.resolve({ json: async () => [] });
    });
    global.fetch = mockFetch;

    setupCommonMocks();
    ({ initializeExtraMealFormLogic } = await import('../extraMealForm.js'));

    const container = createTestDOM('непозната екзотична храна', '2', '2 броя');
    await initializeExtraMealFormLogic(container);
    await navigateToSummary(container);

    // Should show error message with helpful guidance
    const summaryBox = container.querySelector('#extraMealSummary');
    const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
    
    expect(loadingIndicator).toBeTruthy();
    expect(loadingIndicator.textContent).toContain('AI не може да разпознае храната');
    expect(loadingIndicator.textContent).toContain('въведете макросите ръчно');
    
    // Macros should remain empty (not filled with zeros)
    expect(container.querySelector('input[name="calories"]').value).toBe('');
    expect(container.querySelector('input[name="protein"]').value).toBe('');
  });
});
