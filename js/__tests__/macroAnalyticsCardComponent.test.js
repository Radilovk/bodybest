/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { fireEvent, within, waitFor } from '@testing-library/dom';

let originalFetch;
let originalIO;

beforeEach(async () => {
  if (!originalFetch) originalFetch = global.fetch;
  if (!originalIO) originalIO = global.IntersectionObserver;
  if (!customElements.get('macro-analytics-card')) {
    await import('../macroAnalyticsCardComponent.js');
  }
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      title: 'Калории и Макронутриенти',
      caloriesLabel: 'Приети Калории',
      macros: { protein: 'Белтъчини', carbs: 'Въглехидрати', fat: 'Мазнини' },
      fromGoal: 'от целта',
      totalCaloriesLabel: 'от {calories} kcal'
    })
  });
  global.IntersectionObserver = class { observe() {} disconnect() {} };
  document.body.innerHTML = '';
});

afterEach(() => {
  global.fetch = originalFetch || (() => Promise.resolve({ ok: true, json: async () => ({}) }));
  global.IntersectionObserver = originalIO;
  document.body.innerHTML = '';
  jest.useRealTimers();
});

test('рендерира метриките и реагира на highlightMacro', async () => {
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  const target = {
    calories: 2000,
    protein_grams: 150,
    protein_percent: 75,
    carbs_grams: 250,
    carbs_percent: 50,
    fat_grams: 70,
    fat_percent: 35
  };
  const plan = { calories: 1900 };
  const current = {
    calories: 1200,
    protein_grams: 60,
    carbs_grams: 100,
    fat_grams: 40
  };
  card.setData({ target, plan, current });
  const utils = within(card.shadowRoot);
  await waitFor(() => utils.getByText('Белтъчини'));
  expect(utils.getByText('60 / 150г')).toBeTruthy();
  const proteinDiv = utils.getByText('Белтъчини').closest('.macro-metric');
  expect(proteinDiv.classList.contains('active')).toBe(false);
  fireEvent.click(proteinDiv);
  expect(proteinDiv.classList.contains('active')).toBe(true);
  fireEvent.click(proteinDiv);
  expect(proteinDiv.classList.contains('active')).toBe(false);
});

test('data-endpoint и refresh-interval извикват fetch периодично', async () => {
  jest.useFakeTimers();
  const endpoint = '/macros';
  global.fetch = jest.fn((url) => {
    if (url.includes('macroCard')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          title: 'Калории и Макронутриенти',
          caloriesLabel: 'Приети Калории',
          macros: { protein: 'Белтъчини', carbs: 'Въглехидрати', fat: 'Мазнини' },
          fromGoal: 'от целта',
          totalCaloriesLabel: 'от {calories} kcal'
        })
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        target: {
          calories: 2000,
          protein_grams: 150,
          protein_percent: 75,
          carbs_grams: 250,
          carbs_percent: 50,
          fat_grams: 70,
          fat_percent: 35
        },
        plan: { calories: 1900 },
        current: {
          calories: 1200,
          protein_grams: 60,
          carbs_grams: 100,
          fat_grams: 40
        }
      })
    });
  });
  const card = document.createElement('macro-analytics-card');
  card.setAttribute('data-endpoint', endpoint);
  card.setAttribute('refresh-interval', '5000');
  document.body.appendChild(card);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(endpoint));
  await jest.advanceTimersByTimeAsync(5000);
  await Promise.resolve();
  const endpointCalls = global.fetch.mock.calls.filter(c => c[0] === endpoint).length;
  expect(endpointCalls).toBe(2);
});
