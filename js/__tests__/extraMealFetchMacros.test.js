/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let fetchMacrosFromAi;
let showToastMock;

beforeEach(async () => {
  jest.resetModules();
  showToastMock = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });

  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showLoading: jest.fn(),
    showToast: showToastMock,
    openModal: jest.fn(),
    closeModal: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({ apiEndpoints: {} }));
  jest.unstable_mockModule('../macroUtils.js', () => ({
    removeMealMacros: jest.fn(),
    registerNutrientOverrides: jest.fn(),
    getNutrientOverride: jest.fn(() => null),
    loadProductMacros: jest.fn().mockResolvedValue({ overrides: {}, products: [] })
  }));
  jest.unstable_mockModule('../populateUI.js', () => ({
    addExtraMealWithOverride: jest.fn(),
    populateDashboardMacros: jest.fn(),
    renderPendingMacroChart: jest.fn(),
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

  ({ fetchMacrosFromAi } = await import('../extraMealForm.js'));
  fetch.mockClear();
});

test('успешно извличане се кешира', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 3 })
  });
  const r1 = await fetchMacrosFromAi('банан', 100);
  expect(r1.calories).toBe(100);
  expect(fetch).toHaveBeenCalledTimes(1);
  const r2 = await fetchMacrosFromAi('банан', 100);
  expect(r2.calories).toBe(100);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('неуспешно извличане показва грешка', async () => {
  fetch.mockResolvedValueOnce({ ok: false });
  await expect(fetchMacrosFromAi('банан', 100)).rejects.toThrow('Nutrient lookup failed');
  expect(showToastMock).toHaveBeenCalled();
});
