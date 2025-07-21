/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { __testExports } from '../editClient.js';

const { addEditableMealItem, initCharts } = __testExports;

test('addEditableMealItem adds inputs with values', () => {
  document.body.innerHTML = '<div id="c"></div>';
  const c = document.getElementById('c');
  addEditableMealItem(c, { name: 'Ябълка', grams: '100' });
  const inputs = c.querySelectorAll('input');
  expect(inputs[0].value).toBe('Ябълка');
  expect(inputs[1].value).toBe('100');
});

test('initCharts uses Chart with parsed data', () => {
  document.body.innerHTML = '<canvas id="macro-chart"></canvas><canvas id="weight-chart"></canvas>';
  global.Chart = jest.fn().mockImplementation(() => ({ destroy: jest.fn() }));
  initCharts({
    caloriesMacros: { protein_percent: 40, carbs_percent: 40, fat_percent: 20, protein_grams: 120, carbs_grams: 200, fat_grams: 50, calories: 2000 },
    profileSummary: 'Текущо тегло 80 кг (промяна за 7 дни: -1 кг)'
  });
  expect(global.Chart.mock.calls[0][1].type).toBe('doughnut');
  expect(global.Chart.mock.calls[1][1].type).toBe('line');
});
