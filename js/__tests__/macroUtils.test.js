/** @jest-environment jsdom */
import { readFileSync } from 'fs';
import { calculateCurrentMacros, loadDietModel } from '../macroUtils.js';

const dietModel = JSON.parse(
  readFileSync(new URL('../../kv/DIET_RESOURCES/base_diet_model.json', import.meta.url))
);

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(dietModel) })
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

test('calculateCurrentMacros sums macros from completed meals and extras', async () => {
  const planMenu = {
    monday: [
      { id: 'z-01', meal_name: 'Протеинов шейк' },
      { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
    ],
    tuesday: [
      { id: 'o-02', meal_name: 'Телешки кюфтета със салата' }
    ]
  };

  const completionStatus = {
    monday_0: true,
    monday_1: false,
    tuesday_0: true
  };

  const extraMeals = [
    { calories: 100, protein: 5, carbs: 10, fat: 2 }
  ];

  await loadDietModel();
  const result = await calculateCurrentMacros(planMenu, completionStatus, extraMeals);
  expect(result).toEqual({ calories: 880, protein: 67, carbs: 48, fat: 42 });
});
