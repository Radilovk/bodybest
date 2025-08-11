import { jest } from "@jest/globals";

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

jest.unstable_mockModule('../../kv/DIET_RESOURCES/product_measure.json', () => ({
  default: [
    { name: 'apple', measures: [ { label: 'малка', grams: 80 }, { label: 'средна', grams: 120 } ] },
    { name: 'banana', measures: [ { label: 'средна', grams: 110 } ] },
  ]
}));

const { initializeExtraMealFormLogic, getMeasureLabels } = await import('../extraMealForm.js');

test('попълва предложения и показва/скрива measureInput', async () => {
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
      <input id="measureInput" />
      <datalist id="measureSuggestionList"></datalist>
      <div id="measureOptions"></div>
    </form>`;

  await initializeExtraMealFormLogic(document);

  const food = document.getElementById('foodDescription');
  const measureInput = document.getElementById('measureInput');
  const datalist = document.getElementById('measureSuggestionList');

  expect(measureInput.classList.contains('hidden')).toBe(true);

  food.value = 'apple';
  food.dispatchEvent(new Event('input', { bubbles: true }));

  let options = Array.from(datalist.querySelectorAll('option')).map(o => o.value);
  expect(options).toEqual(['малка', 'средна']);
  expect(measureInput.classList.contains('hidden')).toBe(false);

  food.value = 'unknown';
  food.dispatchEvent(new Event('input', { bubbles: true }));

  options = Array.from(datalist.querySelectorAll('option')).map(o => o.value);
  expect(options.length).toBe(0);
  expect(measureInput.classList.contains('hidden')).toBe(true);

  expect(getMeasureLabels('banana')).toEqual(['средна']);
});
