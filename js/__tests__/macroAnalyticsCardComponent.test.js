/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { fireEvent, within, waitFor } from '@testing-library/dom';

beforeAll(() => {
  global.matchMedia = jest.fn().mockImplementation(() => {
    const listeners = [];
    return {
      matches: false,
      addEventListener: (_e, cb) => listeners.push(cb),
      removeEventListener: jest.fn(),
      dispatchEvent: (e) => { listeners.forEach((cb) => cb(e)); }
    };
  });
});

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
      subtitle: '{percent} от целта',
      totalCaloriesLabel: 'от {calories} kcal',
      exceedWarning: 'Превишение над 15%: {items}',
      intakeVsPlanLabel: 'Прием vs План'
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
  const plan = {
    calories: 2000,
    protein_grams: 150,
    protein_percent: 75,
    carbs_grams: 250,
    carbs_percent: 50,
    fat_grams: 70,
    fat_percent: 35
  };
  const current = {
    calories: 1200,
    protein_grams: 60,
    carbs_grams: 100,
    fat_grams: 40
  };
  card.setData({ plan, current });
  const utils = within(card.shadowRoot);
  await waitFor(() => utils.getByText('Белтъчини'));
  expect(utils.getByText('60 / 150г')).toBeTruthy();
  const proteinDiv = utils.getByText('Белтъчини').closest('.macro-metric');
  expect(proteinDiv.getAttribute('aria-label')).toContain('40%');
  expect(within(proteinDiv).getByText('40% от целта')).toBeTruthy();
  expect(proteinDiv.classList.contains('active')).toBe(false);
  fireEvent.click(proteinDiv);
  expect(proteinDiv.classList.contains('active')).toBe(true);
  fireEvent.click(proteinDiv);
  expect(proteinDiv.classList.contains('active')).toBe(false);
});

test('показва предупреждение при превишаване на макросите', async () => {
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  const plan = {
    calories: 2000,
    protein_grams: 100,
    protein_percent: 40,
    carbs_grams: 200,
    carbs_percent: 40,
    fat_grams: 50,
    fat_percent: 20
  };
  const current = {
    calories: 2500,
    protein_grams: 130,
    carbs_grams: 150,
    fat_grams: 40
  };
  card.setData({ plan, current });
  const utils = within(card.shadowRoot);
  await waitFor(() => utils.getByText(/Превишение над 15%/));
  expect(utils.getByText(/Превишение над 15%/)).toBeTruthy();
});

test('класифицира over и under макросите', async () => {
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  const plan = {
    calories: 2000,
    protein_grams: 100,
    protein_percent: 40,
    carbs_grams: 200,
    carbs_percent: 40,
    fat_grams: 50,
    fat_percent: 20
  };
  const current = {
    calories: 1800,
    protein_grams: 120,
    carbs_grams: 200,
    fat_grams: 40
  };
  card.setData({ plan, current });
  const utils = within(card.shadowRoot);
  await waitFor(() => utils.getByText('Белтъчини'));
  const proteinDiv = utils.getByText('Белтъчини').closest('.macro-metric');
  const fatDiv = utils.getByText('Мазнини').closest('.macro-metric');
  expect(proteinDiv.classList.contains('over')).toBe(true);
  expect(fatDiv.classList.contains('under')).toBe(true);
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
            subtitle: '{percent} от целта',
            totalCaloriesLabel: 'от {calories} kcal',
            exceedWarning: 'Превишение над 15%: {items}',
            intakeVsPlanLabel: 'Прием vs План'
          })
        });
      }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        plan: {
          calories: 2000,
          protein_grams: 150,
          protein_percent: 75,
          carbs_grams: 250,
          carbs_percent: 50,
          fat_grams: 70,
          fat_percent: 35
        },
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

test('re-renders chart on theme change', async () => {
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  await waitFor(() => card.labels.title !== '');
  const spy = jest.spyOn(card, 'renderChart');
  card.handleThemeOrPrefs();
  expect(spy).toHaveBeenCalled();
});

test('re-renders chart on motion preference change', async () => {
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  await waitFor(() => card.labels.title !== '');
  const spy = jest.spyOn(card, 'renderChart');
  card.handleThemeOrPrefs();
  expect(spy).toHaveBeenCalled();
});
