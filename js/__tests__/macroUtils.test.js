/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { calculateCurrentMacros, addMealMacros, removeMealMacros, registerNutrientOverrides, getNutrientOverride, calculatePlanMacros, loadProductMacros, scaleMacros, formatPercent, normalizeMacros, calculateMacroPercents, __testExports } from '../macroUtils.js';

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
    { calories: 68, protein_grams: 5, carbs_grams: 10, fat_grams: 2, fiber_grams: 5 }
  ];

  const result = calculateCurrentMacros(planMenu, completionStatus, extraMeals);
  expect(result).toEqual({ calories: 848, protein: 67, carbs: 48, fat: 42, fiber: 5 });
});

test('calculateCurrentMacros използва meal.macros и overrides', () => {
  registerNutrientOverrides({
    'override meal': { calories: 56, protein: 5, carbs: 5, fat: 2, fiber: 1 }
  });
  const planMenu = {
    monday: [
      { meal_name: 'Override Meal' },
      { macros: { calories: 159, protein_grams: 10, carbs_grams: 20, fat_grams: 5, fiber_grams: 3 } }
    ]
  };
  const completionStatus = { monday_0: true, monday_1: true };
  const result = calculateCurrentMacros(planMenu, completionStatus, []);
  expect(result).toEqual({ calories: 215, protein: 15, carbs: 25, fat: 7, fiber: 4 });
  registerNutrientOverrides({});
});

test('calculatePlanMacros sums macros for day menu', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const dayMenu = [
    { id: 'z-01', meal_name: 'Протеинов шейк' },
    { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toEqual({ calories: 820, protein: 72, carbs: 70, fat: 28, fiber: 0 });
  warnSpy.mockRestore();
});

test('calculatePlanMacros използва наличното поле macros', () => {
  const dayMenu = [
    { macros: { calories: 159, protein_grams: 10, carbs_grams: 20, fat_grams: 5, fiber_grams: 3 } },
    { macros: { calories: 280, protein_grams: 20, carbs_grams: 30, fat_grams: 10, fiber_grams: 5 } }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toEqual({ calories: 439, protein: 30, carbs: 50, fat: 15, fiber: 8 });
});

test('addMealMacros и removeMealMacros актуализират и clamp-ват акумулатора', () => {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const meal = { calories: 280, protein_grams: 20, carbs_grams: 30, fat_grams: 10, fiber_grams: 5 };
  addMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 280, protein: 20, carbs: 30, fat: 10, fiber: 5 });
  removeMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  // repeat removal to ensure clamp to 0
  removeMealMacros(meal, acc);
  expect(acc).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
});

test('removeMealMacros нормализира липсващи полета', () => {
  const acc = { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 2 };
  removeMealMacros({ calories: 80, protein_grams: 20 }, acc);
  expect(acc).toEqual({ calories: 20, protein: 0, carbs: 10, fat: 5, fiber: 2 });
});

test('scaleMacros скалира макросите спрямо грамовете', () => {
  const base = { calories: 280, protein: 20, carbs: 30, fat: 10, fiber: 5 };
  expect(scaleMacros(base, 150)).toEqual({ calories: 420, protein: 30, carbs: 45, fat: 15, fiber: 7.5 });
  expect(scaleMacros(base, 75)).toEqual({ calories: 210, protein: 15, carbs: 22.5, fat: 7.5, fiber: 3.75 });
});

test('resolveMacros при grams използва scaleMacros', () => {
  const meal = { calories: 280, protein: 20, carbs: 30, fat: 10, fiber: 5 };
  const result150 = __testExports.resolveMacros(meal, 150);
  const result75 = __testExports.resolveMacros(meal, 75);
  expect(result150).toEqual({ calories: 420, protein: 30, carbs: 45, fat: 15, fiber: 7.5 });
  expect(result75).toEqual({ calories: 210, protein: 15, carbs: 22.5, fat: 7.5, fiber: 3.75 });
});

test('validateMacroCalories предупреждава при голямо отклонение', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  addMealMacros({ calories: 500, protein: 30, carbs: 40, fat: 10, fiber: 10 }, acc);
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});

test('validateMacroCalories не предупреждава при съвпадение с фибри', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  addMealMacros({ calories: 350, protein: 30, carbs: 40, fat: 10, fiber: 10 }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  expect(warnSpy).not.toHaveBeenCalled();
  warnSpy.mockRestore();
});

test('validateMacroCalories приема net carbs при carbsIncludeFiber=false', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  __testExports.validateMacroCalories(
    { calories: 310, protein: 30, carbs: 20, fat: 10, fiber: 10 },
    0.05,
    false
  );
  expect(warnSpy).not.toHaveBeenCalled();
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

test('алкохолните напитки имат alcohol и валидни калории', async () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { products } = await loadProductMacros();
  const check = (name, alcohol, calories) => {
    const p = products.find((pr) => pr.name === name);
    expect(p).toMatchObject({ alcohol, calories });
    addMealMacros({ ...p }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  };
  check('бира (светла, 5% алк.)', 4, 44.4);
  check('вино (сухо, червено/бяло)', 9.4, 76.6);
  check('ракия (40% алк.)', 33, 231);
  expect(warnSpy).not.toHaveBeenCalled();
  warnSpy.mockRestore();
});

test('formatPercent форматира съотношения', () => {
  expect(formatPercent(0.4)).toBe('40%');
  expect(formatPercent(0)).toBe('0%');
  expect(formatPercent('na')).toBe('--%');
});

test('normalizeMacros приема _grams полета', () => {
  const result = normalizeMacros({ calories: 50, protein_grams: 10 });
  expect(result).toEqual({ calories: 50, protein: 10, carbs: 0, fat: 0, fiber: 0 });
});

test('calculateMacroPercents изчислява проценти спрямо калориите', () => {
  const result = calculateMacroPercents({ calories: 200, protein: 10, carbs: 20, fat: 5 });
  expect(result).toEqual({ protein_percent: 20, carbs_percent: 40, fat_percent: 23 });
  const zero = calculateMacroPercents({ calories: 0, protein: 10, carbs: 10, fat: 5 });
  expect(zero).toEqual({ protein_percent: 0, carbs_percent: 0, fat_percent: 0 });
});
