/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { updateMacroChart, setChartInstance } from '../macroChart.js';

test('updateMacroChart updates datasets and calls chart.update', () => {
  const chart = { data: { datasets: [{ data: [] }, { data: [] }, { data: [] }] }, update: jest.fn() };
  setChartInstance(chart);
  updateMacroChart({
    target: { protein_grams: 1, carbs_grams: 2, fat_grams: 3 },
    plan: { protein_grams: 4, carbs_grams: 5, fat_grams: 6 },
    current: { protein_grams: 7, carbs_grams: 8, fat_grams: 9 }
  });
  expect(chart.data.datasets[0].data).toEqual([1,2,3]);
  expect(chart.data.datasets[1].data).toEqual([4,5,6]);
  expect(chart.data.datasets[2].data).toEqual([7,8,9]);
  expect(chart.update).toHaveBeenCalled();
});
