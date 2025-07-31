/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let handleExtraMealFormSubmit;
let showToastMock;

beforeEach(async () => {
  jest.resetModules();
  showToastMock = jest.fn();
  jest.unstable_mockModule('../uiHandlers.js', () => ({
    showLoading: jest.fn(),
    showToast: showToastMock,
    openModal: jest.fn(),
    closeModal: jest.fn(),
    loadAndApplyColors: jest.fn()
  }));
  jest.unstable_mockModule('../config.js', () => ({
    apiEndpoints: { logExtraMeal: '/api' }
  }));
  jest.unstable_mockModule('../app.js', () => ({
    currentUserId: 'u1',
    todaysMealCompletionStatus: {},
    todaysExtraMeals: [],
    currentIntakeMacros: {},
    fullDashboardData: { planData: { week1Menu: {} } },
    planHasRecContent: false
  }));
  global.fetch = jest.fn().mockResolvedValue({ json: async () => [] });
  ({ handleExtraMealFormSubmit } = await import('../extraMealForm.js'));
  fetch.mockClear();
});

test('показва съобщение при липса на количество', async () => {
  document.body.innerHTML = `<form id="f"><input id="quantityCustom" name="quantityCustom"></form>`;
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  expect(showToastMock).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test('изпраща макро стойности при попълнени полета', async () => {
  document.body.innerHTML = `<form id="f">
    <input type="radio" name="quantityEstimateVisual" value="малко" checked>
    <input name="calories" value="120">
    <input name="protein" value="10">
    <input name="carbs" value="15">
    <input name="fat" value="5">
  </form>`;
  const form = document.getElementById('f');
  const e = { preventDefault: jest.fn(), target: form };
  await handleExtraMealFormSubmit(e);
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.calories).toBe(120);
  expect(body.protein).toBe(10);
  expect(body.carbs).toBe(15);
  expect(body.fat).toBe(5);
});
