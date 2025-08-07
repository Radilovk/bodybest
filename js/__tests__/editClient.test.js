/** @jest-environment jsdom */
import { jest } from '@jest/globals';

beforeEach(() => {
  jest.resetModules();
  jest.unstable_mockModule('../chartLoader.js', () => ({ ensureChart: jest.fn(async () => global.Chart) }));
});

test('addEditableMealItem adds inputs with values', async () => {
  const { __testExports } = await import('../editClient.js');
  const { addEditableMealItem } = __testExports;
  document.body.innerHTML = '<div id="c"></div>';
  const c = document.getElementById('c');
  addEditableMealItem(c, { name: 'Ябълка', grams: '100' });
  const inputs = c.querySelectorAll('input');
  expect(inputs[0].value).toBe('Ябълка');
  expect(inputs[1].value).toBe('100');
});

test('initCharts uses Chart with parsed data', async () => {
  document.body.innerHTML = '<canvas id="macro-chart"></canvas><canvas id="weight-chart"></canvas>';
  const ChartMock = jest.fn().mockImplementation(() => ({ destroy: jest.fn() }));
  global.Chart = ChartMock;
  const { __testExports } = await import('../editClient.js');
  const { initCharts } = __testExports;
  await initCharts({
    caloriesMacros: { protein_percent: 40, carbs_percent: 40, fat_percent: 20, protein_grams: 120, carbs_grams: 200, fat_grams: 50, calories: 2000, fiber_percent: 10, fiber_grams: 30 },
    profileSummary: 'Текущо тегло 80 кг (промяна за 7 дни: -1 кг)'
  });
  const macroConfig = ChartMock.mock.calls[0][1];
  expect(macroConfig.type).toBe('doughnut');
  expect(macroConfig.data.labels).toEqual([
    'Протеини (40%)',
    'Въглехидрати (40%)',
    'Мазнини (20%)',
    'Фибри (10%)'
  ]);
  expect(macroConfig.data.datasets[0].data).toEqual([120, 200, 50, 30]);
  expect(ChartMock.mock.calls[1][1].type).toBe('line');
});

test('initCharts handles missing macros with placeholder', async () => {
  document.body.innerHTML = '<div><canvas id="macro-chart"></canvas><canvas id="weight-chart"></canvas></div>';
  const ChartMock = jest.fn().mockImplementation(() => ({ destroy: jest.fn() }));
  global.Chart = ChartMock;
  const { __testExports } = await import('../editClient.js');
  const { initCharts } = __testExports;
  await initCharts({ profileSummary: 'Текущо тегло 80 кг (промяна за 7 дни: -1 кг)' });
  expect(ChartMock).toHaveBeenCalledTimes(1);
  const placeholder = document.getElementById('macro-chart-placeholder');
  expect(placeholder).not.toBeNull();
  expect(placeholder.textContent).toBe('Няма налични макроси за визуализация.');
});
