import { jest } from "@jest/globals";

describe('extraMealForm AI macro calculation in summary', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test.skip('loads macros from AI when missing in summary screen', async () => {
    const mockNutrientData = {
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      fiber: 4.5
    };

    jest.unstable_mockModule('../uiHandlers.js', () => ({
      showLoading: jest.fn(),
      showToast: jest.fn(),
      openModal: jest.fn(),
      closeModal: jest.fn(),
    }));
    jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
    jest.unstable_mockModule('../app.js', () => ({
      currentUserId: 'u1',
      todaysExtraMeals: [],
      currentIntakeMacros: {},
      fullDashboardData: {},
      loadCurrentIntake: jest.fn(),
      updateMacrosAndAnalytics: jest.fn(),
    }));
    jest.unstable_mockModule('../macroUtils.js', () => ({
      removeMealMacros: jest.fn(),
      registerNutrientOverrides: jest.fn(),
      getNutrientOverride: jest.fn(() => null),
      loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
      scaleMacros: jest.fn(),
    }));
    jest.unstable_mockModule('../populateUI.js', () => ({
      addExtraMealWithOverride: jest.fn(),
      appendExtraMealCard: jest.fn(),
    }));
    jest.unstable_mockModule('../debounce.js', () => ({
      debounce: (fn) => {
        fn.cancel = jest.fn();
        return fn;
      },
    }));

    // Mock fetch for nutrient-lookup
    global.fetch = jest.fn((url, opts) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNutrientData)
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    const { initializeExtraMealFormLogic } = await import('../extraMealForm.js');

    document.body.innerHTML = `
      <form id="extraMealEntryFormActual">
        <div class="form-step" data-step="1">
          <textarea id="foodDescription">ябълка</textarea>
        </div>
        <div class="form-step" data-step="2" style="display:none">
          <input type="text" id="quantityCustom" value="150гр">
          <input type="number" id="quantity" class="hidden" value="150">
          <input type="number" id="quantityCountInput">
          <input type="text" id="measureInput" class="hidden">
          <datalist id="measureSuggestionList"></datalist>
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
          <select id="skippedMeal" class="hidden"></select>
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
    `;

    await initializeExtraMealFormLogic(document);

    // Navigate to step 2
    const nextBtn = document.querySelector('#emNextStepBtn');
    nextBtn.click();
    
    // Wait for step to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Navigate to step 3
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Navigate to step 4
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Navigate to step 5 (summary)
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check that fetch was called for nutrient lookup
    expect(global.fetch).toHaveBeenCalledWith(
      '/nutrient-lookup',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String)
      })
    );

    // Check that macro fields were populated with AI data
    const caloriesInput = document.querySelector('input[name="calories"]');
    const proteinInput = document.querySelector('input[name="protein"]');
    const carbsInput = document.querySelector('input[name="carbs"]');
    const fatInput = document.querySelector('input[name="fat"]');
    const fiberInput = document.querySelector('input[name="fiber"]');

    expect(caloriesInput.value).toBe('95.00');
    expect(proteinInput.value).toBe('0.50');
    expect(carbsInput.value).toBe('25.00');
    expect(fatInput.value).toBe('0.30');
    expect(fiberInput.value).toBe('4.50');

    // Check that data is reflected in summary
    const summary = document.querySelector('#extraMealSummary');
    expect(summary.querySelector('[data-summary="calories"]').textContent).toBe('95.00');
    expect(summary.querySelector('[data-summary="protein"]').textContent).toBe('0.50');
    expect(summary.querySelector('[data-summary="carbs"]').textContent).toBe('25.00');
    expect(summary.querySelector('[data-summary="fat"]').textContent).toBe('0.30');
    expect(summary.querySelector('[data-summary="fiber"]').textContent).toBe('4.50');
  });

  test('skips AI fetch if macros are already filled', async () => {
    jest.unstable_mockModule('../uiHandlers.js', () => ({
      showLoading: jest.fn(),
      showToast: jest.fn(),
      openModal: jest.fn(),
      closeModal: jest.fn(),
    }));
    jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
    jest.unstable_mockModule('../app.js', () => ({
      currentUserId: 'u1',
      todaysExtraMeals: [],
      currentIntakeMacros: {},
      fullDashboardData: {},
      loadCurrentIntake: jest.fn(),
      updateMacrosAndAnalytics: jest.fn(),
    }));
    jest.unstable_mockModule('../macroUtils.js', () => ({
      removeMealMacros: jest.fn(),
      registerNutrientOverrides: jest.fn(),
      getNutrientOverride: jest.fn(),
      loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
      scaleMacros: jest.fn(),
    }));
    jest.unstable_mockModule('../populateUI.js', () => ({
      addExtraMealWithOverride: jest.fn(),
      appendExtraMealCard: jest.fn(),
    }));
    jest.unstable_mockModule('../debounce.js', () => ({
      debounce: (fn) => {
        fn.cancel = jest.fn();
        return fn;
      },
    }));

    global.fetch = jest.fn();

    const { initializeExtraMealFormLogic } = await import('../extraMealForm.js');

    document.body.innerHTML = `
      <form id="extraMealEntryFormActual">
        <div class="form-step" data-step="1">
          <textarea id="foodDescription">ябълка</textarea>
        </div>
        <div class="form-step" data-step="2" style="display:none">
          <input type="text" id="quantityCustom" value="150гр">
          <input type="number" id="quantity" class="hidden" value="150">
          <input type="number" id="quantityCountInput">
          <input type="text" id="measureInput" class="hidden">
          <datalist id="measureSuggestionList"></datalist>
          <div id="macroFieldsContainer" class="hidden">
            <div class="macro-inputs-grid">
              <input type="number" name="calories" value="100">
              <input type="number" name="protein" value="20">
              <input type="number" name="carbs" value="30">
              <input type="number" name="fat" value="10">
              <input type="number" name="fiber" value="5">
            </div>
          </div>
        </div>
        <div class="form-step" data-step="3" style="display:none">
          <input type="radio" name="reasonPrimary" value="глад" checked>
        </div>
        <div class="form-step" data-step="4" style="display:none">
          <input type="radio" name="feelingAfter" value="ситост_доволство" checked>
          <input type="radio" name="replacedPlanned" value="не" checked>
          <select id="skippedMeal" class="hidden"></select>
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
    `;

    await initializeExtraMealFormLogic(document);

    // Navigate to summary step
    const nextBtn = document.querySelector('#emNextStepBtn');
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    nextBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not call fetch since macros are already filled
    expect(global.fetch).not.toHaveBeenCalled();

    // Verify summary shows the pre-filled values
    const summary = document.querySelector('#extraMealSummary');
    expect(summary.querySelector('[data-summary="calories"]').textContent).toBe('100');
    expect(summary.querySelector('[data-summary="protein"]').textContent).toBe('20');
  });
});
