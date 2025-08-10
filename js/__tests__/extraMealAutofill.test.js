/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let initializeExtraMealFormLogic;
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

beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
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
    getNutrientOverride: jest.fn(key => key === 'ябълка|x' ? { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 0 } : null),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
    scaleMacros: jest.fn(scaleMacrosImpl)
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

test('автопопълва макросите при разпозната храна', async () => {
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
      <div class="macro-inputs-grid">
        <input name="calories">
        <input name="protein">
        <input name="carbs">
        <input name="fat">
        <input name="fiber">
      </div>
      <div class="form-step"></div>
    </form>
  </div>`;
  const container = document.getElementById('c');
  await initializeExtraMealFormLogic(container);
  const input = container.querySelector('#foodDescription');
  input.value = 'ябълка';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('52');
  expect(container.querySelector('input[name="protein"]').value).toBe('0.3');
  expect(container.querySelector('input[name="fiber"]').value).toBe('0');
});

test('частично описание попълва макроси от първия продукт', async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
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
    getNutrientOverride: jest.fn(),
    loadProductMacros: jest.fn().mockResolvedValue({
      overrides: {},
      products: [
        { name: 'ябълка', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 0 },
        { name: 'ябълков сок', calories: 30, protein: 0.1, carbs: 7, fat: 0, fiber: 0 }
      ]
    }),
    scaleMacros: jest.fn(scaleMacrosImpl)
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
      <div id="measureOptions">
        <label class="quantity-card-option"><input type="radio" name="measureOption" data-grams="100" checked><span class="card-content"></span></label>
      </div>
      <input id="quantity">
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
  input.value = 'яб';
  const measureRadio = container.querySelector('#measureOptions input');
  measureRadio.dispatchEvent(new Event('change', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('52.00');
  expect(container.querySelector('input[name="protein"]').value).toBe('0.30');
  expect(container.querySelector('input[name="carbs"]').value).toBe('14.00');
});

test('попълва макроси при смяна на количество чрез радио бутон', async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
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
    getNutrientOverride: jest.fn(key => key === 'ябълка|малко_количество' ? { calories: 26, protein: 0.15, carbs: 7, fat: 0.1, fiber: 1 } : null),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
    scaleMacros: jest.fn(scaleMacrosImpl)
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
      <input type="radio" name="quantityEstimateVisual" value="малко_количество">
      <div class="macro-inputs-grid">
        <input name="calories">
        <input name="protein">
        <input name="carbs">
        <input name="fat">
        <input name="fiber">
      </div>
      <div class="form-step"></div>
    </form>
  </div>`;
  const container = document.getElementById('c');
  await initializeExtraMealFormLogic(container);
  const desc = container.querySelector('#foodDescription');
  desc.value = 'ябълка';
  desc.dispatchEvent(new Event('input', { bubbles: true }));

  const smallRadio = container.querySelector('input[value="малко_количество"]');
  smallRadio.checked = true;
  smallRadio.dispatchEvent(new Event('change', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('26');
  expect(container.querySelector('#autoFillMsg').classList.contains('hidden')).toBe(false);
});

test('попълва макроси при ръчно въведено количество', async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
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
    getNutrientOverride: jest.fn(key => key === 'ябълка|120g' ? { calories: 60, protein: 0.3, carbs: 15, fat: 0.2, fiber: 2 } : null),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] }),
    scaleMacros: jest.fn(scaleMacrosImpl)
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
      <input type="radio" name="quantityEstimateVisual" value="other_quantity_describe" checked>
      <input id="quantityCustom">
      <div class="macro-inputs-grid">
        <input name="calories">
        <input name="protein">
        <input name="carbs">
        <input name="fat">
        <input name="fiber">
      </div>
      <div class="form-step"></div>
    </form>
  </div>`;
  const container = document.getElementById('c');
  await initializeExtraMealFormLogic(container);
  const desc = container.querySelector('#foodDescription');
  desc.value = 'ябълка';
  desc.dispatchEvent(new Event('input', { bubbles: true }));

  const custom = container.querySelector('#quantityCustom');
  custom.value = '120g';
  custom.dispatchEvent(new Event('input', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('60');
  expect(container.querySelector('#autoFillMsg').classList.contains('hidden')).toBe(false);
});

test('грешка в описанието попълва макроси от най-близкия продукт', async () => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
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
    getNutrientOverride: jest.fn(),
    loadProductMacros: jest.fn().mockResolvedValue({
      overrides: {},
      products: [
        { name: 'ябълков сок', calories: 30, protein: 0.1, carbs: 7, fat: 0, fiber: 0 },
        { name: 'ябълка', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 0 }
      ]
    }),
    scaleMacros: jest.fn(scaleMacrosImpl)
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
      <div id="measureOptions">
        <label class="quantity-card-option"><input type="radio" name="measureOption" data-grams="100" checked><span class="card-content"></span></label>
      </div>
      <input id="quantity">
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
  input.value = 'ябалка';
  const measureRadio = container.querySelector('#measureOptions input');
  measureRadio.dispatchEvent(new Event('change', { bubbles: true }));
  expect(container.querySelector('input[name="calories"]').value).toBe('52.00');
  expect(container.querySelector('input[name="protein"]').value).toBe('0.30');
  expect(container.querySelector('input[name="carbs"]').value).toBe('14.00');
});
