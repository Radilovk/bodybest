import { jest } from "@jest/globals";

describe('extraMealForm macro fields visibility', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('macro fields container is hidden initially', async () => {
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

    const originalFetch = global.fetch;
    global.fetch = undefined;
    const { initializeExtraMealFormLogic } = await import('../extraMealForm.js');
    global.fetch = originalFetch;

    document.body.innerHTML = `
      <form id="extraMealEntryFormActual">
        <div class="form-step" data-step="1">
          <textarea id="foodDescription"></textarea>
        </div>
        <div class="form-step" data-step="2" style="display:none">
          <input type="text" id="quantityCustom">
          <input type="number" id="quantity" class="hidden">
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

    const macroFieldsContainer = document.querySelector('#macroFieldsContainer');
    expect(macroFieldsContainer).not.toBeNull();
    expect(macroFieldsContainer.classList.contains('hidden')).toBe(true);
  });

  test('macro fields container is shown after entering quantity in quantityCustom', async () => {
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
      scaleMacros: jest.fn((product, grams) => ({
        calories: 100,
        protein: 10,
        carbs: 15,
        fat: 5,
        fiber: 2
      })),
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

    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    const { initializeExtraMealFormLogic } = await import('../extraMealForm.js');

    document.body.innerHTML = `
      <form id="extraMealEntryFormActual">
        <div class="form-step" data-step="1">
          <textarea id="foodDescription">known product</textarea>
        </div>
        <div class="form-step" data-step="2" style="display:none">
          <input type="text" id="quantityCustom">
          <input type="number" id="quantity" class="hidden">
          <input type="number" id="quantityCountInput">
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

    const quantityCustomInput = document.querySelector('#quantityCustom');
    const macroFieldsContainer = document.querySelector('#macroFieldsContainer');

    // Macro fields should be hidden initially
    expect(macroFieldsContainer.classList.contains('hidden')).toBe(true);

    // Enter quantity - this should trigger macro calculation from local data
    quantityCustomInput.value = '100гр';
    const event = new Event('input', { bubbles: true });
    quantityCustomInput.dispatchEvent(event);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Macro fields should now be visible because macros were filled
    expect(macroFieldsContainer.classList.contains('hidden')).toBe(false);

    global.fetch = originalFetch;
  });
});
