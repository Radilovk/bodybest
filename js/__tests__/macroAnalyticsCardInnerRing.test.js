/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { waitFor } from '@testing-library/dom';

class ChartMock {
  constructor(_ctx, config) {
    this.config = config;
    this.data = config.data;
    this.destroy = jest.fn();
    global.__lastChartInstance = this;
  }
}

beforeEach(async () => {
  jest.resetModules();
  global.__lastChartInstance = null;
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  };
  const matchMediaMock = () => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn()
  });
  if (typeof window !== 'undefined') {
    window.matchMedia = matchMediaMock;
  }
  global.matchMedia = matchMediaMock;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      title: 'Калории и Макронутриенти',
      caloriesLabel: 'Приети Калории',
      macros: { protein: 'Белтъчини', carbs: 'Въглехидрати', fat: 'Мазнини', fiber: 'Фибри' },
      fromGoal: 'от целта',
      subtitle: '{percent} от целта',
      totalCaloriesLabel: 'от {calories} kcal',
      exceedWarning: 'Превишение над 15%: {items}',
      intakeVsPlanLabel: 'Прием vs План'
    })
  });
  jest.unstable_mockModule('../chartLoader.js', () => ({
    ensureChart: async () => ChartMock,
    registerSubtleGlow: jest.fn()
  }));
  await import('../macroAnalyticsCardComponent.js');
});

afterEach(() => {
  document.body.innerHTML = '';
});

test('рендерира вътрешен пръстен при текущи макроси', async () => {
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  const plan = {
    calories: 2000,
    protein_grams: 150,
    protein_percent: 75,
    carbs_grams: 250,
    carbs_percent: 50,
    fat_grams: 70,
    fat_percent: 35,
    fiber_grams: 30,
    fiber_percent: 10
  };
  const current = {
    calories: 1200,
    protein_grams: 60,
    carbs_grams: 100,
    fat_grams: 40,
    fiber_grams: 20
  };
  card.setData({ plan, current });
  await waitFor(() => {
    expect(global.__lastChartInstance).toBeTruthy();
    expect(global.__lastChartInstance.data.datasets.length).toBe(2);
  });
  expect(global.__lastChartInstance.data.datasets[1].cutout).toBe('65%');
});
