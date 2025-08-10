import { jest } from "@jest/globals";
import { handleLogExtraMealRequest } from '../../worker.js';

const scaleMacrosImpl = (m, g) => {
  const factor = g / 100;
  return {
    calories: (m.calories || 0) * factor,
    protein: (m.protein || 0) * factor,
    carbs: (m.carbs || 0) * factor,
    fat: (m.fat || 0) * factor,
    fiber: (m.fiber || 0) * factor,
  };
};

describe('handleLogExtraMealRequest', () => {
  test('returns success and stores data', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn().mockResolvedValue(null), put: jest.fn() } };
    const request = { json: async () => ({ userId: 'test1', foodDescription: 'Apple', quantityEstimate: 'малко' }) };
    const res = await handleLogExtraMealRequest(request, env);
    expect(res.success).toBe(true);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
  });

  test('fails without userId', async () => {
    const env = { USER_METADATA_KV: { get: jest.fn(), put: jest.fn() } };
    const request = { json: async () => ({ foodDescription: 'Apple', quantityEstimate: 'малко' }) };
    const res = await handleLogExtraMealRequest(request, env);
    expect(res.success).toBe(false);
  });
});

describe('extraMealForm populateSummary', () => {
  test('renders macro values in summary', async () => {
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
      scaleMacros: jest.fn(scaleMacrosImpl),
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
        <div class="form-step">
          <input type="number" name="calories">
          <input type="number" name="protein">
          <input type="number" name="carbs">
          <input type="number" name="fat">
          <input type="number" name="fiber">
        </div>
        <div class="form-step" style="display:none">
          <div id="extraMealSummary">
            <span data-summary="foodDescription"></span>
            <span data-summary="quantityEstimate"></span>
            <span data-summary="mealTimeSelect"></span>
            <span data-summary="reasonPrimary"></span>
            <span data-summary="feelingAfter"></span>
            <span data-summary="replacedPlanned"></span>
            <span data-summary="calories"></span>
            <span data-summary="protein"></span>
            <span data-summary="carbs"></span>
            <span data-summary="fat"></span>
            <span data-summary="fiber"></span>
          </div>
        </div>
        <div class="form-wizard-navigation">
          <button id="emPrevStepBtn"></button>
          <button id="emNextStepBtn"></button>
          <button id="emSubmitBtn"></button>
          <button id="emCancelBtn"></button>
        </div>
      </form>
    `;

    await initializeExtraMealFormLogic(document);

    const setVal = (name, val) => {
      const input = document.querySelector(`input[name="${name}"]`);
      if (input) input.value = val;
    };

    setVal('calories', '100');
    setVal('protein', '20');
    setVal('carbs', '30');
    setVal('fat', '10');
    setVal('fiber', '5');

    document.getElementById('emNextStepBtn').click();

    const summary = document.getElementById('extraMealSummary');
    expect(summary.querySelector('[data-summary="calories"]').textContent).toBe('100');
    expect(summary.querySelector('[data-summary="protein"]').textContent).toBe('20');
    expect(summary.querySelector('[data-summary="carbs"]').textContent).toBe('30');
    expect(summary.querySelector('[data-summary="fat"]').textContent).toBe('10');
    expect(summary.querySelector('[data-summary="fiber"]').textContent).toBe('5');
  });

  test('показва макроси от nutrient lookup при празни полета и количество', async () => {
    jest.resetModules();

    const overridesStore = {};
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
      registerNutrientOverrides: jest.fn((o) => Object.assign(overridesStore, o)),
      getNutrientOverride: jest.fn((k) => overridesStore[k]),
      loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
      scaleMacros: jest.fn(scaleMacrosImpl),
    }));
    jest.unstable_mockModule('../populateUI.js', () => ({
      addExtraMealWithOverride: jest.fn(),
      appendExtraMealCard: jest.fn(),
    }));

    const originalFetch = global.fetch;
    global.fetch = undefined;
    const { initializeExtraMealFormLogic } = await import('../extraMealForm.js');
    global.fetch = jest.fn((url) => {
      if (url === '/nutrient-lookup') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ calories: 150, protein: 15, carbs: 25, fat: 5, fiber: 4 }),
        });
      }
      return Promise.resolve({ json: async () => [] });
    });

    document.body.innerHTML = `
      <form id="extraMealEntryFormActual">
        <div class="form-step">
          <textarea id="foodDescription"></textarea>
          <div id="foodSuggestionsDropdown"></div>
          <input type="radio" name="quantityEstimateVisual" value="x">
          <input type="number" name="calories">
          <input type="number" name="protein">
          <input type="number" name="carbs">
          <input type="number" name="fat">
          <input type="number" name="fiber">
        </div>
        <div class="form-step" style="display:none">
          <div id="extraMealSummary">
            <span data-summary="foodDescription"></span>
            <span data-summary="quantityEstimate"></span>
            <span data-summary="mealTimeSelect"></span>
            <span data-summary="reasonPrimary"></span>
            <span data-summary="feelingAfter"></span>
            <span data-summary="replacedPlanned"></span>
            <span data-summary="calories"></span>
            <span data-summary="protein"></span>
            <span data-summary="carbs"></span>
            <span data-summary="fat"></span>
            <span data-summary="fiber"></span>
          </div>
        </div>
        <div class="form-wizard-navigation">
          <button id="emPrevStepBtn"></button>
          <button id="emNextStepBtn"></button>
          <button id="emSubmitBtn"></button>
          <button id="emCancelBtn"></button>
        </div>
      </form>
    `;

    await initializeExtraMealFormLogic(document);

    const desc = document.getElementById('foodDescription');
    const qty = document.querySelector('input[name="quantityEstimateVisual"]');
    qty.checked = true;
    desc.value = 'непозната храна';
    desc.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise((r) => setTimeout(r, 350));

    document.getElementById('emNextStepBtn').click();

    const summary = document.getElementById('extraMealSummary');
    expect(summary.querySelector('[data-summary="calories"]').textContent).toBe('150');
    expect(summary.querySelector('[data-summary="protein"]').textContent).toBe('15');
    expect(summary.querySelector('[data-summary="carbs"]').textContent).toBe('25');
    expect(summary.querySelector('[data-summary="fat"]').textContent).toBe('5');
    expect(summary.querySelector('[data-summary="fiber"]').textContent).toBe('4');

    global.fetch = originalFetch;
  });
});

describe('quantity card selection', () => {
  test('добавя selected клас към избраната карта', async () => {
    jest.resetModules();
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
      scaleMacros: jest.fn(scaleMacrosImpl),
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
        <div class="form-step">
          <label class="quantity-card-option"><input type="radio" name="quantityEstimateVisual" value="a"></label>
          <label class="quantity-card-option"><input type="radio" name="quantityEstimateVisual" value="b"></label>
        </div>
        <div class="form-step" style="display:none"></div>
        <div class="form-wizard-navigation">
          <button id="emPrevStepBtn"></button>
          <button id="emNextStepBtn"></button>
          <button id="emSubmitBtn"></button>
          <button id="emCancelBtn"></button>
        </div>
      </form>
    `;

    await initializeExtraMealFormLogic(document);

    const radios = document.querySelectorAll('input[name="quantityEstimateVisual"]');
    const first = radios[0];
    const second = radios[1];

    first.checked = true;
    first.dispatchEvent(new Event('change', { bubbles: true }));
    expect(first.closest('.quantity-card-option').classList.contains('selected')).toBe(true);
    expect(second.closest('.quantity-card-option').classList.contains('selected')).toBe(false);

    second.checked = true;
    second.dispatchEvent(new Event('change', { bubbles: true }));
    expect(second.closest('.quantity-card-option').classList.contains('selected')).toBe(true);
    expect(first.closest('.quantity-card-option').classList.contains('selected')).toBe(false);
  });
});

describe('autocomplete suggestions', () => {
  test('предлага краставица при въвеждане на „краст“', async () => {
    jest.resetModules();
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
        <div class="form-step">
          <textarea id="foodDescription"></textarea>
          <div id="foodSuggestionsDropdown"></div>
        </div>
        <div class="form-step" style="display:none"></div>
        <div class="form-wizard-navigation">
          <button id="emPrevStepBtn"></button>
          <button id="emNextStepBtn"></button>
          <button id="emSubmitBtn"></button>
          <button id="emCancelBtn"></button>
        </div>
      </form>
    `;

    await initializeExtraMealFormLogic(document);

    const desc = document.getElementById('foodDescription');
    desc.value = 'краст';
    desc.dispatchEvent(new Event('input', { bubbles: true }));

    const suggestions = Array.from(document.querySelectorAll('#foodSuggestionsDropdown div[role="option"]')).map(el => el.textContent);
    expect(suggestions).toContain('краставица');
  });
});
