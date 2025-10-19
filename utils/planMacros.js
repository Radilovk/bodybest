const MACRO_FIELD_ALIASES = {
  calories: ['calories', 'calories_kcal', 'cal', 'kcal', 'energy', 'energy_kcal'],
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
  fiber: ['fiber', 'fiber_grams', 'fiber_g', 'fibre', 'fibre_grams', 'fibre_g']
};

const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
  fiber: 2
};

const NUMERIC_VALUE_REGEX = /-?\d+(?:[.,]\d+)?/;

const parseNumber = (value) => {
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

const extractMacros = (source = {}) => {
  if (!source || typeof source !== 'object') return null;
  let hasValue = false;
  const result = {
    calories: null,
    protein_grams: null,
    carbs_grams: null,
    fat_grams: null,
    fiber_grams: null
  };

  for (const [macroKey, aliases] of Object.entries(MACRO_FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(source, alias)) {
        const parsed = parseNumber(source[alias]);
        if (parsed != null) {
          if (macroKey === 'calories') {
            result.calories = parsed;
          } else {
            result[`${macroKey}_grams`] = parsed;
          }
          hasValue = true;
          break;
        }
      }
    }
  }

  return hasValue ? result : null;
};

const mergeMacroSources = (primary, secondary) => {
  const result = {
    calories: primary?.calories ?? secondary?.calories ?? null,
    protein_grams: primary?.protein_grams ?? secondary?.protein_grams ?? null,
    carbs_grams: primary?.carbs_grams ?? secondary?.carbs_grams ?? null,
    fat_grams: primary?.fat_grams ?? secondary?.fat_grams ?? null,
    fiber_grams: primary?.fiber_grams ?? secondary?.fiber_grams ?? null
  };
  return result;
};

const roundValue = (value) => Math.round(Number.isFinite(value) ? value : 0);

const isCompleteMacroSet = (macros) => {
  if (!macros || typeof macros !== 'object') return false;
  const required = ['calories', 'protein_grams', 'carbs_grams', 'fat_grams'];
  return required.every((key) => {
    const value = macros[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  });
};

export function calculatePlanMacros(week1Menu = {}, mealMacrosIndex = null) {
  if (!week1Menu || typeof week1Menu !== 'object') {
    return null;
  }

  let hasAnyMacroData = false;
  const totals = {
    calories: 0,
    protein_grams: 0,
    carbs_grams: 0,
    fat_grams: 0,
    fiber_grams: 0
  };

  let caloriesFromInput = 0;

  const dayEntries = Object.entries(week1Menu);
  for (const [dayKey, meals] of dayEntries) {
    if (!Array.isArray(meals)) continue;
    meals.forEach((meal, mealIdx) => {
      const directMacros = extractMacros(meal?.macros ?? meal);
      const indexKey = `${dayKey}_${mealIdx}`;
      const indexedMacros = mealMacrosIndex && typeof mealMacrosIndex === 'object'
        ? extractMacros(mealMacrosIndex[indexKey])
        : null;
      const merged = mergeMacroSources(directMacros, indexedMacros);
      const hasMacroValues = ['protein_grams', 'carbs_grams', 'fat_grams', 'fiber_grams', 'calories']
        .some((key) => merged[key] != null);
      if (!hasMacroValues) {
        return;
      }
      hasAnyMacroData = true;
      const protein = merged.protein_grams ?? 0;
      const carbs = merged.carbs_grams ?? 0;
      const fat = merged.fat_grams ?? 0;
      const fiber = merged.fiber_grams ?? 0;
      const calories = merged.calories ?? 0;

      totals.protein_grams += protein;
      totals.carbs_grams += carbs;
      totals.fat_grams += fat;
      totals.fiber_grams += fiber;
      caloriesFromInput += calories;
    });
  }

  if (!hasAnyMacroData) {
    return null;
  }

  const macroCalories =
    totals.protein_grams * CALORIES_PER_GRAM.protein +
    totals.carbs_grams * CALORIES_PER_GRAM.carbs +
    totals.fat_grams * CALORIES_PER_GRAM.fat +
    totals.fiber_grams * CALORIES_PER_GRAM.fiber;

  const caloriesTotal = macroCalories > 0 ? macroCalories : caloriesFromInput;
  if (caloriesTotal <= 0 || totals.protein_grams + totals.carbs_grams + totals.fat_grams <= 0) {
    return null;
  }

  const caloriesRounded = roundValue(caloriesTotal);

  const percent = (grams, macroKey) => {
    const caloriesForMacro = grams * CALORIES_PER_GRAM[macroKey];
    if (!caloriesRounded || caloriesRounded <= 0) return 0;
    return roundValue((caloriesForMacro * 100) / caloriesRounded);
  };

  const fiberPercent = caloriesRounded > 0
    ? roundValue((totals.fiber_grams * CALORIES_PER_GRAM.fiber * 100) / caloriesRounded)
    : 0;

  const result = {
    calories: caloriesRounded,
    protein_grams: roundValue(totals.protein_grams),
    protein_percent: percent(totals.protein_grams, 'protein'),
    carbs_grams: roundValue(totals.carbs_grams),
    carbs_percent: percent(totals.carbs_grams, 'carbs'),
    fat_grams: roundValue(totals.fat_grams),
    fat_percent: percent(totals.fat_grams, 'fat'),
    fiber_grams: roundValue(totals.fiber_grams),
    fiber_percent: fiberPercent
  };

  return isCompleteMacroSet(result) ? result : null;
}

export function hasCompleteCaloriesMacros(macros) {
  return isCompleteMacroSet(macros);
}
