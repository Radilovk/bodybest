/** @jest-environment jsdom */
import { jest } from '@jest/globals';

/**
 * Tests for failed nutrient lookup caching
 * These tests verify that the system doesn't repeatedly attempt failed lookups
 * and provides appropriate user feedback for different error types
 */
describe('extraMealForm - failed lookup caching', () => {
  let initializeExtraMealFormLogic;
  let mockFetch;
  let fetchCallCount;

  beforeEach(async () => {
    jest.resetModules();
    fetchCallCount = 0;
    
    // Mock fetch that simulates AI not configured (HTTP 503)
    mockFetch = jest.fn((url) => {
      if (url === '/nutrient-lookup') {
        fetchCallCount++;
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({ error: 'AI not configured' })
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
    jest.unstable_mockModule('../config.js', () => ({ 
      apiEndpoints: { nutrientLookup: '/nutrient-lookup' } 
    }));
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
      fullDashboardData: { 
        planData: { 
          week1Menu: {}, 
          caloriesMacros: { fiber_percent: 10, fiber_grams: 30 } 
        } 
      },
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

  test('should cache 503 errors and not retry immediately for same food', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">мъфин</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
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
          </div>
          <div class="form-step" data-step="4" style="display:none">
            <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
            <input type="radio" name="replacedPlanned" value="не" checked>
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
    
    // First attempt - should make API call and cache the failure
    quantityCustom.value = '100';
    quantityCustom.dispatchEvent(new Event('input', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(fetchCallCount).toBe(1); // First call made
    
    // Second attempt with same quantity - should use cached failure, NO new API call
    quantityCustom.value = '100';
    quantityCustom.dispatchEvent(new Event('input', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(fetchCallCount).toBe(1); // Still only 1 call - second was cached
    
    // Third attempt with different quantity - still same food, should also be cached
    quantityCustom.value = '150';
    quantityCustom.dispatchEvent(new Event('input', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // For different quantities, the cache key is different, so this will try again
    // This is expected behavior - we cache per food+quantity combination
    expect(fetchCallCount).toBe(2); // New quantity = new cache key = new attempt
    
    // Fourth attempt with original quantity - should still be cached
    quantityCustom.value = '100';
    quantityCustom.dispatchEvent(new Event('input', { bubbles: true }));
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(fetchCallCount).toBe(2); // Still cached, no new call
  });

  test('should show appropriate error message for 503 errors', async () => {
    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">непозната храна</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
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
          </div>
          <div class="form-step" data-step="4" style="display:none">
            <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
            <input type="radio" name="replacedPlanned" value="не" checked>
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

    // Navigate to summary step where AI lookup happens
    const nextBtn = container.querySelector('#emNextStepBtn');
    
    // Navigate through steps
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check that error message is displayed
    const summaryBox = container.querySelector('#extraMealSummary');
    const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
    
    expect(loadingIndicator).toBeTruthy();
    expect(loadingIndicator.textContent).toContain('AI не е конфигуриран');
    expect(loadingIndicator.textContent).toContain('ръчно');
  });

  test('should handle different error types with appropriate messages', async () => {
    // Test network error
    mockFetch = jest.fn((url) => {
      if (url === '/nutrient-lookup') {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve({ json: async () => [] });
    });
    global.fetch = mockFetch;

    // Re-import to get fresh instance with new fetch mock
    jest.resetModules();
    jest.unstable_mockModule('../uiHandlers.js', () => ({
      showLoading: jest.fn(),
      showToast: jest.fn(),
      openModal: jest.fn(),
      closeModal: jest.fn()
    }));
    jest.unstable_mockModule('../config.js', () => ({ 
      apiEndpoints: { nutrientLookup: '/nutrient-lookup' } 
    }));
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
      fullDashboardData: { 
        planData: { 
          week1Menu: {}, 
          caloriesMacros: { fiber_percent: 10, fiber_grams: 30 } 
        } 
      },
      loadCurrentIntake: jest.fn(),
      updateMacrosAndAnalytics: jest.fn()
    }));
    jest.unstable_mockModule('../debounce.js', () => ({
      debounce: (fn) => {
        fn.cancel = jest.fn();
        return fn;
      }
    }));

    const { initializeExtraMealFormLogic: initLogic } = await import('../extraMealForm.js');

    document.body.innerHTML = `
      <div id="container">
        <form id="extraMealEntryFormActual">
          <div class="form-step active-step" data-step="1">
            <textarea id="foodDescription" name="foodDescription">тестова храна</textarea>
            <div id="foodSuggestionsDropdown" class="hidden"></div>
          </div>
          <div class="form-step" data-step="2" style="display:none">
            <input type="text" id="quantityCustom" name="quantityCustom" value="100">
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
          </div>
          <div class="form-step" data-step="4" style="display:none">
            <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
            <input type="radio" name="replacedPlanned" value="не" checked>
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
    await initLogic(container);

    // Navigate to summary
    const nextBtn = container.querySelector('#emNextStepBtn');
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check that network error message is displayed
    const summaryBox = container.querySelector('#extraMealSummary');
    const loadingIndicator = summaryBox.querySelector('.ai-loading-indicator');
    
    expect(loadingIndicator).toBeTruthy();
    const text = loadingIndicator.textContent;
    // Should mention connection problem or network issue
    expect(text.includes('връзка') || text.includes('ръчно')).toBe(true);
  });
});
