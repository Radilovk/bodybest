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

const CORE_MACRO_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
const MACRO_FIELD_ALIASES = {
  calories: ['calories', 'calories_kcal', 'cal', 'kcal', 'energy_kcal', 'energy'],
  protein: ['protein', 'protein_grams', 'protein_g', 'proteins', 'proteins_g'],
  carbs: [
    'carbs',
    'carbs_grams',
    'carbs_g',
    'carbohydrates',
    'carbohydrates_g',
    'carbohydrates_total_g',
    'net_carbs',
    'net_carbs_g'
  ],
  fat: ['fat', 'fat_grams', 'fat_g', 'fat_total_g', 'fats'],
  fiber: ['fiber', 'fiber_grams', 'fiber_g', 'fibre', 'fibre_grams', 'fibre_g'],
  alcohol: ['alcohol', 'alcohol_grams', 'alcohol_g']
};

const hasValue = (value) => value !== undefined && value !== null && value !== '';
const hasMissingCoreMacros = (normalized) =>
  Array.isArray(normalized?.__missingMacroKeys) && normalized.__missingMacroKeys.length > 0;

const NUMERIC_VALUE_REGEX = /-?\d+(?:[.,]\d+)?/;

const parseNumericValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const match = value.match(NUMERIC_VALUE_REGEX);
    if (!match) return null;
    const normalized = match[0].replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const coerceNumber = (value, fallback = 0) => {
  const parsed = parseNumericValue(value);
  return parsed != null ? parsed : fallback;
};

/**
 * Регистрира overrides за хранителни стойности.
 * @param {Record<string, {calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}>} overrides
 */
export function registerNutrientOverrides(overrides = {}) {
  nutrientOverrides = overrides || {};
  nutrientCache.clear();
}

/**
 * Връща хранителни стойности за име на храна с кеширане.
 * @param {string} name
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}|null}
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
      calories: coerceNumber(p.calories),
      protein: coerceNumber(p.protein),
      carbs: coerceNumber(p.carbs),
      fat: coerceNumber(p.fat),
      fiber: coerceNumber(p.fiber),
      ...(p.alcohol != null ? { alcohol: coerceNumber(p.alcohol) } : {})
    };
  });
  registerNutrientOverrides(overrides);
  return { overrides, products };
}

/**
 * Нормализира макросите като попълва липсващи полета със стойност 0.
 * @param {Object} macros
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}}
*/
function mapGramFields(obj = {}) {
  const base = obj && typeof obj === 'object' ? obj : {};
  const mapped = { ...base };
  const lowerCaseKeyMap = new Map();
  Object.keys(mapped).forEach((key) => {
    lowerCaseKeyMap.set(key.toLowerCase(), key);
  });

  const resolveKey = (candidate) => lowerCaseKeyMap.get(candidate.toLowerCase()) || candidate;
  const ensureField = (target) => {
    if (hasValue(mapped[target])) return;
    const aliases = MACRO_FIELD_ALIASES[target] || [];
    for (const alias of aliases) {
      const sourceKey = resolveKey(alias);
      if (!Object.prototype.hasOwnProperty.call(mapped, sourceKey)) continue;
      const value = mapped[sourceKey];
      if (!hasValue(value)) continue;
      mapped[target] = value;
      return;
    }
  };

  const numericMacroFields = [...CORE_MACRO_FIELDS, 'alcohol'];
  numericMacroFields.forEach(ensureField);

  numericMacroFields.forEach((field) => {
    if (!hasValue(mapped[field])) return;
    const parsed = parseNumericValue(mapped[field]);
    if (parsed != null) mapped[field] = parsed;
  });

  if (hasValue(mapped.grams)) {
    const parsedGrams = parseNumericValue(mapped.grams);
    if (parsedGrams != null) mapped.grams = parsedGrams;
  }

  return mapped;
}

export function normalizeMacros(macros = {}) {
  const m = mapGramFields(macros);
  const missingKeys = CORE_MACRO_FIELDS.filter((key) => !hasValue(m[key]));
  const normalized = {
    calories: coerceNumber(m.calories),
    protein: coerceNumber(m.protein),
    carbs: coerceNumber(m.carbs),
    fat: coerceNumber(m.fat),
    fiber: coerceNumber(m.fiber)
  };
  if (hasValue(m.alcohol)) normalized.alcohol = coerceNumber(m.alcohol);
  Object.defineProperty(normalized, '__missingMacroKeys', {
    value: missingKeys,
    enumerable: false
  });
  return normalized;
}

export function hasMealMacroPayload(macros = {}) {
  const normalized = normalizeMacros(macros);
  return !hasMissingCoreMacros(normalized);
}

/**
 * Скалира макросите спрямо грамовете.
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}} macros
 * @param {number} grams
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}}
*/
export function scaleMacros(macros = {}, grams = 100) {
  const factor = grams / 100;
  const scaled = {
    calories: coerceNumber(macros.calories) * factor,
    protein: coerceNumber(macros.protein) * factor,
    carbs: coerceNumber(macros.carbs) * factor,
    fat: coerceNumber(macros.fat) * factor,
    fiber: coerceNumber(macros.fiber) * factor
  };
  if (macros.alcohol != null) scaled.alcohol = coerceNumber(macros.alcohol) * factor;
  return scaled;
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

/**
 * Изчислява процентното съотношение на макросите спрямо общите калории.
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber?:number}} macros
 * @returns {{protein_percent:number, carbs_percent:number, fat_percent:number, fiber_percent:number}}
 */
export function calculateMacroPercents(macros = {}) {
  const { calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0 } = macros;
  if (calories <= 0) {
    return { protein_percent: 0, carbs_percent: 0, fat_percent: 0, fiber_percent: 0 };
  }
  const toPercent = (grams, kcalPerGram) => Math.round((grams * kcalPerGram / calories) * 100);
  return {
    protein_percent: toPercent(protein, 4),
    carbs_percent: toPercent(carbs, 4),
    fat_percent: toPercent(fat, 9),
    fiber_percent: toPercent(fiber, 2)
  };
}

function resolveMacros(meal, grams) {
  if (!meal) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let macros;
  if ('calories' in meal) {
    macros = {
      calories: coerceNumber(meal.calories),
      protein: coerceNumber(meal.protein),
      carbs: coerceNumber(meal.carbs),
      fat: coerceNumber(meal.fat),
      fiber: coerceNumber(meal.fiber),
      ...(meal.alcohol != null ? { alcohol: coerceNumber(meal.alcohol) } : {})
    };
  } else {
    const override = getNutrientOverride(meal.meal_name || meal.name);
    if (override) macros = override;
    else {
      const baseMacros =
        macrosByIdOrName.get(meal.id) ||
        macrosByIdOrName.get((meal.meal_name || meal.name || '').toLowerCase());
      macros = {
        calories: coerceNumber(baseMacros?.['калории']),
        protein: coerceNumber(baseMacros?.['белтъчини']),
        carbs: coerceNumber(baseMacros?.['въглехидрати']),
        fat: coerceNumber(baseMacros?.['мазнини']),
        fiber: coerceNumber(baseMacros?.['фибри']),
        ...(baseMacros?.['алкохол'] != null
          ? { alcohol: coerceNumber(baseMacros?.['алкохол']) }
          : {})
      };
    }
  }
  return typeof grams === 'number' ? scaleMacros(macros, grams) : macros;
}

/**
 * Преизчислява калориите от макронутриентите.
 * Фибрите се изваждат от въглехидратите за нетно съдържание и се оценяват по 2 kcal/грам.
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}} macros
 * @param {boolean} [carbsIncludeFiber=true] - Ако въглехидратите включват фибри, изважда ги за нетно съдържание.
 * @returns {{calories:number, protein:number, carbs:number, fat:number, fiber:number, alcohol?:number}}
 */
export function recalculateCalories(macros = {}, carbsIncludeFiber = true) {
  const { protein = 0, carbs = 0, fat = 0, fiber = 0, alcohol = 0 } = macros;
  const netCarbs = carbsIncludeFiber ? carbs - fiber : carbs;
  const calc = protein * 4 + netCarbs * 4 + fat * 9 + fiber * 2 + alcohol * 7;
  return { ...macros, calories: calc };
}

/**
 * Проверява дали калориите съответстват на макросите.
 * Фибрите се изваждат от въглехидратите за нетно съдържание и се
 * оценяват по 2 kcal/грам.
 * @param {{calories:number, protein:number, carbs:number, fat:number, fiber:number}} macros
 * @param {number} [threshold=0.05] - Допустимото относително отклонение.
 * @param {boolean} [carbsIncludeFiber=true] - Ако въглехидратите включват фибри, изважда ги за нетно съдържание.
 */
function validateMacroCalories(macros = {}, threshold = 0.05, carbsIncludeFiber = true) {
  const { calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0, alcohol = 0 } = macros;
  const netCarbs = carbsIncludeFiber ? carbs - fiber : carbs;
  const calc = protein * 4 + netCarbs * 4 + fat * 9 + fiber * 2 + alcohol * 7;
  if (!calc) return;
  const diff = Math.abs(calc - calories);
  if (diff / calc > threshold) {
    console.warn(
      `[macroUtils] Calorie mismatch: expected ${calc.toFixed(2)}, received ${calories}`
    );
    Object.assign(macros, recalculateCalories(macros, carbsIncludeFiber));
  }
}

export function addMealMacros(meal, acc, skipValidation = false) {
  const mapped = mapGramFields(meal);
  const m = normalizeMacros(resolveMacros(mapped, mapped?.grams));
  if (!skipValidation) {
    validateMacroCalories(m);
  }
  acc.calories = (acc.calories || 0) + m.calories;
  acc.protein = (acc.protein || 0) + m.protein;
  acc.carbs = (acc.carbs || 0) + m.carbs;
  acc.fat = (acc.fat || 0) + m.fat;
  acc.fiber = (acc.fiber || 0) + m.fiber;
  return acc;
}

export function removeMealMacros(meal, acc, skipValidation = false) {
  const mapped = mapGramFields(meal);
  const m = normalizeMacros(resolveMacros(mapped, mapped?.grams));
  if (!skipValidation) {
    validateMacroCalories(m);
  }
  acc.calories = Math.max(0, (acc.calories || 0) - m.calories);
  acc.protein = Math.max(0, (acc.protein || 0) - m.protein);
  acc.carbs = Math.max(0, (acc.carbs || 0) - m.carbs);
  acc.fat = Math.max(0, (acc.fat || 0) - m.fat);
  acc.fiber = Math.max(0, (acc.fiber || 0) - m.fiber);
  return acc;
}

/**
 * Сумира макросите на всички хранения за деня.
 * @param {Array} dayMenu - Масив от хранения за текущия ден.
 * @returns {{ calories:number, protein:number, carbs:number, fat:number, fiber:number }}
 */
export function calculatePlanMacros(
  dayMenu = [],
  carbsIncludeFiber = true,
  skipValidation = false,
  mealMacrosIndex = null,
  dayKey = ''
) {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  if (!Array.isArray(dayMenu)) return acc;
  const applyNormalized = (normalized) => {
    if (!skipValidation) {
      validateMacroCalories(normalized, 0.05, carbsIncludeFiber);
    }
    acc.calories += normalized.calories;
    acc.protein += normalized.protein;
    acc.carbs += normalized.carbs;
    acc.fat += normalized.fat;
    acc.fiber += normalized.fiber;
  };

  const tryIndexed = (key) => {
    if (!key || !mealMacrosIndex || typeof mealMacrosIndex !== 'object') return false;
    const indexed = mealMacrosIndex[key];
    if (!indexed || typeof indexed !== 'object') return false;
    const normalized = normalizeMacros(indexed);
    if (hasMissingCoreMacros(normalized)) return false;
    applyNormalized(normalized);
    return true;
  };

  dayMenu.forEach((meal, idx) => {
    const macros = meal && typeof meal.macros === 'object' ? meal.macros : null;
    const key = dayKey ? `${dayKey}_${idx}` : null;
    if (macros) {
      const normalized = normalizeMacros(macros);
      if (!hasMissingCoreMacros(normalized)) {
        applyNormalized(normalized);
        return;
      }
      if (tryIndexed(key)) return;
      addMealMacros(meal, acc, skipValidation);
      return;
    }
    if (tryIndexed(key)) return;
    addMealMacros(meal, acc, skipValidation);
  });
  const percents = calculateMacroPercents(acc);
  return { ...acc, ...percents };
}

/**
 * Изчислява общите макроси за изпълнените хранения и извънредни хранения.
 * @param {Object} planMenu - Менюто по дни със списъци от хранения.
 * @param {Object} completionStatus - Обект със статуси дали храненето е изпълнено (day_index ключове).
 * @param {Array} extraMeals - Допълнителни хранения с макроси { calories, protein, carbs, fat, fiber }.
 * @returns {{ calories:number, protein:number, carbs:number, fat:number, fiber:number }}
 */
export function calculateCurrentMacros(
  planMenu = {},
  completionStatus = {},
  extraMeals = [],
  skipValidation = false,
  mealMacrosIndex = null
) {
  const acc = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  const getIndexedMacros = (key, grams) => {
    if (!key || !mealMacrosIndex || typeof mealMacrosIndex !== 'object') return null;
    const indexed = mealMacrosIndex[key];
    if (!indexed || typeof indexed !== 'object') return null;
    const normalized = normalizeMacros(indexed);
    if (hasMissingCoreMacros(normalized)) return null;
    const result = { ...normalized };
    const resolvedGrams = grams ?? indexed.grams;
    if (resolvedGrams != null) result.grams = resolvedGrams;
    return result;
  };

  const prepareMeal = (meal, key = null) => {
    const grams = meal && typeof meal === 'object' ? meal.grams : undefined;
    if (meal && typeof meal.macros === 'object') {
      const normalized = normalizeMacros(meal.macros);
      if (!hasMissingCoreMacros(normalized)) {
        const result = { ...normalized };
        if (grams != null) result.grams = grams;
        return result;
      }
    }
    if (key) {
      const indexed = getIndexedMacros(key, grams);
      if (indexed) return indexed;
    }
    const mapped = mapGramFields(meal);
    if (grams != null) mapped.grams = grams;
    return mapped;
  };

  Object.entries(planMenu).forEach(([day, meals]) => {
    (meals || []).forEach((meal, idx) => {
      const key = `${day}_${idx}`;
      if (completionStatus[key]) addMealMacros(prepareMeal(meal, key), acc, skipValidation);
    });
  });

  if (Array.isArray(extraMeals)) {
    extraMeals.forEach((m) => addMealMacros(prepareMeal(m), acc, skipValidation));
  }

  return acc;
}
export const __testExports = {
  macrosByIdOrName,
  nutrientCache,
  resolveMacros,
  validateMacroCalories,
  recalculateCalories
};
