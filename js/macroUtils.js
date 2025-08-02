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
 * @param {Record<string, {calories:number, protein:number, carbs:number, fat:number}>} overrides
 */
export function registerNutrientOverrides(overrides = {}) {
  nutrientOverrides = overrides || {};
  nutrientCache.clear();
}

/**
 * Връща хранителни стойности за име на храна с кеширане.
 * @param {string} name
 * @returns {{calories:number, protein:number, carbs:number, fat:number}|null}
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

function resolveMacros(meal) {
  if (!meal) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if ('calories' in meal) {
    return {
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0
    };
  }
  const macros =
    macrosByIdOrName.get(meal.id) ||
    macrosByIdOrName.get((meal.meal_name || meal.name || '').toLowerCase());
  return {
    calories: Number(macros?.['калории']) || 0,
    protein: Number(macros?.['белтъчини']) || 0,
    carbs: Number(macros?.['въглехидрати']) || 0,
    fat: Number(macros?.['мазнини']) || 0
  };
}

export function addMealMacros(meal, acc) {
  const m = resolveMacros(meal);
  acc.calories = (acc.calories || 0) + m.calories;
  acc.protein = (acc.protein || 0) + m.protein;
  acc.carbs = (acc.carbs || 0) + m.carbs;
  acc.fat = (acc.fat || 0) + m.fat;
  return acc;
}

export function removeMealMacros(meal, acc) {
  const m = resolveMacros(meal);
  acc.calories = (acc.calories || 0) - m.calories;
  acc.protein = (acc.protein || 0) - m.protein;
  acc.carbs = (acc.carbs || 0) - m.carbs;
  acc.fat = (acc.fat || 0) - m.fat;
  return acc;
}

/**
 * Изчислява общите макроси за изпълнените хранения и извънредни хранения.
 * @param {Object} planMenu - Менюто по дни със списъци от хранения.
 * @param {Object} completionStatus - Обект със статуси дали храненето е изпълнено (day_index ключове).
 * @param {Array} extraMeals - Допълнителни хранения с макроси { calories, protein, carbs, fat }.
 * @returns {{ calories:number, protein:number, carbs:number, fat:number }}
 */
export function calculateCurrentMacros(planMenu = {}, completionStatus = {}, extraMeals = []) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

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
    });
  }

  return { calories, protein, carbs, fat };
}

export const __testExports = { macrosByIdOrName, nutrientCache };
