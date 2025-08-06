/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { waitFor } from '@testing-library/dom';

beforeEach(async () => {
  global.matchMedia = jest.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }));
  delete global.IntersectionObserver;
  delete window.IntersectionObserver;
  global.HTMLCanvasElement.prototype.getContext = () => ({ });
  process.env.NODE_ENV = 'development';
  window.Chart = function ChartStub() { this.destroy = jest.fn(); };
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
  if (!customElements.get('macro-analytics-card')) {
    await import('../macroAnalyticsCardComponent.js');
  }
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  process.env.NODE_ENV = 'test';
});

test('създава диаграма без plug-in когато Chart.register липсва', async () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const card = document.createElement('macro-analytics-card');
  document.body.appendChild(card);
  await waitFor(() => card.labels.title !== '');
  const plan = {
    calories: 2000,
    protein_grams: 150,
    protein_percent: 75,
    carbs_grams: 250,
    carbs_percent: 50,
    fat_grams: 70,
    fat_percent: 35,
    fiber_grams: 30,
    fiber_percent: 5
  };
  card.setData({ plan });
  await waitFor(() => expect(card.chart).toBeTruthy());
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});
