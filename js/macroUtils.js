import dietModel from '../kv/DIET_RESOURCES/base_diet_model.json' with { type: 'json' };

// Създаваме речник за бързо търсене на макроси по id или име
const macrosByIdOrName = new Map(
  (dietModel['ястия'] || [])
    .filter((m) => m['хранителни_стойности'])
    .flatMap((meal) => {
      const macros = meal['хранителни_стойности'];
      return [
        [meal.id, macros],
        [(meal.име || '').toLowerCase(), macros]
      ];
    })
);

// Кеш за хранителни стойности по име
let nutrientOverrides = {};
const nutrientCache = new Map();
const MAX_OVERRIDE_CACHE = 50;

/**
 * Регистрира overrides за хранителни стойности.
 * @param {Record<string, {calories:number, protein:number, carbs:number, fat:number, fiber:number}>} overrides
 */
export function registerNutrientOverrides(overrides = {}) {
  nutrientOverrides = overrides || {};
  nutrientCache.clear();
}

/**
 * Връща хранителни стойности за име на храна с кеширане.
 * @param {string} name
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number}|null}
 */
export function getNutrientOverride(name = '') {
  const key = name.toLowerCase().trim();
  if (!key) return null;
  if (nutrientCache.has(key)) return nutrientCache.get(key);
  const data = nutrientOverrides[key] || null;
  if (data) {
    nutrientCache.set(key, data);
    if (nutrientCache.size > MAX_OVERRIDE_CACHE) {
      const oldestKey = nutrientCache.keys().next().value;
      nutrientCache.delete(oldestKey);
    }
  }
  return data;
}

/**
 * Зарежда продуктови макроси от product_macros.json и регистрира overrides.
 * @returns {Promise<{overrides: Record<string, {calories:number, protein:number, carbs:number, fat:number, fiber:number}>, products: Array}>}
 */
export async function loadProductMacros() {
  const { default: products } = await import(
    '../kv/DIET_RESOURCES/product_macros.json',
    { with: { type: 'json' } }
  );
  const overrides = {};
  (products || []).forEach((p) => {
    if (!p?.name) return;
    overrides[p.name.toLowerCase()] = {
      calories: Number(p.calories) || 0,
      protein: Number(p.protein) || 0,
      carbs: Number(p.carbs) || 0,
      fat: Number(p.fat) || 0,
      fiber: Number(p.fiber) || 0
    };
  });
  registerNutrientOverrides(overrides);
  return { overrides, products };
}

/**
 * Скалира макросите спрямо грамовете.
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber:number}} macros
 * @param {number} grams
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number}}
 */
export function scaleMacros(macros = {}, grams = 100) {
  const factor = grams / 100;
  return {
    calories: (Number(macros.calories) || 0) * factor,
    protein: (Number(macros.protein) || 0) * factor,
    carbs: (Number(macros.carbs) || 0) * factor,
    fat: (Number(macros.fat) || 0) * factor,
    fiber: (Number(macros.fiber) || 0) * factor
  };
}

/**
 * Форматира съотношение като процент.
 * @param {number} ratio - Стойност между 0 и 1.
 * @param {number} fractionDigits - Брой десетични знаци.
 * @returns {string}
 */
export function formatPercent(ratio, fractionDigits = 0) {
  const val = Number(ratio);
  if (!Number.isFinite(val)) return '--%';
  return `${(val * 100).toFixed(fractionDigits)}%`;
}

function resolveMacros(meal, grams) {
  if (!meal) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let macros;
  if ('calories' in meal) {
    macros = {
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0,
      fiber: Number(meal.fiber) || 0
    };
  } else {
    const override = getNutrientOverride(meal.meal_name || meal.name);
    if (override) macros = override;
    else {
      const baseMacros =
        macrosByIdOrName.get(meal.id) ||
        macrosByIdOrName.get((meal.meal_name || meal.name || '').toLowerCase());
      macros = {
        calories: Number(baseMacros?.['калории']) || 0,
        protein: Number(baseMacros?.['белтъчини']) || 0,
        carbs: Number(baseMacros?.['въглехидрати']) || 0,
        fat: Number(baseMacros?.['мазнини']) || 0,
        fiber: Number(baseMacros?.['фибри']) || 0
      };
    }
  }
  return typeof grams === 'number' ? scaleMacros(macros, grams) : macros;
}

function validateMacroCalories(macros = {}, threshold = 0.05) {
  const { calories = 0, protein = 0, carbs = 0, fat = 0 } = macros;
  const calc = protein * 4 + carbs * 4 + fat * 9;
  if (!calc) return;
  const diff = Math.abs(calc - calories);
  if (diff / calc > threshold) {
    console.warn(
      `[macroUtils] Calorie mismatch: expected ${calc.toFixed(2)}, received ${calories}`
    );
  }
}

export function addMealMacros(meal, acc) {
  const m = resolveMacros(meal, meal?.grams);
  validateMacroCalories(m);
  acc.calories = (acc.calories || 0) + m.calories;
  acc.protein = (acc.protein || 0) + m.protein;
  acc.carbs = (acc.carbs || 0) + m.carbs;
  acc.fat = (acc.fat || 0) + m.fat;
  acc.fiber = (acc.fiber || 0) + m.fiber;
  return acc;
}

export function removeMealMacros(meal, acc) {
  const m = resolveMacros(meal, meal?.grams);
  validateMacroCalories(m);
  acc.calories = (acc.calories || 0) - m.calories;
  acc.protein = (acc.protein || 0) - m.protein;
  acc.carbs = (acc.carbs || 0) - m.carbs;
  acc.fat = (acc.fat || 0) - m.fat;
  acc.fiber = (acc.fiber || 0) - m.fiber;
  return acc;
}

/**
 * Сумира макросите на всички хранения за деня.
 * @param {Array} dayMenu - Масив от хранения за текущия ден.
 * @returns {{ calories:number, protein:number, carbs:number, fat:number, fiber:number }}
 */
export function calculatePlanMacros(dayMenu = []) {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  if (!Array.isArray(dayMenu)) return acc;
  dayMenu.forEach((meal) => {
    const macros = meal && typeof meal.macros === 'object' ? meal.macros : null;
    if (macros) {
      const normalized = {
        calories: Number(macros.calories) || 0,
        protein: Number(macros.protein) || 0,
        carbs: Number(macros.carbs) || 0,
        fat: Number(macros.fat) || 0,
        fiber: Number(macros.fiber) || 0
      };
      validateMacroCalories(normalized);
      acc.calories += normalized.calories;
      acc.protein += normalized.protein;
      acc.carbs += normalized.carbs;
      acc.fat += normalized.fat;
      acc.fiber += normalized.fiber;
    } else {
      addMealMacros(meal, acc);
    }
  });
  return acc;
}

/**
 * Изчислява общите макроси за изпълнените хранения и извънредни хранения.
 * @param {Object} planMenu - Менюто по дни със списъци от хранения.
 * @param {Object} completionStatus - Обект със статуси дали храненето е изпълнено (day_index ключове).
 * @param {Array} extraMeals - Допълнителни хранения с макроси { calories, protein, carbs, fat, fiber }.
 * @returns {{ calories:number, protein:number, carbs:number, fat:number, fiber:number }}
 */
export function calculateCurrentMacros(planMenu = {}, completionStatus = {}, extraMeals = []) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;

  Object.entries(planMenu).forEach(([day, meals]) => {
    (meals || []).forEach((meal, idx) => {
      const key = `${day}_${idx}`;
      if (completionStatus[key]) {
        const macros = macrosByIdOrName.get(meal.id) || macrosByIdOrName.get((meal.meal_name || '').toLowerCase());
        if (macros) {
          calories += Number(macros['калории']) || 0;
          protein += Number(macros['белтъчини']) || 0;
          carbs += Number(macros['въглехидрати']) || 0;
          fat += Number(macros['мазнини']) || 0;
          fiber += Number(macros['фибри']) || 0;
        }
      }
    });
  });

  if (Array.isArray(extraMeals)) {
    extraMeals.forEach((m) => {
      calories += Number(m.calories) || 0;
      protein += Number(m.protein) || 0;
      carbs += Number(m.carbs) || 0;
      fat += Number(m.fat) || 0;
      fiber += Number(m.fiber) || 0;
    });
  }

  return { calories, protein, carbs, fat, fiber };
}

export const __testExports = { macrosByIdOrName, nutrientCache, resolveMacros };
