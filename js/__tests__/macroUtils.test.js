/** @jest-environment jsdom */
import { calculateCurrentMacros, addMealMacros, removeMealMacros, registerNutrientOverrides, getNutrientOverride, calculatePlanMacros, __testExports } from '../macroUtils.js';

test('calculateCurrentMacros sums macros from completed meals and extras', () => {
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

  const result = calculateCurrentMacros(planMenu, completionStatus, extraMeals);
  expect(result).toEqual({ calories: 880, protein: 67, carbs: 48, fat: 42 });
});

test('calculatePlanMacros sums macros for day menu', () => {
  const dayMenu = [
    { id: 'z-01', meal_name: 'Протеинов шейк' },
    { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toEqual({ calories: 850, protein: 72, carbs: 70, fat: 28 });
});

test('addMealMacros и removeMealMacros актуализират акумулатора', () => {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const meal = { calories: 200, protein: 20, carbs: 30, fat: 10 };
  addMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 200, protein: 20, carbs: 30, fat: 10 });
  removeMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
});

test('getNutrientOverride кешира резултатите', () => {
  registerNutrientOverrides({ 'ябълка': { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 } });
  expect(__testExports.nutrientCache.size).toBe(0);
  const first = getNutrientOverride('ЯБЪЛКА');
  expect(first).toEqual({ calories: 52, protein: 0.3, carbs: 14, fat: 0.2 });
  expect(__testExports.nutrientCache.size).toBe(1);
  getNutrientOverride('ябълка');
  expect(__testExports.nutrientCache.size).toBe(1);
});
