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

const normalizeLookupKey = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

// Временно съпоставяне на липсващи recipeKey/meal_name стойности към реални каталожни записи.
// Поддържаме таблицата кратка и документирaна, докато добавим липсващите ястия в базата.
const RECIPE_MACRO_ALIASES = new Map(
  [
    // TODO: Добави отделен каталожен запис за "Вечеря: Салата и Риба на Скара".
    ['dinner_salad_fish', 'v-01'],
    ['вечеря: салата и риба на скара', 'v-01']
  ].map(([alias, target]) => [normalizeLookupKey(alias), target])
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

  if (Object.prototype.hasOwnProperty.call(base, '__preferGivenCalories')) {
    Object.defineProperty(mapped, '__preferGivenCalories', {
      value: base.__preferGivenCalories,
      enumerable: false
    });
  }

  if (Object.prototype.hasOwnProperty.call(base, '__macrosScaled')) {
    Object.defineProperty(mapped, '__macrosScaled', {
      value: Boolean(base.__macrosScaled),
      enumerable: false
    });
  }

  if (Object.prototype.hasOwnProperty.call(base, '__providedMacroKeys')) {
    Object.defineProperty(mapped, '__providedMacroKeys', {
      value: base.__providedMacroKeys,
      enumerable: false
    });
  }

  if (base && typeof base.macros === 'object') {
    Object.entries(base.macros).forEach(([key, value]) => {
      if (Object.prototype.hasOwnProperty.call(mapped, key)) return;
      const parsed = parseNumericValue(value);
      mapped[key] = parsed != null ? parsed : value;
    });
  }

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
  const providedKeys = CORE_MACRO_FIELDS.filter((key) => hasValue(m[key]));
  if (hasValue(m.alcohol)) providedKeys.push('alcohol');
  const normalized = {
    calories: coerceNumber(m.calories),
    protein: coerceNumber(m.protein),
    carbs: coerceNumber(m.carbs),
    fat: coerceNumber(m.fat),
    fiber: coerceNumber(m.fiber)
  };
  if (hasValue(m.alcohol)) normalized.alcohol = coerceNumber(m.alcohol);
  if (m.__preferGivenCalories) {
    Object.defineProperty(normalized, '__preferGivenCalories', {
      value: true,
      enumerable: false
    });
  }
  if (m.__macrosScaled) {
    Object.defineProperty(normalized, '__macrosScaled', {
      value: true,
      enumerable: false
    });
  }
  if (providedKeys.length > 0) {
    Object.defineProperty(normalized, '__providedMacroKeys', {
      value: providedKeys,
      enumerable: false
    });
  }
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

function mergeNormalizedWithIndexed(normalized, indexed = null, grams = undefined) {
  const result = { ...normalized };
  if (normalized?.__preferGivenCalories) {
    Object.defineProperty(result, '__preferGivenCalories', {
      value: true,
      enumerable: false
    });
  }
  if (Array.isArray(normalized?.__providedMacroKeys)) {
    Object.defineProperty(result, '__providedMacroKeys', {
      value: normalized.__providedMacroKeys,
      enumerable: false
    });
  }
  const missingKeys = Array.isArray(normalized?.__missingMacroKeys)
    ? [...normalized.__missingMacroKeys]
    : [];
  const remainingMissing = new Set(missingKeys);

  if (indexed) {
    CORE_MACRO_FIELDS.forEach((field) => {
      if (missingKeys.includes(field) && hasValue(indexed[field])) {
        result[field] = indexed[field];
        remainingMissing.delete(field);
      }
    });
    if ((normalized.alcohol == null || missingKeys.includes('alcohol')) && hasValue(indexed.alcohol)) {
      result.alcohol = indexed.alcohol;
      remainingMissing.delete('alcohol');
    } else if (result.alcohol == null && hasValue(indexed.alcohol)) {
      result.alcohol = indexed.alcohol;
    }
    if (result.grams == null && hasValue(indexed.grams)) {
      result.grams = indexed.grams;
    }
  }

  if (grams != null) result.grams = grams;

  Object.defineProperty(result, '__missingMacroKeys', {
    value: Array.from(remainingMissing),
    enumerable: false
  });

  return result;
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

const CORE_AND_OPTIONAL_FIELDS = [...CORE_MACRO_FIELDS, 'alcohol'];

const formatCatalogMacros = (baseMacros) => {
  if (!baseMacros) return null;
  const result = {
    calories: coerceNumber(baseMacros?.['калории']),
    protein: coerceNumber(baseMacros?.['белтъчини']),
    carbs: coerceNumber(baseMacros?.['въглехидрати']),
    fat: coerceNumber(baseMacros?.['мазнини'])
  };
  if (baseMacros?.['фибри'] != null) result.fiber = coerceNumber(baseMacros?.['фибри']);
  if (baseMacros?.['алкохол'] != null) result.alcohol = coerceNumber(baseMacros?.['алкохол']);
  return result;
};

const resolveCatalogMacros = (key) => {
  if (!key) return null;
  const directMatch = macrosByIdOrName.get(key);
  if (directMatch) return formatCatalogMacros(directMatch);
  const normalizedKey = normalizeLookupKey(key);
  if (!normalizedKey) return null;
  const normalizedMatch = macrosByIdOrName.get(normalizedKey);
  return normalizedMatch ? formatCatalogMacros(normalizedMatch) : null;
};

function resolveFallbackMacrosFromMeal(meal) {
  const aliasSources = [
    meal?.recipeKey,
    meal?.recipe_key,
    meal?.id,
    meal?.meal_name,
    meal?.name
  ];

  for (const source of aliasSources) {
    const aliasKey = normalizeLookupKey(source);
    if (!aliasKey) continue;
    const targetKey = RECIPE_MACRO_ALIASES.get(aliasKey);
    if (!targetKey) continue;
    const aliasMacros = resolveCatalogMacros(targetKey);
    if (aliasMacros) return aliasMacros;
  }

  const candidates = [];
  const seenCandidates = new Set();

  const addCandidate = (value, priority = false) => {
    if (value == null) return;
    const strValue = typeof value === 'string' ? value.trim() : String(value).trim();
    if (!strValue) return;
    const key = strValue.toLowerCase();
    if (seenCandidates.has(key)) return;
    seenCandidates.add(key);
    const candidate = { raw: strValue, lower: key };
    if (priority) {
      candidates.unshift(candidate);
    } else {
      candidates.push(candidate);
    }
  };

  const collectCandidatesFromObject = (obj, { prioritizeCamelCase = false } = {}) => {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([prop, value]) => {
      if (value == null) return;
      if (typeof value === 'string' || typeof value === 'number') {
        const matchesSnakeCase = /(?:^|_)(?:id|name|key)$/i.test(prop);
        const matchesCamelCase = /(Id|Name|Key)$/.test(prop);
        if (matchesSnakeCase || matchesCamelCase) {
          const prioritize = prioritizeCamelCase && matchesCamelCase;
          addCandidate(value, prioritize);
        }
      }
    });
  };

  collectCandidatesFromObject(meal, { prioritizeCamelCase: true });
  if (Array.isArray(meal?.items)) {
    meal.items.forEach((item) => collectCandidatesFromObject(item));
  }

  for (const candidate of candidates) {
    const override = getNutrientOverride(candidate.raw);
    if (override) {
      const result = {
        calories: coerceNumber(override.calories),
        protein: coerceNumber(override.protein),
        carbs: coerceNumber(override.carbs),
        fat: coerceNumber(override.fat)
      };
      if (override.fiber != null) result.fiber = coerceNumber(override.fiber);
      if (override.alcohol != null) result.alcohol = coerceNumber(override.alcohol);
      return result;
    }

    const baseMacros = resolveCatalogMacros(candidate.raw);
    if (baseMacros) return baseMacros;
  }

  return null;
}

function resolveMacros(meal, grams) {
  if (!meal) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  const alreadyScaled = Boolean(meal?.__macrosScaled);
  const shouldScale = typeof grams === 'number' && !alreadyScaled;
  const propagateScaleFlag = (target) => {
    if (!alreadyScaled || !target || typeof target !== 'object') return target;
    Object.defineProperty(target, '__macrosScaled', {
      value: true,
      enumerable: false
    });
    return target;
  };

  const parseFieldValue = (field) => {
    if (!meal || typeof meal !== 'object') return null;
    const direct = meal[field];
    if (hasValue(direct)) {
      const parsedDirect = parseNumericValue(direct);
      if (parsedDirect != null) return parsedDirect;
    }
    if (meal.macros && hasValue(meal.macros[field])) {
      const parsedMacro = parseNumericValue(meal.macros[field]);
      if (parsedMacro != null) return parsedMacro;
    }
    return null;
  };

  const initialProvidedKeys = Array.isArray(meal?.__providedMacroKeys)
    ? meal.__providedMacroKeys
    : null;
  const providedMacroKeys = new Set(initialProvidedKeys || []);
  const shouldInferProvided = !initialProvidedKeys;

  const macroValues = {};
  const missingFields = [];

  CORE_AND_OPTIONAL_FIELDS.forEach((field) => {
    const parsed = parseFieldValue(field);
    if (parsed != null) {
      macroValues[field] = parsed;
      if (shouldInferProvided) {
        providedMacroKeys.add(field);
      }
    } else {
      missingFields.push(field);
    }
  });

  const fallbackMacros = missingFields.length > 0 ? resolveFallbackMacrosFromMeal(meal) : null;

  if (fallbackMacros) {
    missingFields.forEach((field) => {
      const currentParsed = parseFieldValue(field);
      if (currentParsed != null) return;
      if (!hasValue(fallbackMacros[field])) return;
      macroValues[field] = coerceNumber(fallbackMacros[field]);
    });
  }

  const macros = {
    calories: coerceNumber(macroValues.calories),
    protein: coerceNumber(macroValues.protein),
    carbs: coerceNumber(macroValues.carbs),
    fat: coerceNumber(macroValues.fat),
    fiber: coerceNumber(macroValues.fiber)
  };

  if (macroValues.alcohol != null) {
    macros.alcohol = coerceNumber(macroValues.alcohol);
  }

  const hasOriginalCoreData = Array.isArray(initialProvidedKeys)
    ? initialProvidedKeys.some((key) => CORE_MACRO_FIELDS.includes(key))
    : false;
  const shouldPreferGivenCalories = Boolean(meal.__preferGivenCalories) || hasOriginalCoreData;

  if (shouldPreferGivenCalories) {
    Object.defineProperty(macros, '__preferGivenCalories', {
      value: true,
      enumerable: false
    });
  }

  if (providedMacroKeys.size > 0) {
    Object.defineProperty(macros, '__providedMacroKeys', {
      value: Array.from(providedMacroKeys),
      enumerable: false
    });
  }

  propagateScaleFlag(macros);
  const result = shouldScale ? scaleMacros(macros, grams) : macros;
  return propagateScaleFlag(result);
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
  if (macros?.__preferGivenCalories) return;
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
  const grams = mapped?.__macrosScaled ? undefined : mapped?.grams;
  const resolved = resolveMacros(mapped, grams);
  const m = normalizeMacros(resolved);
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
  const grams = mapped?.__macrosScaled ? undefined : mapped?.grams;
  const resolved = resolveMacros(mapped, grams);
  const m = normalizeMacros(resolved);
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

  const getIndexedForKey = (key) => {
    if (!key || !mealMacrosIndex || typeof mealMacrosIndex !== 'object') return null;
    const indexed = mealMacrosIndex[key];
    if (!indexed || typeof indexed !== 'object') return null;
    const normalized = normalizeMacros(indexed);
    const result = { ...normalized };
    if (hasValue(indexed.grams)) {
      const parsedGrams = parseNumericValue(indexed.grams);
      if (parsedGrams != null) result.grams = parsedGrams;
    }
    return result;
  };

  const tryIndexed = (key) => {
    const indexed = getIndexedForKey(key);
    if (!indexed) return false;
    applyNormalized(indexed);
    return true;
  };

  dayMenu.forEach((meal, idx) => {
    const macros = meal && typeof meal.macros === 'object' ? meal.macros : null;
    const grams = meal && typeof meal === 'object' ? meal.grams : undefined;
    const key = dayKey ? `${dayKey}_${idx}` : null;
    if (macros) {
      const normalized = normalizeMacros(macros);
      if (!hasMissingCoreMacros(normalized)) {
        Object.defineProperty(normalized, '__preferGivenCalories', {
          value: true,
          enumerable: false
        });
        applyNormalized(normalized);
        return;
      }
      const indexed = getIndexedForKey(key);
      const merged = mergeNormalizedWithIndexed(normalized, indexed, grams);
      const { grams: mergedGrams, ...restValues } = merged;
      const macroValues = { ...restValues };
      const missingKeys = Array.isArray(merged.__missingMacroKeys) ? merged.__missingMacroKeys : [];
      const shouldDropMissing = missingKeys.length > 0;
      if (shouldDropMissing) {
        missingKeys.forEach((key) => {
          delete macroValues[key];
        });
      }
      const prepared = {
        ...meal,
        ...macroValues,
        ...(mergedGrams != null ? { grams: mergedGrams } : {})
      };
      if (Array.isArray(merged.__providedMacroKeys)) {
        Object.defineProperty(prepared, '__providedMacroKeys', {
          value: merged.__providedMacroKeys,
          enumerable: false
        });
      }
      const mergedMacros = { ...(meal.macros || {}) };
      if (shouldDropMissing) {
        missingKeys.forEach((key) => {
          delete mergedMacros[key];
        });
      }
      prepared.macros = { ...mergedMacros, ...macroValues };
      Object.defineProperty(prepared, '__preferGivenCalories', {
        value: true,
        enumerable: false
      });
      addMealMacros(prepared, acc, skipValidation);
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
        Object.defineProperty(result, '__preferGivenCalories', {
          value: true,
          enumerable: false
        });
        return result;
      }
      const indexed = key ? getIndexedMacros(key, grams) : null;
      const merged = mergeNormalizedWithIndexed(normalized, indexed, grams);
      const normalizedMissingKeys = Array.isArray(normalized.__missingMacroKeys)
        ? normalized.__missingMacroKeys
        : [];
      const shouldDropMissing = !indexed && normalizedMissingKeys.length > 0;
      const { grams: mergedGrams, ...restValues } = merged;
      const macroValues = { ...restValues };
      if (shouldDropMissing) {
        normalizedMissingKeys.forEach((macroKey) => {
          delete macroValues[macroKey];
        });
      }
      const prepared = {
        ...meal,
        ...macroValues,
        ...(mergedGrams != null ? { grams: mergedGrams } : {})
      };
      if (shouldDropMissing) {
        normalizedMissingKeys.forEach((macroKey) => {
          delete prepared[macroKey];
        });
      }
      if (Array.isArray(merged.__providedMacroKeys)) {
        Object.defineProperty(prepared, '__providedMacroKeys', {
          value: merged.__providedMacroKeys,
          enumerable: false
        });
      }
      const mergedMacros = { ...(meal.macros || {}) };
      if (shouldDropMissing) {
        normalizedMissingKeys.forEach((macroKey) => {
          delete mergedMacros[macroKey];
        });
      }
      prepared.macros = { ...mergedMacros, ...macroValues };
      if (shouldDropMissing) {
        normalizedMissingKeys.forEach((macroKey) => {
          delete prepared.macros[macroKey];
        });
      }
      Object.defineProperty(prepared, '__preferGivenCalories', {
        value: true,
        enumerable: false
      });
      return prepared;
    }
    if (key) {
      const indexed = getIndexedMacros(key, grams);
      if (indexed) return indexed;
    }
    const mapped = mapGramFields(meal);
    if (grams != null) mapped.grams = grams;
    if (hasValue(mapped.calories)) {
      Object.defineProperty(mapped, '__preferGivenCalories', {
        value: true,
        enumerable: false
      });
    }
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
