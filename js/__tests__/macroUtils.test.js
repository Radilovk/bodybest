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

test('calculateCurrentMacros комбинира частични макроси без индекс', () => {
  const planMenu = {
    monday: [
      {
        macros: {
          calories: 420,
          protein_grams: 32,
          carbs_grams: 45,
          fat_grams: 12
        }
      }
    ]
  };
  const completionStatus = { monday_0: true };
  const result = calculateCurrentMacros(planMenu, completionStatus, []);
  expect(result).toEqual({ calories: 420, protein: 32, carbs: 45, fat: 12, fiber: 0 });
});

test('calculateCurrentMacros скалира macros по grams', () => {
  const planMenu = {
    monday: [
      {
        macros: {
          calories: 200,
          protein_grams: 10,
          carbs_grams: 20,
          fat_grams: 10,
          fiber_grams: 5
        },
        grams: 50
      }
    ]
  };
  const completionStatus = { monday_0: true };
  const result = calculateCurrentMacros(planMenu, completionStatus, []);
  expect(result).toEqual({ calories: 100, protein: 5, carbs: 10, fat: 5, fiber: 2.5 });
});

test('calculateCurrentMacros използва mealMacrosIndex като fallback', () => {
  const planMenu = { monday: [{ meal_name: 'Домашно ястие' }] };
  const completionStatus = { monday_0: true };
  const mealMacrosIndex = {
    monday_0: {
      calories: 320,
      protein_grams: 30,
      carbs_grams: 25,
      fat_grams: 12,
      fiber_grams: 6
    }
  };
  const result = calculateCurrentMacros(planMenu, completionStatus, [], false, mealMacrosIndex);
  expect(result).toEqual({ calories: 320, protein: 30, carbs: 25, fat: 12, fiber: 6 });
});

test('calculateCurrentMacros намира макроси по recipeKey и имена на продукти', () => {
  registerNutrientOverrides({});
  const planMenu = {
    monday: [
      {
        meal_name: 'Персонализирано ястие',
        recipeKey: 'z-01',
        items: [{ name: 'Протеинов шейк' }]
      },
      {
        meal_name: 'Персонализирано ястие 2',
        recipeKey: 'custom-missing',
        items: [{ name: 'Протеинов шейк' }]
      }
    ]
  };
  const completionStatus = { monday_0: true, monday_1: true };
  const result = calculateCurrentMacros(planMenu, completionStatus, []);
  expect(result).toEqual({ calories: 600, protein: 54, carbs: 60, fat: 16, fiber: 0 });
  registerNutrientOverrides({});
});

test('calculateCurrentMacros използва camelCase recipeKey преди fallback опции', () => {
  registerNutrientOverrides({});
  const planMenu = {
    monday: [
      {
        meal_name: 'Персонализирано без артикули',
        recipeKey: 'z-01'
      }
    ]
  };
  const completionStatus = { monday_0: true };
  const result = calculateCurrentMacros(planMenu, completionStatus, []);
  expect(result).toEqual({ calories: 300, protein: 27, carbs: 30, fat: 8, fiber: 0 });
  registerNutrientOverrides({});
});

test('normalizeMacros парсира стойности със съответните единици', () => {
  const normalized = normalizeMacros({
    calories: '320 kcal',
    protein: '25 g',
    carbs: '40 grams',
    fat: '10 g',
    fiber: '5 g',
    alcohol: '7 g'
  });
  expect(normalized).toEqual({ calories: 320, protein: 25, carbs: 40, fat: 10, fiber: 5, alcohol: 7 });
});

test('calculateCurrentMacros обработва стойности със единици в macros и mealMacrosIndex', () => {
  const planMenu = {
    monday: [
      {
        macros: {
          calories: '186 kcal',
          protein_g: '15 g',
          carbs_g: '20 g',
          fat_g: '6 g',
          fiber_g: '4 г'
        }
      },
      { meal_name: 'Indexed meal' }
    ]
  };
  const completionStatus = { monday_0: true, monday_1: true };
  const mealMacrosIndex = {
    monday_1: {
      calories: '151 kcal',
      protein_grams: '10 g',
      carbs_grams: '18 g',
      fat_grams: '5 г',
      fiber_grams: '3 g'
    }
  };
  const result = calculateCurrentMacros(planMenu, completionStatus, [], false, mealMacrosIndex);
  expect(result).toEqual({ calories: 337, protein: 25, carbs: 38, fat: 11, fiber: 7 });
});

test('calculateCurrentMacros нормализира макроси с *_g и *_kcal полета', () => {
  const planMenu = {
    monday: [
      {
        macros: {
          calories_kcal: '320',
          protein_g: '30',
          carbs_g: '25',
          fat_g: '12',
          fiber_g: '6'
        }
      }
    ]
  };
  const completionStatus = { monday_0: true };
  const result = calculateCurrentMacros(planMenu, completionStatus, []);
  expect(result).toEqual({ calories: 320, protein: 30, carbs: 25, fat: 12, fiber: 6 });
});

test('calculatePlanMacros sums macros for day menu', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const dayMenu = [
    { id: 'z-01', meal_name: 'Протеинов шейк' },
    { id: 'o-01', meal_name: 'Печено пилешко с ориз/картофи и салата' }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toMatchObject({
    calories: 820,
    protein: 72,
    carbs: 70,
    fat: 28,
    fiber: 0,
    protein_percent: 35,
    carbs_percent: 34,
    fat_percent: 31,
    fiber_percent: 0
  });
  warnSpy.mockRestore();
});

test('calculatePlanMacros използва наличното поле macros', () => {
  const dayMenu = [
    { macros: { calories: 159, protein_grams: 10, carbs_grams: 20, fat_grams: 5, fiber_grams: 3 } },
    { macros: { calories: 280, protein_grams: 20, carbs_grams: 30, fat_grams: 10, fiber_grams: 5 } }
  ];
  const result = calculatePlanMacros(dayMenu);
  expect(result).toMatchObject({
    calories: 439,
    protein: 30,
    carbs: 50,
    fat: 15,
    fiber: 8,
    protein_percent: 27,
    carbs_percent: 46,
    fat_percent: 31,
    fiber_percent: 4
  });
});

test('calculatePlanMacros използва mealMacrosIndex при липсващи макроси', () => {
  const dayMenu = [{ meal_name: 'Домашна супа' }];
  const mealMacrosIndex = {
    monday_0: {
      calories: 280,
      protein_grams: 18,
      carbs_grams: 32,
      fat_grams: 9,
      fiber_grams: 4
    }
  };
  const result = calculatePlanMacros(dayMenu, true, true, mealMacrosIndex, 'monday');
  expect(result).toMatchObject({
    calories: 280,
    protein: 18,
    carbs: 32,
    fat: 9,
    fiber: 4,
    protein_percent: expect.any(Number),
    carbs_percent: expect.any(Number),
    fat_percent: expect.any(Number),
    fiber_percent: expect.any(Number)
  });
});

test('calculatePlanMacros комбинира частични потребителски и индекс макроси', () => {
  const dayMenu = [
    {
      meal_name: 'Комбинирано ястие',
      macros: {
        calories: 200,
        protein_grams: 20
      }
    }
  ];
  const mealMacrosIndex = {
    monday_0: {
      carbs_grams: 30,
      fat_grams: 10
    }
  };
  const result = calculatePlanMacros(dayMenu, true, false, mealMacrosIndex, 'monday');
  expect(result).toMatchObject({
    calories: 200,
    protein: 20,
    carbs: 30,
    fat: 10,
    fiber: 0,
    protein_percent: 40,
    carbs_percent: 60,
    fat_percent: 45,
    fiber_percent: 0
  });
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

test('validateMacroCalories коригира калориите при разминаване', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const macros = { calories: 57, protein: 10, carbs: 20, fat: 10 };
  __testExports.validateMacroCalories(macros);
  expect(macros.calories).toBe(210);
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
  expect(result).toEqual({ protein_percent: 20, carbs_percent: 40, fat_percent: 23, fiber_percent: 0 });
  const withFiber = calculateMacroPercents({ calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 10 });
  expect(withFiber).toEqual({ protein_percent: 0, carbs_percent: 0, fat_percent: 0, fiber_percent: 20 });
  const zero = calculateMacroPercents({ calories: 0, protein: 10, carbs: 10, fat: 5 });
  expect(zero).toEqual({ protein_percent: 0, carbs_percent: 0, fat_percent: 0, fiber_percent: 0 });
});
