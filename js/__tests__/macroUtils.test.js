/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { calculateCurrentMacros, addMealMacros, removeMealMacros, registerNutrientOverrides, getNutrientOverride, calculatePlanMacros, loadProductMacros, scaleMacros, formatPercent, normalizeMacros, __testExports } from '../macroUtils.js';

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
    { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 0 }
  ];

  const result = calculateCurrentMacros(planMenu, completionStatus, extraMeals);
  expect(result).toEqual({ calories: 880, protein: 67, carbs: 48, fat: 42, fiber: 0 });
});

test('calculatePlanMacros sums macros for day menu', () => {
  const dayMenu = [
    { id: 'z-01', meal_name: 'Протеинов шейк' },
    { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toEqual({ calories: 850, protein: 72, carbs: 70, fat: 28, fiber: 0 });
});

test('calculatePlanMacros използва наличното поле macros', () => {
  const dayMenu = [
    { macros: { calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 3 } },
    { macros: { calories: 200, protein: 20, carbs: 30, fat: 10, fiber: 5 } }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toEqual({ calories: 300, protein: 30, carbs: 50, fat: 15, fiber: 8 });
});

test('addMealMacros и removeMealMacros актуализират и clamp-ват акумулатора', () => {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const meal = { calories: 290, protein: 20, carbs: 30, fat: 10, fiber: 5 };
  addMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 290, protein: 20, carbs: 30, fat: 10, fiber: 5 });
  removeMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  // repeat removal to ensure clamp to 0
  removeMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
});

test('removeMealMacros нормализира липсващи полета', () => {
  const acc = { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 };
  removeMealMacros({ calories: 150, protein: 20 }, acc);
  expect(acc).toEqual({ calories: 0, protein: 0, carbs: 10, fat: 5, fiber: 2 });
});

test('scaleMacros скалира макросите спрямо грамовете', () => {
  const base = { calories: 290, protein: 20, carbs: 30, fat: 10, fiber: 5 };
  expect(scaleMacros(base, 150)).toEqual({ calories: 435, protein: 30, carbs: 45, fat: 15, fiber: 7.5 });
  expect(scaleMacros(base, 75)).toEqual({ calories: 217.5, protein: 15, carbs: 22.5, fat: 7.5, fiber: 3.75 });
});

test('resolveMacros при grams използва scaleMacros', () => {
  const meal = { calories: 290, protein: 20, carbs: 30, fat: 10, fiber: 5 };
  const result150 = __testExports.resolveMacros(meal, 150);
  const result75 = __testExports.resolveMacros(meal, 75);
  expect(result150).toEqual({ calories: 435, protein: 30, carbs: 45, fat: 15, fiber: 7.5 });
  expect(result75).toEqual({ calories: 217.5, protein: 15, carbs: 22.5, fat: 7.5, fiber: 3.75 });
});

test('validateMacroCalories предупреждава при голямо отклонение', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  addMealMacros({ calories: 500, protein: 30, carbs: 30, fat: 10, fiber: 0 }, acc);
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});

test('getNutrientOverride кешира резултатите', () => {
  registerNutrientOverrides({ 'ябълка': { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 } });
  expect(__testExports.nutrientCache.size).toBe(0);
  const first = getNutrientOverride('ЯБЪЛКА');
  expect(first).toEqual({ calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 });
  expect(__testExports.nutrientCache.size).toBe(1);
  getNutrientOverride('ябълка');
  expect(__testExports.nutrientCache.size).toBe(1);
});

test('loadProductMacros позволява търсене на продукт по име', async () => {
  await loadProductMacros();
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  addMealMacros({ name: 'ябълка' }, acc);
  expect(acc).toEqual({ calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4 });
  registerNutrientOverrides({});
});

test('formatPercent форматира съотношения', () => {
  expect(formatPercent(0.4)).toBe('40%');
  expect(formatPercent(0)).toBe('0%');
  expect(formatPercent('na')).toBe('--%');
});

test('normalizeMacros попълва липсващи полета с 0', () => {
  const result = normalizeMacros({ calories: 50, protein: 10 });
  expect(result).toEqual({ calories: 50, protein: 10, carbs: 0, fat: 0, fiber: 0 });
});
