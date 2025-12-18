// Cloudflare Worker Script (index.js) - Версия 2.3
// Добавен е режим за дебъг чрез HTTP заглавие `X-Debug: 1`
// Също така са запазени всички функционалности от предходните версии
// Включва:
// - Пълна логика за Адаптивен Въпросник: генериране, подаване, анализ на отговори. (Запазена и подобрена от v2.1)
// - Актуализиран handlePrincipleAdjustment с по-детайлни данни от въпросник. (Запазено от v2.1)
// - Актуализиран generateAndStoreAdaptiveQuiz с по-детайлни данни от предишни въпросници. (Запазено от v2.1)
// - Автоматичният анализ на отговорите се заменя със събитие planMod.
// - Имплементиран нов ендпойнт /api/log-extra-meal.
// - Имплементиран нов ендпойнт /api/acknowledgeAiUpdate.
// - Попълнени липсващи части от предходни версии.
// - Запазени всички предходни функционалности.

// Вградените помощни функции позволяват worker.js да е самодостатъчен

import { sendEmail, DEFAULT_MAIL_PHP_URL } from './sendEmailWorker.js';

const EMAIL_TIMEOUT_MS = 10000; // 10 seconds timeout for email sending

const MACRO_FIELD_ALIASES = {
  calories: ['calories', 'calories_kcal', 'cal', 'kcal', 'energy', 'energy_kcal'],
  protein: [
    'protein',
    'protein_grams',
    'protein_g',
    'proteins',
    'proteins_g',
    'proteinGrams',
    'proteinTarget',
    'protein_target_grams'
  ],
  carbs: [
    'carbs',
    'carbs_grams',
    'carbs_g',
    'carbohydrates',
    'carbohydrates_g',
    'carbohydrates_total_g',
    'net_carbs',
    'net_carbs_g',
    'carbsGrams',
    'carbGrams',
    'carbsTarget'
  ],
  fat: ['fat', 'fat_grams', 'fat_g', 'fat_total_g', 'fats', 'fatGrams', 'fatTarget'],
  fiber: ['fiber', 'fiber_grams', 'fiber_g', 'fibre', 'fibre_grams', 'fibre_g', 'fiberGrams', 'fibreGrams']
};

const MACRO_PERCENT_FIELD_ALIASES = {
  protein_percent: [
    'protein_percent',
    'protein_pct',
    'protein_percentage',
    'protein_ratio',
    'proteinPercent',
    'proteinPercentage'
  ],
  carbs_percent: [
    'carbs_percent',
    'carb_percent',
    'carbs_pct',
    'carbohydrates_percent',
    'carb_pct',
    'carbsPercent',
    'carbsPercentage'
  ],
  fat_percent: [
    'fat_percent',
    'fat_pct',
    'fat_percentage',
    'fats_percent',
    'fatPercent',
    'fatPercentage'
  ],
  fiber_percent: [
    'fiber_percent',
    'fibre_percent',
    'fiber_pct',
    'fibre_pct',
    'fiberPercent',
    'fiberPercentage'
  ]
};

const TARGET_MACRO_PLACEHOLDERS = {
  calories: ['%%TARGET_CALORIES%%'],
  protein_grams: ['%%TARGET_PROTEIN_GRAMS%%', '%%TARGET_PROTEIN_G%%'],
  protein_percent: ['%%TARGET_PROTEIN_PERCENT%%', '%%TARGET_PROTEIN_P%%'],
  carbs_grams: ['%%TARGET_CARBS_GRAMS%%', '%%TARGET_CARBS_G%%'],
  carbs_percent: ['%%TARGET_CARBS_PERCENT%%', '%%TARGET_CARBS_P%%'],
  fat_grams: ['%%TARGET_FAT_GRAMS%%', '%%TARGET_FAT_G%%'],
  fat_percent: ['%%TARGET_FAT_PERCENT%%', '%%TARGET_FAT_P%%'],
  fiber_grams: ['%%TARGET_FIBER_GRAMS%%', '%%TARGET_FIBER_G%%'],
  fiber_percent: ['%%TARGET_FIBER_PERCENT%%', '%%TARGET_FIBER_P%%']
};

const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
  fiber: 2
};

const NUMERIC_VALUE_REGEX = /-?\d+(?:[.,]\d+)?/;

const TARGET_MACRO_REQUIREMENTS_KEY_SUFFIX = '_target_macro_requirements';

const NO_PSYCH_PROFILE_MESSAGE = 'Няма данни от психологически тестове.';

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

const getTargetMacroRequirementsKey = (userId) => `${userId}${TARGET_MACRO_REQUIREMENTS_KEY_SUFFIX}`;

const pickFirstNumeric = (...values) => {
  for (const value of values) {
    const parsed = parseNumber(value);
    if (parsed != null && Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

/**
 * Грешка за липсващи таргет макро стойности.
 * @property {string[]} missingFields - Списък с ключовете на липсващите таргет полета.
 */
class MissingTargetMacrosError extends Error {
  constructor(message, missingFields) {
    super(message);
    this.name = 'MissingTargetMacrosError';
    this.missingFields = missingFields;
  }
}

const ensureTargetMacrosAvailable = (initialAnswers = {}, profile = {}) => {
  const metrics = {
    weight: pickFirstNumeric(initialAnswers?.weight, profile?.weight),
    height: pickFirstNumeric(initialAnswers?.height, profile?.height),
    age: pickFirstNumeric(initialAnswers?.age, profile?.age)
  };

  const labels = {
    weight: 'тегло (кг)',
    height: 'ръст (см)',
    age: 'възраст (години)'
  };

  const missingFields = Object.entries(metrics)
    .filter(([, value]) => !(typeof value === 'number' && Number.isFinite(value) && value > 0))
    .map(([key]) => key);

  if (missingFields.length > 0) {
    const instructions = missingFields.map((field) => `Попълнете ${labels[field]} във въпросника или профила.`);
    const message = `Липсват задължителни данни за макро таргети: ${missingFields
      .map((field) => labels[field])
      .join(', ')}.`;
    return {
      ok: false,
      missingFields,
      instructions,
      message,
      metrics
    };
  }

  return { ok: true, metrics };
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

const mergeMacroSources = (primary, secondary) => ({
  calories: primary?.calories ?? secondary?.calories ?? null,
  protein_grams: primary?.protein_grams ?? secondary?.protein_grams ?? null,
  carbs_grams: primary?.carbs_grams ?? secondary?.carbs_grams ?? null,
  fat_grams: primary?.fat_grams ?? secondary?.fat_grams ?? null,
  fiber_grams: primary?.fiber_grams ?? secondary?.fiber_grams ?? null
});

const MACRO_GRAM_PERCENT_MAPPING = [
  { gramsKey: 'protein_grams', percentKey: 'protein_percent', alias: 'protein' },
  { gramsKey: 'carbs_grams', percentKey: 'carbs_percent', alias: 'carbs' },
  { gramsKey: 'fat_grams', percentKey: 'fat_percent', alias: 'fat' },
  { gramsKey: 'fiber_grams', percentKey: 'fiber_percent', alias: 'fiber' }
];

const pickNumericValue = (source, aliases = []) => {
  if (!source || typeof source !== 'object') return null;
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      const parsed = parseNumber(source[alias]);
      if (parsed != null) {
        return parsed;
      }
    }
  }
  return null;
};

const convertDirectTargetMacros = (source) => {
  if (!source || typeof source !== 'object') return null;
  const macros = {
    calories: pickNumericValue(source, [...MACRO_FIELD_ALIASES.calories, 'calorieTarget', 'targetCalories']),
    protein_grams: pickNumericValue(source, MACRO_FIELD_ALIASES.protein),
    carbs_grams: pickNumericValue(source, MACRO_FIELD_ALIASES.carbs),
    fat_grams: pickNumericValue(source, MACRO_FIELD_ALIASES.fat),
    fiber_grams: pickNumericValue(source, MACRO_FIELD_ALIASES.fiber),
    protein_percent: pickNumericValue(source, MACRO_PERCENT_FIELD_ALIASES.protein_percent),
    carbs_percent: pickNumericValue(source, MACRO_PERCENT_FIELD_ALIASES.carbs_percent),
    fat_percent: pickNumericValue(source, MACRO_PERCENT_FIELD_ALIASES.fat_percent),
    fiber_percent: pickNumericValue(source, MACRO_PERCENT_FIELD_ALIASES.fiber_percent)
  };
  const hasValue = Object.values(macros).some((value) => value != null);
  return hasValue ? macros : null;
};

const extractTargetMacrosFromAny = (source, visited = new Set()) => {
  if (!source) return null;
  if (typeof source === 'string') {
    const parsed = safeParseJson(source, null);
    return parsed ? extractTargetMacrosFromAny(parsed, visited) : null;
  }
  if (typeof source !== 'object') {
    return null;
  }
  if (visited.has(source)) {
    return null;
  }
  visited.add(source);
  if (Array.isArray(source)) {
    for (const item of source) {
      const found = extractTargetMacrosFromAny(item, visited);
      if (found) return found;
    }
    return null;
  }
  if (source.data) {
    const fromData = extractTargetMacrosFromAny(source.data, visited);
    if (fromData) return fromData;
  }
  if (source.plan || source.recommendation) {
    const planMacros = extractTargetMacrosFromAny(source.plan, visited);
    if (planMacros) return planMacros;
    const recommendationMacros = extractTargetMacrosFromAny(source.recommendation, visited);
    if (recommendationMacros) return recommendationMacros;
  }
  if (source.caloriesMacros) {
    const nested = extractTargetMacrosFromAny(source.caloriesMacros, visited);
    if (nested) return nested;
  }
  const direct = convertDirectTargetMacros(source);
  if (direct) return direct;
  for (const value of Object.values(source)) {
    if (typeof value === 'object' || typeof value === 'string') {
      const nested = extractTargetMacrosFromAny(value, visited);
      if (nested) return nested;
    }
  }
  return null;
};

const finalizeTargetMacros = (macros) => {
  if (!macros || typeof macros !== 'object') return null;
  const normalized = {
    calories: parseNumber(macros.calories),
    protein_grams: parseNumber(macros.protein_grams),
    carbs_grams: parseNumber(macros.carbs_grams),
    fat_grams: parseNumber(macros.fat_grams),
    fiber_grams: parseNumber(macros.fiber_grams),
    protein_percent: parseNumber(macros.protein_percent),
    carbs_percent: parseNumber(macros.carbs_percent),
    fat_percent: parseNumber(macros.fat_percent),
    fiber_percent: parseNumber(macros.fiber_percent)
  };

  if (normalized.calories != null) {
    normalized.calories = roundValue(normalized.calories);
  }

  for (const { gramsKey, percentKey, alias } of MACRO_GRAM_PERCENT_MAPPING) {
    const gramsValue = normalized[gramsKey];
    const percentValue = normalized[percentKey];
    if (gramsValue != null) {
      normalized[gramsKey] = roundValue(gramsValue);
    }
    if (percentValue != null) {
      normalized[percentKey] = roundValue(percentValue);
    }
    if (normalized.calories && normalized.calories > 0) {
      if (normalized[gramsKey] == null && percentValue != null) {
        const grams = (normalized.calories * percentValue) / 100 / CALORIES_PER_GRAM[alias];
        normalized[gramsKey] = roundValue(grams);
      } else if (normalized[percentKey] == null && gramsValue != null) {
        const percent = (gramsValue * CALORIES_PER_GRAM[alias] * 100) / normalized.calories;
        normalized[percentKey] = roundValue(percent);
      }
    }
  }

  // Calculate default fiber values if both are missing (recommended 14g per 1000 calories)
  if (normalized.calories && normalized.calories > 0) {
    if (normalized.fiber_grams == null && normalized.fiber_percent == null) {
      normalized.fiber_grams = roundValue((normalized.calories / 1000) * 14);
      normalized.fiber_percent = roundValue((normalized.fiber_grams * CALORIES_PER_GRAM.fiber * 100) / normalized.calories);
    }
  }

  const hasAny = Object.values(normalized).some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return hasAny ? normalized : null;
};

const buildTargetReplacements = (macros) => {
  const replacements = {};
  if (!macros || typeof macros !== 'object') {
    throw new Error('Липсват таргет макроси за попълване на промпта.');
  }
  const missingFields = [];
  for (const [key, placeholders] of Object.entries(TARGET_MACRO_PLACEHOLDERS)) {
    const value = macros?.[key];
    if (!(typeof value === 'number' && Number.isFinite(value))) {
      missingFields.push(key);
      continue;
    }
    const stringified = String(value);
    const normalizedPlaceholders = Array.isArray(placeholders) ? placeholders : [placeholders];
    for (const placeholder of normalizedPlaceholders) {
      replacements[placeholder] = stringified;
    }
  }
  if (missingFields.length > 0) {
    throw new MissingTargetMacrosError(`Не са налични всички таргет макроси: ${missingFields.join(', ')}`, missingFields);
  }
  return replacements;
};

const mergeTargetMacroCandidates = (...candidates) => {
  const macroKeys = [
    'calories',
    'protein_grams',
    'carbs_grams',
    'fat_grams',
    'fiber_grams',
    'protein_percent',
    'carbs_percent',
    'fat_percent',
    'fiber_percent'
  ];
  const merged = Object.fromEntries(macroKeys.map((key) => [key, null]));
  let hasAny = false;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    for (const key of macroKeys) {
      if (merged[key] == null && candidate[key] != null) {
        merged[key] = candidate[key];
        hasAny = true;
      }
    }
  }

  return hasAny ? merged : null;
};

// Removed MAX_TARGET_MACRO_FIX_ATTEMPTS, buildTargetMacroFixPrompt, and resolveTargetMacrosWithPrompt
// These functions relied on the missing 'prompt_target_macros_fix' resource.
// Now using estimateMacros as the final fallback instead.
// estimateMacros calculates target macros based on user's weight, height, age, gender, and activity level
// using the Mifflin-St Jeor equation for BMR (Basal Metabolic Rate) and activity multipliers.
// This provides a reliable, instant, deterministic fallback when macros cannot be obtained from
// analysis results or previous plans.

const parsePossiblyStringifiedJson = (value) => {
  let current = value;
  let depth = 0;
  while (typeof current === 'string' && depth < 3) {
    const trimmed = current.trim();
    if (!trimmed) {
      return '';
    }
    if (!/^[\[{\"]/.test(trimmed)) {
      return current;
    }
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return current;
    }
    current = parsed;
    depth += 1;
  }
  return current;
};

const extractFirstString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = extractFirstString(item);
      if (result) return result;
    }
    return null;
  }
  if (typeof value === 'object') {
    const preferredKeys = ['name', 'label', 'title', 'id', 'type', 'profile'];
    for (const key of preferredKeys) {
      if (value[key]) {
        const result = extractFirstString(value[key]);
        if (result) return result;
      }
    }
    for (const nested of Object.values(value)) {
      const result = extractFirstString(nested);
      if (result) return result;
    }
  }
  return null;
};

const coerceConceptList = (value) => {
  const normalized = parsePossiblyStringifiedJson(value);
  if (!normalized) return [];
  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(normalized)) {
    return normalized
      .map((item) => extractFirstString(parsePossiblyStringifiedJson(item)))
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim());
  }
  if (typeof normalized === 'object') {
    const candidateKeys = ['concepts', 'items', 'list', 'values'];
    for (const key of candidateKeys) {
      if (normalized[key]) {
        const list = coerceConceptList(normalized[key]);
        if (list.length > 0) return list;
      }
    }
    const fallback = extractFirstString(normalized);
    return fallback ? [fallback] : [];
  }
  return [];
};

const PSYCHO_PROFILE_DOMINANT_KEYS = [
  'dominantPsychoProfile',
  'dominant_psycho_profile',
  'dominantProfile',
  'dominant_profile',
  'dominant',
  'primaryProfile',
  'primary_profile'
];

const PSYCHO_PROFILE_CONCEPT_KEYS = [
  'psychoProfileConcepts',
  'psycho_profile_concepts',
  'profileConcepts',
  'psychoConcepts',
  'concepts'
];

const extractPsychoProfileTexts = (rawValue) => {
  const parsed = parsePossiblyStringifiedJson(rawValue);
  if (!parsed) {
    return { dominant: null, concepts: [] };
  }
  if (typeof parsed === 'string') {
    const dominant = parsed.trim();
    return { dominant: dominant || null, concepts: [] };
  }
  if (typeof parsed !== 'object') {
    return { dominant: null, concepts: [] };
  }

  let dominant = null;
  for (const key of PSYCHO_PROFILE_DOMINANT_KEYS) {
    if (parsed[key]) {
      dominant = extractFirstString(parsed[key]);
      if (dominant) break;
    }
  }
  if (!dominant && parsed.profiles) {
    const profiles = parsed.profiles;
    if (profiles.dominant) {
      dominant = extractFirstString(profiles.dominant);
    }
    if (!dominant && profiles.primary) {
      dominant = extractFirstString(profiles.primary);
    }
    if (!dominant && Array.isArray(profiles)) {
      dominant = extractFirstString(profiles[0]);
    }
    if (!dominant && typeof profiles === 'object') {
      for (const value of Object.values(profiles)) {
        dominant = extractFirstString(value);
        if (dominant) break;
      }
    }
  }

  let concepts = [];
  for (const key of PSYCHO_PROFILE_CONCEPT_KEYS) {
    if (parsed[key]) {
      const list = coerceConceptList(parsed[key]);
      if (list.length > 0) {
        concepts = list;
        break;
      }
    }
  }
  if (concepts.length === 0 && parsed.profiles) {
    const profiles = parsed.profiles;
    const nestedConcepts = profiles?.dominant?.concepts || profiles?.primary?.concepts || profiles?.concepts;
    if (nestedConcepts) {
      concepts = coerceConceptList(nestedConcepts);
    }
  }

  return { dominant: dominant || null, concepts };
};

const roundValue = (value) => Math.round(Number.isFinite(value) ? value : 0);

const isCompleteMacroSet = (macros) => {
  if (!macros || typeof macros !== 'object') return false;
  const required = ['calories', 'protein_grams', 'carbs_grams', 'fat_grams', 'fiber_grams'];
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
  if (caloriesTotal <= 0 || totals.protein_grams + totals.carbs_grams + totals.fat_grams + totals.fiber_grams <= 0) {
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

/**
 * Връща датата във формат YYYY-MM-DD според локалната часова зона.
 * @param {Date} [date=new Date()] - Дата за форматиране.
 * @returns {string} Датата в локален формат.
 */
function getLocalDate(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}

/**
 * Връща датовата част (YYYY-MM-DD) от подадена стойност без да променя локалния ден.
 * Ако стойността е ISO низ с часови пояс, директно се извлича датата от него,
 * вместо да се преобразува към UTC, което би изместило деня.
 * @param {string|Date|number|null|undefined} value - Стойност за парсване.
 * @returns {string|null} Датата във формат YYYY-MM-DD или null при неуспех.
 */
function extractDatePortion(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split('T')[0];
}

// Рендериране на шаблони {{key}}
function renderTemplate(str, data = {}) {
  return String(str).replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : ''
  );
}

// Безопасно JSON парсване с логване при грешка
async function parseJsonSafe(resp, label = 'response') {
  try {
    return await resp.json();
  } catch {
    const bodyText = await resp.clone().text().catch(() => '[unavailable]');
    console.error(`Failed to parse JSON from ${label}:`, bodyText);
    throw new Error('Invalid JSON response');
  }
}

// Унифицирано изпращане на имейл
async function sendEmailUniversal(to, subject, body, env = {}) {
  const endpoint = env.MAILER_ENDPOINT_URL || globalThis['process']?.env?.MAILER_ENDPOINT_URL;
  const fromName = env.FROM_NAME || env.from_email_name || globalThis['process']?.env?.FROM_NAME;
  
  // Use provided signal or create new controller with timeout
  const providedSignal = env._abortSignal;
  let controller = null;
  let timeoutId = null;
  
  if (!providedSignal) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  }
  
  try {
    if (endpoint) {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message: body, body, fromName }),
        signal: providedSignal || controller.signal
      });
      
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Mailer responded with ${resp.status}${text ? `: ${text}` : ''}`);
      }
      return;
    }
    const phpUrl = env.MAIL_PHP_URL ||
      globalThis['process']?.env?.MAIL_PHP_URL ||
      DEFAULT_MAIL_PHP_URL;
    const phpEnv = {
      MAIL_PHP_URL: phpUrl,
      FROM_NAME: fromName,
      _abortSignal: providedSignal || controller.signal
    };
    await sendEmail(to, subject, body, phpEnv);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Email sending timeout after 10 seconds');
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const resourceCache = new Map();

const MAINTENANCE_MODE_KV_KEY = 'maintenance_mode';
const MAINTENANCE_PAGE_KV_KEY = 'maintenance_page';
const MAINTENANCE_MODE_CACHE_KEY = 'maintenance_mode_flag';
const MAINTENANCE_PAGE_CACHE_KEY = 'maintenance_page_html';
const MAINTENANCE_MODE_TTL_MS = 30000;
const MAINTENANCE_PAGE_TTL_MS = 60000;

async function getCachedResource(key, kv, ttlMs = 300000, kvKey = key) {
  const now = Date.now();
  const cached = resourceCache.get(key);
  if (cached) {
    if (cached.expiresAt > now && Object.prototype.hasOwnProperty.call(cached, 'value')) {
      return cached.value;
    }
    if (cached.promise) {
      return cached.promise;
    }
    resourceCache.delete(key);
  }
  if (!kv || typeof kv.get !== 'function') {
    return undefined;
  }
  const fetchPromise = (async () => {
    try {
      const value = await kv.get(kvKey);
      resourceCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } catch (error) {
      resourceCache.delete(key);
      throw error;
    }
  })();
  resourceCache.set(key, { promise: fetchPromise, expiresAt: now + ttlMs });
  return fetchPromise;
}

function clearResourceCache(keys) {
  if (!keys) {
    resourceCache.clear();
    return;
  }
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    resourceCache.delete(key);
  }
}

const WELCOME_SUBJECT = 'Добре дошъл в ONE BODY!';
const WELCOME_BODY_TEMPLATE = `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Вашият персонален анализ е готов!</title>
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Nunito+Sans:wght@400;700&display=swap" rel="stylesheet">
<!--<![endif]-->
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  table { border-collapse: collapse !important; }
  body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

  .ExternalClass { width: 100%; }
  .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }

  @media screen and (max-width: 600px) {
    .container { width: 100% !important; max-width: 100% !important; }
    .content { padding: 20px !important; }
    .header { padding: 30px 20px !important; }
  }
  .email-font { font-family: 'Inter', 'Nunito Sans', Arial, sans-serif; }
</style>
</head>
<body style="background-color: #f4f7f6; margin: 0 !important; padding: 0 !important;">

<!-- СКРИТ PREHEADER ТЕКСТ -->
<div class="email-font" style="display: none; font-size: 1px; color: #f4f7f6; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
  Създадохме Вашата персонална пътна карта към успеха. Вижте я сега!
</div>

<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="background-color: #f4f7f6;">
      <!--[if (gte mso 9)|(IE)]>
      <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
      <tr>
      <td align="center" valign="top" width="600">
      <![endif]-->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;" class="container">

        <!-- ЛОГО -->
        <tr>
          <td align="center" valign="top" style="padding: 40px 20px 30px 20px;" class="header">
            <!-- Заменете src с линк към вашето лого -->
            <img src="https://via.placeholder.com/200x50.png?text=Вашето+Лого" width="200" alt="Лого на компанията" class="email-font" style="display: block; width: 200px; max-width: 200px; min-width: 200px; color: #2C3E50; font-size: 24px; font-weight: bold;">
          </td>
        </tr>

        <!-- ОСНОВНО СЪДЪРЖАНИЕ -->
        <tr>
          <td align="center" style="padding: 0 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(44, 62, 80, 0.1);">
              <tr>
                <td align="center" style="padding: 40px 30px;" class="content">

                  <!-- ЗАГЛАВИЕ -->
                  <h1 class="email-font" style="font-size: 28px; font-weight: 700; color: #2C3E50; margin: 0 0 20px 0;">Добре дошли в ONE BODY!</h1>

                  <!-- ТЕКСТ -->
                  <p class="email-font" style="font-size: 16px; line-height: 1.7; color: #333333; margin: 0 0 15px 0;">
                    Здравейте, <strong>{{name}}</strong>,
                  </p>
                  <p class="email-font" style="font-size: 16px; line-height: 1.7; color: #333333; margin: 0 0 30px 0;">
                    Благодарим Ви, че се присъединихте към <strong>ONE BODY</strong>. Започнете своя път към по-здравословен и балансиран начин на живот още сега.
                  </p>

                  <!-- БУТОН (CTA) -->
                  <table border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="border-radius: 50px; background: linear-gradient(135deg, #4A90E2 0%, #50E3C2 100%);">
                        <a href="https://radilovk.github.io/bodybest/quest.html" target="_blank" class="email-font" style="font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 50px; padding: 18px 40px; border: 1px solid #4A90E2; display: inline-block;">Попълнете въпросника</a>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ФУТЪР -->
        <tr>
          <td align="center" style="padding: 30px 20px;">
            <p class="email-font" style="font-size: 12px; line-height: 1.5; color: #777777; margin: 0;">
              Получавате този имейл, защото сте се регистрирали на нашия сайт.
              <br><br>
              © {{current_year}} Your Wellness Company. Всички права запазени.<br>
              гр. София, ул. "Примерна" 123
            </p>
          </td>
        </tr>

      </table>
      <!--[if (gte mso 9)|(IE)]>
      </td>
      </tr>
      </table>
      <![endif]-->
    </td>
  </tr>
</table>

</body>
</html>`;


const ANALYSIS_READY_SUBJECT = 'Вашият персонален анализ е готов';
const ANALYSIS_READY_BODY_TEMPLATE = '<p>Здравей, {{name}}.</p>' +
    '<p>Благодарим ти, че попълни въпросника. Изготвихме първоначален анализ въз основа на отговорите ти. Можеш да го разгледаш <a href="{{link}}">тук</a>.</p>' +
    '<p>Ще използваме резултатите, за да финализираме персоналния ти план.</p>' +
    '<p>– Екипът на ONE BODY</p>';
const ANALYSIS_PAGE_URL_VAR_NAME = 'ANALYSIS_PAGE_URL';
const PASSWORD_RESET_SUBJECT = 'Смяна на парола';
const PASSWORD_RESET_BODY_TEMPLATE = '<p>За да зададете нова парола, използвайте <a href="{{link}}">този линк</a>. Линкът е валиден 1 час.</p>';
const PASSWORD_RESET_EMAIL_SUBJECT_VAR_NAME = 'PASSWORD_RESET_EMAIL_SUBJECT';
const PASSWORD_RESET_EMAIL_BODY_VAR_NAME = 'PASSWORD_RESET_EMAIL_BODY';
const PASSWORD_RESET_PAGE_URL_VAR_NAME = 'PASSWORD_RESET_PAGE_URL';

async function getEmailConfig(kind, env, defaults = {}) {
    const kv = env.RESOURCES_KV;
    const read = async key => {
        let val = env?.[key] ?? env?.[key.toUpperCase()] ?? env?.[key.toLowerCase()];
        if (val === undefined && kv) {
            try { val = await kv.get(key.toLowerCase()); } catch { val = undefined; }
        }
        return val;
    };
    let send = await read(`send_${kind}_email`);
    if (send === undefined || send === null) send = defaults.send;
    let subject = await read(`${kind}_email_subject`);
    if (!subject) subject = defaults.subject;
    let tpl = await read(`${kind}_email_body`);
    if (!tpl) tpl = defaults.tpl;
    const extras = {};
    const extraDefs = defaults.extras || {};
    for (const [key, defVal] of Object.entries(extraDefs)) {
        let val = await read(key);
        extras[key] = val ?? defVal;
    }
    return { send, subject, tpl, extras };
}

async function sendWelcomeEmail(to, name, env) {
    const html = renderTemplate(WELCOME_BODY_TEMPLATE, {
        name,
        current_year: new Date().getFullYear()
    });
    try {
        await sendEmailUniversal(to, WELCOME_SUBJECT, html, env);
    } catch (err) {
        console.error('Failed to send welcome email:', err);
    }
}

async function sendAnalysisLinkEmail(to, name, link, env) {
    const { send, subject, tpl } = await getEmailConfig('analysis', env, {
        send: '1',
        subject: ANALYSIS_READY_SUBJECT,
        tpl: ANALYSIS_READY_BODY_TEMPLATE
    });
    if (send === '0' || send === 'false') return false;
    if (!tpl.includes('{{name}}')) {
        console.warn('ANALYSIS_EMAIL_BODY missing {{name}} placeholder');
    }
    if (!tpl.includes('{{link}}')) {
        console.warn('ANALYSIS_EMAIL_BODY missing {{link}} placeholder');
    }
    const html = renderTemplate(tpl, { name, link });
    try {
        await sendEmailUniversal(to, subject, html, env);
        return true;
    } catch (err) {
        console.error('Failed to send analysis link email:', err);
        return false;
    }
}

async function sendContactEmail(to, name, env) {
    const { send, subject, tpl, extras } = await getEmailConfig('contact', env, {
        send: '1',
        subject: 'Благодарим за връзката',
        tpl: 'Получихме вашето съобщение от {{form_label}}.',
        extras: { contact_form_label: 'форма за контакт' }
    });
    if (send === '0' || send === 'false') return;
    const formLabel = extras.contact_form_label;
    const html = renderTemplate(tpl, { name, form_label: formLabel });
    try {
        await sendEmailUniversal(to, subject, html, env);
    } catch (err) {
        console.error('Failed to send contact email:', err);
    }
}

async function sendPasswordResetEmail(to, token, env) {
    const subject = env?.[PASSWORD_RESET_EMAIL_SUBJECT_VAR_NAME] || PASSWORD_RESET_SUBJECT;
    const tpl = env?.[PASSWORD_RESET_EMAIL_BODY_VAR_NAME] || PASSWORD_RESET_BODY_TEMPLATE;
    const base = env?.[PASSWORD_RESET_PAGE_URL_VAR_NAME] || 'https://radilovk.github.io/bodybest/reset-password.html';
    const url = new URL(base);
    url.searchParams.set('token', token);
    const html = renderTemplate(tpl, { link: url.toString() });
    try {
        await sendEmailUniversal(to, subject, html, env);
    } catch (err) {
        console.error('Failed to send password reset email:', err);
    }
}

// ------------- START BLOCK: GlobalConstantsAndBindings -------------
const GEMINI_API_KEY_SECRET_NAME = 'GEMINI_API_KEY';
const OPENAI_API_KEY_SECRET_NAME = 'OPENAI_API_KEY';
const COMMAND_R_PLUS_SECRET_NAME = 'command-r-plus';
const CF_AI_TOKEN_SECRET_NAME = 'CF_AI_TOKEN';
const CF_ACCOUNT_ID_VAR_NAME = 'CF_ACCOUNT_ID';
const WORKER_ADMIN_TOKEN_SECRET_NAME = 'WORKER_ADMIN_TOKEN';
const AI_PRESET_INDEX_KEY = 'aiPreset_index';
let aiPresetIndexCache = null;
let aiPresetIndexCacheTime = 0;
const AI_PRESET_INDEX_TTL_MS = 5 * 60 * 1000;

const GEMINI_API_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/`;
// Очаквани Bindings: RESOURCES_KV, USER_METADATA_KV

const DEFAULT_MAX_CHAT_HISTORY_MESSAGES = 30;
const CHAT_CONTEXT_VERSION = 1;
const CHAT_CONTEXT_TTL_MS = 12 * 60 * 60 * 1000; // 12 часа валидност
const PRINCIPLE_UPDATE_INTERVAL_DAYS = 7; // За ръчна актуализация на принципи, ако адаптивният не ги е променил
const USER_ACTIVITY_LOG_LOOKBACK_DAYS = 10;
const USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS = 7;
const USER_ACTIVITY_LOG_LIST_LIMIT = 100;
const MAX_ANALYTICS_PERIOD_DAYS = 365; // Maximum period for analytics (1 year)
const RECENT_CHAT_MESSAGES_FOR_PRINCIPLES = 10;

// Plan modification constants
const PLAN_MOD_REQUEST_MAX_LENGTH = 500; // Maximum length to store in metadata
const PLAN_MOD_PROTEIN_MULTIPLIER = 1.2; // Multiplier for "more protein" example
const PLAN_MOD_DEFAULT_PROTEIN_GRAMS = 100; // Default protein baseline for examples
const PLAN_MOD_AI_TEMPERATURE = 0.7; // Higher temperature for creative meal generation
const PLAN_MOD_AI_MAX_TOKENS = 4000; // Enough tokens for full meal plans
const PLAN_MOD_DECISION_TEMPERATURE = 0.3; // Lower temperature for decision-making
const PLAN_MOD_DECISION_MAX_TOKENS = 500; // Limited tokens for decision response
const PLAN_MOD_PLAN_SUMMARY_FOOD_LIMIT = 15; // Number of foods to include in plan summary
const PLAN_MOD_EXCLUDED_RESPONSE_KEYS = ['textDescription', 'requiresFullRegeneration', 'reasoning']; // Keys to exclude from changeKeys

const callModelRef = { current: null };

async function getMaxChatHistoryMessages(env) {
    let val = env.MAX_CHAT_HISTORY_MESSAGES;
    if (val === undefined && env.RESOURCES_KV) {
        val = await getCachedResource('MAX_CHAT_HISTORY_MESSAGES', env.RESOURCES_KV);
    }
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHAT_HISTORY_MESSAGES;
}

async function summarizeAndTrimChatHistory(history, env, maxMessages) {
    if (history.length <= maxMessages) return history;
    try {
        const hasSummary = history[0]?.summary === true;
        const existingSummary = hasSummary ? history[0].parts?.[0]?.text || '' : '';
        const startIdx = hasSummary ? 1 : 0;
        const summarizable = history.slice(startIdx, history.length - (maxMessages - 1));
        if (summarizable.length === 0) {
            return history.slice(-maxMessages);
        }
        const textBlock = (existingSummary ? `${existingSummary}\n` : '') +
            summarizable.map(m => `${m.role === 'model' ? 'АСИСТЕНТ' : 'ПОТРЕБИТЕЛ'}: ${m.parts?.[0]?.text || ''}`).join('\n');
        const tpl = env.RESOURCES_KV ? await getCachedResource('prompt_chat_summary', env.RESOURCES_KV) : undefined;
        const prompt = tpl ? tpl.replace('%%CHAT_HISTORY%%', textBlock)
            : `Резюмирай накратко на български следния чат между потребител и асистент:\n${textBlock}\nКратко резюме:`;
        const model = env.RESOURCES_KV
            ? (await getCachedResource('model_chat_summary', env.RESOURCES_KV) || await getCachedResource('model_chat', env.RESOURCES_KV))
            : undefined;
        if (!model) {
            console.warn('CHAT_SUMMARY_WARN: Missing summary model, trimming without summarizing.');
            return history.slice(-maxMessages);
        }
        const summaryText = await callModelRef.current(model, prompt, env, { temperature: 0.3, maxTokens: 200 });
        const recent = history.slice(-(maxMessages - 1));
        return [{ role: 'system', parts: [{ text: summaryText.trim() }], summary: true }, ...recent];
    } catch (err) {
        console.error('CHAT_SUMMARY_ERROR:', err);
        return history.slice(-maxMessages);
    }
}

const AUTOMATED_FEEDBACK_TRIGGER_DAYS = 3; // След толкова дни предлагаме автоматичен чат
const PRAISE_INTERVAL_DAYS = 3; // Интервал за нова похвала/значка
const MEDAL_ICONS = [
    '🥇',
    '🥈',
    '🥉',
    '🏅',
    '🏆',
    '🎖️',
    '🌟',
    '✨'
];
const AI_CONFIG_KEYS = [
    'model_plan_generation',
    'model_chat',
    'model_principle_adjustment',
    'model_image_analysis',
    'prompt_image_analysis',
    'model_questionnaire_analysis',
    'prompt_questionnaire_analysis',
    'prompt_unified_plan_generation_v2',
    'plan_token_limit',
    'plan_temperature',
    'prompt_chat',
    'chat_token_limit',
    'chat_temperature',
    'prompt_plan_modification',
    'mod_token_limit',
    'mod_temperature',
    'image_token_limit',
    'image_temperature',
    'welcome_email_subject',
    'welcome_email_body',
    'questionnaire_email_subject',
    'questionnaire_email_body',
    'contact_email_subject',
    'contact_email_body',
    'contact_form_label',
    'analysis_email_subject',
    'analysis_email_body',
    'from_email_name',
    'send_welcome_email',
    'send_contact_email',
    'send_analysis_email',
    'send_questionnaire_email',
    'colors'
];
const MAINTENANCE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="bg">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ONE BODY – Поддръжка</title>
</head>
<body><h1>В момента обновяваме сайта</h1><p>Опитайте отново след малко.</p></body>
</html>`;
// ------------- END BLOCK: GlobalConstantsAndBindings -------------

// ------------- START BLOCK: HelperFunctions -------------
/**
 * Генерира стандартен JSON отговор с правилен статус.
 * @param {Object} body
 * @param {number} [defaultStatus=200]
 * @returns {{status:number, body:string, headers:Object}}
 */
function makeJsonResponse(body, defaultStatus = 200) {
    let status = defaultStatus;
    if (body && body.statusHint !== undefined) {
        status = body.statusHint;
        delete body.statusHint;
    } else if (body && body.success === false) {
        status = 400;
    }
    return {
        status,
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    };
}
// ------------- END BLOCK: HelperFunctions -------------

// ------------- START BLOCK: MainWorkerExport -------------
export default {
    // ------------- START FUNCTION: fetch -------------
    /**
     * Главна точка на Cloudflare Worker-а. Разпределя заявките към
     * съответните REST обработчици.
     * @param {Request} request
     * @param {Object} env
     * @param {ExecutionContext} ctx
     * @returns {Promise<Response>}
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // Debug logging removed for production (previously used X-Debug header)

        const defaultAllowedOrigins = [
            'https://onebody.top',
            'https://radilovk.github.io',
            'https://radilov-k.github.io',
            'http://localhost:5173',
            'http://localhost:3000',
            'null' // за отваряне през file://
        ];
        const allowedOrigins = Array.from(new Set(
            (env.ALLOWED_ORIGINS
                ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
                : [])
                .concat(defaultAllowedOrigins)
        ));
        const requestOrigin = request.headers.get('Origin');
        const originToSend = requestOrigin === null
            ? 'null'
            : allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
        const corsHeaders = {
            'Access-Control-Allow-Origin': originToSend,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
        };

        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const kvFlag = env.RESOURCES_KV
            ? await getCachedResource(
                MAINTENANCE_MODE_CACHE_KEY,
                env.RESOURCES_KV,
                MAINTENANCE_MODE_TTL_MS,
                MAINTENANCE_MODE_KV_KEY
            )
            : null;
        const skipPaths = new Set([
            '/admin.html',
            '/js/admin.js',
            '/js/maintenanceMode.js',
            '/api/getMaintenanceMode',
            '/api/setMaintenanceMode'
        ]);
        if (env.MAINTENANCE_MODE === '1' || kvFlag === '1') {
            if (!skipPaths.has(path)) {
                const maint = env.RESOURCES_KV
                    ? await getCachedResource(
                        MAINTENANCE_PAGE_CACHE_KEY,
                        env.RESOURCES_KV,
                        MAINTENANCE_PAGE_TTL_MS,
                        MAINTENANCE_PAGE_KV_KEY
                    )
                    : null;
                const html = maint || MAINTENANCE_FALLBACK_HTML;
                return new Response(html, {
                    status: 503,
                    headers: { ...corsHeaders, 'Content-Type': 'text/html' }
                });
            }
        }

        let responseBody = {};
        let responseStatus = 200;

        try {
            if (method === 'POST' && path === '/api/register') {
                responseBody = await handleRegisterRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/registerDemo') {
                responseBody = await handleRegisterDemoRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/login') {
                 responseBody = await handleLoginRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitQuestionnaire') {
               responseBody = await handleSubmitQuestionnaire(request, env, ctx);
            } else if (method === 'POST' && path === '/api/submitDemoQuestionnaire') {
               responseBody = await handleSubmitDemoQuestionnaire(request, env, ctx);
            } else if (method === 'POST' && path === '/api/reAnalyzeQuestionnaire') {
                responseBody = await handleReAnalyzeQuestionnaireRequest(request, env, ctx);
            } else if (method === 'GET' && path === '/api/planStatus') {
                responseBody = await handlePlanStatusRequest(request, env);
            } else if (method === 'GET' && path === '/api/planLog') {
                responseBody = await handlePlanLogRequest(request, env);
            } else if (method === 'GET' && path === '/api/checkPlanPrerequisites') {
                responseBody = await handleCheckPlanPrerequisitesRequest(request, env);
            } else if (method === 'GET' && path === '/api/analysisStatus') {
                responseBody = await handleAnalysisStatusRequest(request, env);
            } else if (method === 'GET' && path === '/api/dashboardData') {
                responseBody = await handleDashboardDataRequest(request, env);
            } else if (method === 'POST' && path === '/api/log') {
                responseBody = await handleLogRequest(request, env);
            } else if (method === 'POST' && path === '/api/batch-log') {
                responseBody = await handleBatchLogRequest(request, env);
            } else if (method === 'POST' && path === '/api/regeneratePlan') {
                responseBody = await handleRegeneratePlanRequest(request, env, ctx);
            } else if (method === 'POST' && path === '/api/updateStatus') {
                responseBody = await handleUpdateStatusRequest(request, env);
            } else if (method === 'POST' && path === '/api/chat') {
                responseBody = await handleChatRequest(request, env);
            } else if (method === 'POST' && path === '/api/generateMealAlternatives') {
                responseBody = await handleGenerateMealAlternativesRequest(request, env);
            } else if (method === 'POST' && path === '/api/log-extra-meal') { // Имплементиран
                 responseBody = await handleLogExtraMealRequest(request, env);
            } else if (method === 'POST' && path === '/api/uploadTestResult') {
                responseBody = await handleUploadTestResult(request, env);
            } else if (method === 'POST' && path === '/api/uploadIrisDiag') {
                responseBody = await handleUploadIrisDiag(request, env);
            } else if (method === 'GET' && path === '/api/getProfile') {
                responseBody = await handleGetProfileRequest(request, env);
            } else if (method === 'GET' && path === '/api/getPsychTests') {
                responseBody = await handleGetPsychTestsRequest(request, env);
            } else if (method === 'POST' && path === '/api/updateProfile') {
                responseBody = await handleUpdateProfileRequest(request, env);
            } else if (method === 'POST' && path === '/api/savePsychTests') {
                responseBody = await handleSavePsychTestsRequest(request, env);
            } else if (method === 'POST' && path === '/api/applyPsychometricAdaptation') {
                responseBody = await handleApplyPsychometricAdaptationRequest(request, env);
            } else if (method === 'POST' && path === '/api/updatePlanData') {
                responseBody = await handleUpdatePlanRequest(request, env);
            } else if (method === 'POST' && path === '/api/requestPasswordReset') {
                responseBody = await handleRequestPasswordReset(request, env);
                if (responseBody.statusHint) { responseStatus = responseBody.statusHint; }
            } else if (method === 'POST' && path === '/api/performPasswordReset') {
                responseBody = await handlePerformPasswordReset(request, env);
                if (responseBody.statusHint) { responseStatus = responseBody.statusHint; }
            } else if (method === 'POST' && path === '/api/acknowledgeAiUpdate') { // НОВ ендпойнт
                responseBody = await handleAcknowledgeAiUpdateRequest(request, env);
            } else if (method === 'POST' && path === '/api/recordFeedbackChat') {
                responseBody = await handleRecordFeedbackChatRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitFeedback') {
                responseBody = await handleSubmitFeedbackRequest(request, env);
            } else if (method === 'GET' && path === '/api/getAchievements') {
                responseBody = await handleGetAchievementsRequest(request, env);
            } else if (method === 'POST' && path === '/api/generatePraise') {
                responseBody = await handleGeneratePraiseRequest(request, env);
            } else if (method === 'GET' && path === '/api/getInitialAnalysis') {
                responseBody = await handleGetInitialAnalysisRequest(request, env);
            } else if (method === 'GET' && path === '/api/getPlanModificationPrompt') {
                responseBody = await handleGetPlanModificationPrompt(request, env);
            } else if (method === 'POST' && path === '/api/aiHelper') {
                responseBody = await handleAiHelperRequest(request, env);
            } else if (method === 'POST' && path === '/api/analyzeImage') {
                responseBody = await handleAnalyzeImageRequest(request, env);
            } else if (path === '/api/runImageModel') {
                if (method !== 'POST') {
                    responseBody = { success: false, message: 'Method Not Allowed' };
                    responseStatus = 405;
                } else {
                    responseBody = await handleRunImageModelRequest(request, env);
                }
            } else if (method === 'GET' && path === '/api/listClients') {
                responseBody = await handleListClientsRequest(request, env);
            } else if (method === 'GET' && path === '/api/peekAdminNotifications') {
                responseBody = await handlePeekAdminNotificationsRequest(request, env);
            } else if (method === 'POST' && path === '/api/deleteClient') {
                responseBody = await handleDeleteClientRequest(request, env);
            } else if (method === 'POST' && path === '/api/addAdminQuery') {
                responseBody = await handleAddAdminQueryRequest(request, env);
            } else if (method === 'GET' && path === '/api/getAdminQueries') {
                responseBody = await handleGetAdminQueriesRequest(request, env);
            } else if (method === 'GET' && path === '/api/peekAdminQueries') {
                responseBody = await handleGetAdminQueriesRequest(request, env, true);
            } else if (method === 'POST' && path === '/api/addClientReply') {
                responseBody = await handleAddClientReplyRequest(request, env);
            } else if (method === 'GET' && path === '/api/getClientReplies') {
                responseBody = await handleGetClientRepliesRequest(request, env);
            } else if (method === 'GET' && path === '/api/peekClientReplies') {
                responseBody = await handleGetClientRepliesRequest(request, env, true);
            } else if (method === 'GET' && path === '/api/getAiConfig') {
                responseBody = await handleGetAiConfig(request, env);
            } else if (method === 'POST' && path === '/api/setAiConfig') {
                responseBody = await handleSetAiConfig(request, env);
            } else if (method === 'GET' && path === '/api/listAiPresets') {
                responseBody = await handleListAiPresets(request, env);
            } else if (method === 'GET' && path === '/api/getAiPreset') {
                responseBody = await handleGetAiPreset(request, env);
            } else if (method === 'POST' && path === '/api/saveAiPreset') {
                responseBody = await handleSaveAiPreset(request, env);
            } else if (method === 'POST' && path === '/api/deleteAiPreset') {
                responseBody = await handleDeleteAiPreset(request, env);
            } else if (method === 'POST' && path === '/api/testAiModel') {
                responseBody = await handleTestAiModelRequest(request, env);
            } else if (method === 'GET' && path === '/api/listContactRequests') {
                responseBody = await handleGetContactRequestsRequest(request, env);
            } else if (method === 'POST' && path === '/api/contact') {
                responseBody = await handleContactFormRequest(request, env);
            } else if (method === 'POST' && path === '/api/sendTestEmail') {
                responseBody = await handleSendTestEmailRequest(request, env);
            } else if (method === 'GET' && path === '/api/getMaintenanceMode') {
                responseBody = await handleGetMaintenanceMode(request, env);
            } else if (method === 'POST' && path === '/api/setMaintenanceMode') {
                responseBody = await handleSetMaintenanceMode(request, env);
            } else if (method === 'GET' && path === '/api/getFeedbackMessages') {
                responseBody = await handleGetFeedbackMessagesRequest(request, env);
            } else if (method === 'GET' && path === '/api/listUserKv') {
                responseBody = await handleListUserKvRequest(request, env);
            } else if (method === 'POST' && path === '/api/updateKv') {
                responseBody = await handleUpdateKvRequest(request, env);
            } else if (method === 'POST' && path === '/api/submitPlanChangeRequest') {
                responseBody = await handleSubmitPlanChangeRequest(request, env);
            } else if (method === 'POST' && path === '/api/proposePlanChange') {
                responseBody = await handleProposePlanChangeRequest(request, env);
            } else if (method === 'POST' && path === '/api/approvePlanChange') {
                responseBody = await handleApprovePlanChangeRequest(request, env);
            } else if (method === 'GET' && path === '/api/getPendingPlanChanges') {
                responseBody = await handleGetPendingPlanChangesRequest(request, env);
            } else if (method === 'POST' && path === '/api/rejectPlanChange') {
                responseBody = await handleRejectPlanChangeRequest(request, env);
            } else if (method === 'POST' && path === '/api/deletePlanChangeNotification') {
                responseBody = await handleDeletePlanChangeNotificationRequest(request, env);
            } else if (method === 'POST' && path === '/nutrient-lookup') {
                responseBody = await handleNutrientLookupRequest(request, env);
            } else {
                responseBody = { success: false, error: 'Not Found', message: 'Ресурсът не е намерен.' };
                responseStatus = 404;
            }


        } catch (error) {
             console.error(`!!! Worker Uncaught Error in fetch handler for ${method} ${path}:`, error);
             responseBody = { success: false, error: 'Internal Server Error', message: 'Възникна неочаквана вътрешна грешка.' };
             responseStatus = 500;
             if (error.stack) { console.error("Error Stack:", error.stack); }
        }

        const { status, body, headers } = makeJsonResponse(responseBody, responseStatus);
        return new Response(body, {
            status,
            headers: { ...headers, ...corsHeaders }
        });
    },
    // ------------- END FUNCTION: fetch -------------

    // ------------- START FUNCTION: scheduled -------------
    async scheduled(event, env, ctx) {
        // CRON trigger execution
        if (!env.USER_METADATA_KV) {
            console.error("[CRON] USER_METADATA_KV binding missing. Check configuration.");
            return;
        }

        let processedUsersForPlan = 0;
        let processedUsersForPrinciples = 0;
        let processedUserEvents = 0;
        const MAX_PROCESS_PER_RUN_PLAN_GEN = parseInt(env.MAX_PROCESS_PER_RUN_PLAN_GEN || '1', 10);
        const MAX_PROCESS_PER_RUN_PRINCIPLES = parseInt(env.MAX_PROCESS_PER_RUN_PRINCIPLES || '2', 10);

        const planGenStart = Date.now();
        let planGenDuration = 0;
        let userEventsDuration = 0;
        let principlesDuration = 0;

        try {
            // --- 1. Обработка на генериране на първоначален план ---
            const pendingStr = await env.USER_METADATA_KV.get('pending_plan_users');
            let pendingUsers = safeParseJson(pendingStr, []);
            if (!Array.isArray(pendingUsers)) pendingUsers = [];
            const toProcessPlan = pendingUsers.slice(0, MAX_PROCESS_PER_RUN_PLAN_GEN);
            let remainingPending = pendingUsers.slice(MAX_PROCESS_PER_RUN_PLAN_GEN);
            for (const userId of toProcessPlan) {
                const initialAnswers = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
                if (!initialAnswers) {
                    await setPlanStatus(userId, 'pending_inputs', env);
                    // Missing initial answers, skip user
                    continue;
                }
                await setPlanStatus(userId, 'processing', env);
                // Execute synchronously to avoid "IoContext timed out" errors
                try {
                    await processSingleUserPlan(userId, env);
                    processedUsersForPlan++; // Count only successful generations
                } catch (err) {
                    console.error(`[CRON-PlanGen] Plan generation failed for ${userId}: ${err.message}\n${err.stack}`);
                    try {
                        await setPlanStatus(userId, 'error', env);
                        await env.USER_METADATA_KV.put(`${userId}_processing_error`, 
                            `Грешка при генериране на план: ${err.message}`);
                    } catch (statusErr) {
                        console.error(`[CRON-PlanGen] Failed to set error status for ${userId}:`, statusErr);
                    }
                }
            }
            const pendingUsersJson = JSON.stringify(pendingUsers);
            const remainingPendingJson = JSON.stringify(remainingPending);
            if (remainingPendingJson !== pendingUsersJson) {
                await env.USER_METADATA_KV.put('pending_plan_users', remainingPendingJson);
            }
            // Plan generation complete

            planGenDuration = Date.now() - planGenStart;

            const userEventsStart = Date.now();
            processedUserEvents = await processPendingUserEvents(env, ctx);
            userEventsDuration = Date.now() - userEventsStart;

            // --- 2. Обработка на актуализация на принципи (ръчна/стандартна) ---
            const readyStr = await env.USER_METADATA_KV.get('ready_plan_users');
            let readyUsers = safeParseJson(readyStr, []);
            if (!Array.isArray(readyUsers)) readyUsers = [];
            const toProcessReady = readyUsers.slice(0, MAX_PROCESS_PER_RUN_PRINCIPLES);
            let remainingReady = readyUsers.slice(MAX_PROCESS_PER_RUN_PRINCIPLES);

            const principlesStart = Date.now();
            for (const userId of toProcessReady) {
                const lastActiveStr = await env.USER_METADATA_KV.get(`${userId}_lastActive`);
                const lastActiveDate = lastActiveStr ? new Date(lastActiveStr) : null;
                const inactive = !lastActiveDate || ((Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24) > USER_ACTIVITY_LOG_LOOKBACK_DAYS);
                if (inactive) { remainingReady.push(userId); continue; }

                const lastUpdateTsStrForPrinciples = await env.USER_METADATA_KV.get(`${userId}_last_significant_update_ts`);
                const lastUpdateTsForPrinciples = lastUpdateTsStrForPrinciples ? parseInt(lastUpdateTsStrForPrinciples, 10) : 0;
                const daysSinceLastPrincipleUpdate = (Date.now() - lastUpdateTsForPrinciples) / (1000 * 60 * 60 * 24);

                if (daysSinceLastPrincipleUpdate >= PRINCIPLE_UPDATE_INTERVAL_DAYS) {
                    // User due for standard principle update
                    ctx.waitUntil(handlePrincipleAdjustment(userId, env));
                    processedUsersForPrinciples++;
                } else {
                    remainingReady.push(userId);
                }
            }
            const readyUsersJson = JSON.stringify(readyUsers);
            const remainingReadyJson = JSON.stringify(remainingReady);
            if (remainingReadyJson !== readyUsersJson) {
                await env.USER_METADATA_KV.put('ready_plan_users', remainingReadyJson);
            }
            // Principles update complete

            principlesDuration = Date.now() - principlesStart;

        } catch(error) {
            console.error(`[CRON] Error during scheduled execution: ${error.message}\n${error.stack}`);
        }

        const metrics = {
            ts: new Date(event.scheduledTime).toISOString(),
            planProcessed: processedUsersForPlan,
            planMs: planGenDuration,
            eventsProcessed: processedUserEvents,
            eventsMs: userEventsDuration,
            principlesProcessed: processedUsersForPrinciples,
            principlesMs: principlesDuration
        };
        const hasActivity =
            metrics.planProcessed > 0 ||
            metrics.eventsProcessed > 0 ||
            metrics.principlesProcessed > 0;
        if (hasActivity) {
            const metricsDate = getLocalDate(new Date(event.scheduledTime));
            const metricsKey = `cron_metrics_${metricsDate}`;
            try {
                const existingMetricsStr = await env.USER_METADATA_KV.get(metricsKey);
                const existingMetrics = existingMetricsStr
                    ? safeParseJson(existingMetricsStr, {})
                    : {};
                const aggregatedMetrics = {
                    date: metricsDate,
                    runs: Number(existingMetrics?.runs || 0) + 1,
                    planProcessed: Number(existingMetrics?.planProcessed || 0) + metrics.planProcessed,
                    planMs: Number(existingMetrics?.planMs || 0) + metrics.planMs,
                    eventsProcessed: Number(existingMetrics?.eventsProcessed || 0) + metrics.eventsProcessed,
                    eventsMs: Number(existingMetrics?.eventsMs || 0) + metrics.eventsMs,
                    principlesProcessed: Number(existingMetrics?.principlesProcessed || 0) + metrics.principlesProcessed,
                    principlesMs: Number(existingMetrics?.principlesMs || 0) + metrics.principlesMs,
                    lastTs: metrics.ts
                };
                await env.USER_METADATA_KV.put(metricsKey, JSON.stringify(aggregatedMetrics));
            } catch(storeErr) {
                console.error("[CRON] Failed to store metrics:", storeErr.message);
            }
        } else {
            // No activity detected
        }
        // CRON trigger finished
    }
    // ------------- END FUNCTION: scheduled -------------
};
// ------------- END BLOCK: MainWorkerExport -------------


// ------------- START BLOCK: ApiHandlersHeaderComment -------------
// ===============================================
// ХЕНДЛЪРИ ЗА API ENDPOINTS
// ===============================================
// ------------- END BLOCK: ApiHandlersHeaderComment -------------

// ------------- START FUNCTION: handleRegisterRequest -------------
/**
 * Създава нов потребител и записва данните му чрез PHP API.
 * @param {Request} request
 * @param {Object} env - Обект с environment променливи и KV връзки.
 * @returns {Promise<Object>} Резултат от операцията.
 */
async function handleRegisterRequest(request, env, ctx) {
     try {
        const { email, password, confirm_password } = await request.json();
        const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
        if (!trimmedEmail || !password || !confirm_password) { return { success: false, message: 'Имейл и парола са задължителни.', statusHint: 400 }; }
        if (password.length < 8) { return { success: false, message: 'Паролата трябва да е поне 8 знака.', statusHint: 400 }; }
        if (password !== confirm_password) { return { success: false, message: 'Паролите не съвпадат.', statusHint: 400 }; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { return { success: false, message: 'Невалиден имейл формат.', statusHint: 400 }; }
        const previousUserId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
        if (previousUserId) {
            // Email was previously linked, overwriting with new account
        }
        const userId = crypto.randomUUID();
        const hashedPasswordWithSalt = await hashPassword(password);
        const credentialContent = JSON.stringify({ userId, email: trimmedEmail, passwordHash: hashedPasswordWithSalt });
        await env.USER_METADATA_KV.put(`credential_${userId}`, credentialContent);
        await env.USER_METADATA_KV.put(`email_to_uuid_${trimmedEmail}`, userId);
        await setPlanStatus(userId, 'pending_inputs', env);

        const existingIdsStr = await env.USER_METADATA_KV.get('all_user_ids');
        let existingIds = safeParseJson(existingIdsStr, []);
        if (!existingIds.includes(userId)) {
            existingIds.push(userId);
            await env.USER_METADATA_KV.put('all_user_ids', JSON.stringify(existingIds));
        }

        let sendVal = env.SEND_WELCOME_EMAIL;
        if (sendVal === undefined && env.RESOURCES_KV) {
            try { sendVal = await env.RESOURCES_KV.get('send_welcome_email'); } catch {}
        }
        const skipWelcome = sendVal === '0' || String(sendVal).toLowerCase() === 'false';
        if (!skipWelcome) {
            const emailTask = sendWelcomeEmail(trimmedEmail, userId, env);
            if (ctx) {
                ctx.waitUntil(emailTask);
            } else {
                // Email is sent in background; errors are logged but don't block registration
                emailTask.catch(err => console.error('Failed to send welcome email:', err));
            }
        }
        return { success: true, message: 'Регистрацията успешна!' };
     } catch (error) {
        console.error(`Error in handleRegisterRequest: ${error.message}\n${error.stack}`);
        let userMessage = 'Вътрешна грешка при регистрация.';
        if (error.message.includes('Failed to fetch')) userMessage = 'Грешка при свързване със сървъра.';
        else if (error instanceof SyntaxError) userMessage = 'Грешка в отговора от сървъра.';
        return { success: false, message: userMessage, statusHint: 500 };
     }
}
// ------------- END FUNCTION: handleRegisterRequest -------------

// ------------- START FUNCTION: handleRegisterDemoRequest -------------
/**
 * Регистрира потребител в демо режим.
 * Идентична на handleRegisterRequest, но статусът на плана се задава на 'demo'.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
async function handleRegisterDemoRequest(request, env, ctx) {
    const result = await handleRegisterRequest(request, env, ctx);
    if (result?.success) {
        try {
            const { email } = await request.json();
            const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
            if (trimmedEmail) {
                const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
                if (userId) {
                    await setPlanStatus(userId, 'demo', env);
                }
            }
        } catch (err) {
            console.error('handleRegisterDemoRequest status update failed', err);
        }
    }
    return result;
}
// ------------- END FUNCTION: handleRegisterDemoRequest -------------

// ------------- START FUNCTION: handleLoginRequest -------------
/**
 * Валидира вход на потребител чрез записите в KV.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>} Резултат от проверката.
 */
async function handleLoginRequest(request, env) {
    try {
        const { email, password } = await request.json();
        const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
        if (!trimmedEmail || !password) {
            return { success: false, message: 'Имейл и парола са задължителни.', statusHint: 400 };
        }

        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${trimmedEmail}`);
        if (!userId) {
            return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 };
        }

        const credStr = await env.USER_METADATA_KV.get(`credential_${userId}`);
        if (!credStr) {
            return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 };
        }

        const parsedCredentials = safeParseJson(credStr);
        let storedSaltAndHash = typeof parsedCredentials?.passwordHash === 'string'
            ? parsedCredentials.passwordHash.trim()
            : credStr.trim();

        if (!storedSaltAndHash || !storedSaltAndHash.includes(':')) {
            console.warn(`LOGIN_WARN (${userId}): Unsupported credential format.`);
            return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 };
        }

        const inputPasswordMatches = await verifyPassword(password, storedSaltAndHash);
        if (!inputPasswordMatches) {
            return { success: false, message: 'Грешен имейл или парола.', statusHint: 401 };
        }

        const planStatus = (await env.USER_METADATA_KV.get(`plan_status_${userId}`)) || 'pending';
        const hasInitialAnswers = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const redirectTo = hasInitialAnswers
            ? (planStatus === 'ready' ? 'dashboard' : 'pending')
            : 'questionnaire';
        // Login successful
        return { success: true, userId: userId, planStatus: planStatus, redirectTo: redirectTo };
    } catch (error) {
        console.error(`Error in handleLoginRequest: ${error.message}\n${error.stack}`);
        let userMessage = 'Вътрешна грешка при вход.';
        if (error instanceof SyntaxError || error.message.includes('Invalid content') || error.message.includes('parse')) userMessage = 'Проблем с данните.';
        else if (error.message.includes('Password hash')) userMessage = 'Проблем с акаунта.';
        else if (error.message.includes('fetch')) userMessage = 'Грешка със сървъра.';
        else if (error.message.includes('PHP API URL or Token')) userMessage = 'Грешка в конфигурацията на сървъра.';
        return { success: false, message: userMessage, statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleLoginRequest -------------

// ------------- START FUNCTION: handleSubmitQuestionnaire -------------
async function handleSubmitQuestionnaire(request, env, ctx) {
    try {
        const questionnaireData = await request.json();
        const userEmail = questionnaireData.email ? String(questionnaireData.email).trim().toLowerCase() : null;
        if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
            return { success: false, message: 'Липсва/невалиден имейл.', statusHint: 400 };
        }
        const required = ['gender', 'age', 'height', 'weight', 'goal', 'medicalConditions'];
        for (const field of required) {
            const val = questionnaireData[field];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                return { success: false, statusHint: 400 };
            }
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${userEmail}`);
        if (!userId) {
            return { success: false, message: 'Потребителят не е регистриран.', statusHint: 403 };
        }
        questionnaireData.submissionDate = new Date().toISOString();
        await env.USER_METADATA_KV.put(`${userId}_initial_answers`, JSON.stringify(questionnaireData));
        await setPlanStatus(userId, 'pending', env);
        await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());
        // Initial answers saved, status set to pending

        // Execute plan generation synchronously to avoid Cloudflare Workers "IoContext timed out 
        // due to inactivity" errors. The tradeoff is longer response time, but reliable completion.
        // This matches the approach used in handleRegeneratePlanRequest.
        try {
            await processSingleUserPlan(userId, env);
        } catch (err) {
            console.error(`SUBMIT_QUESTIONNAIRE (${userId}): Plan generation failed: ${err.message}\n${err.stack}`);
            try {
                await setPlanStatus(userId, 'error', env);
                await env.USER_METADATA_KV.put(`${userId}_processing_error`, 
                    `Грешка при генериране на план: ${err.message}`);
            } catch (statusErr) {
                console.error(`SUBMIT_QUESTIONNAIRE (${userId}): Failed to set error status:`, statusErr);
            }
        }

        const baseUrl = env[ANALYSIS_PAGE_URL_VAR_NAME] ||
            'https://radilovk.github.io/bodybest/reganalize/analyze.html';
        const url = new URL(baseUrl);
        url.searchParams.set('userId', userId);
        const link = url.toString();
        
        // Send email asynchronously without blocking the response
        const emailTask = sendAnalysisLinkEmail(
            questionnaireData.email,
            questionnaireData.name || 'Клиент',
            link,
            env
        );
        if (ctx) {
            ctx.waitUntil(emailTask);
        } else {
            // Fallback for environments without ExecutionContext (e.g., local testing)
            // Email is sent in background; errors are logged but don't block the response
            emailTask.catch(err => console.error('Failed to send analysis email:', err));
        }

        await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        const analysisTask = handleAnalyzeInitialAnswers(userId, env);
        if (ctx) {
            ctx.waitUntil(analysisTask);
        } else {
            await analysisTask;
        }
        return { 
            success: true, 
            message: 'Данните са приети. Вашият индивидуален план ще бъде генериран скоро.',
            userId: userId
        };
    } catch (error) {
        console.error(`Error in handleSubmitQuestionnaire: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Възникна грешка при обработка на данните от въпросника.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSubmitQuestionnaire -------------

// ------------- START FUNCTION: handleSubmitDemoQuestionnaire -------------
/**
 * Приема демо въпросник без да променя състоянието на плана.
 * Базира се на handleSubmitQuestionnaire.
 * @param {Request} request
 * @param {Object} env
 */
async function handleSubmitDemoQuestionnaire(request, env, ctx) {
    try {
        const questionnaireData = await request.json();
        const userEmail = questionnaireData.email ? String(questionnaireData.email).trim().toLowerCase() : null;
        if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
            return { success: false, message: 'Липсва/невалиден имейл.', statusHint: 400 };
        }
        const required = ['gender', 'age', 'height', 'weight', 'goal', 'medicalConditions'];
        for (const field of required) {
            const val = questionnaireData[field];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                return { success: false, statusHint: 400 };
            }
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${userEmail}`);
        if (!userId) {
            return { success: false, message: 'Потребителят не е регистриран.', statusHint: 403 };
        }
        questionnaireData.submissionDate = new Date().toISOString();
        await env.USER_METADATA_KV.put(`${userId}_initial_answers`, JSON.stringify(questionnaireData));
        // Demo questionnaire saved

        const baseUrl = env[ANALYSIS_PAGE_URL_VAR_NAME] ||
            'https://radilovk.github.io/bodybest/reganalize/analyze.html';
        const url = new URL(baseUrl);
        url.searchParams.set('userId', userId);
        const link = url.toString();
        
        // Send email asynchronously without blocking the response
        const emailTask = sendAnalysisLinkEmail(
            questionnaireData.email,
            questionnaireData.name || 'Клиент',
            link,
            env
        );
        if (ctx) {
            ctx.waitUntil(emailTask);
        } else {
            // Fallback for environments without ExecutionContext (e.g., local testing)
            // Email is sent in background; errors are logged but don't block the response
            emailTask.catch(err => console.error('Failed to send analysis email:', err));
        }

        await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        const analysisTask = handleAnalyzeInitialAnswers(userId, env);
        if (ctx) {
            ctx.waitUntil(analysisTask);
        } else {
            await analysisTask;
        }
        return { 
            success: true, 
            message: 'Данните са приети. Анализът ще бъде готов скоро.',
            userId: userId
        };
    } catch (error) {
        console.error(`Error in handleSubmitDemoQuestionnaire: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при обработка на данните.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSubmitDemoQuestionnaire -------------

// ------------- START FUNCTION: handlePlanStatusRequest -------------
async function handlePlanStatusRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const status = await env.USER_METADATA_KV.get(`plan_status_${userId}`) || 'unknown';
        if (status === 'error') {
            const errorMsg = await env.USER_METADATA_KV.get(`${userId}_processing_error`);
            return { success: true, userId: userId, planStatus: status, error: errorMsg || "Неизвестна грешка при генериране на плана." };
        }
        // Plan status check complete
        return { success: true, userId: userId, planStatus: status };
    } catch (error) {
        console.error(`Error fetching plan status for ${userId}: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при проверка на статус на плана.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePlanStatusRequest -------------

// ------------- START FUNCTION: handlePlanLogRequest -------------
async function handlePlanLogRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const [logStr, status, errorMsg] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_plan_log`),
            env.USER_METADATA_KV.get(`plan_status_${userId}`),
            env.USER_METADATA_KV.get(`${userId}_processing_error`)
        ]);
        let logs = [];
        try { logs = logStr ? JSON.parse(logStr) : []; } catch { logs = []; }
        const result = { success: true, logs, status: status || 'unknown' };
        if ((status || '') === 'error' && errorMsg) result.error = errorMsg;
        return result;
    } catch (error) {
        console.error(`Error fetching plan log for ${userId}: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на лога на плана.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePlanLogRequest -------------

// ------------- START FUNCTION: handleAnalysisStatusRequest -------------
async function handleAnalysisStatusRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const status = await env.USER_METADATA_KV.get(`${userId}_analysis_status`) || 'unknown';
        return { success: true, userId: userId, analysisStatus: status };
    } catch (error) {
        console.error(`Error fetching analysis status for ${userId}: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при проверка на статус на анализа.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAnalysisStatusRequest -------------

// ------------- START FUNCTION: handleDashboardDataRequest -------------
/**
 * Handles dashboard data requests with optional analytics period filtering
 * 
 * Daily logs storage: Optimized approach using individual KV entries per date
 * - Key pattern: `{userId}_log_{YYYY-MM-DD}`
 * - Benefits: Fast individual date access, efficient updates, no data size limits per day
 * - Returns up to 100 most recent logs (USER_ACTIVITY_LOG_LIST_LIMIT)
 * 
 * Analytics period: Configurable via 'period' query parameter
 * - Default: 7 days (weekly view)
 * - Options: 7 (week), 30 (month), 'all' (entire history)
 * - Period parameter only affects analytics calculation, not log retrieval
 */
async function handleDashboardDataRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const analyticsPeriod = url.searchParams.get('period'); // New parameter for analytics period (7, 30, or 'all')
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    try {
        const [
            initialAnswersStr, finalPlanStr, recipeDataStr, planStatus,
            currentStatusStr,                     firstLoginFlagStr,
            aiUpdateSummaryAckStr,
            lastUpdateTsStr,
            lastFeedbackChatTsStr,
            profileStr
        ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`),
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            getCachedResource('recipe_data', env.RESOURCES_KV),
            env.USER_METADATA_KV.get(`plan_status_${userId}`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_welcome_seen`),
            env.USER_METADATA_KV.get(`${userId}_ai_update_pending_ack`),
            env.USER_METADATA_KV.get(`${userId}_last_significant_update_ts`),
            env.USER_METADATA_KV.get(`${userId}_last_feedback_chat_ts`),
            env.USER_METADATA_KV.get(`${userId}_profile`)
        ]);


        const actualPlanStatus = planStatus || 'unknown';
        
        // Обработка на случаи когато липсват initial_answers
        if (!initialAnswersStr) {
            // Ако потребителят е в статус 'pending_inputs', значи е регистриран но не е попълнил въпросника
            if (actualPlanStatus === 'pending_inputs') {
                // User has not submitted questionnaire yet
                const recipeData = safeParseJson(recipeDataStr, {});
                return { 
                    success: true, 
                    userId, 
                    planStatus: actualPlanStatus, 
                    userName: 'Клиент',
                    initialAnswers: {},
                    initialData: {},
                    recipeData,
                    dailyLogs: [],
                    currentStatus: {},
                    isFirstLoginWithReadyPlan: false,
                    aiUpdateSummary: null,
                    triggerAutomatedFeedbackChat: false,
                    message: 'Моля, попълнете въпросника за да започнете.',
                    planData: null,
                    analytics: null
                };
            }
            // За всички други статуси initial_answers трябва да съществува
            console.error(`DASHBOARD_DATA (${userId}): Missing initial_answers for status: ${actualPlanStatus}.`);
            return { success: false, message: 'Основните данни на потребителя не са намерени.', statusHint: 404, userId };
        }
        
        const initialAnswers = safeParseJson(initialAnswersStr, {});
        if (Object.keys(initialAnswers).length === 0) return { success: false, message: 'Грешка при зареждане на основните данни на потребителя.', statusHint: 500, userId };
        
        const userName = initialAnswers.name || 'Клиент';
        const initialData = { weight: initialAnswers.weight, height: initialAnswers.height, goal: initialAnswers.goal };
        const recipeData = safeParseJson(recipeDataStr, {});
        const currentStatus = safeParseJson(currentStatusStr, {});
        const profile = safeParseJson(profileStr, {});
        
        let logEntries = [];
        const logDates = await getUserLogDates(env, userId);
        if (logDates.length > 0) {
            const sortedDates = logDates
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                .slice(0, USER_ACTIVITY_LOG_LIST_LIMIT);
            const logRecords = await Promise.all(
                sortedDates.map(date => env.USER_METADATA_KV.get(`${userId}_log_${date}`).then(str => ({ date, str })))
            );
            logEntries = logRecords.map(({ date, str }) => {
                if (!str) return null;
                const parsed = safeParseJson(str, {});
                return {
                    date,
                    data: parsed.log || parsed.data || {},
                    totals: parsed.totals || null,
                    extraMeals: parsed.extraMeals || []
                };
            }).filter(entry => entry && (
                (entry.data && Object.keys(entry.data).length > 0) ||
                (entry.extraMeals && entry.extraMeals.length > 0)
            ));
        } else {
            const allLogsStr = await env.USER_METADATA_KV.get(`${userId}_logs`);
            const allLogs = safeParseJson(allLogsStr, []);
            if (Array.isArray(allLogs)) {
                logEntries = allLogs.map(l => ({
                    date: l.date,
                    data: l.data || l.log || {},
                    totals: l.totals || null,
                    extraMeals: l.extraMeals || []
                })).filter(e => e.date && (
                    (e.data && Object.keys(e.data).length > 0) ||
                    (e.extraMeals && e.extraMeals.length > 0)
                ))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, USER_ACTIVITY_LOG_LIST_LIMIT);
            }
        }

        let isFirstLoginWithReadyPlan = false;
        if (actualPlanStatus === 'ready' && !firstLoginFlagStr) {
            isFirstLoginWithReadyPlan = true;
            await env.USER_METADATA_KV.put(`${userId}_welcome_seen`, 'true');
        }
        
        const aiUpdateSummary = aiUpdateSummaryAckStr ? safeParseJson(aiUpdateSummaryAckStr) : null;
        const lastUpdateTs = lastUpdateTsStr ? parseInt(lastUpdateTsStr, 10) : 0;
        const lastChatTs = lastFeedbackChatTsStr ? parseInt(lastFeedbackChatTsStr, 10) : 0;
        const triggerAutomatedFeedbackChat = shouldTriggerAutomatedFeedbackChat(lastUpdateTs, lastChatTs);

        const baseResponse = {
            success: true, userId, planStatus: actualPlanStatus, userName, initialAnswers, initialData,
            recipeData, dailyLogs: logEntries, currentStatus, isFirstLoginWithReadyPlan,
            aiUpdateSummary: aiUpdateSummary, // Добавено тук
            triggerAutomatedFeedbackChat,
            macroExceedThreshold: typeof profile.macroExceedThreshold === 'number' ? profile.macroExceedThreshold : undefined
        };

        if (actualPlanStatus === 'pending' || actualPlanStatus === 'processing') {
            // Plan is being generated
            return { ...baseResponse, message: `Вашият план все още се генерира (статус: ${actualPlanStatus}). Моля, проверете отново по-късно.`, planData: null, analytics: null };
        }
        if (actualPlanStatus === 'error') {
            const errorMsg = await env.USER_METADATA_KV.get(`${userId}_processing_error`);
            console.error(`DASHBOARD_DATA (${userId}): Plan status is 'error'. Error: ${errorMsg}`);
            return { ...baseResponse, success: false, message: `Възникна грешка при генерирането на Вашия план: ${errorMsg ? errorMsg.split('\n')[0] : 'Неизвестна грешка.'}`, planData: null, analytics: null, statusHint: 500 };
        }
        const logTimestamp = new Date().toISOString();
        if (!finalPlanStr) {
            console.warn(`DASHBOARD_DATA (${userId}) [${logTimestamp}]: Plan status '${actualPlanStatus}' but final_plan is missing. Snippet: ${String(finalPlanStr).slice(0,200)}`);
            return { ...baseResponse, success: false, message: 'Планът Ви не е наличен в системата, въпреки че статусът показва готовност. Моля, свържете се с поддръжка.', statusHint: 404, planData: null, analytics: null };
        }
        const finalPlan = safeParseJson(finalPlanStr, {});
        if (Object.keys(finalPlan).length === 0 && finalPlanStr) { // finalPlanStr ensures it wasn't null initially
            console.error(`DASHBOARD_DATA (${userId}) [${logTimestamp}]: Failed to parse final_plan JSON. Status: '${actualPlanStatus}'. Snippet: ${finalPlanStr.slice(0,200)}`);
            return { ...baseResponse, success: false, message: 'Грешка при зареждане на данните на Вашия план.', statusHint: 500, planData: null, analytics: null };
        }

        // Проверка дали caloriesMacros са налични и пълни от AI отговора
        // За стари регистрации може да липсват пълни макроси - показваме предупреждение вместо грешка
        let macrosWarning = null;
        if (!hasCompleteCaloriesMacros(finalPlan.caloriesMacros)) {
            console.warn(`DASHBOARD_DATA (${userId}): Missing or incomplete caloriesMacros in final plan. Legacy user data will be displayed with warning.`);
            macrosWarning = 'Планът няма пълни данни за макроси. За пълна функционалност е препоръчително да регенерирате плана.';
        }

        // Determine analytics period days
        let analyticsPeriodDays = 7; // Default
        if (analyticsPeriod === '30') {
            analyticsPeriodDays = 30;
        } else if (analyticsPeriod === 'all') {
            analyticsPeriodDays = logEntries.length > 0 ? Math.min(logEntries.length, MAX_ANALYTICS_PERIOD_DAYS) : MAX_ANALYTICS_PERIOD_DAYS;
        } else if (analyticsPeriod && !isNaN(parseInt(analyticsPeriod))) {
            analyticsPeriodDays = Math.min(parseInt(analyticsPeriod), MAX_ANALYTICS_PERIOD_DAYS);
        }

        const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries, currentStatus, analyticsPeriodDays); // Add period parameter
        const planDataForClient = { ...finalPlan };

        return { ...baseResponse, planData: planDataForClient, analytics: analyticsData, macrosWarning, analyticsPeriod: analyticsPeriodDays };

    } catch (error) {
        console.error(`Error in handleDashboardDataRequest for ${userId}: ${error.message}\n${error.stack}`);
        const fallbackInitialAnswers = safeParseJson(await env.USER_METADATA_KV.get(`${userId}_initial_answers`), {});
        const planStatusOnError = await env.USER_METADATA_KV.get(`plan_status_${userId}`) || 'error';
        return {
            success: false,
            message: 'Възникна вътрешна грешка при зареждане на данните за таблото. Моля, опитайте отново по-късно.',
            statusHint: 500,
            userId,
            userName: fallbackInitialAnswers.name || 'Клиент',
            initialAnswers: fallbackInitialAnswers,
            planStatus: planStatusOnError,
            aiUpdateSummary: null, // Ensure aiUpdateSummary is present even on error
            triggerAutomatedFeedbackChat: false
        };
    }
}
// ------------- END FUNCTION: handleDashboardDataRequest -------------

async function ensureLogIndexEntry(userId, date, env) {
    if (!userId || !date || !env?.USER_METADATA_KV) {
        return false;
    }

    const indexKey = `${userId}_logs_index`;
    try {
        const idxStr = await env.USER_METADATA_KV.get(indexKey);
        const parsedIndex = parseLogIndexRecord(idxStr);
        const now = Date.now();
        const idxArr = Array.isArray(parsedIndex.dates) ? [...parsedIndex.dates] : [];
        let hasChanges = false;

        if (!idxArr.includes(date)) {
            idxArr.push(date);
            hasChanges = true;
        }

        if (hasChanges || !parsedIndex.ts || now - parsedIndex.ts > LOG_INDEX_STALE_MS / 2) {
            const updatedRecord = createLogIndexRecord(idxArr, parsedIndex, now);
            await env.USER_METADATA_KV.put(indexKey, JSON.stringify(updatedRecord));
        }

        return hasChanges;
    } catch (err) {
        console.warn(`LOG_INDEX_WARN (${userId}): Failed to ensure log index for ${date} - ${err.message}`);
    }

    return false;
}

// ------------- START FUNCTION: handleLogRequest -------------
async function handleLogRequest(request, env) {
    let inputData;
    try {
        inputData = await request.json();
        const userId = inputData.userId;
        if (!userId) {
            console.warn("LOG_REQUEST_ERROR: Missing userId in input data.");
            throw new Error("Липсва потребителско ID (userId).");
        }

        const todayStr = getLocalDate();
        const dateToLog = inputData.date || todayStr; // Позволява подаване на дата, иначе днешна
        const logKey = `${userId}_log_${dateToLog}`;

        if (inputData.delete) {
            await env.USER_METADATA_KV.delete(logKey);
            const indexKey = `${userId}_logs_index`;
            const idxStr = await env.USER_METADATA_KV.get(indexKey);
            const parsedIndex = parseLogIndexRecord(idxStr);
            const updatedDates = (Array.isArray(parsedIndex.dates) ? parsedIndex.dates : []).filter(d => d !== dateToLog);
            const updatedRecord = createLogIndexRecord(updatedDates, parsedIndex);
            await env.USER_METADATA_KV.put(indexKey, JSON.stringify(updatedRecord));
            await refreshChatContextAfterLog(userId, env, dateToLog, null);
            // Daily log deleted
            return { success: true, message: 'Дневникът е изтрит успешно.', deletedDate: dateToLog };
        }

        // Копираме всички полета от inputData.data, ако съществува
        const log = { ...(inputData.data || {}) };

        // Специфично обработваме полета извън 'data', ако са подадени директно
        if (inputData.completedMealsStatus !== undefined) log.completedMealsStatus = inputData.completedMealsStatus;
        if (inputData.note !== undefined) log.note = inputData.note;
        if (inputData.weight !== undefined) log.weight = inputData.weight;
        if (inputData.mood !== undefined) log.mood = inputData.mood;
        if (inputData.energy !== undefined) log.energy = inputData.energy;
        if (inputData.sleep !== undefined) log.sleep = inputData.sleep;
        if (inputData.calmness !== undefined) log.calmness = inputData.calmness;
        if (inputData.hydration !== undefined) log.hydration = inputData.hydration;

        // Премахваме служебните полета от обекта за запис, ако са влезли случайно
        delete log.userId;
        delete log.date;

        const existingStr = await env.USER_METADATA_KV.get(logKey);
        const existingRecord = existingStr ? safeParseJson(existingStr, {}) : {};

        const mergedTotalsObj = {
            ...(existingRecord.totals || {}),
            ...(inputData.totals || {})
        };
        const mergedRecord = {
            totals: Object.keys(mergedTotalsObj).length ? mergedTotalsObj : null,
            extraMeals: [
                ...(Array.isArray(existingRecord.extraMeals) ? existingRecord.extraMeals : []),
                ...(Array.isArray(inputData.extraMeals) ? inputData.extraMeals : [])
            ],
            log: {
                ...(existingRecord.log || existingRecord.data || {}),
                ...log
            }
        };

        const serializedRecord = JSON.stringify(mergedRecord);
        const payloadChanged = !existingStr || existingStr !== serializedRecord;

        if (payloadChanged) {
            await env.USER_METADATA_KV.put(logKey, serializedRecord);
        } else {
            // No changes detected, skipping log update
        }

        const lastActiveKey = `${userId}_lastActive`;
        // Записваме последната активност само ако датата е нова
        const previousLastActive = await env.USER_METADATA_KV.get(lastActiveKey);
        if (previousLastActive !== dateToLog) {
            await env.USER_METADATA_KV.put(lastActiveKey, dateToLog);
        }

        if (log.weight !== undefined && log.weight !== null && String(log.weight).trim() !== "") {
            const statusKey = `${userId}_current_status`;
            const existingStatusStr = await env.USER_METADATA_KV.get(statusKey);
            const currentStatus = existingStatusStr ? safeParseJson(existingStatusStr, {}) : {};
            const storedWeight = currentStatus.weight;
            const newWeightValue = typeof log.weight === 'string' ? log.weight.trim() : log.weight;
            const storedWeightValue = typeof storedWeight === 'string' ? storedWeight.trim() : storedWeight;
            const weightChanged = storedWeightValue === undefined || storedWeightValue === null
                ? newWeightValue !== '' && newWeightValue !== null && newWeightValue !== undefined
                : String(storedWeightValue) !== String(newWeightValue);
            const timestamp = new Date().toISOString();

            if (weightChanged) {
                const updatedStatus = { ...currentStatus, weight: log.weight, lastUpdated: timestamp };
                await env.USER_METADATA_KV.put(statusKey, JSON.stringify(updatedStatus));
                // Current status updated with new weight
            } else {
                // Само обновяваме локалния timestamp, без да натоварваме KV със същата стойност
                currentStatus.lastUpdated = timestamp;
                // Weight unchanged, skipping KV update
            }
        }

        if (payloadChanged) {
            await ensureLogIndexEntry(userId, dateToLog, env);
        }

        if (payloadChanged) {
            // Daily log saved
        } else {
            // Daily log already up to date
        }

        await refreshChatContextAfterLog(
            userId,
            env,
            dateToLog,
            payloadChanged ? mergedRecord : existingRecord,
            { weight: log.weight }
        );

        return {
            success: true,
            message: payloadChanged ? 'Данните от дневника са записани успешно.' : 'Дневникът вече съдържа подадените данни.',
            savedDate: dateToLog,
            savedData: log,
            updated: payloadChanged
        };
    } catch (error) {
        console.error(`Error in handleLogRequest: ${error.message}\n${error.stack}`);
        const userId = inputData?.userId || 'unknown_user';
        return { success: false, message: `Грешка при запис на дневник: ${error.message}`, statusHint: 400, userId };
    }
}
// ------------- END FUNCTION: handleLogRequest -------------

// ------------- START FUNCTION: handleBatchLogRequest -------------
/**
 * Обработва batch операция за множество log записи
 * Оптимизира синхронизацията при offline-first подход
 */
async function handleBatchLogRequest(request, env) {
    try {
        const inputData = await request.json();
        const logs = inputData.logs;
        
        if (!Array.isArray(logs) || logs.length === 0) {
            return { 
                success: false, 
                message: 'Липсват логове за обработка.', 
                statusHint: 400 
            };
        }

        // Валидираме всички логове преди обработка
        for (const log of logs) {
            if (!log.userId) {
                return { 
                    success: false, 
                    message: 'Липсва userId в един от логовете.', 
                    statusHint: 400 
                };
            }
        }

        const results = [];
        const errors = [];

        // Обработваме всеки лог
        for (const logData of logs) {
            try {
                // Създаваме mock request за handleLogRequest
                const mockRequest = {
                    json: async () => logData
                };

                const result = await handleLogRequest(mockRequest, env);
                
                if (result.success) {
                    results.push({
                        offlineId: logData._offlineId,
                        userId: logData.userId,
                        savedDate: result.savedDate,
                        success: true
                    });
                } else {
                    errors.push({
                        offlineId: logData._offlineId,
                        userId: logData.userId,
                        error: result.message,
                        success: false
                    });
                }
            } catch (error) {
                console.error(`Error processing log in batch: ${error.message}`);
                errors.push({
                    offlineId: logData._offlineId,
                    userId: logData.userId,
                    error: error.message,
                    success: false
                });
            }
        }

        const successCount = results.length;
        const errorCount = errors.length;

        return {
            success: errorCount === 0,
            message: `Обработени ${successCount} от ${logs.length} логове.`,
            processed: successCount,
            total: logs.length,
            results: results,
            errors: errorCount > 0 ? errors : undefined
        };
    } catch (error) {
        console.error(`Error in handleBatchLogRequest: ${error.message}\n${error.stack}`);
        return { 
            success: false, 
            message: `Грешка при batch обработка: ${error.message}`, 
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleBatchLogRequest -------------

// ------------- START FUNCTION: handleUpdateStatusRequest -------------
async function handleUpdateStatusRequest(request, env) {
     try {
        const inputData = await request.json();
        const { userId, ...statusDataToSave } = inputData;
        if (!userId) {
            console.warn("UPDATE_STATUS_ERROR: Missing userId in input data.");
            throw new Error("Липсва потребителско ID (userId).");
        }
        const statusKey = `${userId}_current_status`;
         let currentStatus = {};
         const existingStatusStr = await env.USER_METADATA_KV.get(statusKey);
         if (existingStatusStr) {
             currentStatus = safeParseJson(existingStatusStr, {});
         }
        // Копираме всички подадени полета, освен userId (вече отделен при деструктуриране)
         Object.assign(currentStatus, statusDataToSave);
         currentStatus.lastUpdated = new Date().toISOString();

         await env.USER_METADATA_KV.put(statusKey, JSON.stringify(currentStatus));
         // Status updated successfully
         return { success: true, message: 'Текущият Ви статус е актуализиран успешно.', savedStatus: currentStatus };
     } catch (error) {
         console.error(`Error in handleUpdateStatusRequest: ${error.message}\n${error.stack}`);
         const userId = (await request.json().catch(() => ({}))).userId || 'unknown_user';
         return { success: false, message: `Грешка при актуализация на статус: ${error.message}`, statusHint: 400, userId };
     }
}
// ------------- END FUNCTION: handleUpdateStatusRequest -------------

// ------------- START FUNCTION: handleGenerateMealAlternativesRequest -------------
/**
 * Generates 3 meal alternatives for a specific meal using AI
 * @param {Request} request - The HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Response with alternatives
 */
async function handleGenerateMealAlternativesRequest(request, env) {
    try {
        const { userId, mealIndex, dayKey, currentMeal, todayMenu } = await request.json();
        
        if (!userId || mealIndex === undefined || !dayKey || !currentMeal) {
            return { 
                success: false, 
                message: 'Липсват задължителни параметри (userId, mealIndex, dayKey, currentMeal)', 
                statusHint: 400 
            };
        }
        
        // Get user's final plan to understand dietary requirements
        const userPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        if (!userPlanStr) {
            return { 
                success: false, 
                message: 'Планът не е намерен', 
                statusHint: 404 
            };
        }
        
        const userPlan = JSON.parse(userPlanStr);
        const profileSummary = userPlan.profileSummary || '';
        const allowedForbidden = userPlan.allowedForbiddenFoods || {};
        const caloriesMacros = userPlan.caloriesMacros || {};
        
        // Get the current meal's macros
        const currentMacros = currentMeal.macros || {
            calories: 0,
            protein_grams: 0,
            carbs_grams: 0,
            fat_grams: 0
        };
        
        // Extract existing meal names from today's menu to avoid duplicates
        const existingMealNames = (todayMenu || []).map(m => (m.meal_name || '').toLowerCase().trim());
        
        // Get AI model configuration from KV
        const chatModel = await env.RESOURCES_KV.get('model_chat') || '@cf/meta/llama-3-8b-instruct';
        
        // Build the prompt for generating alternatives
        const prompt = `Ти си хранителен експерт. Генерирай 3 алтернативни хранения за замяна на следното:

ТЕКУЩО ХРАНЕНЕ: ${currentMeal.meal_name}
ПРОДУКТИ: ${(currentMeal.items || []).map(i => `${i.name} (${i.grams}g)`).join(', ')}

МАКРОНУТРИЕНТИ (целеви):
- Калории: ${currentMacros.calories} kcal (±10%)
- Протеини: ${currentMacros.protein_grams}g (±10%)
- Въглехидрати: ${currentMacros.carbs_grams}g (±15%)
- Мазнини: ${currentMacros.fat_grams}g (±15%)

ПРОФИЛ НА ПОТРЕБИТЕЛЯ:
${profileSummary}

РАЗРЕШЕНИ ХРАНИ: ${JSON.stringify(allowedForbidden.main_allowed_foods || [])}
ЗАБРАНЕНИ ХРАНИ: ${JSON.stringify(allowedForbidden.main_forbidden_foods || [])}

ИЗБЯГВАЙ ТЕЗИ ХРАНЕНИЯ (вече са в менюто днес):
${existingMealNames.join(', ')}

ИЗИСКВАНИЯ:
1. Генерирай 3 РАЗЛИЧНИ алтернативи с подобни макронутриенти
2. Използвай РАЗЛИЧНИ продукти от оригиналното хранене
3. Избягвай храненията, които вече са в менюто днес
4. Всяка алтернатива трябва да бъде реално приложима и вкусна
5. Спазвай профила и диетичните ограничения

ФОРМАТ НА ОТГОВОРА (СТРОГО JSON):
{
  "alternatives": [
    {
      "meal_name": "Име на хранението",
      "items": [
        {"name": "Продукт 1", "grams": 150},
        {"name": "Продукт 2", "grams": 100}
      ],
      "macros": {
        "calories": 500,
        "protein_grams": 30,
        "carbs_grams": 60,
        "fat_grams": 15
      }
    }
  ]
}

Върни САМО JSON, без допълнителен текст.`;

        // Call AI model
        const aiResponse = await callModel(chatModel, prompt, env, {
            temperature: 0.8,
            maxTokens: 2000
        });
        
        if (!aiResponse) {
            throw new Error('AI моделът не върна отговор');
        }
        
        // Parse AI response with robust error handling
        let parsedResponse;
        const parseAttempts = [
            // Attempt 1: Direct parse after basic cleanup
            () => {
                let cleanedResponse = aiResponse.trim();
                // Remove markdown code blocks
                if (cleanedResponse.startsWith('```json')) {
                    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
                } else if (cleanedResponse.startsWith('```')) {
                    cleanedResponse = cleanedResponse.replace(/```\s*/g, '').replace(/```\s*$/g, '');
                }
                return JSON.parse(cleanedResponse);
            },
            // Attempt 2: Extract first complete JSON object
            () => {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                throw new Error('No JSON found in response');
            },
            // Attempt 3: Find balanced JSON object containing "alternatives"
            () => {
                // Find the start of a JSON object that contains "alternatives"
                const startIdx = aiResponse.indexOf('{');
                if (startIdx === -1) throw new Error('No JSON object found');
                
                // Balance braces to find complete JSON
                let depth = 0;
                let inString = false;
                let escape = false;
                
                for (let i = startIdx; i < aiResponse.length; i++) {
                    const char = aiResponse[i];
                    
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (inString) continue;
                    
                    if (char === '{') depth++;
                    if (char === '}') {
                        depth--;
                        if (depth === 0) {
                            const jsonStr = aiResponse.substring(startIdx, i + 1);
                            const parsed = JSON.parse(jsonStr);
                            if (parsed.alternatives) {
                                return parsed;
                            }
                        }
                    }
                }
                throw new Error('No balanced JSON with alternatives found');
            }
        ];
        
        let lastError;
        for (let i = 0; i < parseAttempts.length; i++) {
            try {
                parsedResponse = parseAttempts[i]();
                if (parsedResponse) {
                    console.log(`Successfully parsed AI response on attempt ${i + 1}`);
                    break;
                }
            } catch (e) {
                lastError = e;
                console.warn(`Parse attempt ${i + 1} failed:`, e.message);
            }
        }
        
        if (!parsedResponse) {
            console.error('All parse attempts failed. AI response:', aiResponse);
            throw new Error('Не може да се парсира отговорът от AI модела. Моля, опитайте отново.');
        }
        
        // Validate response structure
        if (!parsedResponse || !parsedResponse.alternatives || !Array.isArray(parsedResponse.alternatives)) {
            console.error('Invalid response structure:', parsedResponse);
            throw new Error('Невалиден формат на отговора от AI модела');
        }
        
        // Validate and normalize each alternative
        const validAlternatives = parsedResponse.alternatives
            .map(alt => {
                if (!alt) return null;
                
                // Ensure meal_name exists
                if (!alt.meal_name || typeof alt.meal_name !== 'string') {
                    console.warn('Alternative missing meal_name:', alt);
                    return null;
                }
                
                // Ensure items array exists and has content
                if (!Array.isArray(alt.items) || alt.items.length === 0) {
                    console.warn('Alternative missing or empty items:', alt);
                    return null;
                }
                
                // Normalize items - ensure each has name and grams
                const normalizedItems = alt.items
                    .filter(item => item && item.name)
                    .map(item => ({
                        name: String(item.name),
                        grams: typeof item.grams === 'number' ? item.grams : 
                               (item.grams ? parseFloat(item.grams) : 100)
                    }));
                
                if (normalizedItems.length === 0) {
                    console.warn('Alternative has no valid items after normalization:', alt);
                    return null;
                }
                
                // Ensure macros exist with fallback to current meal's macros
                const macros = alt.macros || {};
                const normalizedMacros = {
                    calories: typeof macros.calories === 'number' ? macros.calories : 
                             (currentMacros.calories || 0),
                    protein_grams: typeof macros.protein_grams === 'number' ? macros.protein_grams : 
                                  (currentMacros.protein_grams || 0),
                    carbs_grams: typeof macros.carbs_grams === 'number' ? macros.carbs_grams : 
                                (currentMacros.carbs_grams || 0),
                    fat_grams: typeof macros.fat_grams === 'number' ? macros.fat_grams : 
                              (currentMacros.fat_grams || 0)
                };
                
                return {
                    meal_name: alt.meal_name,
                    items: normalizedItems,
                    macros: normalizedMacros,
                    recipeKey: alt.recipeKey || null
                };
            })
            .filter(alt => alt !== null)
            .slice(0, 3); // Take only first 3
        
        if (validAlternatives.length === 0) {
            console.error('No valid alternatives after filtering:', parsedResponse.alternatives);
            throw new Error('AI моделът не генерира валидни алтернативи');
        }
        
        console.log(`Generated ${validAlternatives.length} valid alternative(s)`);

        
        return {
            success: true,
            alternatives: validAlternatives,
            originalMeal: currentMeal.meal_name
        };
        
    } catch (error) {
        console.error('Error in handleGenerateMealAlternativesRequest:', error);
        return {
            success: false,
            message: error.message || 'Грешка при генериране на алтернативи',
            statusHint: 500
        };
    }
}
// ------------- END FUNCTION: handleGenerateMealAlternativesRequest -------------

// ------------- START FUNCTION: handleChatRequest -------------
async function handleChatRequest(request, env) {
    const { userId, message, model, promptOverride, source, history } = await request.json();
    if (!userId || !message) return { success: false, message: 'Липсва userId или съобщение.', statusHint: 400 };
    try {
        const chatContextKey = getChatContextKey(userId);
        let promptData = null;
        let useContext = false;

        if (env?.USER_METADATA_KV?.get) {
            try {
                const contextStr = await env.USER_METADATA_KV.get(chatContextKey);
                if (contextStr) {
                    const parsedContext = safeParseJson(contextStr, null);
                    if (parsedContext && isChatContextFresh(parsedContext) && parsedContext.planStatus === 'ready') {
                        const contextPrompt = createPromptDataFromContext(parsedContext);
                        if (contextPrompt) {
                            promptData = contextPrompt;
                            useContext = true;
                        }
                    }
                }
            } catch (ctxErr) {
                console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно зареждане на кеш - ${ctxErr.message}`);
            }
        }

        const today = new Date();
        const todayLocaleDate = today.toLocaleDateString('bg-BG');

        let storedChatHistoryStr;
        let planStatus = 'unknown';
        if (!useContext) {
            const logDates = Array.from({ length: 3 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                return getLocalDate(d);
            });
            const results = await Promise.all([
                env.USER_METADATA_KV.get(`${userId}_initial_answers`),
                env.USER_METADATA_KV.get(`${userId}_final_plan`),
                env.USER_METADATA_KV.get(`plan_status_${userId}`),
                env.USER_METADATA_KV.get(`${userId}_chat_history`),
                env.USER_METADATA_KV.get(`${userId}_current_status`),
                ...logDates.map(dateKey => env.USER_METADATA_KV.get(`${userId}_log_${dateKey}`))
            ]);
            const [initialAnswersStr, finalPlanStr, planStatusRaw, chatHistoryStr, currentStatusStr, ...logStrings] = results;
            storedChatHistoryStr = chatHistoryStr;
            const actualPlanStatus = planStatusRaw || 'unknown';

            if (actualPlanStatus !== 'ready' || !initialAnswersStr || !finalPlanStr) {
                let errMsg = 'Данните, необходими за чат асистента, все още не са готови.';
                if (actualPlanStatus === 'pending' || actualPlanStatus === 'processing') {
                    errMsg = `Вашият план все още се генерира (статус: ${actualPlanStatus}). Моля, изчакайте преди да използвате чат асистента.`;
                } else if (actualPlanStatus === 'error') {
                    errMsg = 'Възникна грешка при генерирането на Вашия план. Моля, свържете се с поддръжка.';
                }
                console.warn(`CHAT_REQUEST_WARN (${userId}): Chat attempted but plan not ready. Status: ${actualPlanStatus}`);
                if (env?.USER_METADATA_KV?.delete) {
                    await env.USER_METADATA_KV.delete(chatContextKey).catch(() => {});
                }
                return { success: false, message: errMsg, statusHint: 404 };
            }

            const initialAnswers = safeParseJson(initialAnswersStr, {});
            const finalPlan = safeParseJson(finalPlanStr, {});
            const currentStatus = safeParseJson(currentStatusStr, {});
            if (Object.keys(initialAnswers).length === 0 || Object.keys(finalPlan).length === 0) {
                console.error(`CHAT_REQUEST_ERROR (${userId}): Critical data (initialAnswers or finalPlan) empty after parsing.`);
                return { success: false, message: 'Грешка при зареждане на данни за чат асистента.', statusHint: 500 };
            }

            const sanitizedLogs = logStrings
                .map((logStr, idx) => {
                    if (!logStr) return null;
                    const parsedLog = safeParseJson(logStr, {});
                    return sanitizeLogEntryForContext(logDates[idx], parsedLog);
                })
                .filter(Boolean);

            promptData = buildPromptDataFromRaw(initialAnswers, finalPlan, currentStatus, sanitizedLogs);
            planStatus = actualPlanStatus;

            const contextPayload = await assembleChatContext(userId, env, {
                initialAnswers,
                finalPlan,
                currentStatus,
                logEntries: sanitizedLogs,
                planStatus
            });
            await persistChatContext(userId, env, contextPayload);
        } else {
            storedChatHistoryStr = await env.USER_METADATA_KV.get(`${userId}_chat_history`);
        }

        if (!promptData) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Missing prompt data after context resolution.`);
            return { success: false, message: 'Грешка при зареждане на данни за чат асистента.', statusHint: 500 };
        }

        let storedChatHistory = safeParseJson(storedChatHistoryStr, []);
        if (source === 'planModChat' && Array.isArray(history)) {
            storedChatHistory = history.map(h => ({
                role: h.sender === 'user' ? 'user' : 'model',
                parts: [{ text: h.text || '' }]
            }));
        }

        const maxChatHistory = await getMaxChatHistoryMessages(env);
        storedChatHistory.push({ role: 'user', parts: [{ text: message }] });
        storedChatHistory = await summarizeAndTrimChatHistory(storedChatHistory, env, maxChatHistory);

        const summaryEntry = storedChatHistory[0]?.summary ? storedChatHistory[0] : null;
        const recentForPrompt = storedChatHistory.slice(-(summaryEntry ? 9 : 10));
        const historyForPrompt = summaryEntry ? [summaryEntry, ...recentForPrompt] : recentForPrompt;
        const historyPrompt = historyForPrompt
            .map(entry => `${entry.summary ? 'РЕЗЮМЕ' : entry.role === 'model' ? 'АСИСТЕНТ' : 'ПОТРЕБИТЕЛ'}: ${entry.parts?.[0]?.text || ''}`)
            .join('\n');

        const chatPromptTpl = promptOverride || await getCachedResource('prompt_chat', env.RESOURCES_KV);
        const chatModel = await getCachedResource('model_chat', env.RESOURCES_KV);
        const modelToUse = model || chatModel;
        const geminiKey = env[GEMINI_API_KEY_SECRET_NAME];
        const openaiKey = env[OPENAI_API_KEY_SECRET_NAME];

        if (!chatPromptTpl || !modelToUse) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Missing chat prompt template or chat model name.`);
            return { success: false, message: 'Грешка в конфигурацията на чат асистента. Моля, опитайте по-късно.', statusHint: 500 };
        }
        const provider = getModelProvider(modelToUse);
        if (provider === 'gemini' && !geminiKey) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): Gemini API key missing.`);
            return { success: false, message: 'Липсва конфигурация за AI модела.', statusHint: 500 };
        }
        if (provider === 'openai' && !openaiKey) {
            console.error(`CHAT_REQUEST_ERROR (${userId}): OpenAI API key missing.`);
            return { success: false, message: 'Липсва конфигурация за AI модела.', statusHint: 500 };
        }

        const r = {
            '%%USER_NAME%%': promptData.userName,
            '%%USER_GOAL%%': promptData.userGoal,
            '%%USER_CONDITIONS%%': promptData.userConditions,
            '%%USER_PREFERENCES%%': promptData.userPreferences,
            '%%PSYCH_PROFILE%%': promptData.psychProfile || NO_PSYCH_PROFILE_MESSAGE,
            '%%ADAPTED_GUIDANCE%%': promptData.adaptedGuidance || '',  // v2.0: Add adapted guidance
            '%%INITIAL_CALORIES_MACROS%%': promptData.initCalMac,
            '%%PLAN_APPROACH_SUMMARY%%': promptData.planSum,
            '%%ALLOWED_FOODS_SUMMARY%%': promptData.allowedF,
            '%%FORBIDDEN_FOODS_SUMMARY%%': promptData.forbiddenF,
            '%%CURRENT_PRINCIPLES%%': promptData.currentPrinciples,
            '%%HYDRATION_TARGET%%': promptData.hydrTarget,
            '%%COOKING_METHODS%%': promptData.cookMethods,
            '%%SUPPLEMENT_SUGGESTIONS%%': promptData.suppSuggest,
            '%%TODAY_DATE%%': todayLocaleDate,
            '%%CURRENT_WEIGHT%%': promptData.currW,
            '%%RECENT_AVG_MOOD%%': promptData.avgMood,
            '%%RECENT_AVG_ENERGY%%': promptData.avgEnergy,
            '%%RECENT_AVG_CALMNESS%%': promptData.avgCalmness,
            '%%RECENT_AVG_SLEEP%%': promptData.avgSleep,
            '%%RECENT_ADHERENCE%%': promptData.adherence,
            '%%TODAYS_MEALS_NAMES%%': promptData.todayMeals,
            '%%TODAYS_COMPLETED_MEALS_KEYS%%': promptData.todaysCompletedMealsKeys,
            '%%HISTORY%%': historyPrompt || 'Няма предишна история на чата.',
            '%%USER_MESSAGE%%': message,
            '%%USER_REQUEST%%': message,
            '%%RECENT_LOGS_SUMMARY%%': promptData.recentLogsSummary
        };
        const populatedPrompt = populatePrompt(chatPromptTpl, r);
        const aiRespRaw = await callModelRef.current(modelToUse, populatedPrompt, env, { temperature: 0.7, maxTokens: 800 });

        let respToUser = aiRespRaw.trim();
        const sig = '[PLAN_MODIFICATION_REQUEST]';
        const sigIdx = respToUser.lastIndexOf(sig);
        if (sigIdx !== -1) {
            respToUser = respToUser.substring(0, sigIdx).trim();
        }

        storedChatHistory.push({ role: 'model', parts: [{ text: respToUser }] });
        storedChatHistory = await summarizeAndTrimChatHistory(storedChatHistory, env, maxChatHistory);

        // Asynchronous save of chat history
        env.USER_METADATA_KV.put(`${userId}_chat_history`, JSON.stringify(storedChatHistory)).catch(err => {
            console.error(`CHAT_ERROR (${userId}): Failed async chat history save:`, err);
        });

        // Chat request processed successfully
        return { success: true, reply: respToUser };

    } catch (error) {
        console.error(`Error in handleChatRequest for userId ${userId}: ${error.message}\n${error.stack}`);
        let userMsg = 'Възникна грешка при обработка на Вашата заявка към чат асистента.';
        if (error.message.includes('Gemini API Error') || error.message.includes('OpenAI API Error') || error.message.includes('CF AI error')) {
            userMsg = `Грешка от AI асистента: ${error.message.replace(/(Gemini|OpenAI) API Error \([^)]+\): /, '')}`;
        } else if (error.message.includes('blocked')) {
            userMsg = 'Отговорът от AI асистента беше блокиран поради съображения за безопасност. Моля, преформулирайте въпроса си.';
        } else if (error instanceof ReferenceError) {
            userMsg = 'Грешка: Вътрешен проблем с конфигурацията на асистента.';
        }
        return { success: false, message: userMsg, statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleChatRequest -------------

// ------------- START FUNCTION: handleLogExtraMealRequest -------------
async function handleLogExtraMealRequest(request, env) {
    try {
        const inputData = await request.json();
        const userId = inputData.userId;

        if (!userId) {
            console.warn("LOG_EXTRA_MEAL_ERROR: Missing userId.");
            return { success: false, message: 'Липсва потребителско ID.', statusHint: 400 };
        }
        if (!inputData.foodDescription || (!inputData.quantityEstimate && !inputData.quantityCustom)) {
             console.warn(`LOG_EXTRA_MEAL_ERROR (${userId}): Missing foodDescription or quantity.`);
            return { success: false, message: 'Липсват данни за описание на храната или количество.', statusHint: 400 };
        }

        let logDateStr = extractDatePortion(inputData.mealTimeSpecific);
        if (!logDateStr) {
            if (inputData.mealTimeSpecific) {
                console.warn(`LOG_EXTRA_MEAL_WARN (${userId}): Invalid mealTimeSpecific format: ${inputData.mealTimeSpecific}. Defaulting to today.`);
            }
            logDateStr = getLocalDate();
        }

        const logKey = `${userId}_log_${logDateStr}`;
        let currentLogData = {};
        const existingLogStr = await env.USER_METADATA_KV.get(logKey);
        if (existingLogStr) {
            currentLogData = safeParseJson(existingLogStr, {});
        }

        const extraMealEntry = {
            entryTimestamp: new Date().toISOString(), // Кога е направен записа
            consumedTimestamp: inputData.mealTimeSpecific || new Date(logDateStr + "T12:00:00.000Z").toISOString(), // Кога е консумирано, ако не е посочено, слагаме обяд на деня
            foodDescription: inputData.foodDescription || "Не е посочено",
            quantityEstimate: inputData.quantityEstimate || null, // e.g., "малка порция", "средна порция", "голяма порция"
            quantityCustom: inputData.quantityCustom || null, // e.g., "100гр пиле", "1 ябълка"
            reasonPrimary: inputData.reasonPrimary || "не е посочено", // e.g., "глад", "социално събитие"
            reasonOtherText: inputData.reasonOtherText || null,
            feelingAfter: inputData.feelingAfter || "не е посочено", // e.g., "добре", "виновен", "подут"
            replacedPlanned: inputData.replacedPlanned || "не", // "да_напълно", "да_частично", "не"
            skippedMeal: inputData.skippedMeal || null, // Кое планирано хранене е пропуснато, ако има такова
            calories: (inputData.calories !== undefined && !isNaN(parseFloat(inputData.calories))) ? parseFloat(inputData.calories) : null,
            protein: (inputData.protein !== undefined && !isNaN(parseFloat(inputData.protein))) ? parseFloat(inputData.protein) : null,
            carbs: (inputData.carbs !== undefined && !isNaN(parseFloat(inputData.carbs))) ? parseFloat(inputData.carbs) : null,
            fat: (inputData.fat !== undefined && !isNaN(parseFloat(inputData.fat))) ? parseFloat(inputData.fat) : null,
            type: "extra_meal" // Маркер за типа запис
        };

        if (!Array.isArray(currentLogData.extraMeals)) {
            currentLogData.extraMeals = [];
        }
        currentLogData.extraMeals.push(extraMealEntry);
        currentLogData.lastUpdated = new Date().toISOString();

        await env.USER_METADATA_KV.put(logKey, JSON.stringify(currentLogData));
        await ensureLogIndexEntry(userId, logDateStr, env);
        await refreshChatContextAfterLog(userId, env, logDateStr, currentLogData);
        // Extra meal logged successfully
        return { success: true, message: 'Извънредното хранене е записано успешно.', savedDate: logDateStr };
    } catch (error) {
        console.error(`Error in handleLogExtraMealRequest: ${error.message}\n${error.stack}`);
        const userId = (await request.json().catch(() => ({}))).userId || 'unknown_user';
        return { success: false, message: `Грешка при запис на извънредно хранене: ${error.message}`, statusHint: 500, userId };
    }
}
// ------------- END FUNCTION: handleLogExtraMealRequest -------------
// ------------- START FUNCTION: handleGetProfileRequest -------------
async function handleGetProfileRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        if (!userId) return { success: false, message: "Липсва ID на потребител.", statusHint: 400 };
        const profileStr = await env.USER_METADATA_KV.get(`${userId}_profile`);
        const profile = profileStr ? safeParseJson(profileStr, {}) : {};
        return { success: true, ...profile };
    } catch (error) {
        console.error(`Error in handleGetProfileRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: "Грешка при зареждане на профила.", statusHint: 500 };
}
}
// ------------- END FUNCTION: handleGetProfileRequest -------------

// ------------- START FUNCTION: handleUpdateProfileRequest -------------
async function handleUpdateProfileRequest(request, env) {
    try {
        const data = await request.json();
        const userId = data.userId;
        if (!userId) return { success: false, message: "Липсва ID на потребител.", statusHint: 400 };
        const existingStr = await env.USER_METADATA_KV.get(`${userId}_profile`);
        const profile = existingStr ? safeParseJson(existingStr, {}) : {};
        profile.name = data.name ? String(data.name).trim() : "";
        profile.fullname = data.fullname ? String(data.fullname).trim() : "";
        profile.age = (typeof data.age === "number" && !isNaN(data.age)) ? data.age : null;
        profile.phone = data.phone ? String(data.phone).trim() : "";
        profile.email = data.email ? String(data.email).trim().toLowerCase() : "";
        profile.height = (typeof data.height === "number" && !isNaN(data.height)) ? data.height : null;
        const thr = parseFloat(data.macroExceedThreshold);
        if (!isNaN(thr)) {
            if (thr >= 1 && thr <= 2) {
                profile.macroExceedThreshold = thr;
            } else {
                console.warn(`macroExceedThreshold out of range for ${userId}:`, thr);
            }
        }
        await env.USER_METADATA_KV.put(`${userId}_profile`, JSON.stringify(profile));
        return { success: true, message: "Профилът е обновен успешно" };
    } catch (error) {
        console.error(`Error in handleUpdateProfileRequest: ${error.message}\n${error.stack}`);
        const uid = (await request.json().catch(() => ({}))).userId || "unknown_user";
        return { success: false, message: "Грешка при запис на профила.", statusHint: 500, userId: uid };
}
}
// ------------- END FUNCTION: handleUpdateProfileRequest -------------

// ------------- START HELPER: createPsychoTestsProfileData -------------
/**
 * Създава компактна структура от психо тест данни за включване във final_plan.
 * Запазва съдържателна информация за AI анализ и препоръки.
 * @param {Object|null} visualTest - Визуален тест данни
 * @param {Object|null} personalityTest - Личностен тест данни
 * @param {Object} timestamps - Обект с timestamps { normalizedVisualTimestamp, normalizedPersonalityTimestamp, timestamp }
 * @returns {Object} Обогатен психо профил обект
 */
function createPsychoTestsProfileData(visualTest, personalityTest, timestamps) {
    const { normalizedVisualTimestamp, normalizedPersonalityTimestamp, timestamp } = timestamps;
    
    const psychoTestsData = {
        lastUpdated: normalizedPersonalityTimestamp || normalizedVisualTimestamp || timestamp
    };
    
    // Добавяме визуален тест със съдържателна информация
    if (visualTest) {
        psychoTestsData.visualTest = {
            profileId: visualTest.id,
            profileName: visualTest.name,
            profileShort: visualTest.short || '',
            summary: visualTest.summary || (visualTest.short ? `${visualTest.name} - ${visualTest.short}` : visualTest.name),
            mainPsycho: visualTest.mainPsycho || [],
            mainHabits: visualTest.mainHabits || [],
            mainRisks: visualTest.mainRisks || [],
            timestamp: normalizedVisualTimestamp
        };
    }
    
    // Добавяме личностен тест със съдържателна информация
    if (personalityTest) {
        psychoTestsData.personalityTest = {
            typeCode: personalityTest.typeCode,
            scores: personalityTest.scores,
            summary: personalityTest.summary || (personalityTest.typeCode ? `Личностен тип ${personalityTest.typeCode}` : 'Личностен профил'),
            riskFlags: personalityTest.riskFlags || [],
            strengths: personalityTest.strengths || [],
            mainRisks: personalityTest.mainRisks || [],
            topRecommendations: personalityTest.topRecommendations || [],
            timestamp: normalizedPersonalityTimestamp,
            // НОВО: Включване на psyadvice данни за AI интеграция
            psyadvice: personalityTest.psyadvice || null
        };
    }
    
    return psychoTestsData;
}
// ------------- END HELPER: createPsychoTestsProfileData -------------

// ------------- START HELPER: Psychometric Adaptation Functions (v2.0) -------------

/**
 * Maps 16 personality types to 8 communication modes
 * Based on: Communication Style (4 types) × Structure Need (2 types) = 8 modes
 * 
 * @param {string} typeCode - 4-letter personality type code (e.g., "X-S-D-P")
 * @returns {string} Communication mode (e.g., "DIRECT_FLEXIBLE")
 */
function mapPersonalityTypeTo8Modes(typeCode) {
    if (!typeCode || typeof typeCode !== 'string') {
        return 'SUPPORTIVE_STRUCTURED'; // Default fallback
    }
    
    const parts = typeCode.split('-');
    if (parts.length !== 4) {
        return 'SUPPORTIVE_STRUCTURED'; // Default fallback
    }
    
    const [energy, innovation, contact, structure] = parts;
    
    // Determine communication style (4 variants)
    let style;
    if (contact === 'D' && innovation === 'S') {
        style = 'DIRECT';
    } else if (contact === 'M' && innovation === 'S') {
        style = 'SUPPORTIVE';
    } else if (contact === 'D' && innovation === 'V') {
        style = 'STRATEGIC';
    } else if (contact === 'M' && innovation === 'V') {
        style = 'EMPATHETIC';
    } else {
        style = 'SUPPORTIVE'; // Default
    }
    
    // Determine structure need (2 variants)
    const structureNeed = (structure === 'J') ? 'STRUCTURED' : 'FLEXIBLE';
    
    return `${style}_${structureNeed}`;
}

/**
 * Gets communication mode keys based on the 8-mode system
 * 
 * @param {string} communicationMode - One of 8 modes
 * @returns {Object} Keys for AI prompt (tone, length, frequency, structure, flexibility)
 */
function getCommunicationModeKeys(communicationMode) {
    const modeConfig = {
        'DIRECT_STRUCTURED': {
            tone: 'directive',
            length: 'short',
            frequency: 'moderate',
            complexity: 'simple',
            structure: 'high',
            flexibility: 'low',
            variety: 'low'
        },
        'DIRECT_FLEXIBLE': {
            tone: 'directive',
            length: 'short',
            frequency: 'low',
            complexity: 'minimal',
            structure: 'low',
            flexibility: 'high',
            variety: 'low'
        },
        'SUPPORTIVE_STRUCTURED': {
            tone: 'gentle',
            length: 'medium',
            frequency: 'high',
            complexity: 'simple',
            structure: 'high',
            flexibility: 'low',
            variety: 'medium'
        },
        'SUPPORTIVE_FLEXIBLE': {
            tone: 'gentle',
            length: 'medium',
            frequency: 'high',
            complexity: 'simple',
            structure: 'medium',
            flexibility: 'high',
            variety: 'medium'
        },
        'STRATEGIC_STRUCTURED': {
            tone: 'analytical',
            length: 'long',
            frequency: 'low',
            complexity: 'high',
            structure: 'high',
            flexibility: 'low',
            variety: 'medium'
        },
        'STRATEGIC_FLEXIBLE': {
            tone: 'analytical',
            length: 'medium',
            frequency: 'low',
            complexity: 'moderate',
            structure: 'low',
            flexibility: 'high',
            variety: 'high'
        },
        'EMPATHETIC_STRUCTURED': {
            tone: 'understanding',
            length: 'medium',
            frequency: 'moderate',
            complexity: 'moderate',
            structure: 'high',
            flexibility: 'medium',
            variety: 'medium'
        },
        'EMPATHETIC_FLEXIBLE': {
            tone: 'understanding',
            length: 'medium',
            frequency: 'high',
            complexity: 'simple',
            structure: 'low',
            flexibility: 'high',
            variety: 'low'
        }
    };
    
    return modeConfig[communicationMode] || modeConfig['SUPPORTIVE_STRUCTURED'];
}

/**
 * Gets risk areas and coping strategies based on communication mode
 * 
 * @param {string} communicationMode - One of 8 modes
 * @returns {Object} Risk areas and coping strategies
 */
function getRiskAreasAndCoping(communicationMode) {
    const riskConfig = {
        'DIRECT_STRUCTURED': {
            riskAreas: ['over_control', 'rigidity', 'perfectionism'],
            coping: ['planned_flexibility', 'self_compassion', 'progress_not_perfection']
        },
        'DIRECT_FLEXIBLE': {
            riskAreas: ['meal_skipping', 'inconsistency', 'late_eating'],
            coping: ['anchor_meals', 'habit_stacking', 'simple_routine']
        },
        'SUPPORTIVE_STRUCTURED': {
            riskAreas: ['fear_of_change', 'others_first', 'anxiety'],
            coping: ['gradual_changes', 'self_care_priority', 'predictable_plan']
        },
        'SUPPORTIVE_FLEXIBLE': {
            riskAreas: ['external_eating', 'boundary_issues', 'social_pressure'],
            coping: ['personal_plan', 'saying_no', 'advance_decisions']
        },
        'STRATEGIC_STRUCTURED': {
            riskAreas: ['over_optimization', 'food_as_fuel', 'burnout'],
            coping: ['pleasure_integration', 'recovery_planning', 'long_term_focus']
        },
        'STRATEGIC_FLEXIBLE': {
            riskAreas: ['diet_hopping', 'extreme_experiments', 'inconsistency'],
            coping: ['one_change_at_time', 'time_boxed_trials', 'data_tracking']
        },
        'EMPATHETIC_STRUCTURED': {
            riskAreas: ['overthinking', 'overcommitment', 'stress'],
            coping: ['simplification', 'resource_protection', 'clear_priorities']
        },
        'EMPATHETIC_FLEXIBLE': {
            riskAreas: ['emotional_eating', 'chaos', 'mood_dependent'],
            coping: ['minimal_framework', 'emotion_work', 'stable_anchors']
        }
    };
    
    return riskConfig[communicationMode] || riskConfig['SUPPORTIVE_STRUCTURED'];
}

/**
 * Calculates correlation score between initial_answers and personality profile
 * Returns a score from 0 to 1 indicating concordance level
 * 
 * @param {Object} initialAnswers - User's questionnaire answers
 * @param {Object} personalityTest - Personality test results with scores
 * @returns {number} Correlation score (0-1)
 */
function calculateCorrelationScore(initialAnswers, personalityTest) {
    if (!initialAnswers || !personalityTest || !personalityTest.scores) {
        return 0.5; // Neutral if missing data
    }
    
    const dimensions = personalityTest.scores;
    let totalPoints = 0;
    let maxPoints = 0;
    
    // Correlation weights per dimension
    const dimensionWeights = {
        E: 0.15,  // Extraversion
        C: 0.25,  // Conscientiousness (most important for eating)
        O: 0.10,  // Openness
        A: 0.10,  // Agreeableness
        N: 0.20,  // Neuroticism (important for eating)
        I: 0.15,  // Impulsivity (important for eating)
        R: 0.05   // Risk-taking
    };
    
    // Check correlations for each dimension
    
    // E (Extraversion) correlations
    if (dimensions.E !== undefined) {
        const weight = dimensionWeights.E;
        maxPoints += weight;
        
        if (initialAnswers.chronotype === 'Сутрешен' && dimensions.E >= 55) {
            totalPoints += weight;
        } else if (initialAnswers.chronotype === 'Вечерен' && dimensions.E < 50) {
            totalPoints += weight * 0.7;
        }
        
        if (initialAnswers.stressLevel === 'Високо' && dimensions.E < 50) {
            totalPoints += weight * 0.5;
        } else if (initialAnswers.stressLevel === 'Ниско' && dimensions.E >= 55) {
            totalPoints += weight * 0.5;
        }
    }
    
    // C (Conscientiousness) correlations - most important
    if (dimensions.C !== undefined) {
        const weight = dimensionWeights.C;
        maxPoints += weight;
        
        if (initialAnswers.sleepHours === '7–8' && dimensions.C >= 60) {
            totalPoints += weight * 0.4;
        }
        
        if (initialAnswers.sleepInterrupt === 'Не' && dimensions.C >= 60) {
            totalPoints += weight * 0.3;
        }
        
        const overeating = initialAnswers.overeatingFrequency || '';
        if ((overeating === 'Рядко' || overeating === 'Никога') && dimensions.C >= 60) {
            totalPoints += weight * 0.3;
        } else if ((overeating === 'Често' || overeating === 'Постоянно') && dimensions.C < 50) {
            totalPoints += weight * 0.3;
        }
    }
    
    // N (Neuroticism) correlations - important for emotional eating
    if (dimensions.N !== undefined) {
        const weight = dimensionWeights.N;
        maxPoints += weight;
        
        if (initialAnswers.stressLevel === 'Високо' && dimensions.N >= 60) {
            totalPoints += weight * 0.4;
        }
        
        const triggers = initialAnswers.foodTriggers || [];
        const emotionalTriggers = triggers.includes('Напрежение') || triggers.includes('Тъга');
        if (emotionalTriggers && dimensions.N >= 60) {
            totalPoints += weight * 0.3;
        }
        
        const overeating = initialAnswers.overeatingFrequency || '';
        if ((overeating === 'Често' || overeating === 'Постоянно') && dimensions.N >= 60) {
            totalPoints += weight * 0.3;
        }
    }
    
    // I (Impulsivity) correlations
    if (dimensions.I !== undefined) {
        const weight = dimensionWeights.I;
        maxPoints += weight;
        
        const overeating = initialAnswers.overeatingFrequency || '';
        if ((overeating === 'Често' || overeating === 'Постоянно') && dimensions.I >= 60) {
            totalPoints += weight * 0.5;
        }
        
        if (initialAnswers.foodCravings === 'Да' && dimensions.I >= 60) {
            totalPoints += weight * 0.5;
        }
    }
    
    // O (Openness) correlations
    if (dimensions.O !== undefined) {
        const weight = dimensionWeights.O;
        maxPoints += weight;
        
        if (initialAnswers.dietHistory === 'Да' && dimensions.O >= 60) {
            totalPoints += weight * 0.5;
        }
        
        const dietPref = initialAnswers.dietPreference || [];
        if (Array.isArray(dietPref) && dietPref.length > 1 && dimensions.O >= 60) {
            totalPoints += weight * 0.5;
        }
    }
    
    // A (Agreeableness) correlations
    if (dimensions.A !== undefined) {
        const weight = dimensionWeights.A;
        maxPoints += weight;
        
        const triggers = initialAnswers.foodTriggers || [];
        if (triggers.includes('Социални събития') && dimensions.A >= 60) {
            totalPoints += weight;
        }
    }
    
    // R (Risk-taking) correlations
    if (dimensions.R !== undefined) {
        const weight = dimensionWeights.R;
        maxPoints += weight;
        
        if (initialAnswers.dietHistory === 'Да' && dimensions.R >= 60) {
            totalPoints += weight * 0.5;
        }
        
        const compensation = initialAnswers.compensationmethod || initialAnswers.compensationMethods || [];
        if (Array.isArray(compensation) && compensation.includes('Хапчета за отслабване') && dimensions.R >= 60) {
            totalPoints += weight * 0.5;
        }
    }
    
    // Calculate final score
    if (maxPoints === 0) {
        return 0.5; // Neutral if no correlations found
    }
    
    return totalPoints / maxPoints;
}

/**
 * Determines concordance level based on correlation score
 * 
 * @param {number} correlationScore - Score from 0 to 1
 * @returns {string} 'high', 'medium', or 'low'
 */
function getConcordanceLevel(correlationScore) {
    if (correlationScore >= 0.75) return 'high';
    if (correlationScore >= 0.55) return 'medium';
    return 'low';
}

/**
 * Generates adapted guidance structure for final_plan
 * Based on psycho-profile and concordance level
 * 
 * @param {Object} psychoTestsData - Psycho tests data
 * @param {Object} initialAnswers - User's initial questionnaire answers
 * @returns {Object|null} Adapted guidance structure or null
 */
function generateAdaptedGuidance(psychoTestsData, initialAnswers) {
    if (!psychoTestsData || !psychoTestsData.personalityTest) {
        return null;
    }
    
    const personalityTest = psychoTestsData.personalityTest;
    const visualTest = psychoTestsData.visualTest;
    const typeCode = personalityTest.typeCode;
    
    if (!typeCode) {
        return null;
    }
    
    // Calculate correlation and concordance
    const correlationScore = calculateCorrelationScore(initialAnswers, personalityTest);
    const concordanceLevel = getConcordanceLevel(correlationScore);
    
    // Map to communication mode
    const communicationMode = mapPersonalityTypeTo8Modes(typeCode);
    
    // Base structure
    const adaptedGuidance = {
        concordanceLevel: concordanceLevel,
        correlationScore: Math.round(correlationScore * 100) / 100,
        personalityType: typeCode,
        visualType: visualTest ? visualTest.profileId : null
    };
    
    // Adaptation level based on concordance
    if (concordanceLevel === 'low') {
        // No adaptation, 7-day observation
        adaptedGuidance.adaptationLevel = 'none';
        adaptedGuidance.observationMode = true;
        adaptedGuidance.observationDays = 7;
        adaptedGuidance.reason = 'Ниска съгласуваност между тестове и въпросник. Препоръчва се 7-дневно наблюдение.';
    } else if (concordanceLevel === 'medium') {
        // Communication only
        adaptedGuidance.adaptationLevel = 'communication_only';
        adaptedGuidance.communicationMode = communicationMode;
        
        // Only tone and length keys (no structure/flexibility)
        const modeKeys = getCommunicationModeKeys(communicationMode);
        adaptedGuidance.keys = {
            tone: modeKeys.tone,
            length: modeKeys.length,
            frequency: modeKeys.frequency
        };
        
        adaptedGuidance.reason = 'Умерена съгласуваност. Адаптира се само комуникационният стил.';
    } else {
        // High concordance - full adaptation
        adaptedGuidance.adaptationLevel = 'full';
        adaptedGuidance.communicationMode = communicationMode;
        
        // Full keys including structure and flexibility
        adaptedGuidance.keys = getCommunicationModeKeys(communicationMode);
        
        // Risk areas and coping strategies
        const riskData = getRiskAreasAndCoping(communicationMode);
        adaptedGuidance.riskAreas = riskData.riskAreas;
        adaptedGuidance.coping = riskData.coping;
        
        adaptedGuidance.reason = 'Висока съгласуваност. Прилага се пълна адаптация.';
    }
    
    return adaptedGuidance;
}

/**
 * Formats adapted guidance for AI prompt
 * Returns a concise text suitable for AI context
 * 
 * @param {Object} adaptedGuidance - Adapted guidance structure
 * @returns {string} Formatted text for AI prompt
 */
function formatAdaptedGuidanceForPrompt(adaptedGuidance) {
    if (!adaptedGuidance) {
        return '';
    }
    
    const { adaptationLevel, concordanceLevel, communicationMode, keys, riskAreas, coping } = adaptedGuidance;
    
    if (adaptationLevel === 'none') {
        return `Психо-профил: Наблюдение (ниска съгласуваност). Използвай generic комуникация.`;
    }
    
    let text = `Комуникационен режим: ${communicationMode}\n`;
    
    if (keys) {
        text += `Тон: ${keys.tone}, Дължина: ${keys.length}`;
        if (keys.structure) {
            text += `, Структура: ${keys.structure}, Гъвкавост: ${keys.flexibility}`;
        }
        text += '\n';
    }
    
    if (riskAreas && riskAreas.length > 0) {
        text += `Рискови области: ${riskAreas.join(', ')}\n`;
    }
    
    if (coping && coping.length > 0) {
        text += `Стратегии: ${coping.join(', ')}`;
    }
    
    return text.trim();
}

// ------------- END HELPER: Psychometric Adaptation Functions (v2.0) -------------

// ------------- START FUNCTION: handleSavePsychTestsRequest -------------
/**
 * Запазва резултатите от психологическите тестове (визуален и личностен)
 * и актуализира analysis данните на потребителя.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
async function handleSavePsychTestsRequest(request, env) {
    try {
        const data = await request.json();
        const userId = data.userId;
        
        if (!userId) {
            return { success: false, message: "Липсва ID на потребител.", statusHint: 400 };
        }

        const { visualTest, personalityTest } = data;

        if (!visualTest && !personalityTest) {
            return { success: false, message: "Липсват данни за тестове.", statusHint: 400 };
        }

        // Валидация на данните
        if (visualTest) {
            if (!visualTest.id || !visualTest.name) {
                return { success: false, message: "Невалидни данни за визуален тест.", statusHint: 400 };
            }
        }

        if (personalityTest) {
            if (!personalityTest.typeCode || !personalityTest.scores) {
                return { success: false, message: "Невалидни данни за личностен тест.", statusHint: 400 };
            }
        }

        // Зареждане на съществуващи analysis данни
        const analysisKey = `${userId}_analysis`;
        const existingAnalysisStr = await env.USER_METADATA_KV.get(analysisKey);
        const analysis = existingAnalysisStr ? safeParseJson(existingAnalysisStr, {}) : {};

        // Добавяне на timestamp
        const timestamp = new Date().toISOString();

        // Актуализиране на analysis данните с резултатите от тестовете
        if (visualTest) {
            analysis.visualTestProfile = {
                profileId: visualTest.id,
                profileName: visualTest.name,
                profileShort: visualTest.short,
                timestamp: visualTest.timestamp || timestamp
            };
        }

        if (personalityTest) {
            analysis.personalityTestProfile = {
                typeCode: personalityTest.typeCode,
                scores: personalityTest.scores,
                riskFlags: personalityTest.riskFlags || [],
                timestamp: personalityTest.timestamp || timestamp
            };
        }

        // Запазваме суровите резултати в initial_answers вместо отделен запис
        const psychTestsToStore = {};
        const normalizedVisualTimestamp = visualTest ? (visualTest.timestamp || timestamp) : null;
        const normalizedPersonalityTimestamp = personalityTest ? (personalityTest.timestamp || timestamp) : null;

        if (visualTest) {
            psychTestsToStore.visualTest = {
                ...visualTest,
                timestamp: normalizedVisualTimestamp
            };
        }
        if (personalityTest) {
            psychTestsToStore.personalityTest = {
                ...personalityTest,
                timestamp: normalizedPersonalityTimestamp
            };
        }

        const timestampCandidates = [
            normalizedVisualTimestamp ? { value: normalizedVisualTimestamp, time: new Date(normalizedVisualTimestamp).getTime() } : null,
            normalizedPersonalityTimestamp ? { value: normalizedPersonalityTimestamp, time: new Date(normalizedPersonalityTimestamp).getTime() } : null
        ].filter(Boolean);

        if (timestampCandidates.length > 0) {
            const latestEntry = timestampCandidates.reduce((acc, entry) => entry.time > acc.time ? entry : acc);
            psychTestsToStore.lastUpdated = latestEntry.value;
        } else {
            psychTestsToStore.lastUpdated = timestamp;
        }

        // Запазване на актуализираните данни
        await env.USER_METADATA_KV.put(analysisKey, JSON.stringify(analysis));
        
        // Зареждаме initial_answers и добавяме psychTests там
        const answersKey = `${userId}_initial_answers`;
        const answersStr = await env.USER_METADATA_KV.get(answersKey);
        const answers = answersStr ? safeParseJson(answersStr, {}) : {};
        
        // Merge existing psychTests with new data to preserve both visual and personality tests
        const existingPsychTests = answers.psychTests || {};
        answers.psychTests = {
            visualTest: psychTestsToStore.visualTest || existingPsychTests.visualTest,
            personalityTest: psychTestsToStore.personalityTest || existingPsychTests.personalityTest,
            lastUpdated: psychTestsToStore.lastUpdated
        };
        await env.USER_METADATA_KV.put(answersKey, JSON.stringify(answers));

        // Проверка дали вече има генериран план
        const planStatus = await env.USER_METADATA_KV.get(`${userId}_plan_status`);
        const hasPlan = planStatus && planStatus !== 'error' && planStatus !== 'pending';

        // Автоматично запазване на резултатите във final_plan (ако планът съществува)
        let addedToFinalPlan = false;
        if (hasPlan) {
            try {
                const finalPlanKey = `${userId}_final_plan`;
                const finalPlanStr = await env.USER_METADATA_KV.get(finalPlanKey);
                
                if (finalPlanStr) {
                    const finalPlan = safeParseJson(finalPlanStr, null);
                    
                    if (finalPlan && typeof finalPlan === 'object') {
                        // Създаваме компактен обект само с ключовите параметри
                        const psychoTestsData = createPsychoTestsProfileData(
                            visualTest, 
                            personalityTest, 
                            { normalizedVisualTimestamp, normalizedPersonalityTimestamp, timestamp }
                        );
                        
                        // Актуализираме final_plan с психо профил данните
                        finalPlan.psychoTestsProfile = psychoTestsData;
                        
                        // v2.0: Adapted guidance ще се генерира отделно чрез /api/applyPsychometricAdaptation
                        // за да не претоварваме основния план с допълнителен анализ
                        
                        // Запазваме актуализирания план
                        await env.USER_METADATA_KV.put(finalPlanKey, JSON.stringify(finalPlan));
                        addedToFinalPlan = true;
                        
                        console.log(`SAVE_PSYCH_TESTS (${userId}): Психо профил данни добавени към final_plan успешно.`);
                    }
                }
            } catch (finalPlanError) {
                console.error(`SAVE_PSYCH_TESTS (${userId}): Грешка при актуализиране на final_plan: ${finalPlanError.message}`);
                // Продължаваме - грешката при актуализиране на final_plan не трябва да провали цялата операция
            }
        }

        // Флаг за регенериране на плана
        // Когато потребителят попълни психотестове, препоръчваме регенериране на плана
        // за да се интегрират психопрофил данните в препоръките и менюто
        let shouldRegeneratePlan = false;
        let regenerationReason = '';
        
        if (hasPlan) {
            if (addedToFinalPlan) {
                // Данните са добавени успешно към съществуващия план
                // Но за пълна интеграция в AI препоръките се препоръчва регенериране
                shouldRegeneratePlan = true;
                regenerationReason = 'Психопрофилът е добавен към плана. Препоръчваме регенериране за пълна интеграция на препоръките.';
                await env.USER_METADATA_KV.put(`${userId}_psycho_regeneration_pending`, JSON.stringify({
                    reason: regenerationReason,
                    timestamp: timestamp,
                    visualTestAdded: !!visualTest,
                    personalityTestAdded: !!personalityTest
                }));
                console.log(`SAVE_PSYCH_TESTS (${userId}): Маркиран за препоръчано регенериране на плана.`);
            } else {
                // Ако има план, но не успяхме да добавим данните, задължително трябва регенериране
                shouldRegeneratePlan = true;
                regenerationReason = 'Необходимо е регенериране на плана за добавяне на психопрофила.';
                await env.USER_METADATA_KV.put(`${userId}_psych_tests_updated`, timestamp);
                console.warn(`SAVE_PSYCH_TESTS (${userId}): Не успя добавянето към final_plan - необходимо регенериране.`);
            }
        }

        return {
            success: true,
            message: "Резултатите от тестовете са запазени успешно.",
            data: {
                visualTestSaved: !!visualTest,
                personalityTestSaved: !!personalityTest,
                addedToFinalPlan,
                shouldRegeneratePlan,
                regenerationReason,
                timestamp: psychTestsToStore.lastUpdated || timestamp
            }
        };
    } catch (error) {
        console.error(`Error in handleSavePsychTestsRequest: ${error.message}\n${error.stack}`);
        return {
            success: false,
            message: "Грешка при запазване на резултатите от тестовете.",
            statusHint: 500
        };
    }
}
// ------------- END FUNCTION: handleSavePsychTestsRequest -------------

// ------------- START FUNCTION: handleApplyPsychometricAdaptationRequest -------------
/**
 * Прилага психометрична адаптация към съществуващ план.
 * Този endpoint се извиква СЛЕД като вече има създаден план и психо-тестове.
 * Генерира adapted guidance базирано на корелация между въпросник и психо-профил.
 * 
 * v2.0: Отделен процес за психометрична адаптация за да не претоварваме основния AI анализ
 * 
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
async function handleApplyPsychometricAdaptationRequest(request, env) {
    try {
        const body = await request.json();
        const { userId } = body;
        
        if (!userId) {
            return { 
                success: false, 
                message: 'userId е задължителен параметър', 
                statusHint: 400 
            };
        }
        
        console.log(`APPLY_PSYCHOMETRIC_ADAPTATION (${userId}): Започва процес на адаптация`);
        
        // 1. Проверка за съществуващ план
        const finalPlanKey = `${userId}_final_plan`;
        const finalPlanStr = await env.USER_METADATA_KV.get(finalPlanKey);
        
        if (!finalPlanStr) {
            return {
                success: false,
                message: 'Не е намерен съществуващ план. Моля първо създайте план.',
                statusHint: 404
            };
        }
        
        const finalPlan = safeParseJson(finalPlanStr, null);
        if (!finalPlan || typeof finalPlan !== 'object') {
            return {
                success: false,
                message: 'Грешка при четене на плана.',
                statusHint: 500
            };
        }
        
        // 2. Проверка за психо-тестове
        const psychoTestsData = finalPlan.psychoTestsProfile;
        
        if (!psychoTestsData || !psychoTestsData.personalityTest) {
            return {
                success: false,
                message: 'Няма налични психологически тестове. Моля попълнете психо-тестовете преди адаптация.',
                statusHint: 400
            };
        }
        
        // 3. Вземане на initial_answers
        const initialAnswersKey = `${userId}_initial_answers`;
        const initialAnswersStr = await env.USER_METADATA_KV.get(initialAnswersKey);
        
        if (!initialAnswersStr) {
            return {
                success: false,
                message: 'Липсва въпросник. Не може да се изчисли корелация.',
                statusHint: 400
            };
        }
        
        const initialAnswers = safeParseJson(initialAnswersStr, {});
        
        // 4. Генериране на adapted guidance
        console.log(`APPLY_PSYCHOMETRIC_ADAPTATION (${userId}): Генериране на adapted guidance`);
        
        let adaptedGuidance = null;
        try {
            adaptedGuidance = generateAdaptedGuidance(psychoTestsData, initialAnswers);
        } catch (guidanceError) {
            console.error(`APPLY_PSYCHOMETRIC_ADAPTATION (${userId}): Грешка при генериране: ${guidanceError.message}`);
            return {
                success: false,
                message: `Грешка при генериране на адаптация: ${guidanceError.message}`,
                statusHint: 500
            };
        }
        
        if (!adaptedGuidance) {
            return {
                success: false,
                message: 'Не успя генериране на adapted guidance.',
                statusHint: 500
            };
        }
        
        // 5. Запазване на adapted guidance в плана
        finalPlan.adaptedGuidance = adaptedGuidance;
        
        // Добавяме timestamp на адаптацията
        if (!finalPlan.adaptationMetadata) {
            finalPlan.adaptationMetadata = {};
        }
        finalPlan.adaptationMetadata.lastAdapted = new Date().toISOString();
        finalPlan.adaptationMetadata.concordanceLevel = adaptedGuidance.concordanceLevel;
        finalPlan.adaptationMetadata.communicationMode = adaptedGuidance.communicationMode;
        
        await env.USER_METADATA_KV.put(finalPlanKey, JSON.stringify(finalPlan));
        
        console.log(`APPLY_PSYCHOMETRIC_ADAPTATION (${userId}): Успешна адаптация. Mode: ${adaptedGuidance.communicationMode}, Concordance: ${adaptedGuidance.concordanceLevel}`);
        
        // 6. Изтриване на pending флага ако съществува
        await env.USER_METADATA_KV.delete(`${userId}_psycho_regeneration_pending`);
        
        return {
            success: true,
            message: 'Психометричната адаптация е приложена успешно.',
            data: {
                concordanceLevel: adaptedGuidance.concordanceLevel,
                correlationScore: adaptedGuidance.correlationScore,
                communicationMode: adaptedGuidance.communicationMode,
                adaptationLevel: adaptedGuidance.adaptationLevel,
                riskAreas: adaptedGuidance.riskAreas || [],
                reason: adaptedGuidance.reason
            }
        };
        
    } catch (error) {
        console.error(`Error in handleApplyPsychometricAdaptationRequest: ${error.message}\n${error.stack}`);
        return {
            success: false,
            message: `Грешка при прилагане на адаптация: ${error.message}`,
            statusHint: 500
        };
    }
}
// ------------- END FUNCTION: handleApplyPsychometricAdaptationRequest -------------

// ------------- START FUNCTION: handleGetPsychTestsRequest -------------
/**
 * Връща последно запазените психологически тестове за потребителя.
 * Пада обратно към analysis профила, ако липсва директен запис.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object>}
 */
async function handleGetPsychTestsRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        if (!userId) return { success: false, message: "Липсва ID на потребител.", statusHint: 400 };

        // Четем от initial_answers
        const answersKey = `${userId}_initial_answers`;
        const answersStr = await env.USER_METADATA_KV.get(answersKey);
        const answers = answersStr ? safeParseJson(answersStr, {}) : {};
        let psychTests = answers.psychTests || null;

        // Fallback към analysis данните (поддържа по-стари записи)
        if (!psychTests || (!psychTests.visualTest && !psychTests.personalityTest)) {
            const analysisStr = await env.USER_METADATA_KV.get(`${userId}_analysis`);
            const analysis = analysisStr ? safeParseJson(analysisStr, {}) : {};
            const fallback = {};

            if (analysis.visualTestProfile) {
                fallback.visualTest = {
                    id: analysis.visualTestProfile.profileId,
                    name: analysis.visualTestProfile.profileName,
                    short: analysis.visualTestProfile.profileShort,
                    timestamp: analysis.visualTestProfile.timestamp
                };
            }

            if (analysis.personalityTestProfile) {
                fallback.personalityTest = {
                    typeCode: analysis.personalityTestProfile.typeCode,
                    scores: analysis.personalityTestProfile.scores,
                    riskFlags: analysis.personalityTestProfile.riskFlags,
                    timestamp: analysis.personalityTestProfile.timestamp
                };
            }

            if (Object.keys(fallback).length > 0) {
                psychTests = { ...fallback };
                const latestTs = fallback.personalityTest?.timestamp || fallback.visualTest?.timestamp;
                if (latestTs) {
                    psychTests.lastUpdated = latestTs;
                }
            }
        }

        return { success: true, data: psychTests || null };
    } catch (error) {
        console.error(`Error in handleGetPsychTestsRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: "Грешка при зареждане на резултатите от тестовете.", statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetPsychTestsRequest -------------

// ------------- START FUNCTION: validatePlanPrerequisites -------------
async function validatePlanPrerequisites(env, userId) {
    // Извличаме всички задължителни елементи, нужни за генериране на план.
    const [
        modelName,            // задължително: идентификатор на модела
        promptTemplate,       // задължително: шаблон за подканата
        initialAnswersStr     // задължително: отговори от въпросника
    ] = await Promise.all([
        env.RESOURCES_KV.get('model_plan_generation'),
        env.RESOURCES_KV.get('prompt_unified_plan_generation_v2'),
        env.USER_METADATA_KV.get(`${userId}_initial_answers`)
    ]);
    if (!initialAnswersStr) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсват първоначални отговори.' };
    }
    let parsedInitial;
    try {
        parsedInitial = JSON.parse(initialAnswersStr);
    } catch {
        parsedInitial = null;
    }
    if (!parsedInitial || typeof parsedInitial !== 'object' || Object.keys(parsedInitial).length === 0) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Некоректни първоначални отговори.' };
    }
    if (!modelName) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва model_plan_generation.' };
    }
    if (!promptTemplate) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва prompt_unified_plan_generation_v2.' };
    }
    const provider = getModelProvider(modelName);
    if (provider === 'gemini' && !env[GEMINI_API_KEY_SECRET_NAME]) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва GEMINI_API_KEY.' };
    }
    if (provider === 'openai' && !env[OPENAI_API_KEY_SECRET_NAME]) {
        await setPlanStatus(userId, 'error', env);
        return { ok: false, message: 'Липсва OPENAI_API_KEY.' };
    }
    // Опционални данни (напр. дневници) не се валидират тук, липсата им е допустима.
    return { ok: true };
}
// ------------- END FUNCTION: validatePlanPrerequisites -------------

// ------------- START FUNCTION: handleCheckPlanPrerequisitesRequest -------------
async function handleCheckPlanPrerequisitesRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
        return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
    }
    try {
        const precheck = await validatePlanPrerequisites(env, userId);
        return { success: true, ...precheck };
    } catch (error) {
        console.error(`Error in handleCheckPlanPrerequisitesRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при проверка на prerequisites.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleCheckPlanPrerequisitesRequest -------------

// ------------- START FUNCTION: handleRegeneratePlanRequest -------------
/**
 * Handles plan regeneration requests.
 * 
 * NOTE: This function executes processSingleUserPlan SYNCHRONOUSLY (with await) instead of 
 * using ctx.waitUntil(). This is intentional to avoid Cloudflare Workers "IoContext timed out 
 * due to inactivity" errors that occur when waitUntil tasks take too long (30-60+ seconds for 
 * AI plan generation). The tradeoff is that the client will wait longer for a response, but 
 * the process will complete reliably. Priority is correctness over speed.
 */
async function handleRegeneratePlanRequest(request, env, ctx, planProcessor = processSingleUserPlan) {
    let body;
    try {
        body = await request.json();
        const { userId } = body;
        if (!userId) {
            return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        }
        const precheck = await validatePlanPrerequisites(env, userId);
        if (!precheck.ok) {
            return { success: false, message: precheck.message, statusHint: 400 };
        }
        await setPlanStatus(userId, 'processing', env);
        // Execute synchronously instead of using waitUntil to avoid timeout issues
        await planProcessor(userId, env);
        return { success: true, message: 'Генерирането на нов план завърши.' };
    } catch (error) {
        console.error(`Error in handleRegeneratePlanRequest: ${error.message}\n${error.stack}`);
        const userId = body?.userId || 'unknown_user';
        // Set plan status to error to prevent stuck in 'processing' state
        if (userId !== 'unknown_user') {
            try {
                await setPlanStatus(userId, 'error', env);
                await env.USER_METADATA_KV.put(`${userId}_processing_error`, `Грешка при генериране на плана: ${error.message}`);
            } catch (statusError) {
                console.error(`Failed to set error status for ${userId}:`, statusError);
            }
        }
        return { success: false, message: 'Грешка при генериране на плана.', statusHint: 500, userId };
    }
}
// ------------- END FUNCTION: handleRegeneratePlanRequest -------------

// ------------- START FUNCTION: handleUpdatePlanRequest -------------
async function handleUpdatePlanRequest(request, env) {
    try {
        const data = await request.json();
        const userId = data.userId;
        const planData = data.planData;
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        if (!planData || typeof planData !== 'object') {
            return { success: false, message: 'Невалидни данни за плана.', statusHint: 400 };
        }
        const safePlan = typeof structuredClone === 'function'
            ? structuredClone(planData)
            : JSON.parse(JSON.stringify(planData));
        if (!safePlan.generationMetadata || typeof safePlan.generationMetadata !== 'object') {
            safePlan.generationMetadata = { timestamp: '', modelUsed: null, errors: [] };
        } else if (!Array.isArray(safePlan.generationMetadata.errors)) {
            safePlan.generationMetadata.errors = [];
        }

        const recordIncident = async (reason, details) => {
            try {
                await env.USER_METADATA_KV.put(
                    `${userId}_plan_update_incident`,
                    JSON.stringify({
                        timestamp: new Date().toISOString(),
                        reason,
                        details
                    })
                );
            } catch (incidentErr) {
                console.error(
                    `MANUAL_PLAN_UPDATE_ERROR (${userId}): Неуспешно записване на инцидент - ${incidentErr.message}`
                );
            }
        };

        const initialGaps = collectPlanMacroGaps(safePlan);
        let planModelName = null;
        if (initialGaps.hasGaps) {
            if (!env.RESOURCES_KV || typeof env.RESOURCES_KV.get !== 'function') {
                const msg = 'Липсва достъп до AI ресурсите за корекции на плана.';
                console.error(`MANUAL_PLAN_UPDATE_ERROR (${userId}): ${msg}`);
                await recordIncident('missing-ai-config', { message: msg });
                return { success: false, message: msg, statusHint: 500 };
            }
            planModelName = await env.RESOURCES_KV.get('model_plan_generation');
            if (!planModelName) {
                const msg = 'AI моделът за планове не е конфигуриран.';
                console.error(`MANUAL_PLAN_UPDATE_ERROR (${userId}): ${msg}`);
                await recordIncident('missing-ai-model', { message: msg });
                return { success: false, message: msg, statusHint: 500 };
            }
            const providerForPlan = getModelProvider(planModelName);
            if (providerForPlan === 'gemini' && !env[GEMINI_API_KEY_SECRET_NAME]) {
                const msg = 'Липсва Gemini API ключ за корекции на плана.';
                console.error(`MANUAL_PLAN_UPDATE_ERROR (${userId}): ${msg}`);
                await recordIncident('missing-gemini-key', { message: msg });
                return { success: false, message: msg, statusHint: 500 };
            }
            if (providerForPlan === 'openai' && !env[OPENAI_API_KEY_SECRET_NAME]) {
                const msg = 'Липсва OpenAI API ключ за корекции на плана.';
                console.error(`MANUAL_PLAN_UPDATE_ERROR (${userId}): ${msg}`);
                await recordIncident('missing-openai-key', { message: msg });
                return { success: false, message: msg, statusHint: 500 };
            }
            if (providerForPlan === 'cohere' && !env[COMMAND_R_PLUS_SECRET_NAME]) {
                const msg = 'Липсва Command R+ API ключ за корекции на плана.';
                console.error(`MANUAL_PLAN_UPDATE_ERROR (${userId}): ${msg}`);
                await recordIncident('missing-cohere-key', { message: msg });
                return { success: false, message: msg, statusHint: 500 };
            }
        }

        const manualCorrectionPrompt = [
            'Действай като нутриционист, който преглежда готов хранителен план.',
            'Запази всички хранения, ред и описания, но попълни липсващите макроси (калории, протеин, въглехидрати, мазнини).',
            'Отговори само с валиден JSON, без обяснения.'
        ].join(' ');
        // Manual plan update logging removed for production
        const manualLog = async () => {}; // No-op function
        const enforcementResult = await enforceCompletePlanBeforePersist({
            plan: safePlan,
            userId,
            env,
            planModelName,
            basePrompt: manualCorrectionPrompt,
            addLog: manualLog,
            retryArtifactKey: initialGaps.hasGaps ? `${userId}_manual_plan_macro_retry` : null
        });

        if (!enforcementResult.success) {
            const failureMessage = 'Планът съдържа непопълнени макроси и автоматичната корекция не успя.';
            console.error(`MANUAL_PLAN_UPDATE_ERROR (${userId}): ${failureMessage}`);
            await recordIncident('macro-validation-failed', enforcementResult.finalMacroGaps);
            return { success: false, message: failureMessage, statusHint: 422 };
        }

        const validatedPlan = enforcementResult.plan;
        if (!validatedPlan.generationMetadata || typeof validatedPlan.generationMetadata !== 'object') {
            validatedPlan.generationMetadata = { timestamp: '', modelUsed: planModelName || null, errors: [] };
        }
        if (!Array.isArray(validatedPlan.generationMetadata.errors)) {
            validatedPlan.generationMetadata.errors = [];
        }
        if (!validatedPlan.generationMetadata.timestamp) {
            validatedPlan.generationMetadata.timestamp = new Date().toISOString();
        }
        if (!validatedPlan.generationMetadata.modelUsed && planModelName) {
            validatedPlan.generationMetadata.modelUsed = planModelName;
        }

        await env.USER_METADATA_KV.put(`${userId}_final_plan`, JSON.stringify(validatedPlan));
        const macrosRecord = {
            status: 'final',
            data: validatedPlan.caloriesMacros ? { ...validatedPlan.caloriesMacros } : null
        };
        await env.USER_METADATA_KV.put(`${userId}_analysis_macros`, JSON.stringify(macrosRecord));
        await env.USER_METADATA_KV.delete(`${userId}_manual_plan_macro_retry`);
        await setPlanStatus(userId, 'ready', env);
        return { success: true, message: 'Планът е обновен успешно' };
    } catch (error) {
        console.error(`Error in handleUpdatePlanRequest: ${error.message}\n${error.stack}`);
        const uid = (await request.json().catch(() => ({}))).userId || 'unknown_user';
        return { success: false, message: 'Грешка при запис на плана.', statusHint: 500, userId: uid };
    }
}
// ------------- END FUNCTION: handleUpdatePlanRequest -------------

// ------------- START FUNCTION: handleRequestPasswordReset -------------
async function handleRequestPasswordReset(request, env) {
    try {
        const { email } = await request.json();
        const clean = email ? String(email).trim().toLowerCase() : '';
        if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
            return { success: false, message: 'Невалиден имейл.', statusHint: 400 };
        }
        const userId = await env.USER_METADATA_KV.get(`email_to_uuid_${clean}`);
        if (!userId) {
            return { success: true, message: 'Ако имейлът съществува, ще получите линк за смяна на паролата.' };
        }
        const token = crypto.randomUUID();
        await env.USER_METADATA_KV.put(`pwreset_${token}`, userId, { expirationTtl: 3600 });
        try {
            await sendPasswordResetEmail(clean, token, env);
        } catch (err) {
            console.error('Failed to send password reset email:', err);
            // Don't fail the request - token is created and valid
        }
        return { success: true, message: 'Изпратихме линк за смяна на паролата.' };
    } catch (error) {
        console.error(`Error in handleRequestPasswordReset: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при заявката.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleRequestPasswordReset -------------

// ------------- START FUNCTION: handlePerformPasswordReset -------------
async function handlePerformPasswordReset(request, env) {
    try {
        const { token, password, confirm_password } = await request.json();
        if (!token) return { success: false, message: 'Липсва токен.', statusHint: 400 };
        if (!password || password.length < 8) {
            return { success: false, message: 'Паролата трябва да е поне 8 знака.', statusHint: 400 };
        }
        if (confirm_password !== undefined && password !== confirm_password) {
            return { success: false, message: 'Паролите не съвпадат.', statusHint: 400 };
        }
        const userId = await env.USER_METADATA_KV.get(`pwreset_${token}`);
        if (!userId) return { success: false, message: 'Невалиден или изтекъл токен.', statusHint: 400 };
        const credStr = await env.USER_METADATA_KV.get(`credential_${userId}`);
        if (!credStr) return { success: false, message: 'Потребителят не е намерен.', statusHint: 404 };
        const cred = safeParseJson(credStr, {});
        cred.passwordHash = await hashPassword(password);
        await env.USER_METADATA_KV.put(`credential_${userId}`, JSON.stringify(cred));
        await env.USER_METADATA_KV.delete(`pwreset_${token}`);
        return { success: true, message: 'Паролата е обновена успешно.' };
    } catch (error) {
        console.error(`Error in handlePerformPasswordReset: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при смяна на паролата.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePerformPasswordReset -------------


// ------------- START FUNCTION: handleAcknowledgeAiUpdateRequest -------------
async function handleAcknowledgeAiUpdateRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            console.warn("ACK_AI_UPDATE_ERROR: Missing userId.");
            return { success: false, message: 'Липсва потребителско ID (userId).', statusHint: 400 };
        }
        await env.USER_METADATA_KV.delete(`${userId}_ai_update_pending_ack`); // Използваме новия ключ
        // AI update summary acknowledged and cleared
        return { success: true, message: "Резюмето от AI е потвърдено и скрито." };
    } catch (error) {
        console.error(`Error in handleAcknowledgeAiUpdateRequest: ${error.message}\n${error.stack}`);
        const userIdFromBody = (await request.json().catch(() => ({}))).userId || 'unknown';
        return { success: false, message: "Грешка при потвърждаване на резюмето от AI.", statusHint: 500, userId: userIdFromBody };
    }
}
// ------------- END FUNCTION: handleAcknowledgeAiUpdateRequest -------------

// ------------- START FUNCTION: handleRecordFeedbackChatRequest -------------
async function handleRecordFeedbackChatRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) return { success: false, message: 'Липсва потребителско ID (userId).', statusHint: 400 };
        await env.USER_METADATA_KV.put(`${userId}_last_feedback_chat_ts`, Date.now().toString());
        return { success: true };
    } catch (error) {
        console.error(`Error in handleRecordFeedbackChatRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис на времето на обратната връзка.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleRecordFeedbackChatRequest -------------

// ------------- START FUNCTION: handleSubmitFeedbackRequest -------------
async function handleSubmitFeedbackRequest(request, env) {
    let data = {};
    try {
        data = await request.json();
    } catch (err) {
        console.error(`Error parsing feedback JSON: ${err.message}\n${err.stack}`);
        return { success: false, message: 'Невалидни данни.', statusHint: 400 };
    }
    const userId = data.userId;
    if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };

    const feedback = {
        type: data.type ? String(data.type) : '',
        message: data.message ? String(data.message) : '',
        rating: (typeof data.rating === 'number' && !isNaN(data.rating)) ? data.rating : null,
        timestamp: new Date().toISOString()
    };

    try {
        const key = `feedback_${userId}_${Date.now()}`;
        await env.USER_METADATA_KV.put(key, JSON.stringify(feedback));

        const listKey = `${userId}_feedback_messages`;
        const existing = safeParseJson(await env.USER_METADATA_KV.get(listKey), []);
        existing.push(feedback);
        await env.USER_METADATA_KV.put(listKey, JSON.stringify(existing));

        return { success: true, message: 'Обратната връзка е записана.' };
    } catch (error) {
        console.error(`Error in handleSubmitFeedbackRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис на обратната връзка.', statusHint: 500, userId };
    }
}
// ------------- END FUNCTION: handleSubmitFeedbackRequest -------------

// ------------- START FUNCTION: handleGetAchievementsRequest -------------
async function handleGetAchievementsRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        const achStr = await env.USER_METADATA_KV.get(`${userId}_achievements`);
        let achievements = safeParseJson(achStr, []);
        let updated = false;
        achievements = achievements.map(a => {
            if (!a.emoji || /<.*>/.test(a.emoji)) {
                a.emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
                updated = true;
            }
            return a;
        });
        if (updated) await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
        return { success: true, achievements };
    } catch (error) {
        console.error(`Error in handleGetAchievementsRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на постижения.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAchievementsRequest -------------

// ------------- START FUNCTION: handleGeneratePraiseRequest -------------
async function handleGeneratePraiseRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };

        const now = Date.now();
        const lastTsStr = await env.USER_METADATA_KV.get(`${userId}_last_praise_ts`);
        const achStr = await env.USER_METADATA_KV.get(`${userId}_achievements`);
        let achievements = safeParseJson(achStr, []);
        let updated = false;
        achievements = achievements.map(a => {
            if (!a.emoji || /<.*>/.test(a.emoji)) {
                a.emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
                updated = true;
            }
            return a;
        });
        if (updated) await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));

        if (!lastTsStr && achievements.length === 0) {
            const title = 'Първа стъпка';
            const message = 'Ти направи нещо, което мнозина отлагат с месеци, години, а други въобще не започват — реши да направиш първата крачка към твоето по-добро АЗ.\nОттук нататък ние сме част от твоята кауза и стъпките, които правиш с нашата подкрепа ще донесат резултат\nСамото присъствие тук вече те отличава!';
            const emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
            const newAch = { date: now, title, message, emoji };
            achievements.push(newAch);
            await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
            await env.USER_METADATA_KV.put(`${userId}_last_praise_ts`, now.toString());
            return { success: true, title, message, emoji };
        }

        if (lastTsStr && now - parseInt(lastTsStr, 10) < PRAISE_INTERVAL_DAYS * 86400000) {
            const lastAch = achievements[achievements.length - 1] || null;
            return { success: true, alreadyGenerated: true, ...(lastAch || {}) };
        }

        const initialAnswersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const initialAnswers = safeParseJson(initialAnswersStr, {});

        const [finalPlanStr, currentStatusStr, lastSnapshotStr] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_last_praise_analytics`)
        ]);
        const finalPlan = safeParseJson(finalPlanStr, {});
        const currentStatus = safeParseJson(currentStatusStr, {});

        const logKeys = [];
        const today = new Date();
        for (let i = 0; i < PRAISE_INTERVAL_DAYS; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            logKeys.push(`${userId}_log_${d.toISOString().split('T')[0]}`);
        }
        const logStrings = await Promise.all(logKeys.map(k => env.USER_METADATA_KV.get(k)));
        const logs = logStrings.map((ls, idx) => {
            if (ls) { const d = new Date(today); d.setDate(today.getDate() - idx); return { date: d.toISOString().split('T')[0], data: safeParseJson(ls, {}) }; }
            return null;
        }).filter(Boolean);

        const analyticsLogKeys = [];
        for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            analyticsLogKeys.push(`${userId}_log_${d.toISOString().split('T')[0]}`);
        }
        const analyticsLogStrings = await Promise.all(analyticsLogKeys.map(k => env.USER_METADATA_KV.get(k)));
        const analyticsLogs = analyticsLogStrings.map((ls, idx) => {
            if (ls) { const d = new Date(today); d.setDate(today.getDate() - idx); return { date: d.toISOString().split('T')[0], data: safeParseJson(ls, {}) }; }
            return null;
        }).filter(entry => entry && Object.keys(entry.data).length > 0);

        const analyticsData = await calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, analyticsLogs, currentStatus);
        const bmiMetric = analyticsData.detailed.find(m => m.key === 'bmi_status');
        const currentSnapshot = {
            goalProgress: analyticsData.current.goalProgress,
            overallHealthScore: analyticsData.current.overallHealthScore,
            bmi: bmiMetric?.currentValueNumeric ?? null
        };
        const prevSnapshot = safeParseJson(lastSnapshotStr, null);
        if (!currentSnapshot.bmi || currentSnapshot.bmi < 18.5 || currentSnapshot.bmi > 25 ||
            (prevSnapshot && ((currentSnapshot.goalProgress - (prevSnapshot.goalProgress || 0)) + (currentSnapshot.overallHealthScore - (prevSnapshot.overallHealthScore || 0)) <= 0))) {
            return { success: false, message: 'No significant progress' };
        }

        const avgMetric = (key) => {
            let sum = 0, count = 0;
            logs.forEach(l => { const v = parseFloat(l.data[key]); if (!isNaN(v)) { sum += v; count++; } });
            return count > 0 ? (sum / count).toFixed(1) : 'N/A';
        };

        const mealAdh = () => {
            let total = 0, done = 0;
            logs.forEach(l => {
                const cs = l.data.completedMealsStatus || {};
                const vals = Object.values(cs);
                done += vals.filter(v => v === true).length;
                total += vals.length;
            });
            return total > 0 ? Math.round((done / total) * 100) : 0;
        };

        const promptTpl = await env.RESOURCES_KV.get('prompt_praise_generation');
        const geminiKey = env[GEMINI_API_KEY_SECRET_NAME];
        const openaiKey = env[OPENAI_API_KEY_SECRET_NAME];
        const model = await getCachedResource('model_chat', env.RESOURCES_KV) || await env.RESOURCES_KV.get('model_plan_generation');

        let title = 'Браво!';
        let message = 'Продължавай в същия дух!';

        const providerForPraise = getModelProvider(model);
        if (promptTpl && model && ((providerForPraise === 'gemini' && geminiKey) || (providerForPraise === 'openai' && openaiKey) || providerForPraise === 'cf')) {
            const replacements = createPraiseReplacements(initialAnswers, logs, avgMetric, mealAdh);
            const populated = populatePrompt(promptTpl, replacements);
            try {
                const raw = await callModelRef.current(model, populated, env, { temperature: 0.6, maxTokens: 400 });
                const cleaned = cleanGeminiJson(raw);
                const parsed = safeParseJson(cleaned, null);
                if (parsed && parsed.title && parsed.message) {
                    title = parsed.title; message = parsed.message;
                } else {
                    message = cleaned;
                }
            } catch (err) {
                console.error('Praise generation AI error:', err.message);
            }
        }

        const emoji = MEDAL_ICONS[Math.floor(Math.random() * MEDAL_ICONS.length)];
        const newAch = { date: now, title, message, emoji };
        achievements.push(newAch);
        if (achievements.length > 7) achievements.shift();
        await env.USER_METADATA_KV.put(`${userId}_achievements`, JSON.stringify(achievements));
        await env.USER_METADATA_KV.put(`${userId}_last_praise_ts`, now.toString());
        await env.USER_METADATA_KV.put(`${userId}_last_praise_analytics`, JSON.stringify(currentSnapshot));

        return { success: true, title, message, emoji };
    } catch (error) {
        console.error(`Error in handleGeneratePraiseRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при генериране на похвала.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGeneratePraiseRequest -------------

// ------------- START FUNCTION: estimateMacros -------------
function calcMacroGrams(calories, percent, calsPerGram) {
    const cal = Number(calories);
    const pct = Number(percent);
    if (!cal || !pct) return 0;
    return Math.round((cal * pct) / 100 / calsPerGram);
}

function estimateMacros(initial = {}) {
    const weight = Number(initial.weight);
    const height = Number(initial.height);
    const age = Number(initial.age);
    if (!weight || !height || !age) return null;
    
    const gender = (initial.gender || '').toLowerCase().startsWith('м') ? 'male' : 'female';
    
    // Combine daily activity level and sport activity level for total activity factor
    const dailyActivity = (initial.dailyActivityLevel || '').toLowerCase();
    const sportActivity = (initial.sportActivity || initial.sportActivityLevel || '').toLowerCase();
    
    // Base activity factors from dailyActivityLevel
    const dailyFactors = {
        'ниско': 1.2,
        'средно': 1.375,
        'високо': 1.55
    };
    
    // Sport activity bonus
    const sportBonus = {
        'висока': 0.2,        // 5-7 days/week
        'средна': 0.1,        // 2-4 days/week
        'ниска': 0.05,        // 1-2 days/week
        'никаква': 0          // 0 days/week
    };
    
    let baseFactor = dailyFactors[dailyActivity] || 1.375;
    let bonus = 0;
    // Use startsWith for more reliable matching of sport activity levels
    for (const [key, val] of Object.entries(sportBonus)) {
        if (sportActivity.startsWith(key)) {
            bonus = val;
            break;
        }
    }
    const factor = baseFactor + bonus;
    
    // Calculate BMR using Mifflin-St Jeor equation
    const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
    let tdee = Math.round(bmr * factor);
    
    // Adjust calories based on goal
    const goal = (initial.goal || '').toLowerCase();
    let calorieAdjustment = 0;
    
    if (goal.includes('отслабване') || goal.includes('weight loss') || goal.includes('загуба')) {
        // Weight loss: deficit of 300-500 kcal depending on how much to lose
        const lossKg = Number(initial.lossKg) || 5;
        calorieAdjustment = lossKg > 10 ? -500 : (lossKg > 5 ? -400 : -300);
    } else if (goal.includes('покачване') || goal.includes('muscle') || goal.includes('мускул')) {
        // Muscle gain: surplus of 200-300 kcal
        calorieAdjustment = 250;
    }
    // Maintenance/Оформяне/Health improvement: no adjustment
    
    let calories = Math.round(tdee + calorieAdjustment);
    
    // Determine macro distribution based on goal, activity, and diet preference
    let protein_percent = 30;
    let carbs_percent = 40;
    let fat_percent = 30;
    
    // Check for diet preference (from question 25)
    const dietPref = Array.isArray(initial.dietPreference) ? initial.dietPreference : [];
    const dietType = (initial.dietType || '').toLowerCase();
    
    // Keto preference - use exact match for preference value
    const isKeto = dietPref.some(d => d === 'Кето') || 
                   dietType.startsWith('кето') || dietType.startsWith('keto');
    
    // High protein preference - use exact match
    const isHighProtein = dietPref.some(d => d === 'Високопротеинова');
    
    // Note: Vegan, Vegetarian, and Fasting preferences are captured in dietPreference
    // and can be used for food recommendations in the AI prompt
    
    if (goal.includes('отслабване') || goal.includes('weight loss')) {
        // Weight loss: higher protein to preserve muscle mass
        protein_percent = 35;
        carbs_percent = 35;
        fat_percent = 30;
        
        // If high sport activity, increase carbs slightly
        if (sportActivity.includes('висока') || sportActivity.includes('средна')) {
            protein_percent = 30;
            carbs_percent = 40;
            fat_percent = 30;
        }
    } else if (goal.includes('покачване') || goal.includes('muscle')) {
        // Muscle gain: higher carbs for energy
        protein_percent = 25;
        carbs_percent = 45;
        fat_percent = 30;
    } else if (goal.includes('антиейджинг') || goal.includes('anti-aging')) {
        // Anti-aging: balanced with emphasis on protein
        protein_percent = 30;
        carbs_percent = 35;
        fat_percent = 35;
    }
    
    // Adjust for keto preference
    if (isKeto) {
        protein_percent = 25;
        carbs_percent = 10;
        fat_percent = 65;
    }
    
    // Adjust for high protein preference
    if (isHighProtein && !isKeto) {
        protein_percent = Math.min(40, protein_percent + 10);
        carbs_percent = Math.max(25, carbs_percent - 5);
        fat_percent = Math.max(25, fat_percent - 5);
    }
    
    const protein_grams = calcMacroGrams(calories, protein_percent, 4);
    const carbs_grams = calcMacroGrams(calories, carbs_percent, 4);
    const fat_grams = calcMacroGrams(calories, fat_percent, 9);
    
    // Calculate fiber based on recommended 14g per 1000 calories
    const fiber_grams = Math.round((calories / 1000) * 14);
    const fiber_percent = Math.round((fiber_grams * 2 * 100) / calories);
    
    return { 
        calories, 
        protein_percent, 
        carbs_percent, 
        fat_percent, 
        protein_grams, 
        carbs_grams, 
        fat_grams, 
        fiber_grams, 
        fiber_percent 
    };
}
// ------------- END FUNCTION: estimateMacros -------------

// ------------- START FUNCTION: handleAnalyzeInitialAnswers -------------
async function handleAnalyzeInitialAnswers(userId, env) {
    try {
        if (!userId) {
            console.warn('INITIAL_ANALYSIS_ERROR: Missing userId.');
            return;
        }
        const answersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        if (!answersStr) {
            console.warn(`INITIAL_ANALYSIS_ERROR (${userId}): No initial answers found.`);
            return;
        }
        const answers = safeParseJson(answersStr, {});
        const promptTpl = await env.RESOURCES_KV.get('prompt_questionnaire_analysis');
        const modelName = await env.RESOURCES_KV.get('model_questionnaire_analysis');
        const provider = getModelProvider(modelName);
        if (!promptTpl || !modelName ||
            (provider === 'gemini' && !env[GEMINI_API_KEY_SECRET_NAME]) ||
            (provider === 'openai' && !env[OPENAI_API_KEY_SECRET_NAME])) {
            console.warn(`INITIAL_ANALYSIS_ERROR (${userId}): Missing prompt, model or API key.`);
            return;
        }
        const populated = populatePrompt(promptTpl, { '%%ANSWERS_JSON%%': JSON.stringify(answers) });
        const raw = await callModelRef.current(modelName, populated, env, { temperature: 0.5, maxTokens: 2500 });
        const cleaned = cleanGeminiJson(raw);
        await env.USER_METADATA_KV.put(`${userId}_analysis`, cleaned);
        await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'ready');
        // Initial analysis stored
        // Имейлът с линк към анализа вече се изпраща при подаване на въпросника,
        // затова тук не се изпраща повторно.
    } catch (error) {
        console.error(`Error in handleAnalyzeInitialAnswers (${userId}): ${error.message}\n${error.stack}`);
        try {
            await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'error');
        } catch (e) {
            console.error('Failed to record analysis status error:', e);
        }
    }
}
// ------------- END FUNCTION: handleAnalyzeInitialAnswers -------------

// ------------- START FUNCTION: handleGetInitialAnalysisRequest -------------
async function handleGetInitialAnalysisRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };
        const analysisStr = await env.USER_METADATA_KV.get(`${userId}_analysis`);
        const analysis = safeParseJson(analysisStr, analysisStr || null);
        return { success: true, analysis };
    } catch (error) {
        console.error(`Error in handleGetInitialAnalysisRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на анализа.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetInitialAnalysisRequest -------------

// ------------- START FUNCTION: handleReAnalyzeQuestionnaireRequest -------------
async function handleReAnalyzeQuestionnaireRequest(request, env, ctx) {
    try {
        const { userId: id, email } = await request.json();
        let userId = id ? String(id).trim() : '';
        const cleanEmail = email ? String(email).trim().toLowerCase() : '';
        if (!userId && cleanEmail) {
            userId = await env.USER_METADATA_KV.get(`email_to_uuid_${cleanEmail}`);
        }
        if (!userId) {
            return { success: false, message: 'Липсва userId или email.', statusHint: 400 };
        }
        const answersStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        if (!answersStr) {
            return { success: false, message: 'Няма съхранен въпросник.', statusHint: 404 };
        }
        if (ctx) {
            ctx.waitUntil(handleAnalyzeInitialAnswers(userId, env));
            await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        } else {
            await handleAnalyzeInitialAnswers(userId, env);
            await env.USER_METADATA_KV.put(`${userId}_analysis_status`, 'pending');
        }
        const baseUrl = env[ANALYSIS_PAGE_URL_VAR_NAME] || 'https://radilovk.github.io/bodybest/reganalize/analyze.html';
        const url = new URL(baseUrl);
        url.searchParams.set('userId', userId);
        return { success: true, userId, link: url.toString() };
    } catch (error) {
        console.error(`Error in handleReAnalyzeQuestionnaireRequest: ${error.message}\n${error.stack}`);
        const body = await request.json().catch(() => ({}));
        return { success: false, message: 'Грешка при стартиране на анализа.', statusHint: 500, userId: body.userId || 'unknown' };
    }
}
// ------------- END FUNCTION: handleReAnalyzeQuestionnaireRequest -------------

// ------------- START FUNCTION: handleUploadTestResult -------------
async function handleUploadTestResult(request, env) {
    try {
        const { userId, result } = await request.json();
        if (!userId || !result) {
            return { success: false, message: 'Липсват userId или result.', statusHint: 400 };
        }
        await createUserEvent('testResult', userId, { result }, env);
        return { success: true };
    } catch (error) {
        console.error(`Error in handleUploadTestResult: ${error.message}\n${error.stack}`);
        const body = await request.json().catch(() => ({}));
        return { success: false, message: 'Грешка при запис на резултата.', statusHint: 500, userId: body.userId || 'unknown' };
    }
}
// ------------- END FUNCTION: handleUploadTestResult -------------

// ------------- START FUNCTION: handleUploadIrisDiag -------------
async function handleUploadIrisDiag(request, env) {
    try {
        const { userId, data } = await request.json();
        if (!userId || !data) {
            return { success: false, message: 'Липсват userId или данни.', statusHint: 400 };
        }
        await createUserEvent('irisDiag', userId, { data }, env);
        return { success: true };
    } catch (error) {
        console.error(`Error in handleUploadIrisDiag: ${error.message}\n${error.stack}`);
        const body = await request.json().catch(() => ({}));
        return { success: false, message: 'Грешка при запис на данните.', statusHint: 500, userId: body.userId || 'unknown' };
    }
}
// ------------- END FUNCTION: handleUploadIrisDiag -------------

// ------------- START FUNCTION: handleAiHelperRequest -------------
async function handleAiHelperRequest(request, env) {
    try {
        const { userId, lookbackDays = 3, prompt = 'Обобщи следните логове' } = await request.json();
        if (!userId) {
            console.warn('AI_HELPER_ERROR: Missing userId.');
            return { success: false, message: 'Липсва userId.', statusHint: 400 };
        }

        const days = Math.min(Math.max(parseInt(lookbackDays, 10) || 3, 1), 14);
        const logKeys = [];
        const today = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            logKeys.push(`${userId}_log_${d.toISOString().split('T')[0]}`);
        }
        const logStrings = await Promise.all(logKeys.map(k => env.USER_METADATA_KV.get(k)));
        const logs = logStrings.map((s, idx) => {
            if (s) { const d = new Date(today); d.setDate(today.getDate() - idx); return { date: d.toISOString().split('T')[0], data: safeParseJson(s, {}) }; }
            return null;
        }).filter(Boolean);

        const textInput = `${prompt}:\n${JSON.stringify(logs)}`;
        const aiResp = await callCfAi(
            '@cf/meta/llama-3-8b-instruct',
            {
                messages: [{ role: 'user', content: textInput }],
                stream: false
            },
            env
        );
        return { success: true, aiResponse: aiResp };
    } catch (error) {
        console.error(`Error in handleAiHelperRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: `Грешка от Cloudflare AI: ${error.message}`, statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAiHelperRequest -------------

// ------------- START FUNCTION: handleAnalyzeImageRequest -------------
async function handleAnalyzeImageRequest(request, env) {
    const identifier =
        (request.headers?.get?.('Authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
        request.headers?.get?.('CF-Connecting-IP') || '';

    if (await checkRateLimit(env, 'analyzeImage', identifier)) {
        return { success: false, message: 'Прекалено много заявки. Опитайте по-късно.', statusHint: 429 };
    }

    let payloadData;
    try {
        payloadData = await request.json();
    } catch {
        return { success: false, message: 'Невалиден JSON.', statusHint: 400 };
    }

    await recordUsage(env, 'analyzeImage', identifier);
    try {
        const { userId, image, imageData, mimeType, prompt } = payloadData;
        if (!userId || (!image && !imageData)) {
            return { success: false, message: 'Липсва изображение или userId.', statusHint: 400 };
        }

        let base64 = imageData || '';
        let finalMime = mimeType;
        if (typeof image === 'string') {
            if (!image.startsWith('data:image/')) {
                return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
            }
            const match = /^data:([^;]+);base64,(.+)$/.exec(image);
            if (!match) {
                return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
            }
            finalMime = match[1];
            base64 = match[2];
        } else if (typeof base64 === 'string' && base64.startsWith('data:')) {
            const match = /^data:([^;]+);base64,(.+)$/.exec(base64);
            if (match) {
                finalMime = match[1];
                base64 = match[2];
            }
            if (!base64 || !finalMime.startsWith('image/')) {
                return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
            }
        }
        if (finalMime && !finalMime.startsWith('image/')) {
            return { success: false, message: 'Невалиден MIME тип.', statusHint: 400 };
        }
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
            return { success: false, message: 'Невалиден Base64 стринг.', statusHint: 400 };
        }

        const buf = typeof globalThis.Buffer !== 'undefined'
            ? new Uint8Array(globalThis.Buffer.from(base64, 'base64'))
            : (() => {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return bytes;
            })();
        const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
        const png =
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a;
        if (!jpeg && !png) {
            return { success: false, message: 'Невалиден формат на изображението.', statusHint: 400 };
        }

        const modelFromKv = env.RESOURCES_KV ? await env.RESOURCES_KV.get('model_image_analysis') : null;
        let kvPrompt = null;
        if (env.RESOURCES_KV) {
            const raw = await env.RESOURCES_KV.get('prompt_image_analysis');
            kvPrompt = raw && raw !== modelFromKv ? raw : null;
        }
        const finalPrompt = prompt || kvPrompt || 'Опиши съдържанието на това изображение.';
        const modelName = modelFromKv || '@cf/stabilityai/clip';
        const provider = getModelProvider(modelName);

        if (provider === 'cf') {
            const usingBinding = env.AI && typeof env.AI.run === 'function';
            if (!usingBinding) {
                const missing = [];
                if (!env[CF_AI_TOKEN_SECRET_NAME]) missing.push('CF_AI_TOKEN');
                if (!(env[CF_ACCOUNT_ID_VAR_NAME] || env.accountId || env.ACCOUNT_ID)) missing.push('CF_ACCOUNT_ID');
                if (missing.length) {
                    const verb = missing.length > 1 ? 'Липсват' : 'Липсва';
                    return { success: false, message: `${verb} ${missing.join(' и ')}.`, statusHint: 500 };
                }
            }
        } else if (provider === 'gemini') {
            if (!env[GEMINI_API_KEY_SECRET_NAME]) {
                return { success: false, message: 'Липсва GEMINI_API_KEY.', statusHint: 500 };
            }
        }

        let aiResp;
        if (provider === 'cf') {
            // Processing image with Cloudflare AI
            const dataUrl = `data:${finalMime || 'image/jpeg'};base64,${base64}`;
            const payload = buildCfImagePayload(modelName, dataUrl, finalPrompt);
            aiResp = await callCfAi(modelName, payload, env);
        } else if (provider === 'gemini') {
            // Processing image with Gemini
            const key = env[GEMINI_API_KEY_SECRET_NAME];
            if (!key) throw new Error('Missing Gemini API key.');
            aiResp = await callGeminiVisionAPI(
                base64,
                finalMime || 'image/jpeg',
                key,
                finalPrompt,
                { temperature: 0.2, maxOutputTokens: 200 },
                modelName
            );
        } else {
            // Processing image with default model
            const textPrompt = finalPrompt || `Опиши съдържанието на това изображение: ${base64}`;
            aiResp = await callModelRef.current(modelName, textPrompt, env, { temperature: 0.2, maxTokens: 200 });
        }

        return { success: true, result: aiResp };
    } catch (error) {
        console.error(`Error in handleAnalyzeImageRequest: ${error.message}\n${error.stack}`);
        if (/failed to decode u8|Tensor error/i.test(error.message)) {
            return {
                success: false,
                message: 'Невалидни или повредени данни на изображението.',
                statusHint: 400
            };
        }
        return {
            success: false,
            message: `Грешка при анализа на изображението: ${error.message}`,
            statusHint: 500
        };
    }
}
// ------------- END FUNCTION: handleAnalyzeImageRequest -------------
// ------------- START FUNCTION: handleRunImageModelRequest -------------
async function handleRunImageModelRequest(request, env) {
    let data;
    try {
        data = await request.json();
    } catch {
        return { success: false, message: 'Невалиден JSON.', statusHint: 400 };
    }
    const { model, prompt, image } = data || {};
    if (typeof model !== 'string' || !model || typeof prompt !== 'string' || !prompt || !Array.isArray(image)) {
        return { success: false, message: 'Липсват данни за модел, описание или изображение.', statusHint: 400 };
    }
    try {
        const bytes = new Uint8Array(image);
        const result = await env.AI.run(model, { prompt, image: bytes });
        return { success: true, result };
    } catch (error) {
        console.error(`Error in handleRunImageModelRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при анализа на изображението.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleRunImageModelRequest -------------

// ------------- START FUNCTION: handleListClientsRequest -------------
async function handleListClientsRequest(request, env) {
    try {
        const idsStr = await env.USER_METADATA_KV.get('all_user_ids');
        let userIds = safeParseJson(idsStr, []);
        if (!Array.isArray(userIds) || userIds.length === 0) {
            try {
                const list = await env.USER_METADATA_KV.list({ prefix: '' });
                userIds = list.keys
                    .map(k => k.name)
                    .filter(n => n.endsWith('_initial_answers'))
                    .map(n => n.replace('_initial_answers', ''));
                if (userIds.length > 0) {
                    await env.USER_METADATA_KV.put('all_user_ids', JSON.stringify(userIds));
                    // Rebuilt all_user_ids index
                }
            } catch (err) {
                console.warn('Fallback listing failed in handleListClientsRequest:', err.message);
                userIds = [];
            }
        }
        const clients = [];
        for (const id of userIds) {
            const [ansStr, profileStr, planStatus, statusStr] = await Promise.all([
                env.USER_METADATA_KV.get(`${id}_initial_answers`),
                env.USER_METADATA_KV.get(`${id}_profile`),
                env.USER_METADATA_KV.get(`plan_status_${id}`),
                env.USER_METADATA_KV.get(`${id}_current_status`)
            ]);
            if (!ansStr) continue;
            const ans = safeParseJson(ansStr, {});
            const profile = profileStr ? safeParseJson(profileStr, {}) : {};
            const currentStatus = safeParseJson(statusStr, {});
            clients.push({
                userId: id,
                name: ans.name || 'Клиент',
                email: profile.email || '',
                registrationDate: ans.submissionDate || null,
                status: planStatus || 'unknown',
                tags: currentStatus.adminTags || [],
                lastUpdated: currentStatus.lastUpdated || ''
            });
        }
        return { success: true, clients };
    } catch (error) {
        console.error(`Error in handleListClientsRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на клиентите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleListClientsRequest -------------

/** @typedef {{ message?: string; timestamp?: string|number; ts?: string|number; rating?: number|null; type?: string; author?: string; date?: string|number; read?: boolean; resolvedTs?: number|null }} NotificationEntry */
// ------------- START FUNCTION: handlePeekAdminNotificationsRequest -------------
async function handlePeekAdminNotificationsRequest(request, env) {
    try {
        const listResponse = await handleListClientsRequest(request, env);
        if (!listResponse.success) {
            return listResponse;
        }

        const clients = Array.isArray(listResponse.clients) ? listResponse.clients : [];
        const aggregated = [];

        for (const client of clients) {
            const userId = client?.userId;
            if (!userId) continue;

            const [queriesStr, repliesStr, feedbackStr, planChangeRequestsStr] = await Promise.all([
                env.USER_METADATA_KV.get(`${userId}_admin_queries`),
                env.USER_METADATA_KV.get(`${userId}_client_replies`),
                env.USER_METADATA_KV.get(`${userId}_feedback_messages`),
                env.USER_METADATA_KV.get(`${userId}_plan_change_requests`)
            ]);

            const parsedQueries = safeParseJson(queriesStr, []);
            const unreadQueries = (Array.isArray(parsedQueries) ? parsedQueries : [])
                .filter(item => item && typeof item === 'object' && !item.read)
                .map(item => /** @type {NotificationEntry} */ (item));
            const parsedReplies = safeParseJson(repliesStr, []);
            const unreadReplies = (Array.isArray(parsedReplies) ? parsedReplies : [])
                .filter(item => item && typeof item === 'object' && !item.read)
                .map(item => /** @type {NotificationEntry} */ (item));
            const rawFeedback = safeParseJson(feedbackStr, []);
            const parsedPlanChangeRequests = safeParseJson(planChangeRequestsStr, []);
            const unreadPlanChangeRequests = (Array.isArray(parsedPlanChangeRequests) ? parsedPlanChangeRequests : [])
                .filter(item => item && typeof item === 'object' && !item.read && item.status === 'pending')
                .map(item => ({ ...item, type: 'plan_change_request' }));

            let latestFeedbackTs = null;

            const normalizeEntry = (input, tsKey = 'ts') => {
                if (!input || typeof input !== 'object') return null;
                const source = /** @type {NotificationEntry & Record<string, unknown>} */ (input);
                const { message = '', rating = null, timestamp, ts } = source;
                const keyedTs = typeof tsKey === 'string' && tsKey in source
                    ? /** @type {string | number | null | undefined} */ (source[tsKey])
                    : undefined;
                return { message, rating, ts: keyedTs ?? timestamp ?? ts ?? null };
            };

            /**
             * @param {NotificationEntry | null} entry
             * @returns {entry is NotificationEntry}
             */
            const toEntryWithMessage = (entry) => Boolean(entry?.message);

            const queries = unreadQueries
                .map(q => normalizeEntry(q))
                .filter(toEntryWithMessage);
            const replies = unreadReplies
                .map(r => normalizeEntry(r))
                .filter(toEntryWithMessage);
            // Map plan change requests to consistent format with 'message' field
            // (stored as 'requestText' in KV, but exposed as 'message' for API consistency)
            const planChangeRequests = unreadPlanChangeRequests
                .map(pcr => ({
                    id: pcr.id || null, // Include ID for deletion
                    message: pcr.requestText || '',
                    ts: pcr.timestamp || null,
                    type: 'plan_change_request',
                    status: pcr.status || 'pending'
                }))
                .filter(pcr => pcr.message);
            const feedback = (Array.isArray(rawFeedback) ? rawFeedback : [])
                .map(item => {
                    const source = /** @type {NotificationEntry} */ (item ?? {});
                    const entry = normalizeEntry(source, 'timestamp');
                    if (!entry) return null;
                    const { type, author, timestamp, ts, date } = source;
                    if (timestamp) entry.timestamp = timestamp;
                    if (type) entry.type = type;
                    if (author) entry.author = author;
                    const tsValue = timestamp ?? ts ?? date ?? null;
                    const parsedTsRaw = typeof tsValue === 'number'
                        ? tsValue
                        : (tsValue ? Date.parse(String(tsValue)) : null);
                    const fallbackTs = typeof entry.ts === 'number' ? entry.ts : Number(entry.ts) || null;
                    const parsedTs = Number.isFinite(parsedTsRaw) ? parsedTsRaw : fallbackTs;
                    if (!entry.timestamp && tsValue) {
                        entry.timestamp = tsValue;
                    }
                    if (parsedTs && (!latestFeedbackTs || parsedTs > latestFeedbackTs)) {
                        latestFeedbackTs = parsedTs;
                    }
                    entry.resolvedTs = parsedTs;
                    return entry;
                })
                .filter(Boolean);

            if (queries.length === 0 && replies.length === 0 && feedback.length === 0 && planChangeRequests.length === 0) {
                continue;
            }

            const messages = [
                ...queries.map(q => ({ type: 'query', text: q.message, ts: q.ts ?? null })),
                ...replies.map(r => ({ type: 'reply', text: r.message, ts: r.ts ?? null })),
                ...planChangeRequests.map(pcr => ({ type: 'plan_change_request', text: pcr.message, ts: pcr.ts ?? null })),
                ...feedback.map(f => {
                    const primaryTs = typeof f.ts === 'number' && Number.isFinite(f.ts) ? f.ts : null;
                    const fallbackTs = typeof f.resolvedTs === 'number' && Number.isFinite(f.resolvedTs)
                        ? f.resolvedTs
                        : (f.timestamp ? Date.parse(f.timestamp) : null);
                    const tsValue = primaryTs !== null ? primaryTs : (Number.isFinite(fallbackTs) ? fallbackTs : null);
                    return { type: 'feedback', text: f.message, ts: tsValue };
                })
            ].filter(msg => msg.text);

            const normalizedFeedback = feedback.map(({ resolvedTs, ...rest }) => rest); // eslint-disable-line no-unused-vars

            messages.sort((a, b) => {
                const tsA = typeof a.ts === 'number' ? a.ts : Date.parse(a.ts || '') || 0;
                const tsB = typeof b.ts === 'number' ? b.ts : Date.parse(b.ts || '') || 0;
                return tsB - tsA;
            });

            aggregated.push({
                userId,
                name: client.name || userId,
                flags: {
                    queries: queries.length > 0,
                    replies: replies.length > 0,
                    feedback: feedback.length > 0,
                    planChangeRequests: planChangeRequests.length > 0
                },
                latestFeedbackTs: latestFeedbackTs ? new Date(latestFeedbackTs).toISOString() : null,
                queries,
                replies,
                feedback: normalizedFeedback,
                planChangeRequests,
                messages
            });
        }

        return { success: true, clients: aggregated };
    } catch (error) {
        console.error(`Error in handlePeekAdminNotificationsRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при агрегиране на известията.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handlePeekAdminNotificationsRequest -------------

// ------------- START FUNCTION: handleDeleteClientRequest -------------
async function handleDeleteClientRequest(request, env) {
    try {
        const { userId } = await request.json();
        if (!userId) {
            return { success: false, message: 'Липсва userId.', statusHint: 400 };
        }

        const idsStr = await env.USER_METADATA_KV.get('all_user_ids');
        let ids = safeParseJson(idsStr, []);
        ids = ids.filter(id => id !== userId);
        await env.USER_METADATA_KV.put('all_user_ids', JSON.stringify(ids));

        const credKey = `credential_${userId}`;
        const credStr = await env.USER_METADATA_KV.get(credKey);
        if (credStr) {
            const cred = safeParseJson(credStr, {});
            if (cred.email) {
                await env.USER_METADATA_KV.delete(`email_to_uuid_${cred.email}`);
            }
            await env.USER_METADATA_KV.delete(credKey);
        }

        await Promise.all([
            env.USER_METADATA_KV.delete(`${userId}_profile`),
            env.USER_METADATA_KV.delete(`${userId}_initial_answers`),
            env.USER_METADATA_KV.delete(`plan_status_${userId}`),
            env.USER_METADATA_KV.delete(`${userId}_current_status`),
            env.USER_METADATA_KV.delete(`${userId}${ADMIN_QUERIES_LAST_FETCH_SUFFIX}`)
        ]);

        return { success: true };
    } catch (error) {
        console.error(`Error in handleDeleteClientRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при изтриване на клиента.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleDeleteClientRequest -------------

// ------------- START FUNCTION: handleAddAdminQueryRequest -------------
async function handleAddAdminQueryRequest(request, env) {
    try {
        const { userId, message } = await request.json();
        if (!userId || !message) return { success: false, message: 'Липсват данни.', statusHint: 400 };
        const key = `${userId}_admin_queries`;
        const existing = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        existing.push({ message, ts: Date.now(), read: false });
        await env.USER_METADATA_KV.put(key, JSON.stringify(existing));
        return { success: true };
    } catch (error) {
        console.error(`Error in handleAddAdminQueryRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAddAdminQueryRequest -------------

const ADMIN_QUERIES_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ADMIN_QUERIES_LAST_FETCH_SUFFIX = '_admin_queries_last_fetch';

// ------------- START FUNCTION: handleGetAdminQueriesRequest -------------
async function handleGetAdminQueriesRequest(request, env, peek = false) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва userId.', statusHint: 400 };
        const key = `${userId}_admin_queries`;
        const arr = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        const now = Date.now();
        let lastFetchTs = 0;
        if (!peek) {
            const lastFetchRaw = await env.USER_METADATA_KV.get(`${userId}${ADMIN_QUERIES_LAST_FETCH_SUFFIX}`);
            const parsed = Number(lastFetchRaw);
            if (Number.isFinite(parsed) && parsed > 0) {
                lastFetchTs = parsed;
            }
        }
        const unread = arr.filter(q => !q.read);
        if (!peek && lastFetchTs > 0) {
            const hasNewSinceLast = unread.some(entry => {
                const ts = typeof entry?.ts === 'number' ? entry.ts : Number(entry?.ts) || 0;
                return ts > lastFetchTs;
            });
            if (!hasNewSinceLast && (now - lastFetchTs) < ADMIN_QUERIES_MIN_INTERVAL_MS) {
                return {
                    success: true,
                    queries: [],
                    throttled: true,
                    nextAllowedTs: lastFetchTs + ADMIN_QUERIES_MIN_INTERVAL_MS
                };
            }
        }
        if (unread.length > 0 && !peek) {
            arr.forEach(q => { q.read = true; });
            await env.USER_METADATA_KV.put(key, JSON.stringify(arr));
        }
        if (!peek) {
            await env.USER_METADATA_KV.put(`${userId}${ADMIN_QUERIES_LAST_FETCH_SUFFIX}`, String(now));
        }
        return { success: true, queries: unread };
    } catch (error) {
        console.error(`Error in handleGetAdminQueriesRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на запитванията.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAdminQueriesRequest -------------

// ------------- START FUNCTION: handleAddClientReplyRequest -------------
async function handleAddClientReplyRequest(request, env) {
    try {
        const { userId, message } = await request.json();
        if (!userId || !message) return { success: false, message: 'Липсват данни.', statusHint: 400 };
        const key = `${userId}_client_replies`;
        const existing = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        existing.push({ message, ts: Date.now(), read: false });
        await env.USER_METADATA_KV.put(key, JSON.stringify(existing));
        return { success: true };
    } catch (error) {
        console.error(`Error in handleAddClientReplyRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleAddClientReplyRequest -------------

// ------------- START FUNCTION: handleGetClientRepliesRequest -------------
async function handleGetClientRepliesRequest(request, env, peek = false) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва userId.', statusHint: 400 };
        const key = `${userId}_client_replies`;
        const arr = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        const unread = arr.filter(r => !r.read);
        if (unread.length > 0 && !peek) {
            arr.forEach(r => { r.read = true; });
            await env.USER_METADATA_KV.put(key, JSON.stringify(arr));
        }
        return { success: true, replies: unread };
    } catch (error) {
        console.error(`Error in handleGetClientRepliesRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на отговорите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetClientRepliesRequest -------------

// ------------- START FUNCTION: handleGetFeedbackMessagesRequest -------------
async function handleGetFeedbackMessagesRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва userId.', statusHint: 400 };
        const key = `${userId}_feedback_messages`;
        const arr = safeParseJson(await env.USER_METADATA_KV.get(key), []);
        return { success: true, feedback: arr };
    } catch (error) {
        console.error(`Error in handleGetFeedbackMessagesRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на обратната връзка.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetFeedbackMessagesRequest -------------

// ------------- START FUNCTION: handleGetPlanModificationPrompt -------------
async function handleGetPlanModificationPrompt(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) return { success: false, message: 'Липсва ID на потребител.', statusHint: 400 };

        const promptTpl = await env.RESOURCES_KV.get('prompt_plan_modification');
        const model = await getCachedResource('model_chat', env.RESOURCES_KV);

        if (!promptTpl || !model) {
            console.error(`PLAN_MOD_PROMPT_ERROR (${userId}): Missing prompt or model.`);
            return { success: false, message: 'Липсва промпт или модел.', statusHint: 500 };
        }

        return { success: true, prompt: promptTpl, model };
    } catch (error) {
        console.error(`Error in handleGetPlanModificationPrompt: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на промпта.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetPlanModificationPrompt -------------

// ------------- START FUNCTION: handleGetAiConfig -------------
async function handleGetAiConfig(request, env) {
    try {
        const config = {};
        for (const key of AI_CONFIG_KEYS) {
            const val = await env.RESOURCES_KV.get(key);
            if (val !== null) config[key] = val;
        }
        return { success: true, config };
    } catch (error) {
        console.error(`Error in handleGetAiConfig: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на настройките.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAiConfig -------------

// ------------- START FUNCTION: handleSetAiConfig -------------
async function handleSetAiConfig(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }

        const body = await request.json();
        let updates = body.updates;
        if (!updates && body.key) {
            updates = { [body.key]: body.value || '' };
        }
        if (!updates || typeof updates !== 'object') {
            return { success: false, message: 'Липсват данни.', statusHint: 400 };
        }
        const touchedKeys = [];
        for (const [key, value] of Object.entries(updates)) {
            if (AI_CONFIG_KEYS.includes(key)) {
                await env.RESOURCES_KV.put(key, String(value));
                touchedKeys.push(key);
            }
        }
        if (touchedKeys.length) {
            const cacheKeysToClear = new Set(touchedKeys);
            cacheKeysToClear.add('analytics_prompt');
            cacheKeysToClear.add('model_plan_generation');
            clearResourceCache([...cacheKeysToClear]);
        }
        return { success: true };
    } catch (error) {
        console.error(`Error in handleSetAiConfig: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис на настройките.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSetAiConfig -------------

// ------------- START FUNCTION: handleListAiPresets -------------
async function handleListAiPresets(request, env) {
    try {
        const now = Date.now();
        if (Array.isArray(aiPresetIndexCache) && aiPresetIndexCache.length && now - aiPresetIndexCacheTime < AI_PRESET_INDEX_TTL_MS) {
            return { success: true, presets: aiPresetIndexCache };
        }
        const idxStr = await env.RESOURCES_KV.get(AI_PRESET_INDEX_KEY);
        if (idxStr) {
            const idx = safeParseJson(idxStr, []);
            if (idx.length) {
                aiPresetIndexCache = idx;
                aiPresetIndexCacheTime = now;
                return { success: true, presets: idx };
            }
        }
        const { keys } = await env.RESOURCES_KV.list({ prefix: 'aiPreset_' });
        const presets = keys
            .map(k => k.name)
            .filter(name => name !== AI_PRESET_INDEX_KEY)
            .map(name => name.replace(/^aiPreset_/, ''));
        aiPresetIndexCache = presets;
        aiPresetIndexCacheTime = now;
        await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(presets));
        return { success: true, presets };
    } catch (error) {
        console.error(`Error in handleListAiPresets: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на пресетите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleListAiPresets -------------

// ------------- START FUNCTION: handleGetAiPreset -------------
async function handleGetAiPreset(request, env) {
    try {
        const url = new URL(request.url);
        const name = url.searchParams.get('name');
        if (!name) {
            return { success: false, message: 'Липсва име.', statusHint: 400 };
        }
        const val = await env.RESOURCES_KV.get(`aiPreset_${name}`);
        if (!val) {
            return { success: false, message: 'Няма такъв пресет.', statusHint: 404 };
        }
        return { success: true, config: JSON.parse(val) };
    } catch (error) {
        console.error(`Error in handleGetAiPreset: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на пресета.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetAiPreset -------------

// ------------- START FUNCTION: handleSaveAiPreset -------------
async function handleSaveAiPreset(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }

        const body = await request.json();
        const name = body.name && String(body.name).trim();
        const cfg = body.config;
        if (!name || !cfg || typeof cfg !== 'object') {
            return { success: false, message: 'Липсват данни.', statusHint: 400 };
        }
        await env.RESOURCES_KV.put(`aiPreset_${name}`, JSON.stringify(cfg));
        try {
            const idxStr = await env.RESOURCES_KV.get(AI_PRESET_INDEX_KEY);
            const idx = idxStr ? safeParseJson(idxStr, []) : [];
            if (!idx.includes(name)) {
                idx.push(name);
                await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(idx));
            }
            aiPresetIndexCache = idx;
            aiPresetIndexCacheTime = Date.now();
        } catch (idxErr) {
            console.error('Failed to update AI preset index:', idxErr.message);
            if (Array.isArray(aiPresetIndexCache)) {
                if (!aiPresetIndexCache.includes(name)) aiPresetIndexCache.push(name);
            } else {
                aiPresetIndexCache = [name];
            }
            aiPresetIndexCacheTime = Date.now();
        }
        return { success: true };
    } catch (error) {
        console.error(`Error in handleSaveAiPreset: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис на пресета.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSaveAiPreset -------------

// ------------- START FUNCTION: handleDeleteAiPreset -------------
async function handleDeleteAiPreset(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const body = await request.json();
        const name = body.name && String(body.name).trim();
        if (!name) {
            return { success: false, message: 'Липсва име.', statusHint: 400 };
        }
        await env.RESOURCES_KV.delete(`aiPreset_${name}`);
        try {
            const idxStr = await env.RESOURCES_KV.get(AI_PRESET_INDEX_KEY);
            let idx = idxStr ? safeParseJson(idxStr, []) : [];
            idx = idx.filter(n => n !== name);
            await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(idx));
            aiPresetIndexCache = idx;
            aiPresetIndexCacheTime = Date.now();
        } catch (idxErr) {
            console.error('Failed to update AI preset index:', idxErr.message);
            if (Array.isArray(aiPresetIndexCache)) {
                aiPresetIndexCache = aiPresetIndexCache.filter(n => n !== name);
                aiPresetIndexCacheTime = Date.now();
            }
        }
        return { success: true };
    } catch (error) {
        console.error(`Error in handleDeleteAiPreset: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при изтриване на пресета.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleDeleteAiPreset -------------

// ------------- START FUNCTION: handleTestAiModelRequest -------------
async function handleTestAiModelRequest(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const { model } = await request.json();
        if (!model) {
            return { success: false, message: 'Липсва модел.', statusHint: 400 };
        }
        await callModelRef.current(model, 'Здравей', env, { temperature: 0, maxTokens: 5 });
        return { success: true };
    } catch (error) {
        console.error(`Error in handleTestAiModelRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: error.message || 'Грешка при комуникацията.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleTestAiModelRequest -------------

// ------------- START FUNCTION: handleContactFormRequest -------------
async function handleContactFormRequest(request, env) {
    try {
        const identifier = request.headers?.get?.('CF-Connecting-IP') || '';
        if (await checkRateLimit(env, 'contactForm', identifier)) {
            return { success: false, message: 'Прекалено много заявки. Опитайте по-късно.', statusHint: 429 };
        }
        await recordUsage(env, 'contactForm', identifier);
        let data;
        try {
            data = await request.json();
        } catch {
            return { success: false, message: 'Invalid JSON.', statusHint: 400 };
        }
        const email = data.email;
        const name = data.name || '';
        const message = typeof data.message === 'string' ? data.message : '';
        if (typeof email !== 'string' || !email.trim()) {
            return { success: false, message: 'Missing field: email', statusHint: 400 };
        }
        const ts = Date.now();
        const key = `contact_${ts}`;
        try {
            await env.CONTACT_REQUESTS_KV.put(
                key,
                JSON.stringify({ email: email.trim(), name: name.trim(), message: message.trim(), ts })
            );
            try {
                const idxStr = await env.CONTACT_REQUESTS_KV.get('contactRequests_index');
                const idx = idxStr ? safeParseJson(idxStr, []) : [];
                idx.push(key);
                await env.CONTACT_REQUESTS_KV.put('contactRequests_index', JSON.stringify(idx));
            } catch (idxErr) {
                console.error('Failed to update contact index:', idxErr.message);
            }
        } catch (err) {
            console.error('Failed to store contact request:', err.message);
        }
        try {
            await sendContactEmail(email.trim(), name.trim(), env);
        } catch (err) {
            console.error('Failed to send contact confirmation:', err.message);
        }
        return { success: true };
    } catch (error) {
        console.error(`Error in handleContactFormRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при изпращане.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleContactFormRequest -------------

// ------------- START FUNCTION: handleGetContactRequestsRequest -------------
async function handleGetContactRequestsRequest(request, env) {
    try {
        const auth = request.headers?.get?.('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const indexStr = await env.CONTACT_REQUESTS_KV.get('contactRequests_index');
        const ids = indexStr ? safeParseJson(indexStr, []) : [];
        const requests = [];
        for (const key of ids) {
            const val = await env.CONTACT_REQUESTS_KV.get(key);
            if (val) requests.push(safeParseJson(val, null));
        }
        return { success: true, requests };
    } catch (error) {
        console.error(`Error in handleGetContactRequestsRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане на заявките.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetContactRequestsRequest -------------

// ------------- START FUNCTION: handleValidateIndexesRequest -------------
async function handleValidateIndexesRequest(request, env) {
    try {
        const auth = request.headers?.get?.('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const { keys: presetKeys } = await env.RESOURCES_KV.list({ prefix: 'aiPreset_' });
        const presetIds = presetKeys
            .map(k => k.name)
            .filter(name => name !== AI_PRESET_INDEX_KEY)
            .map(name => name.replace(/^aiPreset_/, ''));
        aiPresetIndexCache = presetIds;
        aiPresetIndexCacheTime = Date.now();
        await env.RESOURCES_KV.put(AI_PRESET_INDEX_KEY, JSON.stringify(presetIds));
        const { keys: contactKeys } = await env.CONTACT_REQUESTS_KV.list({ prefix: 'contact_' });
        const contactIds = contactKeys.map(k => k.name);
        await env.CONTACT_REQUESTS_KV.put('contactRequests_index', JSON.stringify(contactIds));
        return { success: true };
    } catch (error) {
        console.error(`Error in handleValidateIndexesRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при валидиране на индексите.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleValidateIndexesRequest -------------

// ------------- START FUNCTION: handleSendTestEmailRequest -------------
async function handleSendTestEmailRequest(request, env) {
    try {
        const auth = request.headers?.get?.('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const identifier = token || request.headers?.get?.('CF-Connecting-IP') || '';
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }

        if (await checkRateLimit(env, 'sendTestEmail', identifier)) {
            return { success: false, message: 'Прекалено много заявки. Опитайте по-късно.', statusHint: 429 };
        }

        await recordUsage(env, 'sendTestEmail', identifier);

        let data;
        try {
            data = await request.json();
        } catch {
            return { success: false, message: 'Invalid JSON.', statusHint: 400 };
        }

        const recipient = data.recipient ?? data.to;
        const subject = data.subject;
        const body = data.body ?? data.text ?? data.message;
        let fromName = data.fromName ?? data.from_email_name;
        if (!fromName && env.RESOURCES_KV) {
            try {
                fromName = await env.RESOURCES_KV.get('from_email_name');
            } catch {
                fromName = undefined;
            }
        }
        if (fromName) env.from_email_name = fromName;

        if (typeof recipient !== 'string' || !recipient) {
            return { success: false, message: 'Missing field: recipient (use "recipient" or "to")', statusHint: 400 };
        }
        if (typeof subject !== 'string' || !subject) {
            return { success: false, message: 'Missing field: subject', statusHint: 400 };
        }
        if (typeof body !== 'string' || !body) {
            return { success: false, message: 'Missing field: body (use "body", "text" or "message")', statusHint: 400 };
        }

        await sendEmailUniversal(recipient, subject, body, env);
        return { success: true };
    } catch (error) {
        console.error(`Error in handleSendTestEmailRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: error.message || 'Грешка при изпращане.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSendTestEmailRequest -------------

// ------------- START FUNCTION: handleGetMaintenanceMode -------------
async function handleGetMaintenanceMode(request, env) {
    try {
        const val = env.RESOURCES_KV
            ? await getCachedResource(
                MAINTENANCE_MODE_CACHE_KEY,
                env.RESOURCES_KV,
                MAINTENANCE_MODE_TTL_MS,
                MAINTENANCE_MODE_KV_KEY
            )
            : null;
        const enabled = (val === '1') || env.MAINTENANCE_MODE === '1';
        return { success: true, enabled };
    } catch (error) {
        console.error(`Error in handleGetMaintenanceMode: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при зареждане.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleGetMaintenanceMode -------------

// ------------- START FUNCTION: handleSetMaintenanceMode -------------
async function handleSetMaintenanceMode(request, env) {
    try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = env[WORKER_ADMIN_TOKEN_SECRET_NAME];
        if (expected && token !== expected) {
            return { success: false, message: 'Невалиден токен.', statusHint: 403 };
        }
        const { enabled } = await request.json();
        const val = enabled ? '1' : '0';
        if (env.RESOURCES_KV) await env.RESOURCES_KV.put(MAINTENANCE_MODE_KV_KEY, val);
        clearResourceCache([MAINTENANCE_MODE_CACHE_KEY, MAINTENANCE_PAGE_CACHE_KEY]);
        return { success: true };
    } catch (error) {
        console.error(`Error in handleSetMaintenanceMode: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Грешка при запис.', statusHint: 500 };
    }
}
// ------------- END FUNCTION: handleSetMaintenanceMode -------------


// ------------- START BLOCK: PlanGenerationHeaderComment -------------
// ===============================================
// ГЕНЕРИРАНЕ НА ПЛАН И АДАПТИВНИ ПРИНЦИПИ
// ===============================================
// ------------- END BLOCK: PlanGenerationHeaderComment -------------

const PLAN_MACRO_RETRY_LIMIT = 2;
const MAX_PLAN_SECTION_REPAIR_ATTEMPTS = 3; // Максимален брой опити за попълване на липсващи секции от AI
const AI_CALL_TIMEOUT_MS = 25_000;
// Increased from 60s to 90s to reduce partial JSON responses for large plan payloads
const DEFAULT_PLAN_CALL_TIMEOUT_MS = 90_000;
// All days required in week1Menu - used for validation and logging
const REQUIRED_WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const parsePositiveInteger = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
};

function resolvePlanCallTimeoutMs(env) {
    const candidates = [
        env?.AI_PLAN_TIMEOUT_MS,
        env?.AI_PLAN_TIMEOUT,
        env?.AI_CALL_TIMEOUT_MS,
        env?.AI_TIMEOUT_MS
    ];

    for (const candidate of candidates) {
        const parsed = parsePositiveInteger(candidate);
        if (parsed != null) {
            return parsed;
        }
    }

    return DEFAULT_PLAN_CALL_TIMEOUT_MS;
}

async function callModelWithTimeout({
    model,
    prompt,
    env,
    options = {},
    timeoutMs = AI_CALL_TIMEOUT_MS
}) {
    const controller = new AbortController();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const timeoutError = new Error(`AI call timed out after ${timeoutMs}ms`);
            timeoutError.name = 'AbortError';
            controller.abort(timeoutError);
            reject(timeoutError);
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([
            callModelRef.current(model, prompt, env, { ...options, signal: controller.signal }),
            timeoutPromise
        ]);
        return result;
    } finally {
        clearTimeout(timeoutId);
    }
}
const REQUIRED_PLAN_SECTIONS = [
    'profileSummary',
    'caloriesMacros',
    'allowedForbiddenFoods',
    'week1Menu',
    'mealMacrosIndex',
    'principlesWeek2_4',
    'hydrationCookingSupplements',
    'psychologicalGuidance',
    'detailedTargets',
    'additionalGuidelines'
];

/**
 * Validates if a plan section has meaningful content
 * @param {string} sectionKey - The key of the section to validate
 * @param {any} sectionValue - The value of the section
 * @returns {boolean} - True if the section has valid content
 */
function isPlanSectionValid(sectionKey, sectionValue) {
    // Null or undefined check
    if (sectionValue === null || sectionValue === undefined) {
        return false;
    }
    
    // String check - must be non-empty
    if (typeof sectionValue === 'string') {
        return sectionValue.trim().length > 0;
    }
    
    // Array check - must be non-empty for principlesWeek2_4
    if (Array.isArray(sectionValue)) {
        if (sectionKey === 'principlesWeek2_4') {
            // Must have at least one element
            // Elements can be either strings or objects with title and/or content
            return sectionValue.length > 0 && sectionValue.every(item => {
                if (typeof item === 'string') {
                    return item.trim().length > 0;
                }
                if (item && typeof item === 'object') {
                    // Accept objects with either title or content (or both), but at least one must be non-empty
                    const hasTitle = typeof item.title === 'string' && item.title.trim().length > 0;
                    const hasContent = typeof item.content === 'string' && item.content.trim().length > 0;
                    return hasTitle || hasContent;
                }
                return false;
            });
        }
        return sectionValue.length > 0;
    }
    
    // Object check - must have at least one key with meaningful value
    if (typeof sectionValue === 'object') {
        const keys = Object.keys(sectionValue);
        if (keys.length === 0) {
            return false;
        }
        
        // Special validation for specific sections
        if (sectionKey === 'allowedForbiddenFoods') {
            // Must have at least one of the main arrays populated
            return (
                (Array.isArray(sectionValue.main_allowed_foods) && sectionValue.main_allowed_foods.length > 0) ||
                (Array.isArray(sectionValue.main_forbidden_foods) && sectionValue.main_forbidden_foods.length > 0) ||
                (Array.isArray(sectionValue.detailed_allowed_suggestions) && sectionValue.detailed_allowed_suggestions.length > 0) ||
                (Array.isArray(sectionValue.detailed_limit_suggestions) && sectionValue.detailed_limit_suggestions.length > 0)
            );
        }
        
        if (sectionKey === 'hydrationCookingSupplements') {
            // Must have hydration_recommendations or cooking_methods with meaningful content
            const hasHydration = 
                sectionValue.hydration_recommendations && 
                typeof sectionValue.hydration_recommendations === 'object' &&
                Object.keys(sectionValue.hydration_recommendations).length > 0;
            const hasCooking = 
                sectionValue.cooking_methods && 
                typeof sectionValue.cooking_methods === 'object' &&
                Object.keys(sectionValue.cooking_methods).length > 0;
            return hasHydration || hasCooking;
        }
        
        if (sectionKey === 'psychologicalGuidance') {
            // Must have at least one meaningful field
            return (
                (Array.isArray(sectionValue.coping_strategies) && sectionValue.coping_strategies.length > 0) ||
                (Array.isArray(sectionValue.motivational_messages) && sectionValue.motivational_messages.length > 0) ||
                (typeof sectionValue.habit_building_tip === 'string' && sectionValue.habit_building_tip.trim().length > 0) ||
                (typeof sectionValue.self_compassion_reminder === 'string' && sectionValue.self_compassion_reminder.trim().length > 0)
            );
        }
        
        if (sectionKey === 'week1Menu') {
            // Must have all 7 days with non-empty arrays
            return REQUIRED_WEEK_DAYS.every(d => Array.isArray(sectionValue?.[d]) && sectionValue[d].length > 0);
        }
        
        if (sectionKey === 'detailedTargets') {
            // Must have at least some target fields
            const hasTargets = Object.values(sectionValue).some(val => {
                if (typeof val === 'string' && val.trim().length > 0) return true;
                if (typeof val === 'number' && Number.isFinite(val)) return true;
                return false;
            });
            return hasTargets;
        }
        
        return true;
    }
    
    // For other types, just check if it exists
    return true;
}

function createEmptyPlanBuilder() {
    return {
        profileSummary: null,
        caloriesMacros: null,
        week1Menu: null,
        principlesWeek2_4: [],
        additionalGuidelines: [],
        hydrationCookingSupplements: null,
        allowedForbiddenFoods: {},
        psychologicalGuidance: null,
        detailedTargets: null,
        mealMacrosIndex: null,
        generationMetadata: { timestamp: '', modelUsed: null, errors: [] }
    };
}

class PlanCaloriesMacrosMissingError extends Error {
    constructor(message, planBuilder) {
        super(message);
        this.name = 'PlanCaloriesMacrosMissingError';
        this.planBuilder = planBuilder;
    }
}

function collectPlanMacroGaps(plan) {
    const requiredKeys = ['calories', 'protein_grams', 'carbs_grams', 'fat_grams', 'fiber_grams'];
    const result = {
        missingCaloriesMacroFields: [],
        missingMealMacros: [],
        hasGaps: false
    };

    const caloriesExtracted = extractMacros(plan?.caloriesMacros || {});
    const caloriesMerged = mergeMacroSources(caloriesExtracted, null);
    for (const key of requiredKeys) {
        const value = caloriesMerged ? caloriesMerged[key] : null;
        if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
            result.missingCaloriesMacroFields.push(key);
        }
    }

    if (plan?.week1Menu && typeof plan.week1Menu === 'object') {
        const entries = Object.entries(plan.week1Menu);
        for (const [dayKey, meals] of entries) {
            if (!Array.isArray(meals)) continue;
            meals.forEach((meal, mealIdx) => {
                const directMacros = extractMacros(meal?.macros ?? meal ?? {});
                const indexKey = `${dayKey}_${mealIdx}`;
                const indexedMacros = plan?.mealMacrosIndex && typeof plan.mealMacrosIndex === 'object'
                    ? extractMacros(plan.mealMacrosIndex[indexKey])
                    : null;
                const merged = mergeMacroSources(directMacros, indexedMacros);
                if (!isCompleteMacroSet(merged)) {
                    const missingFields = [];
                    for (const key of requiredKeys) {
                        const value = merged ? merged[key] : null;
                        if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
                            missingFields.push(key);
                        }
                    }
                    const label = meal?.meal_name || meal?.title || `meal_${mealIdx + 1}`;
                    result.missingMealMacros.push({ dayKey, mealIndex: mealIdx, label, missingFields });
                }
            });
        }
    }

    result.hasGaps =
        result.missingCaloriesMacroFields.length > 0 || result.missingMealMacros.length > 0;
    return result;
}

/**
 * Auto-generates mealMacrosIndex from week1Menu
 * @param {Object} week1Menu - The weekly menu object
 * @returns {Object} The generated mealMacrosIndex
 */
// eslint-disable-next-line no-unused-vars
function generateMealMacrosIndexFromMenu(week1Menu) {
    const mealMacrosIndex = {};
    if (!week1Menu || typeof week1Menu !== 'object') {
        return mealMacrosIndex;
    }
    
    for (const [dayKey, meals] of Object.entries(week1Menu)) {
        if (Array.isArray(meals)) {
            meals.forEach((meal, mealIdx) => {
                // Validate meal exists and has macros before accessing
                if (meal && typeof meal === 'object' && meal.macros && typeof meal.macros === 'object') {
                    const indexKey = `${dayKey}_${mealIdx}`;
                    mealMacrosIndex[indexKey] = { ...meal.macros };
                }
            });
        }
    }
    
    return mealMacrosIndex;
}

async function buildPlanFromRawResponse(rawAiResponse, { planModelName, env, userId, addLog }) {
    const planBuilder = createEmptyPlanBuilder();
    planBuilder.generationMetadata.modelUsed = planModelName;

    const cleanedJson = cleanGeminiJson(rawAiResponse);
    let generatedPlanObject = safeParseJson(cleanedJson, {});

    let missingSections = REQUIRED_PLAN_SECTIONS.filter((key) => !isPlanSectionValid(key, generatedPlanObject[key]));
    
    // Log missing days in week1Menu if it exists but is incomplete
    if (generatedPlanObject.week1Menu && typeof generatedPlanObject.week1Menu === 'object') {
        const missingDays = REQUIRED_WEEK_DAYS.filter(d => !Array.isArray(generatedPlanObject.week1Menu?.[d]) || generatedPlanObject.week1Menu[d].length === 0);
        if (missingDays.length > 0) {
            const missingDaysMsg = `Липсващи дни в week1Menu: ${missingDays.join(', ')}`;
            planBuilder.generationMetadata.errors.push(missingDaysMsg);
            await addLog(`Предупреждение: ${missingDaysMsg}`);
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): ${missingDaysMsg}`);
        }
    }
    
    if (missingSections.length > 0) {
        console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Initial missing sections: ${missingSections.join(', ')}. Original response (start): ${rawAiResponse.substring(0, 300)}`);
        
        // ВАЖНО: Не използваме default стойности - всички данни трябва да идват от AI
        // Опитваме се многократно да получим липсващите секции от AI
        let repairAttempt = 0;
        const maxRepairAttempts = MAX_PLAN_SECTION_REPAIR_ATTEMPTS;
        
        while (missingSections.length > 0 && repairAttempt < maxRepairAttempts) {
            repairAttempt++;
            try {
                // Изграждаме детайлен prompt за липсващите секции
                const sectionDescriptions = {
                    'profileSummary': 'персонализирано резюме на потребителския профил и хранителен подход',
                    'caloriesMacros': 'обект с calories, protein_percent, carbs_percent, fat_percent, protein_grams, carbs_grams, fat_grams, fiber_grams, fiber_percent',
                    'allowedForbiddenFoods': 'обект с main_allowed_foods (масив от разрешени храни), main_forbidden_foods (масив от забранени храни), detailed_allowed_suggestions (масив), detailed_limit_suggestions (масив), dressing_flavoring_ideas (масив)',
                    'week1Menu': 'седмично меню с дни (monday, tuesday, wednesday, thursday, friday, saturday, sunday), всеки съдържащ масив от храни с meal_name, items (масив с name и grams), recipeKey',
                    'mealMacrosIndex': 'индекс на макроси за всяка храна от менюто по формат {dayKey}_{index}: {calories, protein_grams, carbs_grams, fat_grams, fiber_grams}',
                    'principlesWeek2_4': 'масив от хранителни принципи за седмици 2-4, всеки с title, content, и icon',
                    'hydrationCookingSupplements': 'обект с hydration_recommendations (daily_liters, tips като масив, suitable_drinks като масив, unsuitable_drinks като масив), cooking_methods (recommended като масив, limit_or_avoid като масив, fat_usage_tip), supplement_suggestions като масив с обекти (supplement_name, reasoning, caution)',
                    'psychologicalGuidance': 'обект с coping_strategies (масив от стратегии), motivational_messages (масив от съобщения), habit_building_tip (текст), self_compassion_reminder (текст)',
                    'detailedTargets': 'обект с sleep_quality_target_text, stress_level_target_text, energy_level_target_text, hydration_target_text, bmi_target_numeric (число), bmi_target_category_text, meal_adherence_target_percent (число), log_consistency_target_percent (число)',
                    'additionalGuidelines': 'масив от допълнителни насоки, всяка с title и content, или масив от текстови низове'
                };
                
                const missingDescriptions = missingSections.map(key => `- ${key}: ${sectionDescriptions[key] || 'необходима секция'}`).join('\n');
                
                const repairPrompt = `Върни САМО ВАЛИДЕН JSON обект с липсващите секции.

ЛИПСВАЩИ СЕКЦИИ (${repairAttempt}/${maxRepairAttempts} опит):
${missingDescriptions}

КОНТЕКСТ от първоначалния план:
${cleanedJson.substring(0, 2000)}

ВАЖНО: 
- Върни САМО JSON обект
- Всички стойности трябва да са персонализирани според контекста
- Използвай правилната структура за всяка секция
- НЕ използвай placeholder стойности`;

                // Attempting to repair missing sections
                
                const repairResponse = await callModelRef.current(planModelName, repairPrompt, env, {
                    temperature: 0.1,
                    maxTokens: 3000
                });
                const repairCleaned = cleanGeminiJson(repairResponse);
                const repairedObject = safeParseJson(repairCleaned, {});
                
                if (repairedObject && typeof repairedObject === 'object') {
                    let filledCount = 0;
                    for (const key of missingSections) {
                        if (isPlanSectionValid(key, repairedObject[key])) {
                            generatedPlanObject[key] = repairedObject[key];
                            filledCount++;
                        }
                    }
                    
                    if (filledCount > 0) {
                        // Filled section(s) in attempt
                    }
                }
                
                // Преизчисляваме липсващите секции след опита за попълване
                const previousMissingCount = missingSections.length;
                missingSections = REQUIRED_PLAN_SECTIONS.filter((key) => !isPlanSectionValid(key, generatedPlanObject[key]));
                
                if (missingSections.length === 0) {
                    // All missing sections filled
                    break;
                } else if (missingSections.length === previousMissingCount) {
                    console.warn(`PROCESS_USER_PLAN_WARN (${userId}): No progress in attempt ${repairAttempt}, still missing: ${missingSections.join(', ')}`);
                    // Ако няма напредък в последователни опити, прекъсваме цикъла рано
                    if (repairAttempt >= 2) {
                        console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Breaking retry loop due to no progress after ${repairAttempt} attempts`);
                        break;
                    }
                }
                
            } catch (repairErr) {
                const repairErrorMsg = `Repair attempt ${repairAttempt} failed: ${repairErr.message}`;
                console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${repairErrorMsg}`);
                planBuilder.generationMetadata.errors.push(repairErrorMsg);
            }
        }
        
        // След всички опити, ако все още има липсващи секции, добавяме грешка
        if (missingSections.length > 0) {
            const finalMissingMsg = `AI не успя да попълни секциите след ${maxRepairAttempts} опити: ${missingSections.join(', ')}`;
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${finalMissingMsg}`);
            planBuilder.generationMetadata.errors.push(finalMissingMsg);
        }
    } else {
        // Unified plan JSON parsed successfully with all required sections
    }

    const { generationMetadata, ...restOfGeneratedPlan } = generatedPlanObject;
    Object.assign(planBuilder, restOfGeneratedPlan);

    const ensureFiber = (macros) => {
        if (!macros) return;
        const { calories, fiber_percent, fiber_grams } = macros;
        if (fiber_percent == null && fiber_grams != null && calories) {
            macros.fiber_percent = Math.round((fiber_grams * 2 * 100) / calories);
        }
        if (fiber_grams == null && fiber_percent != null && calories) {
            macros.fiber_grams = Math.round((calories * fiber_percent) / 100 / 2);
        }
    };
    if (planBuilder.caloriesMacros) {
        ensureFiber(planBuilder.caloriesMacros);
    }

    if (!hasCompleteCaloriesMacros(planBuilder.caloriesMacros)) {
        const failureMsg = 'AI отговорът няма валидни caloriesMacros и изисква нов опит от модела.';
        console.warn(`PROCESS_USER_PLAN_WARN (${userId}): ${failureMsg}`);
        planBuilder.generationMetadata.errors.push(failureMsg);
        await addLog(`Предупреждение: ${failureMsg}`);
        throw new PlanCaloriesMacrosMissingError(failureMsg, planBuilder);
    }

    if (generationMetadata && Array.isArray(generationMetadata.errors)) {
        planBuilder.generationMetadata.errors.push(...generationMetadata.errors);
    }

    return planBuilder;
}

async function retryPlanGeneration({
    userId,
    env,
    planModelName,
    basePrompt,
    addLog,
    initialPlan,
    maxAttempts = PLAN_MACRO_RETRY_LIMIT,
    timeoutMs = AI_CALL_TIMEOUT_MS
}) {
    let workingPlan = initialPlan;
    let attempts = 0;
    let lastRawResponse = '';

    while (attempts < maxAttempts) {
        const gaps = collectPlanMacroGaps(workingPlan);
        if (!gaps.hasGaps) {
            return { success: true, plan: workingPlan, attempts, finalGaps: gaps };
        }

        attempts += 1;
        const missingParts = [];
        if (gaps.missingCaloriesMacroFields.length > 0) {
            missingParts.push(
                `- Обнови caloriesMacros (липсват: ${gaps.missingCaloriesMacroFields.join(', ')})`
            );
        }
        for (const mealGap of gaps.missingMealMacros) {
            missingParts.push(
                `- Ден ${mealGap.dayKey}, храна "${mealGap.label}" (липсват: ${mealGap.missingFields.join(', ')})`
            );
        }

        const logMessage = `Повторен опит ${attempts} за попълване на макроси.`;
        await addLog(`${logMessage} ${missingParts.join(' ')}`);
        console.warn(`PROCESS_USER_PLAN_WARN (${userId}): ${logMessage} ${missingParts.join(' ')}`);

        const planContext = JSON.stringify({
            caloriesMacros: workingPlan.caloriesMacros,
            week1Menu: workingPlan.week1Menu,
            mealMacrosIndex: workingPlan.mealMacrosIndex || null,
            detailedTargets: workingPlan.detailedTargets || null
        });
        let trimmedContext = planContext;
        if (trimmedContext.length > 8000) {
            trimmedContext = `${trimmedContext.slice(0, 8000)}...`;
        }

        let basePromptExcerpt = '';
        if (basePrompt) {
            let trimmedBasePrompt = basePrompt;
            if (trimmedBasePrompt.length > 4000) {
                trimmedBasePrompt = `${trimmedBasePrompt.slice(0, 4000)}...`;
            }
            basePromptExcerpt = `Original instructions excerpt:\n${trimmedBasePrompt}\n`;
        }

        const correctionPrompt = `${basePromptExcerpt}You previously generated a nutrition plan JSON. Some macronutrient values are missing. Keep the structure and meals identical, but fill in every missing macro.\n` +
            `Missing items:\n${missingParts.join('\n')}\n` +
            `Current plan snapshot:\n${trimmedContext}\n` +
            `Respond ONLY with the complete updated JSON plan.`;

        try {
            lastRawResponse = await callModelWithTimeout({
                model: planModelName,
                prompt: correctionPrompt,
                env,
                options: { temperature: 0.05, maxTokens: 12000 },
                timeoutMs
            });
            const rebuiltPlan = await buildPlanFromRawResponse(lastRawResponse, {
                planModelName,
                env,
                userId,
                addLog
            });
            workingPlan = rebuiltPlan;
        } catch (retryErr) {
            const isTimeout = retryErr?.name === 'AbortError' || /timed out/i.test(retryErr?.message || '');
            const retryMsg = isTimeout
                ? `AI заявката за макроси прекъсна след ${timeoutMs}ms (опит ${attempts}).`
                : `Macro retry attempt ${attempts} failed: ${retryErr.message}`;
            if (isTimeout) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): ${retryMsg}`);
            } else {
                console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${retryMsg}`);
            }
            await addLog(
                `Грешка при повторен опит за макроси: ${isTimeout ? 'Изтече времето за отговор' : retryErr.message}`
            );
            if (isTimeout) {
                await env.USER_METADATA_KV.put(`${userId}_processing_error`, retryMsg);
            }
            if (retryErr instanceof PlanCaloriesMacrosMissingError && retryErr.planBuilder) {
                workingPlan = retryErr.planBuilder;
            }
        }
    }

    return {
        success: false,
        plan: workingPlan,
        attempts,
        finalGaps: collectPlanMacroGaps(workingPlan),
        lastRawResponse
    };
}

async function enforceCompletePlanBeforePersist({
    plan,
    userId,
    env,
    planModelName,
    basePrompt,
    addLog = async (...args) => {
        if (args.length) {
            return;
        }
    },
    maxAttempts = PLAN_MACRO_RETRY_LIMIT,
    retryArtifactKey = null
}) {
    let workingPlan = plan;
    if (!workingPlan || typeof workingPlan !== 'object') {
        throw new Error('Invalid plan supplied for validation.');
    }

    if (!workingPlan.generationMetadata || typeof workingPlan.generationMetadata !== 'object') {
        workingPlan.generationMetadata = {
            timestamp: workingPlan?.generationMetadata?.timestamp || '',
            modelUsed: workingPlan?.generationMetadata?.modelUsed || planModelName || null,
            errors: []
        };
    } else if (!Array.isArray(workingPlan.generationMetadata.errors)) {
        workingPlan.generationMetadata.errors = [];
    }

    let finalMacroGaps = collectPlanMacroGaps(workingPlan);
    if (!finalMacroGaps.hasGaps) {
        return {
            success: true,
            plan: workingPlan,
            finalMacroGaps,
            macroRetryInfo: null,
            attempts: 0
        };
    }

    if (!planModelName) {
        const validationMessage = 'Липсва конфигуриран AI модел за автоматично попълване на макроси.';
        workingPlan.generationMetadata.errors.push(validationMessage);
        await addLog(`Грешка: ${validationMessage}`, { checkpoint: true, reason: 'macro-validation-failed' });
        console.error(`PLAN_VALIDATION_ERROR (${userId}): ${validationMessage}`);
        return {
            success: false,
            plan: workingPlan,
            finalMacroGaps,
            macroRetryInfo: null,
            attempts: 0
        };
    }

    const planCallTimeoutMs = resolvePlanCallTimeoutMs(env);
    const macroRetryInfo = await retryPlanGeneration({
        userId,
        env,
        planModelName,
        basePrompt,
        addLog,
        initialPlan: workingPlan,
        maxAttempts,
        timeoutMs: planCallTimeoutMs
    });
    workingPlan = macroRetryInfo.plan;
    finalMacroGaps = collectPlanMacroGaps(workingPlan);

    if (macroRetryInfo.success && macroRetryInfo.attempts > 0) {
        await addLog(`Макросите бяха допълнени след ${macroRetryInfo.attempts} повторен(и) опит(и).`);
    }

    if (!finalMacroGaps.hasGaps) {
        return {
            success: true,
            plan: workingPlan,
            finalMacroGaps,
            macroRetryInfo,
            attempts: macroRetryInfo.attempts
        };
    }

    const missingParts = [];
    if (finalMacroGaps.missingCaloriesMacroFields.length > 0) {
        missingParts.push(
            `caloriesMacros (${finalMacroGaps.missingCaloriesMacroFields.join(', ')})`
        );
    }
    for (const gap of finalMacroGaps.missingMealMacros) {
        missingParts.push(`${gap.dayKey} / ${gap.label} (${gap.missingFields.join(', ')})`);
    }
    const attemptNote = macroRetryInfo ? ` (повторни опити: ${macroRetryInfo.attempts})` : '';
    const validationMessage =
        'Липсват макроси за следните елементи: ' + (missingParts.join('; ') || 'неопределени елементи') +
        `. Планът няма да бъде записан${attemptNote}.`;
    workingPlan.generationMetadata.errors.push(validationMessage);
    await addLog(`Грешка: ${validationMessage}`, { checkpoint: true, reason: 'macro-validation-failed' });
    console.warn(`PLAN_VALIDATION_WARN (${userId}): ${validationMessage}`);

    if (retryArtifactKey && macroRetryInfo && macroRetryInfo.lastRawResponse) {
        try {
            await env.USER_METADATA_KV.put(
                retryArtifactKey,
                macroRetryInfo.lastRawResponse.substring(0, 600)
            );
        } catch (storeErr) {
            console.warn(`PLAN_VALIDATION_WARN (${userId}): Неуспешно записване на суров AI отговор - ${storeErr.message}`);
        }
    }

    return {
        success: false,
        plan: workingPlan,
        finalMacroGaps,
        macroRetryInfo,
        attempts: macroRetryInfo.attempts
    };
}

// ------------- START FUNCTION: processSingleUserPlan -------------
async function processSingleUserPlan(userId, env) {
    // Starting plan generation
    const logKey = `${userId}_plan_log`;
    const logErrorKey = `${logKey}_flush_error`;
    const logBuffer = [];
    const kvRawCache = new Map();
    const kvJsonCache = new Map();
    const kvParsedCache = new Map();
    const getKvValue = async (key) => {
        if (kvRawCache.has(key)) {
            return kvRawCache.get(key);
        }
        const value = await env.USER_METADATA_KV.get(key);
        kvRawCache.set(key, value);
        return value;
    };
    const getKvJson = async (key, defaultValue = null) => {
        if (kvJsonCache.has(key)) {
            return kvJsonCache.get(key);
        }
        const raw = await getKvValue(key);
        if (raw === undefined || raw === null) {
            kvJsonCache.set(key, defaultValue);
            return defaultValue;
        }
        const parsed = safeParseJson(raw, defaultValue);
        kvJsonCache.set(key, parsed);
        return parsed;
    };
    const getKvParsed = async (key, parser = (value) => safeParseJson(value, null), defaultValue = null) => {
        if (kvParsedCache.has(key)) {
            return kvParsedCache.get(key);
        }
        const raw = await getKvValue(key);
        if (raw === undefined || raw === null) {
            const result = { raw: null, parsed: defaultValue };
            kvParsedCache.set(key, result);
            return result;
        }
        let parsed = defaultValue;
        try {
            parsed = parser(raw);
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешен парс за ${key} - ${err.message}`);
        }
        const result = { raw, parsed };
        kvParsedCache.set(key, result);
        return result;
    };
    const flushLog = async (reason = 'manual') => {
        if (logBuffer.length === 0) {
            return;
        }
        const serializedLog = JSON.stringify(logBuffer);
        try {
            await env.USER_METADATA_KV.put(logKey, serializedLog);
            await env.USER_METADATA_KV.delete(logErrorKey);
        } catch (err) {
            const timestamp = new Date().toISOString();
            console.error(`PROCESS_USER_PLAN_LOG_ERROR (${userId}):`, err.message);
            logBuffer.push(`[${timestamp}] Неуспешен запис на лог (${reason}): ${err.message}`);
            try {
                await env.USER_METADATA_KV.put(
                    logErrorKey,
                    JSON.stringify({ timestamp, reason, message: err.message })
                );
            } catch (criticalErr) {
                console.error(`PROCESS_USER_PLAN_LOG_CRITICAL (${userId}):`, criticalErr.message);
            }
        }
    };
    const addLog = async (msg, { checkpoint = false, reason = 'checkpoint' } = {}) => {
        logBuffer.push(`[${new Date().toISOString()}] ${msg}`);
        if (checkpoint) {
            await flushLog(reason);
        }
    };
    await env.USER_METADATA_KV.put(logKey, JSON.stringify([]));
    await addLog('Старт на генериране на плана', { checkpoint: true, reason: 'start' });
    try {
        const precheck = await validatePlanPrerequisites(env, userId);
        if (!precheck.ok) {
            await addLog(`Прекъснато: ${precheck.message}`, { checkpoint: true, reason: 'precheck' });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${precheck.message}`);
            return;
        }
        await addLog('Зареждане на изходни данни', { checkpoint: true, reason: 'load' });
        // Step 0 - Loading prerequisites
        const initialAnswersKey = `${userId}_initial_answers`;
        const finalPlanKey = `${userId}_final_plan`;
        const initialAnswersString = await getKvValue(initialAnswersKey);
        const previousPlan = await getKvJson(finalPlanKey, {});
        if (!initialAnswersString) {
            const msg = 'Initial answers not found. Cannot generate plan.';
            await addLog(`Грешка: ${msg}`, { checkpoint: true, reason: 'missing-initial-answers' });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${msg}`);
            throw new Error(`Initial answers not found for ${userId}. Cannot generate plan.`);
        }
        const initialAnswers = await getKvJson(initialAnswersKey, {});
        if (Object.keys(initialAnswers).length === 0) {
            const msg = 'Parsed initial answers are empty.';
            await addLog(`Грешка: ${msg}`, { checkpoint: true, reason: 'empty-initial-answers' });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${msg}`);
            throw new Error(`Parsed initial answers are empty for ${userId}.`);
        }
        const profile = await getKvJson(`${userId}_profile`, {});
        const requirementKey = getTargetMacroRequirementsKey(userId);
        const targetMacroInputCheck = ensureTargetMacrosAvailable(initialAnswers, profile);
        if (!targetMacroInputCheck.ok) {
            const guidancePayload = {
                ...targetMacroInputCheck,
                timestamp: new Date().toISOString()
            };
            await env.USER_METADATA_KV.put(requirementKey, JSON.stringify(guidancePayload));
            const combinedMessage = `${targetMacroInputCheck.message} ${targetMacroInputCheck.instructions.join(' ')}`.trim();
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, combinedMessage);
            await setPlanStatus(userId, 'awaiting-data', env);
            await addLog(`Прекъснато: ${targetMacroInputCheck.message}`, {
                checkpoint: true,
                reason: 'missing-macro-inputs'
            });
            console.warn(
                `PROCESS_USER_PLAN_WARN (${userId}): ${targetMacroInputCheck.message} - изисква се допълване на данни.`
            );
            return targetMacroInputCheck;
        }
        await env.USER_METADATA_KV.delete(requirementKey).catch(() => {});
        let targetMacros = null;
        let analysisTargetMacros = null;
        try {
            const { raw: analysisMacrosRaw, parsed: analysisMacrosParsed } = await getKvParsed(
                `${userId}_analysis_macros`,
                (value) => safeParseJson(value, null),
                null
            );
            const analysisSource = analysisMacrosParsed?.data ?? analysisMacrosParsed ?? analysisMacrosRaw;
            if (analysisSource) {
                analysisTargetMacros = finalizeTargetMacros(extractTargetMacrosFromAny(analysisSource));
            }
            if (analysisMacrosRaw && !analysisTargetMacros) {
                console.warn(
                    `PROCESS_USER_PLAN_WARN (${userId}): Записът ${userId}_analysis_macros няма валидни стойности.`
                );
            }
        } catch (macrosErr) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Грешка при зареждане на анализ на макроси - ${macrosErr.message}`);
        }

        let planTargetMacros = null;
        try {
            planTargetMacros = finalizeTargetMacros(
                extractTargetMacrosFromAny(previousPlan?.caloriesMacros || previousPlan)
            );
            if (!analysisTargetMacros && planTargetMacros) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Използваме макроси от предишния план.`);
            }
        } catch (planMacroErr) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Грешка при извличане на макроси от предишния план - ${planMacroErr.message}`);
        }

        let estimateTargetMacros = null;
        try {
            const estimated = estimateMacros(initialAnswers);
            estimateTargetMacros = finalizeTargetMacros(extractTargetMacrosFromAny(estimated));
            if (!analysisTargetMacros && !planTargetMacros && estimateTargetMacros) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Използваме estimateMacros като fallback.`);
            }
        } catch (estimateErr) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Грешка при estimateMacros - ${estimateErr.message}`);
        }
        const mergedTargetMacros = mergeTargetMacroCandidates(
            analysisTargetMacros,
            planTargetMacros,
            estimateTargetMacros
        );
        if (mergedTargetMacros) {
            targetMacros = finalizeTargetMacros(mergedTargetMacros);
        }
        if (!targetMacros) {
            console.warn(
                `PROCESS_USER_PLAN_WARN (${userId}): Неуспешно извличане на таргет макроси от наличните източници.`
            );
        }
        const defaultPsychoProfileText = 'Няма наличен психопрофил';
        const defaultPsychoConceptsText = 'Няма налични насоки за психопрофил';
        let psychoProfileText = defaultPsychoProfileText;
        let psychoConceptsText = defaultPsychoConceptsText;
        let visualTestInfo = '';
        let personalityTestInfo = '';
        try {
            // Първо се опитваме да вземем обогатените данни от initial_answers.psychTests
            let psychTestsData = null;
            if (initialAnswers && initialAnswers.psychTests) {
                psychTestsData = initialAnswers.psychTests;
            }
            
            // Ако имаме обогатени данни от psychTests, използваме тях (приоритет)
            if (psychTestsData && (psychTestsData.visualTest || psychTestsData.personalityTest)) {
                // Форматиране на визуален тест с обогатени данни
                if (psychTestsData.visualTest) {
                    const vt = psychTestsData.visualTest;
                    const name = vt.name || vt.profileName || 'Неизвестен профил';
                    const profileId = vt.id || vt.profileId || 'N/A';
                    visualTestInfo = `Визуален тест: ${name} (ID: ${profileId})`;
                    
                    const short = vt.short || vt.profileShort;
                    if (short) {
                        visualTestInfo += `\nОписание: ${short}`;
                    }
                    
                    // Добавяне на mainPsycho характеристики (с подробности)
                    if (vt.mainPsycho && Array.isArray(vt.mainPsycho) && vt.mainPsycho.length > 0) {
                        visualTestInfo += `\n\nПсихологически характеристики:`;
                        vt.mainPsycho.forEach((item, idx) => {
                            visualTestInfo += `\n  ${idx + 1}. ${item}`;
                        });
                    }
                    
                    // Добавяне на mainHabits (с подробности)
                    if (vt.mainHabits && Array.isArray(vt.mainHabits) && vt.mainHabits.length > 0) {
                        visualTestInfo += `\n\nХранителни навици:`;
                        vt.mainHabits.forEach((item, idx) => {
                            visualTestInfo += `\n  ${idx + 1}. ${item}`;
                        });
                    }
                    
                    // Добавяне на mainRisks (с подробности)
                    if (vt.mainRisks && Array.isArray(vt.mainRisks) && vt.mainRisks.length > 0) {
                        visualTestInfo += `\n\nПотенциални рискове:`;
                        vt.mainRisks.forEach((item, idx) => {
                            visualTestInfo += `\n  ${idx + 1}. ${item}`;
                        });
                    }
                }
                
                // Форматиране на личностен тест с обогатени данни
                if (psychTestsData.personalityTest) {
                    const pt = psychTestsData.personalityTest;
                    personalityTestInfo = `Личностен профил: ${pt.typeCode || 'N/A'}`;
                    
                    if (pt.scores) {
                        const scoreEntries = Object.entries(pt.scores)
                            .map(([dim, score]) => `${dim}: ${typeof score === 'number' ? score.toFixed(1) : score}`)
                            .join(', ');
                        personalityTestInfo += `\nРезултати: ${scoreEntries}`;
                    }
                    
                    if (pt.strengths && Array.isArray(pt.strengths) && pt.strengths.length > 0) {
                        personalityTestInfo += `\n\nСилни страни:`;
                        pt.strengths.forEach((item, idx) => {
                            personalityTestInfo += `\n  ${idx + 1}. ${item}`;
                        });
                    }
                    
                    // Обработка на mainRisks - може да е масив от стрингове или обекти
                    if (pt.mainRisks && Array.isArray(pt.mainRisks) && pt.mainRisks.length > 0) {
                        personalityTestInfo += `\n\nОсновни рискове:`;
                        pt.mainRisks.forEach((risk, idx) => {
                            if (typeof risk === 'object' && risk.title) {
                                // Нов формат с обекти { title, description }
                                personalityTestInfo += `\n  ${idx + 1}. ${risk.title}`;
                                if (risk.description) {
                                    personalityTestInfo += ` - ${risk.description}`;
                                }
                            } else {
                                // Стар формат - само стринг
                                personalityTestInfo += `\n  ${idx + 1}. ${risk}`;
                            }
                        });
                    }
                    
                    if (pt.riskFlags && Array.isArray(pt.riskFlags) && pt.riskFlags.length > 0) {
                        personalityTestInfo += `\nРискови флагове: ${pt.riskFlags.join('; ')}`;
                    }
                    
                    if (pt.topRecommendations && Array.isArray(pt.topRecommendations) && pt.topRecommendations.length > 0) {
                        personalityTestInfo += `\n\nПрепоръки:`;
                        pt.topRecommendations.forEach((rec, idx) => {
                            personalityTestInfo += `\n  ${idx + 1}. ${rec}`;
                        });
                    }
                    
                    // НОВО: Добавяне на psyadvice данни от psyadvice.txt
                    if (pt.psyadvice) {
                        const psy = pt.psyadvice;
                        personalityTestInfo += `\n\n--- ПСИХОЛОГИЧЕСКИ ПРОФИЛ (psyadvice) ---`;
                        if (psy.description) {
                            personalityTestInfo += `\nОписание: ${psy.description}`;
                        }
                        if (psy.traits) {
                            personalityTestInfo += `\nХарактеристики: ${psy.traits}`;
                        }
                        if (psy.eatingRisks && Array.isArray(psy.eatingRisks) && psy.eatingRisks.length > 0) {
                            personalityTestInfo += `\n\nХранене – рискове:`;
                            psy.eatingRisks.forEach((risk, idx) => {
                                personalityTestInfo += `\n  ${idx + 1}. ${risk}`;
                            });
                        }
                        if (psy.directions && Array.isArray(psy.directions) && psy.directions.length > 0) {
                            personalityTestInfo += `\n\nНасоки за хранене:`;
                            psy.directions.forEach((dir, idx) => {
                                personalityTestInfo += `\n  ${idx + 1}. ${dir}`;
                            });
                        }
                        if (psy.communication && Array.isArray(psy.communication) && psy.communication.length > 0) {
                            personalityTestInfo += `\n\nКомуникационен стил:`;
                            psy.communication.forEach((comm, idx) => {
                                personalityTestInfo += `\n  ${idx + 1}. ${comm}`;
                            });
                        }
                    }
                }
            }
            
            // Fallback към _analysis данните (по-стар формат или липсващи psychTests)
            if (!visualTestInfo && !personalityTestInfo) {
                const { raw: psychoAnalysisRaw, parsed: psychoAnalysisParsed } = await getKvParsed(
                    `${userId}_analysis`,
                    (value) => parsePossiblyStringifiedJson(value),
                    null
                );
                const psychoSource = psychoAnalysisParsed ?? psychoAnalysisRaw;
                if (psychoSource) {
                    const psychoData = extractPsychoProfileTexts(psychoSource);
                    if (psychoData.dominant) {
                        psychoProfileText = psychoData.dominant;
                    }
                    if (psychoData.concepts && psychoData.concepts.length > 0) {
                        psychoConceptsText = psychoData.concepts.join(', ');
                    }
                    
                    // Добавяне на информация от визуалния тест (legacy format)
                    if (psychoSource.visualTestProfile) {
                        const vt = psychoSource.visualTestProfile;
                        visualTestInfo = `Визуален тест: ${vt.profileName} (ID: ${vt.profileId})`;
                        if (vt.profileShort) {
                            visualTestInfo += ` - ${vt.profileShort}`;
                        }
                    }
                    
                    // Добавяне на информация от личностния тест (legacy format)
                    if (psychoSource.personalityTestProfile) {
                        const pt = psychoSource.personalityTestProfile;
                        personalityTestInfo = `Личностен профил: ${pt.typeCode}`;
                        if (pt.scores) {
                            const scoreEntries = Object.entries(pt.scores)
                                .map(([dim, score]) => `${dim}: ${score}`)
                                .join(', ');
                            personalityTestInfo += ` (Скорове: ${scoreEntries})`;
                        }
                        if (pt.riskFlags && pt.riskFlags.length > 0) {
                            personalityTestInfo += ` | Рискови фактори: ${pt.riskFlags.join('; ')}`;
                        }
                    }
                }
            }
        } catch (psychoErr) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Грешка при зареждане на психопрофил - ${psychoErr.message}`);
        }
        // Processing plan for user
        await addLog('Подготовка на модела');
        let planBuilder = createEmptyPlanBuilder();
        const [ questionsJsonString, baseDietModelContent, allowedMealCombinationsContent, eatingPsychologyContent, recipeDataStr, geminiApiKey, openaiApiKey, planModelName, unifiedPromptTemplate ] = await Promise.all([
            env.RESOURCES_KV.get('question_definitions'),
            env.RESOURCES_KV.get('base_diet_model'),
            env.RESOURCES_KV.get('allowed_meal_combinations'),
            env.RESOURCES_KV.get('eating_psychology'),
            getCachedResource('recipe_data', env.RESOURCES_KV),
            env[GEMINI_API_KEY_SECRET_NAME],
            env[OPENAI_API_KEY_SECRET_NAME],
            env.RESOURCES_KV.get('model_plan_generation'),
            env.RESOURCES_KV.get('prompt_unified_plan_generation_v2')
        ]);
        // Опционално: чакаща модификация на плана
        let pendingPlanModText = '';
        try {
            const pendingPlanModStr = await getKvValue(`pending_plan_mod_${userId}`);
            const pendingPlanModData = safeParseJson(pendingPlanModStr, pendingPlanModStr);
            if (pendingPlanModData) {
                pendingPlanModText = typeof pendingPlanModData === 'string' ? pendingPlanModData : JSON.stringify(pendingPlanModData);
            }
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно зареждане на pending_plan_mod - ${err.message}`);
        }
        const providerForPlan = getModelProvider(planModelName);
        if (providerForPlan === 'gemini' && !geminiApiKey) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Gemini API Key secret not found or empty.`);
            throw new Error('CRITICAL: Gemini API Key secret not found or empty.');
        }
        if (providerForPlan === 'openai' && !openaiApiKey) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: OpenAI API Key secret not found or empty.`);
            throw new Error('CRITICAL: OpenAI API Key secret not found or empty.');
        }
        if (!planModelName) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Plan generation model name ('model_plan_generation') not found in RESOURCES_KV.`);
            throw new Error("CRITICAL: Plan generation model name ('model_plan_generation') not found in RESOURCES_KV.");
        }
        if (!unifiedPromptTemplate) {
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): CRITICAL: Unified prompt template ('prompt_unified_plan_generation_v2') is missing from RESOURCES_KV.`);
            throw new Error("CRITICAL: Unified prompt template ('prompt_unified_plan_generation_v2') is missing from RESOURCES_KV.");
        }
        let targetReplacements;
        let targetMacroFixAttempted = false;
        const handleTargetMacroFailure = async (error, reason = 'target-macros-invalid') => {
            const errMsg = error.message;
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, errMsg);
            await setPlanStatus(userId, 'error', env);
            await addLog(`Грешка: ${errMsg}`, { checkpoint: true, reason });
            console.error(`PROCESS_USER_PLAN_ERROR (${userId}): ${errMsg}`);
            throw error;
        };
        const runTargetMacroFix = async () => {
            try {
                // Опит за изчисляване на макроси чрез AI модел
                let aiMacros = null;
                try {
                    const macroPromptTemplate = await env.RESOURCES_KV.get('prompt_macro_calculation');
                    const macroModelName = planModelName || await env.RESOURCES_KV.get('model_plan_generation');
                    
                    if (macroPromptTemplate && macroModelName) {
                        await addLog('Изчисляване на оптимални макроси чрез AI модел...');
                        const populatedMacroPrompt = populatePrompt(macroPromptTemplate, {
                            '%%ANSWERS_JSON%%': JSON.stringify(initialAnswers)
                        });
                        
                        const rawMacroResponse = await callModelRef.current(
                            macroModelName, 
                            populatedMacroPrompt, 
                            env, 
                            { temperature: 0.3, maxTokens: 1000 }
                        );
                        
                        const cleanedMacroResponse = cleanGeminiJson(rawMacroResponse);
                        const parsedMacros = safeParseJson(cleanedMacroResponse, null);
                        
                        if (parsedMacros && parsedMacros.calories && parsedMacros.protein_grams && 
                            parsedMacros.carbs_grams && parsedMacros.fat_grams) {
                            aiMacros = parsedMacros;
                            // AI calculated macros successfully
                            await addLog(`AI изчисли макроси: ${parsedMacros.calories} kcal (${parsedMacros.protein_percent}% протеин, ${parsedMacros.carbs_percent}% въглехидрати, ${parsedMacros.fat_percent}% мазнини)`);
                        } else {
                            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): AI macro response missing required fields.`);
                        }
                    } else {
                        console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Macro calculation prompt or model not configured.`);
                    }
                } catch (aiError) {
                    console.warn(`PROCESS_USER_PLAN_WARN (${userId}): AI macro calculation failed: ${aiError.message}`);
                }
                
                // Ако AI не успя, използваме подобрения estimateMacros като fallback
                if (aiMacros) {
                    targetMacros = finalizeTargetMacros(extractTargetMacrosFromAny(aiMacros));
                    targetMacroFixAttempted = true;
                    await addLog('Таргет макросите са определени чрез AI анализ.');
                } else {
                    const estimated = estimateMacros(initialAnswers);
                    if (estimated) {
                        targetMacros = finalizeTargetMacros(extractTargetMacrosFromAny(estimated));
                        targetMacroFixAttempted = true;
                        await addLog('Таргет макросите са определени чрез формула (AI не бе достъпен).');
                        // Target macros calculated using enhanced estimateMacros fallback
                    } else {
                        throw new Error('Не може да се калкулират таргет макроси от наличните данни.');
                    }
                }
            } catch (macroFixErr) {
                await handleTargetMacroFailure(macroFixErr, 'target-macros-missing');
            }
        };
        if (!targetMacros) {
            await runTargetMacroFix();
        }
        try {
            targetReplacements = buildTargetReplacements(targetMacros);
        } catch (macroErr) {
            if (macroErr instanceof MissingTargetMacrosError && !targetMacroFixAttempted) {
                await runTargetMacroFix();
                try {
                    targetReplacements = buildTargetReplacements(targetMacros);
                } catch (retryError) {
                    await handleTargetMacroFailure(retryError, 'target-macros-invalid');
                }
            } else {
                await handleTargetMacroFailure(macroErr, 'target-macros-invalid');
            }
        }
        planBuilder.generationMetadata.modelUsed = planModelName;
        let questionTextMap = new Map();
        if (questionsJsonString) { try { const defs = JSON.parse(questionsJsonString); if (Array.isArray(defs)) defs.forEach(q => { if (q.id && q.text) questionTextMap.set(q.id, q.text); }); } catch (e) { console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Failed to parse question_definitions: ${e.message}`); } } else { console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Resource 'question_definitions' not found.`); }
        const recipeData = safeParseJson(recipeDataStr, {});

        // --- Опционални данни: текущ статус и дневници ---
        let currentStatus = {};
        let logEntries = [];
        let logsForContext = [];
        try {
            const currentStatusStr = await getKvValue(`${userId}_current_status`);
            currentStatus = safeParseJson(currentStatusStr, {});
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно зареждане на current_status - ${err.message}`);
        }
        try {
            const logDates = await getUserLogDates(env, userId);
            if (logDates.length > 0) {
                const sortedLogDates = [...logDates].sort((a, b) => a.localeCompare(b));
                const logKeys = sortedLogDates.map(d => `${userId}_log_${d}`);
                const logStrings = await Promise.all(logKeys.map((k) => getKvValue(k)));
                logEntries = logStrings.map(s => {
                    const obj = safeParseJson(s, {});
                    return obj.log || obj.data || obj;
                });
                logsForContext = sortedLogDates
                    .map((date, idx) => sanitizeLogEntryForContext(date, safeParseJson(logStrings[idx], {})))
                    .filter(Boolean);
            } else {
                const aggregatedStr = await getKvValue(`${userId}_logs`);
                const aggregated = safeParseJson(aggregatedStr, []);
                if (Array.isArray(aggregated)) {
                    logEntries = aggregated.map(l => l.log || l.data || l);
                    logsForContext = aggregated
                        .map(entry => sanitizeLogEntryForContext(entry?.date, entry?.log || entry?.data || entry))
                        .filter(Boolean);
                } else {
                    logEntries = [];
                    logsForContext = [];
                }
            }
        } catch (err) {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно зареждане на дневници - ${err.message}`);
        }

        const safeNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
        let recentWeight = safeNum(currentStatus.weight);
        if (recentWeight === null && logEntries.length > 0) {
            recentWeight = safeNum(logEntries[logEntries.length - 1].weight);
        }
        const firstWeight = logEntries.length > 0 ? safeNum(logEntries[0].weight) : null;
        let weightChangeStr = 'N/A';
        if (recentWeight !== null && firstWeight !== null) {
            const diff = recentWeight - firstWeight;
            weightChangeStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} кг`;
        }
        const avgOf = (key) => {
            const vals = logEntries.map(l => safeNum(l[key])).filter(v => v !== null);
            return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
        };
        const avgMood = avgOf('mood');
        const avgEnergy = avgOf('energy');

        const formattedAnswersForPrompt = Object.entries(initialAnswers).filter(([qId]) => qId !== 'submissionDate' && qId !== 'email' && qId !== 'name').map(([qId, aVal]) => { const qText = questionTextMap.get(qId) || qId.replace(/_/g, ' '); let aText = ''; if (aVal === null || aVal === undefined || String(aVal).trim() === '') aText = '(няма отговор)'; else if (Array.isArray(aVal)) aText = aVal.length > 0 ? aVal.join(', ') : '(няма избран отговор)'; else aText = String(aVal); return `В: ${qText}\nО: ${aText}`; }).join('\n\n').trim();
        const userAnswersJson = JSON.stringify(initialAnswers);

        // Preparing for unified AI call
        const replacements = {
            '%%FORMATTED_ANSWERS%%': formattedAnswersForPrompt, '%%USER_ID%%': userId, '%%USER_NAME%%': safeGet(initialAnswers, 'name', 'Потребител'),
            '%%USER_EMAIL%%': safeGet(initialAnswers, 'email', 'N/A'), '%%USER_GOAL%%': safeGet(initialAnswers, 'goal', 'Общо здраве'),
            '%%FOOD_PREFERENCE%%': (() => { const prefs = safeGet(initialAnswers, 'dietPreference', []); return Array.isArray(prefs) && prefs.length > 0 ? prefs.join(', ') : 'Нямам специфични предпочитания'; })(),
            '%%INTOLERANCES%%': (() => { const c = safeGet(initialAnswers, 'medicalConditions', []); let i = []; if (c.includes("Инсулинова резистентност")) i.push("инсулинова резистентност"); if (c.includes("Диабет")) i.push("диабет"); if (c.includes("IBS")) i.push("IBS"); if (c.includes("IBD")) i.push("IBD"); if (c.includes("Алергии")) i.push("алергии"); if (c.includes("Рефлукс")) i.push("рефлукс"); return i.length > 0 ? i.join(', ') : "Няма декларирани"; })(),
            '%%DISLIKED_FOODS%%': safeGet(initialAnswers, 'dietDislike', '') || safeGet(initialAnswers, 'foodPreferenceDisliked', '') || 'Няма посочени нехаресвани храни',
            '%%CONDITIONS%%': (safeGet(initialAnswers, 'medicalConditions', []).filter(c => c && c.toLowerCase() !== 'нямам' && c.toLowerCase() !== 'друго')).join(', ') || 'Няма декларирани специфични медицински състояния',
            '%%ACTIVITY_LEVEL%%': (() => { const da = safeGet(initialAnswers, 'dailyActivityLevel', 'Не е посочено'); const sa = safeGet(initialAnswers, 'sportActivity', '') || safeGet(initialAnswers, 'sportActivityLevel', ''); return `Ежедневна активност: ${da}. Спортна активност: ${sa || 'Не е посочено'}`; })(),
            '%%STRESS_LEVEL%%': safeGet(initialAnswers, 'stressLevel', 'Не е посочено'), '%%SLEEP_INFO%%': `Часове сън: ${safeGet(initialAnswers, 'sleepHours', 'Непос.')}, Прекъсвания на съня: ${safeGet(initialAnswers, 'sleepInterrupt', 'Непос.')}`,
            '%%MAIN_CHALLENGES%%': safeGet(initialAnswers, 'additionalNotes', '') || safeGet(initialAnswers, 'mainChallenge', 'Няма посочени основни предизвикателства'), '%%USER_AGE%%': safeGet(initialAnswers, 'age', 'Няма данни'),
            '%%USER_GENDER%%': safeGet(initialAnswers, 'gender', 'Няма данни'), '%%USER_HEIGHT%%': safeGet(initialAnswers, 'height', 'Няма данни'),
            '%%USER_WEIGHT%%': safeGet(initialAnswers, 'weight', 'Няма данни'), '%%TARGET_WEIGHT_CHANGE_KG%%': safeGet(initialAnswers, 'lossKg', safeGet(initialAnswers, 'gainKg', 'N/A')),
            '%%BASE_DIET_MODEL_SUMMARY%%': (baseDietModelContent || '').substring(0, 3000), '%%ALLOWED_MEAL_COMBINATIONS%%': (allowedMealCombinationsContent || '').substring(0, 2500),
            '%%EATING_PSYCHOLOGY_SUMMARY%%': (eatingPsychologyContent || '').substring(0, 3000), '%%RECIPE_KEYS%%': Object.keys(recipeData).join(', ') || 'няма налични рецепти за референция',
            '%%RECENT_WEIGHT_KG%%': recentWeight !== null ? `${recentWeight.toFixed(1)} кг` : 'N/A',
            '%%WEIGHT_CHANGE_LAST_7_DAYS%%': weightChangeStr,
            '%%AVG_MOOD_LAST_7_DAYS%%': avgMood !== 'N/A' ? `${avgMood}/5` : 'N/A',
            '%%AVG_ENERGY_LAST_7_DAYS%%': avgEnergy !== 'N/A' ? `${avgEnergy}/5` : 'N/A'
        };
        Object.assign(replacements, targetReplacements, {
            '%%USER_ANSWERS_JSON%%': userAnswersJson,
            '%%DOMINANT_PSYCHO_PROFILE%%': psychoProfileText,
            '%%PSYCHO_PROFILE_CONCEPTS%%': psychoConceptsText,
            '%%VISUAL_TEST_PROFILE%%': visualTestInfo || 'Няма визуален тест',
            '%%PERSONALITY_TEST_PROFILE%%': personalityTestInfo || 'Няма личностен тест'
        });
        const targetPlaceholderDefaults = {};
        for (const placeholders of Object.values(TARGET_MACRO_PLACEHOLDERS)) {
            const normalizedPlaceholders = Array.isArray(placeholders) ? placeholders : [placeholders];
            for (const placeholder of normalizedPlaceholders) {
                targetPlaceholderDefaults[placeholder] = 'N/A';
            }
        }
        const criticalDefaults = {
            ...targetPlaceholderDefaults,
            '%%USER_ANSWERS_JSON%%': '{}',
            '%%DOMINANT_PSYCHO_PROFILE%%': defaultPsychoProfileText,
            '%%PSYCHO_PROFILE_CONCEPTS%%': defaultPsychoConceptsText,
            '%%VISUAL_TEST_PROFILE%%': 'Няма визуален тест',
            '%%PERSONALITY_TEST_PROFILE%%': 'Няма личностен тест'
        };
        const criticalMarkers = new Set([
            ...Object.values(TARGET_MACRO_PLACEHOLDERS).flatMap((placeholders) =>
                (Array.isArray(placeholders) ? placeholders : [placeholders])
            ),
            '%%USER_ANSWERS_JSON%%',
            '%%DOMINANT_PSYCHO_PROFILE%%',
            '%%PSYCHO_PROFILE_CONCEPTS%%',
            '%%VISUAL_TEST_PROFILE%%',
            '%%PERSONALITY_TEST_PROFILE%%'
        ]);
        for (const [marker, fallbackValue] of Object.entries(criticalDefaults)) {
            const value = replacements[marker];
            if (value === undefined || value === null || (typeof value === 'string' && value.includes('%%'))) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Липсва стойност за маркер ${marker}, използваме дефолт.`);
                replacements[marker] = fallbackValue;
            }
        }
        const templateCriticalMarkers = Array.from(criticalMarkers).filter((marker) =>
            typeof unifiedPromptTemplate === 'string' && unifiedPromptTemplate.includes(marker)
        );
        for (const marker of templateCriticalMarkers) {
            const value = replacements[marker];
            if (value === undefined || value === null || (typeof value === 'string' && value.includes('%%'))) {
                const fallbackValue = criticalDefaults[marker] ?? 'N/A';
                console.warn(
                    `PROCESS_USER_PLAN_WARN (${userId}): Маркер ${marker} присъства в шаблона без стойност, задаваме дефолт.`
                );
                replacements[marker] = fallbackValue;
            }
        }
        const placeholderPattern = /%%[^%]+%%/;
        for (const [key, value] of Object.entries(replacements)) {
            if (typeof value === 'string' && placeholderPattern.test(value)) {
                const fallbackValue = criticalDefaults[key] ?? 'N/A';
                console.warn(
                    `PROCESS_USER_PLAN_WARN (${userId}): Маркер ${key} съдържа непопълнен плейсхолдър (${value}), използваме дефолтна стойност.`
                );
                replacements[key] = fallbackValue;
            }
        }
        const populatedUnifiedPrompt = populatePrompt(unifiedPromptTemplate, replacements);
        let finalPrompt = populatedUnifiedPrompt;
        if (pendingPlanModText) {
            finalPrompt += `\n\n[PLAN_MODIFICATION]\n${pendingPlanModText}`;
        }
        
        const planCallTimeoutMs = resolvePlanCallTimeoutMs(env);
        let rawAiResponse = "";
        let macroValidationPassed = false;
        let planStatusValue = 'processing';
        try {
            await addLog('Извикване на AI модела');
            // Calling AI model for unified plan
            rawAiResponse = await callModelWithTimeout({
                model: planModelName,
                prompt: finalPrompt,
                env,
                options: { temperature: 0.1, maxTokens: 12000 },
                timeoutMs: planCallTimeoutMs
            });
            try {
                planBuilder = await buildPlanFromRawResponse(rawAiResponse, {
                    planModelName,
                    env,
                    userId,
                    addLog
                });
            } catch (buildErr) {
                if (buildErr instanceof PlanCaloriesMacrosMissingError && buildErr.planBuilder) {
                    planBuilder = buildErr.planBuilder;
                } else {
                    throw buildErr;
                }
            }
            const enforcementResult = await enforceCompletePlanBeforePersist({
                plan: planBuilder,
                userId,
                env,
                planModelName,
                basePrompt: finalPrompt,
                addLog,
                retryArtifactKey: `${userId}_last_plan_macro_retry`
            });
            planBuilder = enforcementResult.plan;
            macroValidationPassed = enforcementResult.success;
            if (macroValidationPassed) {
                await addLog('Планът е генериран', { checkpoint: true, reason: 'plan-generated' });
            }
        } catch (e) {
            const isTimeout = e?.name === 'AbortError' || /timed out/i.test(e?.message || '');
            const timeoutMsg = `AI заявката за плана прекъсна след ${planCallTimeoutMs}ms.`;
            const detailedErrorMsg = `Unified Plan Generation Error for ${userId}: ${e.message}. Raw response (start): ${rawAiResponse.substring(0, 500)}...`;
            const errorMsg = isTimeout ? timeoutMsg : detailedErrorMsg;
            if (isTimeout) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): ${timeoutMsg}`);
            } else {
                console.error(detailedErrorMsg);
            }
            await addLog(`Грешка при AI: ${isTimeout ? 'Изтече времето за отговор' : e.message}`, {
                checkpoint: true,
                reason: 'ai-error'
            });
            if (!isTimeout) {
                await env.USER_METADATA_KV.put(`${userId}_last_plan_raw_error`, rawAiResponse.substring(0, 300));
            }
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, errorMsg);
            planBuilder.generationMetadata.errors.push(errorMsg);
        }

        if (macroValidationPassed) {
            // Assembling and saving final plan
            await addLog('Запис на генерирания план', { checkpoint: true, reason: 'save' });
            planBuilder.generationMetadata.timestamp = planBuilder.generationMetadata.timestamp || new Date().toISOString();
            
            // Добавяне на психо профил данни от initial_answers към плана (ако има налични)
            try {
                // Четем psychTests от initial_answers
                const psychTests = initialAnswers?.psychTests;
                if (psychTests && (psychTests.visualTest || psychTests.personalityTest)) {
                    // Използваме helper функцията за създаване на компактните данни
                    const psychoTestsData = createPsychoTestsProfileData(
                        psychTests.visualTest,
                        psychTests.personalityTest,
                        {
                            normalizedVisualTimestamp: psychTests.visualTest?.timestamp,
                            normalizedPersonalityTimestamp: psychTests.personalityTest?.timestamp,
                            timestamp: psychTests.lastUpdated || planBuilder.generationMetadata.timestamp
                        }
                    );
                    
                    planBuilder.psychoTestsProfile = psychoTestsData;
                    await addLog('Психо профил данни добавени към плана');
                    
                    // v2.0: Adapted guidance ще се генерира отделно чрез /api/applyPsychometricAdaptation
                    // за да не претоварваме основния AI анализ при генериране на плана
                }
            } catch (psychoErr) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Не успя добавянето на психо профил към плана - ${psychoErr.message}`);
                // Не прекъсваме процеса при грешка - психо профилът не е критичен
            }
            
            const finalPlanString = JSON.stringify(planBuilder, null, 2);
            await env.USER_METADATA_KV.put(`${userId}_final_plan`, finalPlanString);

            const macrosRecord = {
                status: 'final',
                data: planBuilder.caloriesMacros ? { ...planBuilder.caloriesMacros } : null
            };
            await env.USER_METADATA_KV.put(`${userId}_analysis_macros`, JSON.stringify(macrosRecord));
            await env.USER_METADATA_KV.delete(`${userId}_last_plan_macro_retry`);

            planStatusValue = planBuilder.generationMetadata.errors.length > 0 ? 'error' : 'ready';
            if (planStatusValue === 'error') {
                await setPlanStatus(userId, 'error', env);
                await env.USER_METADATA_KV.put(`${userId}_processing_error`, planBuilder.generationMetadata.errors.join('\n---\n'));
                await addLog('Процесът завърши с грешка', { checkpoint: true, reason: 'status-error' });
                // Finished with errors, status set to 'error'
            } else {
                await setPlanStatus(userId, 'ready', env);
                await env.USER_METADATA_KV.delete(`${userId}_processing_error`); // Изтриваме евентуална стара грешка
                await env.USER_METADATA_KV.delete(`pending_plan_mod_${userId}`);
                await env.USER_METADATA_KV.delete(getTargetMacroRequirementsKey(userId));
                await env.USER_METADATA_KV.delete(`${userId}_last_target_macros_fix`);
                await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());
                const summary = createPlanUpdateSummary(planBuilder, previousPlan);
                await env.USER_METADATA_KV.put(`${userId}_ai_update_pending_ack`, JSON.stringify(summary));

                await addLog('Планът е готов', { checkpoint: true, reason: 'status-ready' });
            }
        } else {
            console.warn(`PROCESS_USER_PLAN_WARN (${userId}): Макро-валидацията не бе успешна, планът остава в статус 'processing'.`);
            planStatusValue = 'processing';
        }

        if (macroValidationPassed) {
            try {
                const chatContext = await assembleChatContext(userId, env, {
                    initialAnswers,
                    finalPlan: planBuilder,
                    currentStatus,
                    planStatus: planStatusValue,
                    logEntries: logsForContext
                });
                if (chatContext) {
                    await env.USER_METADATA_KV.put(getChatContextKey(userId), JSON.stringify(chatContext));
                } else {
                    await env.USER_METADATA_KV.delete(getChatContextKey(userId));
                }
            } catch (ctxErr) {
                console.warn(`PROCESS_USER_PLAN_WARN (${userId}): неуспешно обновяване на чат контекст - ${ctxErr.message}`);
            }
        }
    } catch (error) {
        console.error(`PROCESS_USER_PLAN (${userId}): >>> FATAL Processing Error <<<: ${error.name} - ${error.message}\n${error.stack}`);
        try {
            await addLog(`Фатална грешка: ${error.message}`, { checkpoint: true, reason: 'fatal' });
            await setPlanStatus(userId, 'error', env);
            const detailedErrorMessage = `[${new Date().toISOString()}] FATAL ERROR during plan generation for user ${userId}: ${error.name}: ${error.message}\nStack: ${error.stack}`;
            await env.USER_METADATA_KV.put(`${userId}_processing_error`, detailedErrorMessage);
            // Status set to 'error' after fatal exception
        } catch (statusError) {
            console.error(`PROCESS_USER_PLAN (${userId}): CRITICAL - Failed to set error status after fatal exception:`, statusError.message, statusError.stack);
        }
    } finally {
        await addLog('Процесът приключи');
        await flushLog('final');
        // Processing cycle finished
    }
}
// ------------- END FUNCTION: processSingleUserPlan -------------

// ------------- START FUNCTION: handlePrincipleAdjustment -------------
async function handlePrincipleAdjustment(userId, env, calledFromQuizAnalysis = false) {
    // Starting principle adjustment
    try {
        const [
            initialAnswersStr, finalPlanStr, currentStatusStr,
            chatHistoryStr, principleAdjustmentPromptTpl, planModelName, geminiApiKey, openaiApiKey,
            ...logStringsForWeightCheck
        ] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_initial_answers`),
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`${userId}_current_status`),
            env.USER_METADATA_KV.get(`${userId}_chat_history`),
            env.RESOURCES_KV.get('prompt_principle_adjustment'),
            env.RESOURCES_KV.get('model_plan_generation'), // Or specific model for adjustment
            env[GEMINI_API_KEY_SECRET_NAME],
            env[OPENAI_API_KEY_SECRET_NAME],
            ...Array.from({ length: 14 }, (_, i) => { // Fetch logs for the last 14 days
                const date = new Date(); date.setDate(date.getDate() - i);
                return env.USER_METADATA_KV.get(`${userId}_log_${date.toISOString().split('T')[0]}`);
            })
        ]);

        const providerForAdjustment = getModelProvider(planModelName);
        if (!initialAnswersStr || !finalPlanStr || !principleAdjustmentPromptTpl || !planModelName ||
            (providerForAdjustment === 'gemini' && !geminiApiKey) ||
            (providerForAdjustment === 'openai' && !openaiApiKey)) {
            console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Missing prerequisites (initialAnswers, finalPlan, prompt, model, or API key).`);
            return null;
        }
        const initialAnswers = safeParseJson(initialAnswersStr, {});
        const finalPlan = safeParseJson(finalPlanStr, {});
        const currentStatus = safeParseJson(currentStatusStr, {});
        const chatHistory = safeParseJson(chatHistoryStr, []);
        const initialPrinciples = finalPlan.principlesWeek2_4 || "Няма дефинирани първоначални принципи."; // Fallback

        if (Object.keys(initialAnswers).length === 0 || Object.keys(finalPlan).length === 0) {
             console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Failed to parse critical data (initialAnswers or finalPlan).`);
             return null;
        }

        const originalGoal = initialAnswers.goal || 'N/A';
        const calMac = finalPlan.caloriesMacros;
        const initCalMac = calMac
            ? `Кал: ${calMac.calories || '?'} P:${calMac.protein_grams || '?'}g C:${calMac.carbs_grams || '?'}g F:${calMac.fat_grams || '?'}g Fb:${calMac.fiber_grams || '?'}g`
            : 'N/A';

        const currentWeightVal = safeParseFloat(currentStatus?.weight);
        const currentWeightStr = currentWeightVal ? `${currentWeightVal.toFixed(1)} кг` : "N/A";
        
        let weightChangeLastWeek = "N/A";
        let weight7DaysAgo = null;
        // Търсене на тегло от преди ~7 дни (между 6-ия и 8-ия ден назад, за гъвкавост)
        for (let i = 6; i < 9; i++) { 
            if (i < logStringsForWeightCheck.length && logStringsForWeightCheck[i]) {
                const logD = safeParseJson(logStringsForWeightCheck[i], {});
                const lw = safeParseFloat(logD?.weight || safeGet(logD, 'currentStatus.weight')); // Check both direct weight and nested
                if (lw !== null) { weight7DaysAgo = lw; break; }
            }
        }
        if (currentWeightVal !== null && weight7DaysAgo !== null) {
            const ch = currentWeightVal - weight7DaysAgo;
            weightChangeLastWeek = `${ch >= 0 ? '+' : ''}${ch.toFixed(1)} кг`;
        }

        const logEntriesForAvg = [];
        for (let i = 0; i < 7; i++) { // Последните 7 дни
            if (i < logStringsForWeightCheck.length && logStringsForWeightCheck[i]) {
                const ld = safeParseJson(logStringsForWeightCheck[i], {});
                if(Object.keys(ld).length > 0) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    logEntriesForAvg.push({ date: d.toISOString().split('T')[0] , data: ld });
                }
            }
        }

        const getAvg = (k, p=1) => { const v = logEntriesForAvg.map(l => safeParseFloat(l?.data?.[k])).filter(val => val !== null && !isNaN(val) && val >= 1 && val <= 5); return v.length > 0 ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(p) : "N/A"; };
        const avgMood = getAvg('mood');
        const avgEnergy = getAvg('energy');
        const avgCalmness = getAvg('calmness');
        const avgSleep = getAvg('sleep');

        let mealAdherencePercent = "N/A";
        if (finalPlan.week1Menu && typeof finalPlan.week1Menu === 'object' && logEntriesForAvg.length > 0) {
            let totalPlanned = 0; let totalCompleted = 0; const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            for (const logEntry of logEntriesForAvg) {
                 const logDateObj = new Date(logEntry.date); const dayKey = daysOrder[logDateObj.getDay()];
                 const mealsForThisDay = safeGet(finalPlan.week1Menu, dayKey, []);
                 if (Array.isArray(mealsForThisDay) && mealsForThisDay.length > 0) {
                     totalPlanned += mealsForThisDay.length;
                     const completedStatusForDay = logEntry.data?.completedMealsStatus;
                     if (completedStatusForDay && typeof completedStatusForDay === 'object') {
                         mealsForThisDay.forEach((_, mealIdx) => { if (completedStatusForDay[`${dayKey}_${mealIdx}`] === true) totalCompleted++; });
                     }
                 } else if (logEntry.data?.completedMealsStatus && Object.keys(logEntry.data.completedMealsStatus).length > 0) {
                     // Ако няма планирани хранения за деня, но има отбелязани като изпълнени (може би от предишен план или свободен ден)
                     const completedToday = Object.values(logEntry.data.completedMealsStatus).filter(v => v === true).length;
                     if (completedToday > 0) { totalPlanned += completedToday; totalCompleted += completedToday; } // Броим ги като 100% за тези
                 } else if (Object.keys(logEntry.data).length > 0 && (!mealsForThisDay || mealsForThisDay.length === 0)) {
                     // Има лог, но няма планирани хранения (свободен ден) - считаме за 100% придържане за този ден
                     totalPlanned++; totalCompleted++;
                 }
            }
             if (totalPlanned > 0) mealAdherencePercent = `${((totalCompleted / totalPlanned) * 100).toFixed(0)}%`;
             else mealAdherencePercent = logEntriesForAvg.length > 0 ? '0%' : 'N/A (няма логове/план)'; // Ако има логове, но totalPlanned = 0, значи 0%
        }
        
        let recentChatSummary = "Няма скорошен чат или чат историята е празна.";
        if (chatHistory.length > 0) {
            recentChatSummary = chatHistory.slice(-RECENT_CHAT_MESSAGES_FOR_PRINCIPLES)
                                .map(e => `${e.role==='user'?'ПОТРЕБИТЕЛ':'АСИСТЕНТ'}: ${(e.parts?.[0]?.text||'').substring(0,150)}...`) // Съкращаваме малко за промпта
                                .join('\n---\n');
        }

        const userConcernsSummary = createUserConcernsSummary(logStringsForWeightCheck, chatHistory);

        const replacements = {
            '%%USER_ID%%': userId,
            '%%ORIGINAL_GOAL%%': originalGoal,
            '%%INITIAL_PRINCIPLES%%': typeof initialPrinciples === 'string' ? initialPrinciples : JSON.stringify(initialPrinciples),
            '%%INITIAL_CALORIES_MACROS%%': initCalMac,
            '%%CURRENT_WEIGHT%%': currentWeightStr,
            '%%WEIGHT_CHANGE_LAST_WEEK%%': weightChangeLastWeek,
            '%%AVERAGE_MOOD_LAST_WEEK%%': `${avgMood}/5`,
            '%%AVERAGE_ENERGY_LAST_WEEK%%': `${avgEnergy}/5`,
            '%%AVERAGE_CALMNESS_LAST_WEEK%%': `${avgCalmness}/5`,
            '%%AVERAGE_SLEEP_QUALITY_LAST_WEEK%%': `${avgSleep}/5`,
            '%%MEAL_ADHERENCE_PERCENT_LAST_WEEK%%': mealAdherencePercent,
            '%%RECENT_CHAT_SUMMARY%%': recentChatSummary,
            '%%USER_SPECIFIC_CONCERNS_FROM_LOGS_OR_CHAT%%': userConcernsSummary
        };

        const populatedPrompt = populatePrompt(principleAdjustmentPromptTpl, replacements);
        const modelForAdjustment = await env.RESOURCES_KV.get('model_principle_adjustment') || planModelName; // Specific model or fallback
        
        // Calling AI model for principle adjustment
        const updatedPrinciplesTextRaw = await callModelRef.current(modelForAdjustment, populatedPrompt, env, { temperature: 0.55, maxTokens: 1500 });
        const updatedPrinciplesText = cleanGeminiJson(updatedPrinciplesTextRaw); // Добавено почистване

        // Опитваме се да парснем отговора, ако очакваме JSON структура с принципи и резюме
        let principlesToSave = updatedPrinciplesText.trim(); // По подразбиране, ако не е JSON
        let summaryForUser = null; // За евентуално показване на потребителя

        try {
            const parsedResponse = JSON.parse(updatedPrinciplesText); // Може да хвърли грешка, ако не е JSON
            if (parsedResponse.updatedPrinciples && typeof parsedResponse.updatedPrinciples === 'string') {
                principlesToSave = parsedResponse.updatedPrinciples.trim();
            }
            if (parsedResponse.summaryForUser && typeof parsedResponse.summaryForUser === 'string') {
                summaryForUser = {
                     title: parsedResponse.titleForUser || "Актуализация на Вашите Принципи",
                     introduction: parsedResponse.introductionForUser || "Въз основа на последните Ви данни, Вашите хранителни принципи бяха прегледани:",
                     changes: [parsedResponse.summaryForUser],
                     encouragement: parsedResponse.encouragementForUser || "Продължавайте да следвате насоките!"
                };
            } else if (typeof parsedResponse.updatedPrinciples === 'object' && Array.isArray(parsedResponse.updatedPrinciples)) {
                // Ако AI върне масив от принципи, ги съединяваме
                principlesToSave = parsedResponse.updatedPrinciples.map(p => `- ${p}`).join('\n');
            }
        } catch {
            // Не е JSON, използваме `updatedPrinciplesText` директно.
            // Response from AI was not JSON, using raw text for principles
        }


        if (principlesToSave && principlesToSave.length > 10) {
            await env.USER_METADATA_KV.put(`${userId}_last_significant_update_ts`, Date.now().toString());

            if (!summaryForUser) {
                summaryForUser = createFallbackPrincipleSummary(principlesToSave);
            }

            if (!calledFromQuizAnalysis) {
                await env.USER_METADATA_KV.put(`${userId}_ai_update_pending_ack`, JSON.stringify(summaryForUser));
                // AI update summary stored
            }
            return principlesToSave;
        } else {
            console.warn(`PRINCIPLE_ADJUST_WARN (${userId}): AI model returned empty or very short response for principles. Skipping save. Raw response: ${updatedPrinciplesTextRaw.substring(0,200)}`);
            return null;
        }
    } catch (error) {
        console.error(`PRINCIPLE_ADJUST_ERROR (${userId}): Error during principle adjustment: ${error.message}\n${error.stack}`);
        return null;
    }
}
// ------------- END FUNCTION: handlePrincipleAdjustment -------------



// ------------- START BLOCK: HelperFunctionsHeaderComment -------------
// ===============================================
// ПОМОЩНИ ФУНКЦИИ (ПЪЛНИ ВЕРСИИ)
// ===============================================
// ------------- END BLOCK: HelperFunctionsHeaderComment -------------

// ------------- START FUNCTION: safeGet -------------
const safeGet = (obj, path, defaultValue = null) => { try { const keys = Array.isArray(path) ? path : String(path).replace(/\[(\d+)\]/g, '.$1').split('.'); let result = obj; for (const key of keys) { if (result === undefined || result === null) return defaultValue; const currentKey = key.trim(); if(currentKey === '') continue; if (typeof result !== 'object' || !(Object.prototype.hasOwnProperty.call(result, currentKey) || (Array.isArray(result) && Number.isInteger(parseInt(currentKey, 10)) && parseInt(currentKey, 10) < result.length && parseInt(currentKey, 10) >= 0 ))) {  if(Number.isInteger(parseInt(currentKey, 10)) && !Array.isArray(result)){ return defaultValue; } if(!Number.isInteger(parseInt(currentKey, 10)) && typeof result === 'object' && !result.hasOwnProperty(currentKey)){ return defaultValue; } if(Array.isArray(result) && !(parseInt(currentKey, 10) < result.length && parseInt(currentKey, 10) >= 0)) return defaultValue; } result = result[currentKey]; } return result === undefined || result === null ? defaultValue : result; } catch (e) { console.warn(`safeGet encountered an error for path "${Array.isArray(path) ? path.join('.') : path}": ${e.message}`); return defaultValue; } };
// ------------- END FUNCTION: safeGet -------------

// ------------- START FUNCTION: safeParseFloat -------------
const safeParseFloat = (val, defaultVal = null) => { if (val === null || val === undefined || String(val).trim() === '') return defaultVal; const num = parseFloat(String(val).replace(',', '.')); return isNaN(num) ? defaultVal : num; };
// ------------- END FUNCTION: safeParseFloat -------------

// ------------- START BLOCK: ChatContextHelpers -------------
const CHAT_CONTEXT_MENU_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getChatContextKey(userId) {
    return `${userId}_chat_context`;
}

/**
 * Строи резюме за менюто по дни на база генерирания план.
 * @param {Record<string, Array<{meal_name?: string}> | undefined> | null} [week1Menu]
 * @returns {Record<string, string>}
 */
function buildMenuSummaryByDay(week1Menu = {}) {
    /** @type {Record<string, string>} */
    const summary = {};
    if (week1Menu && typeof week1Menu === 'object') {
        for (const [day, meals] of Object.entries(week1Menu)) {
            if (!day) continue;
            const normalizedDay = String(day).toLowerCase();
            if (!Array.isArray(meals)) {
                summary[normalizedDay] = 'няма планирани за днес';
                continue;
            }
            const names = meals.map(m => (m && typeof m === 'object' ? m.meal_name || '?' : '?')).join(', ');
            summary[normalizedDay] = names || 'няма планирани за днес';
        }
    }
    return summary;
}

function sanitizeLogEntryForContext(date, rawRecord) {
    if (!date) return null;
    const base = rawRecord && typeof rawRecord === 'object' ? rawRecord : {};
    const log = base.log || base.data || base;
    if (!log || typeof log !== 'object' || Object.keys(log).length === 0) {
        return null;
    }
    return { date, log };
}

function computeLogMetrics(entries, todayStr = getLocalDate()) {
    const validEntries = Array.isArray(entries)
        ? entries.map(e => sanitizeLogEntryForContext(e?.date, e?.log ? { log: e.log } : e)).filter(Boolean)
        : [];
    if (validEntries.length === 0) {
        return {
            entries: [],
            summaryText: 'Няма скорошни логове.',
            averages: { mood: 'N/A', energy: 'N/A', calmness: 'N/A', sleep: 'N/A' },
            adherenceText: 'N/A',
            todaysCompletedMealsKeys: 'Няма данни за днес',
            updatedAt: new Date().toISOString()
        };
    }

    const sortedEntries = [...validEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
    const lines = [];
    let moodSum = 0; let moodCount = 0;
    let energySum = 0; let energyCount = 0;
    let calmSum = 0; let calmCount = 0;
    let sleepSum = 0; let sleepCount = 0;
    let adherenceCount = 0;
    let todaysCompletedMealsKeys = 'Няма данни за днес';

    for (const entry of sortedEntries) {
        const data = entry.log || {};
        const formattedDate = new Date(entry.date).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' });
        const mood = safeParseFloat(data.mood, null);
        const energy = safeParseFloat(data.energy, null);
        const calmness = safeParseFloat(data.calmness, null);
        const sleep = safeParseFloat(data.sleep, null);
        const completedStatus = data.completedMealsStatus && typeof data.completedMealsStatus === 'object'
            ? Object.values(data.completedMealsStatus).filter(v => v === true).length
            : 0;
        adherenceCount += completedStatus;

        if (mood !== null && mood >= 1 && mood <= 5) { moodSum += mood; moodCount++; }
        if (energy !== null && energy >= 1 && energy <= 5) { energySum += energy; energyCount++; }
        if (calmness !== null && calmness >= 1 && calmness <= 5) { calmSum += calmness; calmCount++; }
        if (sleep !== null && sleep >= 1 && sleep <= 5) { sleepSum += sleep; sleepCount++; }

        const summaryParts = [];
        if (mood !== null) summaryParts.push(`Настр:${data.mood}/5`);
        if (energy !== null) summaryParts.push(`Енерг:${data.energy}/5`);
        if (sleep !== null) summaryParts.push(`Сън:${data.sleep}/5`);
        if (completedStatus > 0) summaryParts.push(`${completedStatus} изп. хран.`);
        if (data.note) {
            const trimmed = String(data.note).slice(0, 20);
            summaryParts.push(`Бел:"${trimmed}..."`);
        }

        lines.push(`${formattedDate}: ${summaryParts.filter(Boolean).join('; ')}`.trim());

        if (entry.date === todayStr) {
            const statusObj = data.completedMealsStatus && typeof data.completedMealsStatus === 'object'
                ? data.completedMealsStatus
                : null;
            todaysCompletedMealsKeys = statusObj
                ? JSON.stringify(Object.keys(statusObj).filter(k => statusObj[k] === true))
                : 'Няма данни за днес';
        }
    }

    const avg = (sum, count) => (count > 0 ? `${(sum / count).toFixed(1)}/5` : 'N/A');
    return {
        entries: sortedEntries,
        summaryText: lines.join('\n') || 'Няма скорошни логове.',
        averages: {
            mood: avg(moodSum, moodCount),
            energy: avg(energySum, energyCount),
            calmness: avg(calmSum, calmCount),
            sleep: avg(sleepSum, sleepCount)
        },
        adherenceText: sortedEntries.length > 0 ? `${adherenceCount} изп. хран. за последните ${sortedEntries.length} дни` : 'N/A',
        todaysCompletedMealsKeys,
        updatedAt: new Date().toISOString()
    };
}

async function fetchRecentLogEntries(userId, env, limit = 3) {
    const entries = [];
    if (!env?.USER_METADATA_KV || typeof env.USER_METADATA_KV.get !== 'function') {
        return entries;
    }
    for (let i = 0; i < limit; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = getLocalDate(date);
        try {
            const logStr = await env.USER_METADATA_KV.get(`${userId}_log_${dateKey}`);
            if (!logStr) continue;
            const parsed = safeParseJson(logStr, {});
            const sanitized = sanitizeLogEntryForContext(dateKey, parsed);
            if (sanitized) entries.push(sanitized);
        } catch (err) {
            console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно зареждане на лог за ${dateKey} - ${err.message}`);
        }
    }
    return entries;
}

/**
 * Форматира психологическия профил за включване в AI промпт
 * @param {Object} psychProfile - Обект съдържащ резултати от психологическите тестове
 * @param {Object} [psychProfile.visualTest] - Резултати от визуалния тест
 * @param {string} [psychProfile.visualTest.profileName] - Име на профила (нов формат)
 * @param {string} [psychProfile.visualTest.name] - Име на профила (legacy формат)
 * @param {string} [psychProfile.visualTest.profileShort] - Кратко описание (нов формат)
 * @param {string} [psychProfile.visualTest.short] - Кратко описание (legacy формат)
 * @param {Array<string>} [psychProfile.visualTest.mainPsycho] - Ключови психологически характеристики (нов формат)
 * @param {Array<string>} [psychProfile.visualTest.psycho] - Ключови психологически характеристики (legacy формат)
 * @param {Array<string>} [psychProfile.visualTest.mainHabits] - Ключови хранителни навици (нов формат)
 * @param {Array<string>} [psychProfile.visualTest.habits] - Ключови хранителни навици (legacy формат)
 * @param {Array<string>} [psychProfile.visualTest.mainRisks] - Ключови потенциални рискове (нов формат)
 * @param {Array<string>} [psychProfile.visualTest.risks] - Ключови потенциални рискове (legacy формат)
 * @param {Object} [psychProfile.personalityTest] - Резултати от личностния тест
 * @param {string} [psychProfile.personalityTest.typeCode] - Код на типа личност
 * @param {Object} [psychProfile.personalityTest.scores] - Резултати от теста
 * @param {Array<string>} [psychProfile.personalityTest.riskFlags] - Рискови флагове
 * @param {Array<string>} [psychProfile.personalityTest.strengths] - Силни страни
 * @param {Array<string>} [psychProfile.personalityTest.mainRisks] - Основни рискове
 * @param {Array<string>} [psychProfile.personalityTest.topRecommendations] - Топ препоръки
 * @param {Object} [psychProfile.personalityTest.psyadvice] - Данни от psyadvice.txt профила
 * @param {string} [psychProfile.personalityTest.psyadvice.description] - Описание на профила
 * @param {string} [psychProfile.personalityTest.psyadvice.traits] - Ключови характеристики
 * @param {Array<string>} [psychProfile.personalityTest.psyadvice.eatingRisks] - Рискове при хранене
 * @param {Array<string>} [psychProfile.personalityTest.psyadvice.directions] - Насоки за хранене
 * @param {Array<string>} [psychProfile.personalityTest.psyadvice.communication] - Комуникационен стил
 * @returns {string} Форматиран текст за включване в промпт
 */
function formatPsychProfileForPrompt(psychProfile) {
    if (!psychProfile || typeof psychProfile !== 'object') {
        return NO_PSYCH_PROFILE_MESSAGE;
    }
    
    let text = '';
    let hasData = false;
    
    // Visual test data
    if (psychProfile.visualTest) {
        const vt = psychProfile.visualTest;
        const name = vt.profileName || vt.name || 'N/A';
        const short = vt.profileShort || vt.short || '';
        
        text += `\n=== ВИЗУАЛЕН ТЕСТ ===\n`;
        text += `Профил: ${name}\n`;
        hasData = true;
        
        if (short) {
            text += `Описание: ${short}\n`;
        }
        
        // Поддръжка за legacy формат (psycho, habits, risks) и нов формат (mainPsycho, mainHabits, mainRisks)
        const psychoArr = vt.mainPsycho || vt.psycho;
        if (psychoArr && Array.isArray(psychoArr) && psychoArr.length > 0) {
            text += '\nПсихологически характеристики:\n';
            psychoArr.forEach(p => text += `• ${p}\n`);
        }
        
        const habitsArr = vt.mainHabits || vt.habits;
        if (habitsArr && Array.isArray(habitsArr) && habitsArr.length > 0) {
            text += '\nХранителни навици:\n';
            habitsArr.forEach(h => text += `• ${h}\n`);
        }
        
        const risksArr = vt.mainRisks || vt.risks;
        if (risksArr && Array.isArray(risksArr) && risksArr.length > 0) {
            text += '\nПотенциални рискове:\n';
            risksArr.forEach(r => text += `• ${r}\n`);
        }
    }
    
    // Personality test data
    if (psychProfile.personalityTest) {
        const pt = psychProfile.personalityTest;
        text += `\n=== ЛИЧНОСТЕН ТЕСТ ===\n`;
        text += `Тип: ${pt.typeCode || 'N/A'}\n`;
        hasData = true;
        
        if (pt.scores && typeof pt.scores === 'object') {
            text += '\nРезултати (скала 0-100):\n';
            Object.entries(pt.scores).forEach(([key, value]) => {
                text += `• ${key}: ${typeof value === 'number' ? value.toFixed(1) : value}\n`;
            });
        }
        
        if (pt.strengths && Array.isArray(pt.strengths) && pt.strengths.length > 0) {
            text += '\nСилни страни:\n';
            pt.strengths.forEach(strength => text += `• ${strength}\n`);
        }
        
        if (pt.mainRisks && Array.isArray(pt.mainRisks) && pt.mainRisks.length > 0) {
            text += '\nОсновни рискови области:\n';
            pt.mainRisks.forEach(risk => text += `• ${risk}\n`);
        }
        
        if (pt.riskFlags && Array.isArray(pt.riskFlags) && pt.riskFlags.length > 0) {
            text += '\nВажни флагове:\n';
            pt.riskFlags.forEach(flag => text += `• ${flag}\n`);
        }
        
        if (pt.topRecommendations && Array.isArray(pt.topRecommendations) && pt.topRecommendations.length > 0) {
            text += '\nКлючови препоръки:\n';
            pt.topRecommendations.forEach(rec => text += `• ${rec}\n`);
        }
        
        // НОВО: Добавяне на psyadvice данни за AI асистента
        if (pt.psyadvice) {
            const psy = pt.psyadvice;
            text += '\n--- ПРОФИЛ ОТ PSYADVICE ---\n';
            
            if (psy.description) {
                text += `Профил: ${psy.description}\n`;
            }
            if (psy.traits) {
                text += `Характеристики: ${psy.traits}\n`;
            }
            
            if (psy.eatingRisks && Array.isArray(psy.eatingRisks) && psy.eatingRisks.length > 0) {
                text += '\nХранене – рискове:\n';
                psy.eatingRisks.forEach(risk => text += `• ${risk}\n`);
            }
            
            if (psy.directions && Array.isArray(psy.directions) && psy.directions.length > 0) {
                text += '\nНасоки за хранене:\n';
                psy.directions.forEach(dir => text += `• ${dir}\n`);
            }
            
            // ВАЖНО: Комуникационен стил за AI асистента
            if (psy.communication && Array.isArray(psy.communication) && psy.communication.length > 0) {
                text += '\n** КОМУНИКАЦИОНЕН СТИЛ (следвай тези насоки при отговорите си):\n';
                psy.communication.forEach(comm => text += `• ${comm}\n`);
            }
        }
    }
    
    if (!hasData) {
        return NO_PSYCH_PROFILE_MESSAGE;
    }
    
    return '=== ПСИХОЛОГИЧЕСКИ ПРОФИЛ ===\n' + text;
}

function createPromptDataFromContext(context) {
    if (!context) {
        return null;
    }
    const todayKey = CHAT_CONTEXT_MENU_KEYS[new Date().getDay()];
    const menuSummary = safeGet(context, ['plan', 'menuSummaryByDay'], {});
    const psychProfile = safeGet(context, ['user', 'psychProfile'], null);
    let psychProfileText = NO_PSYCH_PROFILE_MESSAGE;
    if (psychProfile) {
        psychProfileText = formatPsychProfileForPrompt(psychProfile);
    }
    return {
        userName: safeGet(context, ['user', 'name'], 'Потребител'),
        userGoal: safeGet(context, ['user', 'goal'], 'N/A'),
        userConditions: safeGet(context, ['user', 'conditions'], 'Няма специфични'),
        userPreferences: safeGet(context, ['user', 'preferences'], 'N/A'),
        psychProfile: psychProfileText,
        initCalMac: safeGet(context, ['plan', 'macrosString'], 'N/A'),
        planSum: safeGet(context, ['plan', 'summary'], 'Персонализиран хранителен подход'),
        allowedF: safeGet(context, ['plan', 'allowedFoodsSummary'], ''),
        forbiddenF: safeGet(context, ['plan', 'forbiddenFoodsSummary'], ''),
        hydrTarget: safeGet(context, ['plan', 'hydrationTarget'], 'N/A'),
        cookMethods: safeGet(context, ['plan', 'cookingMethodsSummary'], 'N/A'),
        suppSuggest: safeGet(context, ['plan', 'supplementSuggestionsSummary'], 'няма препоръки'),
        currentPrinciples: safeGet(context, ['plan', 'principlesText'], 'Общи принципи.'),
        todayMeals: menuSummary?.[todayKey] || 'няма планирани за днес',
        currW: safeGet(context, ['metrics', 'currentWeightFormatted'], 'N/A'),
        recentLogsSummary: safeGet(context, ['logs', 'summaryText'], 'Няма скорошни логове.'),
        avgMood: safeGet(context, ['logs', 'averages', 'mood'], 'N/A'),
        avgEnergy: safeGet(context, ['logs', 'averages', 'energy'], 'N/A'),
        avgCalmness: safeGet(context, ['logs', 'averages', 'calmness'], 'N/A'),
        avgSleep: safeGet(context, ['logs', 'averages', 'sleep'], 'N/A'),
        adherence: safeGet(context, ['logs', 'adherenceText'], 'N/A'),
        todaysCompletedMealsKeys: safeGet(context, ['logs', 'todaysCompletedMealsKeys'], 'Няма данни за днес')
    };
}

function buildPromptDataFromRaw(initialAnswers, finalPlan, currentStatus, logEntries) {
    const userName = safeGet(initialAnswers, 'name', 'Потребител');
    const userGoal = safeGet(initialAnswers, 'goal', 'N/A');
    const conditionsList = safeGet(initialAnswers, 'medicalConditions', []);
    const userConditions = Array.isArray(conditionsList)
        ? conditionsList.filter(c => c && c.toLowerCase() !== 'нямам').join(', ') || 'Няма специфични'
        : 'Няма специфични';
    const dislikes = safeGet(initialAnswers, 'dietDislike', '') || safeGet(initialAnswers, 'foodPreferenceDisliked', '') || 'Няма';
    const dietPrefArr = safeGet(initialAnswers, 'dietPreference', []);
    const dietPrefStr = Array.isArray(dietPrefArr) && dietPrefArr.length > 0 ? dietPrefArr.join(', ') : 'N/A';
    const userPreferences = `${dietPrefStr}. Не харесва: ${dislikes}`;
    const calMac = safeGet(finalPlan, 'caloriesMacros', null);
    const initCalMac = calMac
        ? `Кал: ${calMac.calories || '?'} P:${calMac.protein_grams || '?'}g C:${calMac.carbs_grams || '?'}g F:${calMac.fat_grams || '?'}g Fb:${calMac.fiber_grams || '?'}g`
        : 'N/A';
    const planSum = safeGet(finalPlan, 'profileSummary', 'Персонализиран хранителен подход');
    const allowedFoods = safeGet(finalPlan, 'allowedForbiddenFoods.main_allowed_foods', []);
    const allowedF = Array.isArray(allowedFoods)
        ? allowedFoods.slice(0, 7).join(', ') + (allowedFoods.length > 7 ? '...' : '')
        : '';
    const forbiddenFoods = safeGet(finalPlan, 'allowedForbiddenFoods.main_forbidden_foods', []);
    const forbiddenF = Array.isArray(forbiddenFoods)
        ? forbiddenFoods.slice(0, 5).join(', ') + (forbiddenFoods.length > 5 ? '...' : '')
        : '';
    const hydrTarget = safeGet(finalPlan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', 'N/A');
    const cookMethodsArr = safeGet(finalPlan, 'hydrationCookingSupplements.cooking_methods.recommended', []);
    const cookMethods = Array.isArray(cookMethodsArr) && cookMethodsArr.length > 0 ? cookMethodsArr.join(', ') : 'N/A';
    const supplements = safeGet(finalPlan, 'hydrationCookingSupplements.supplement_suggestions', []);
    const suppSuggest = Array.isArray(supplements) && supplements.length > 0
        ? supplements.map(s => s?.supplement_name).filter(Boolean).join(', ') || 'няма препоръки'
        : 'няма препоръки';
    const principles = safeGet(finalPlan, 'principlesWeek2_4', 'Общи принципи.');
    const principlesText = Array.isArray(principles) ? principles.join('\n') : principles || 'Общи принципи.';
    const menuSummary = buildMenuSummaryByDay(safeGet(finalPlan, 'week1Menu', {}));
    const todayKey = CHAT_CONTEXT_MENU_KEYS[new Date().getDay()];
    const todayMeals = menuSummary?.[todayKey] || 'няма планирани за днес';
    const currWeight = safeParseFloat(safeGet(currentStatus, 'weight', null), null);
    const currW = currWeight !== null ? `${currWeight.toFixed(1)} кг` : 'N/A';
    const logMetrics = computeLogMetrics(logEntries, getLocalDate());
    
    // Extract psychProfile from finalPlan if available
    const psychProfileData = safeGet(finalPlan, 'psychoTestsProfile', null);
    const psychProfileText = psychProfileData ? formatPsychProfileForPrompt(psychProfileData) : NO_PSYCH_PROFILE_MESSAGE;
    
    // v2.0: Extract adapted guidance for AI context
    const adaptedGuidanceData = safeGet(finalPlan, 'adaptedGuidance', null);
    const adaptedGuidanceText = adaptedGuidanceData ? formatAdaptedGuidanceForPrompt(adaptedGuidanceData) : '';

    return {
        userName,
        userGoal,
        userConditions,
        userPreferences,
        psychProfile: psychProfileText,
        adaptedGuidance: adaptedGuidanceText,  // v2.0: Add adapted guidance to context
        initCalMac,
        planSum,
        allowedF,
        forbiddenF,
        hydrTarget,
        cookMethods,
        suppSuggest,
        currentPrinciples: principlesText,
        todayMeals,
        currW,
        recentLogsSummary: logMetrics.summaryText,
        avgMood: logMetrics.averages.mood,
        avgEnergy: logMetrics.averages.energy,
        avgCalmness: logMetrics.averages.calmness,
        avgSleep: logMetrics.averages.sleep,
        adherence: logMetrics.adherenceText,
        todaysCompletedMealsKeys: logMetrics.todaysCompletedMealsKeys,
        logEntries: logMetrics.entries,
        menuSummary,
        logMetrics
    };
}

function isChatContextFresh(context) {
    if (!context || context.version !== CHAT_CONTEXT_VERSION) {
        return false;
    }
    const ttl = typeof context.ttlMs === 'number' ? context.ttlMs : CHAT_CONTEXT_TTL_MS;
    const updatedAt = Date.parse(context.updatedAt || '');
    if (!updatedAt || Number.isNaN(updatedAt)) {
        return false;
    }
    return Date.now() - updatedAt < ttl;
}

/**
 * @typedef {Object} ChatContextSource
 * @property {Record<string, any>} [initialAnswers]
 * @property {Record<string, any>} [finalPlan]
 * @property {Record<string, any>} [currentStatus]
 * @property {Array<{date: string, log?: Record<string, any>, data?: Record<string, any>}>} [logEntries]
 * @property {string} [planStatus]
 */

/**
 * @typedef {Object} ChatContextLogEntry
 * @property {string} date
 * @property {Record<string, any>} log
 */

/**
 * @typedef {Object} ChatContextLogMetrics
 * @property {ChatContextLogEntry[]} entries
 * @property {string} summaryText
 * @property {{mood: string, energy: string, calmness: string, sleep: string}} averages
 * @property {string} adherenceText
 * @property {string} todaysCompletedMealsKeys
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ChatContextPayload
 * @property {number} version
 * @property {number} ttlMs
 * @property {string} updatedAt
 * @property {string} planStatus
 * @property {string} planTimestamp
 * @property {{name: string, goal: string, conditions: string, preferences: string, psychProfile: Object|null}} user
 * @property {{
 *   summary: string,
 *   macrosString: string,
 *   allowedFoodsSummary: string,
 *   forbiddenFoodsSummary: string,
 *   hydrationTarget: string|number,
 *   cookingMethodsSummary: string,
 *   supplementSuggestionsSummary: string,
 *   principlesText: string,
 *   menuSummaryByDay: Record<string, string>
 * }} plan
 * @property {{currentWeightFormatted: string}} metrics
 * @property {ChatContextLogMetrics} logs
 */

/**
 * Сглобява контекста за чат бота на база съхранените в KV данни и опционален предварителен източник.
 * @param {string} userId
 * @param {Record<string, any>} env
 * @param {ChatContextSource} [source={}]
 * @returns {Promise<ChatContextPayload|null>}
 */
async function assembleChatContext(
    userId,
    env,
    {
        initialAnswers = undefined,
        finalPlan = undefined,
        currentStatus = undefined,
        logEntries = undefined,
        planStatus = undefined
    } = {}
) {
    const answers = initialAnswers || safeParseJson(await env.USER_METADATA_KV.get(`${userId}_initial_answers`), {});
    const plan = finalPlan || safeParseJson(await env.USER_METADATA_KV.get(`${userId}_final_plan`), {});
    if (!answers || Object.keys(answers).length === 0 || !plan || Object.keys(plan).length === 0) {
        return null;
    }
    const status = currentStatus || safeParseJson(await env.USER_METADATA_KV.get(`${userId}_current_status`), {});
    let logs = Array.isArray(logEntries) ? logEntries : await fetchRecentLogEntries(userId, env, 3);
    logs = logs.map(entry => sanitizeLogEntryForContext(entry?.date, entry?.log ? { log: entry.log } : entry)).filter(Boolean);
    const logMetrics = computeLogMetrics(logs, getLocalDate());
    const menuSummary = buildMenuSummaryByDay(safeGet(plan, 'week1Menu', {}));
    const calMac = safeGet(plan, 'caloriesMacros', null);
    const initCalMac = calMac
        ? `Кал: ${calMac.calories || '?'} P:${calMac.protein_grams || '?'}g C:${calMac.carbs_grams || '?'}g F:${calMac.fat_grams || '?'}g Fb:${calMac.fiber_grams || '?'}g`
        : 'N/A';
    const allowedFoods = safeGet(plan, 'allowedForbiddenFoods.main_allowed_foods', []);
    const allowedF = Array.isArray(allowedFoods)
        ? allowedFoods.slice(0, 7).join(', ') + (allowedFoods.length > 7 ? '...' : '')
        : '';
    const forbiddenFoods = safeGet(plan, 'allowedForbiddenFoods.main_forbidden_foods', []);
    const forbiddenF = Array.isArray(forbiddenFoods)
        ? forbiddenFoods.slice(0, 5).join(', ') + (forbiddenFoods.length > 5 ? '...' : '')
        : '';
    const cookMethodsArr = safeGet(plan, 'hydrationCookingSupplements.cooking_methods.recommended', []);
    const cookMethods = Array.isArray(cookMethodsArr) && cookMethodsArr.length > 0 ? cookMethodsArr.join(', ') : 'N/A';
    const supplements = safeGet(plan, 'hydrationCookingSupplements.supplement_suggestions', []);
    const suppSuggest = Array.isArray(supplements) && supplements.length > 0
        ? supplements.map(s => s?.supplement_name).filter(Boolean).join(', ') || 'няма препоръки'
        : 'няма препоръки';
    const principles = safeGet(plan, 'principlesWeek2_4', 'Общи принципи.');
    const principlesText = Array.isArray(principles) ? principles.join('\n') : principles || 'Общи принципи.';
    const conditionsList = safeGet(answers, 'medicalConditions', []);
    const userConditions = Array.isArray(conditionsList)
        ? conditionsList.filter(c => c && c.toLowerCase() !== 'нямам').join(', ') || 'Няма специфични'
        : 'Няма специфични';
    const dislikes = safeGet(answers, 'dietDislike', '') || safeGet(answers, 'foodPreferenceDisliked', '') || 'Няма';
    const dietPrefArr = safeGet(answers, 'dietPreference', []);
    const dietPrefStr = Array.isArray(dietPrefArr) && dietPrefArr.length > 0 ? dietPrefArr.join(', ') : 'N/A';
    const userPreferences = `${dietPrefStr}. Не харесва: ${dislikes}`;
    const currWeight = safeParseFloat(safeGet(status, 'weight', null), null);
    const currW = currWeight !== null ? `${currWeight.toFixed(1)} кг` : 'N/A';

    // Extract psychProfile from plan if available (already stored in final_plan)
    const psychProfileSummary = safeGet(plan, 'psychoTestsProfile', null);

    return {
        version: CHAT_CONTEXT_VERSION,
        ttlMs: CHAT_CONTEXT_TTL_MS,
        updatedAt: new Date().toISOString(),
        planStatus: planStatus || 'ready',
        planTimestamp: safeGet(plan, 'generationMetadata.timestamp', new Date().toISOString()),
        user: {
            name: safeGet(answers, 'name', 'Потребител'),
            goal: safeGet(answers, 'goal', 'N/A'),
            conditions: userConditions,
            preferences: userPreferences,
            psychProfile: psychProfileSummary
        },
        plan: {
            summary: safeGet(plan, 'profileSummary', 'Персонализиран хранителен подход'),
            macrosString: initCalMac,
            allowedFoodsSummary: allowedF,
            forbiddenFoodsSummary: forbiddenF,
            hydrationTarget: safeGet(plan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', 'N/A'),
            cookingMethodsSummary: cookMethods,
            supplementSuggestionsSummary: suppSuggest,
            principlesText,
            menuSummaryByDay: menuSummary
        },
        metrics: {
            currentWeightFormatted: currW
        },
        logs: {
            ...logMetrics,
            entries: logMetrics.entries
        }
    };
}

async function persistChatContext(userId, env, context) {
    if (!context) {
        return;
    }
    try {
        await env.USER_METADATA_KV.put(getChatContextKey(userId), JSON.stringify(context));
    } catch (err) {
        console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно записване на контекст - ${err.message}`);
    }
}

/**
 * Обновява вече записания чат контекст след подаване на нов дневен лог.
 * Синхронизира се със sanitizeLogEntryForContext, като допуска записи с `log` или `data` поле.
 * @param {string} userId
 * @param {Record<string, any>} env
 * @param {string} dateStr
 * @param {{log?: Record<string, any>, data?: Record<string, any>}|Record<string, any>|null} [record=null]
 * @param {{weight?: number|string|null}} [options={}]
 * @returns {Promise<void>}
 */
async function refreshChatContextAfterLog(userId, env, dateStr, record = null, { weight = undefined } = {}) {
    if (!env?.USER_METADATA_KV || typeof env.USER_METADATA_KV.get !== 'function') {
        return;
    }
    try {
        const contextStr = await env.USER_METADATA_KV.get(getChatContextKey(userId));
        if (!contextStr) {
            return;
        }
        const context = safeParseJson(contextStr, null);
        if (!context || context.version !== CHAT_CONTEXT_VERSION) {
            return;
        }
        const sanitized = record ? sanitizeLogEntryForContext(dateStr, record) : null;
        const entries = Array.isArray(context.logs?.entries) ? context.logs.entries.slice(0, 3) : [];
        const updatedMap = new Map(entries.map(e => [e.date, e]));
        if (sanitized) {
            updatedMap.set(dateStr, sanitized);
        } else {
            updatedMap.delete(dateStr);
        }
        const mergedEntries = Array.from(updatedMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
        const metrics = computeLogMetrics(mergedEntries, getLocalDate());
        context.logs = { ...metrics, entries: metrics.entries };
        context.updatedAt = new Date().toISOString();
        if (weight !== undefined && weight !== null && String(weight).trim() !== '') {
            const parsedWeight = safeParseFloat(weight, null);
            if (parsedWeight !== null) {
                context.metrics = context.metrics || {};
                context.metrics.currentWeightFormatted = `${parsedWeight.toFixed(1)} кг`;
            }
        }
        await env.USER_METADATA_KV.put(getChatContextKey(userId), JSON.stringify(context));
    } catch (err) {
        console.warn(`CHAT_CONTEXT_WARN (${userId}): неуспешно обновяване след лог - ${err.message}`);
    }
}
// ------------- END BLOCK: ChatContextHelpers -------------

// ------------- START FUNCTION: recordUsage -------------
async function recordUsage(env, type, identifier = '') {
    try {
        if (env.USER_METADATA_KV && typeof env.USER_METADATA_KV.put === 'function') {
            const key = `usage_${type}_${Date.now()}`;
            const entry = { ts: new Date().toISOString(), id: identifier };
            await env.USER_METADATA_KV.put(key, JSON.stringify(entry));
        }
    } catch (err) {
        console.error('Failed to record usage:', err.message);
    }
}
// ------------- END FUNCTION: recordUsage -------------

// ------------- START FUNCTION: checkRateLimit -------------
async function checkRateLimit(env, type, identifier, limit = 3, windowMs = 60000) {
    if (!env.USER_METADATA_KV || typeof env.USER_METADATA_KV.get !== 'function' || typeof env.USER_METADATA_KV.put !== 'function') {
        return false;
    }
    const key = `rl_${type}_${identifier}`;
    try {
        const now = Date.now();
        const existing = await env.USER_METADATA_KV.get(key);
        if (existing) {
            const data = JSON.parse(existing);
            if (now - data.ts < windowMs) {
                if (data.count >= limit) return true;
                data.count++;
                await env.USER_METADATA_KV.put(key, JSON.stringify(data), {
                    expirationTtl: Math.ceil((windowMs - (now - data.ts)) / 1000)
                });
                return false;
            }
        }
        await env.USER_METADATA_KV.put(
            key,
            JSON.stringify({ ts: now, count: 1 }),
            { expirationTtl: Math.ceil(windowMs / 1000) }
        );
    } catch (err) {
        console.error('Failed to enforce rate limit:', err.message);
    }
    return false;
}
// ------------- END FUNCTION: checkRateLimit -------------

// ------------- START FUNCTION: safeParseJson -------------
const safeParseJson = (jsonString, defaultValue = null) => {
    if (typeof jsonString !== 'string' || !jsonString.trim()) {
        return defaultValue;
    }
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn(`Failed JSON parse: ${e.message}. String (start): "${jsonString.substring(0, 150)}..."`);
        return defaultValue;
    }
};
// ------------- END FUNCTION: safeParseJson -------------

const LOG_INDEX_VERSION = 1;
const LOG_INDEX_STALE_MS = 12 * 60 * 60 * 1000;

function parseLogIndexRecord(rawValue) {
    const fallback = { dates: [], ts: 0, version: 0, extra: {} };
    if (!rawValue) {
        return fallback;
    }

    const parsed = safeParseJson(rawValue, null);
    if (Array.isArray(parsed)) {
        return { dates: parsed.filter(Boolean), ts: 0, version: 0, extra: {} };
    }

    if (parsed && typeof parsed === 'object') {
        const { dates, ts, version, ...extra } = parsed;
        const normalizedDates = Array.isArray(dates) ? dates.filter(Boolean) : [];
        let numericTs = 0;
        if (typeof ts === 'number' && Number.isFinite(ts)) {
            numericTs = ts;
        } else if (typeof ts === 'string') {
            numericTs = Number.parseInt(ts, 10) || 0;
        }

        let numericVersion = 0;
        if (typeof version === 'number' && Number.isFinite(version)) {
            numericVersion = version;
        } else if (typeof version === 'string') {
            numericVersion = Number.parseInt(version, 10) || 0;
        }

        return { dates: normalizedDates, ts: numericTs, version: numericVersion, extra };
    }

    return fallback;
}

function createLogIndexRecord(dates, parsedIndex = {}, now = Date.now()) {
    const extra = parsedIndex.extra ? { ...parsedIndex.extra } : {};
    const seen = new Set();
    const normalizedDates = [];
    const source = Array.isArray(dates) ? dates : [];
    for (const date of source) {
        if (date && !seen.has(date)) {
            seen.add(date);
            normalizedDates.push(date);
        }
    }

    normalizedDates.sort();

    return {
        ...extra,
        dates: normalizedDates,
        ts: now,
        version: LOG_INDEX_VERSION
    };
}

// ------------- START FUNCTION: getUserLogDates -------------
async function getUserLogDates(env, userId) {
    const indexKey = `${userId}_logs_index`;
    const now = Date.now();
    let parsedIndex = { dates: [], ts: 0, version: 0, extra: {} };

    try {
        const idxStr = await env.USER_METADATA_KV.get(indexKey);
        if (idxStr) {
            parsedIndex = parseLogIndexRecord(idxStr);
        }
    } catch {
        parsedIndex = { dates: [], ts: 0, version: 0, extra: {} };
    }

    const isStale = !parsedIndex.ts || now - parsedIndex.ts > LOG_INDEX_STALE_MS;
    if (!isStale) {
        return parsedIndex.dates;
    }

    let dates = parsedIndex.dates;
    try {
        const list = await env.USER_METADATA_KV.list({ prefix: `${userId}_log_` });
        dates = list.keys
            .map(k => k.name.split('_log_')[1])
            .filter(Boolean);
    } catch {
        return parsedIndex.dates;
    }

    const updatedRecord = createLogIndexRecord(dates, parsedIndex, now);
    try {
        await env.USER_METADATA_KV.put(indexKey, JSON.stringify(updatedRecord));
    } catch (err) {
        console.warn(`LOG_INDEX_WARN (${userId}): Failed to persist rebuilt index - ${err.message}`);
    }

    try {
        const fallbackKey = 'log_index_fallbacks';
        const fallbackStr = await env.USER_METADATA_KV.get(fallbackKey);
        const fallbackCount = fallbackStr ? parseInt(fallbackStr, 10) || 0 : 0;
        await env.USER_METADATA_KV.put(fallbackKey, String(fallbackCount + 1));
    } catch {
        /* noop */
    }

    return updatedRecord.dates;
}
// ------------- END FUNCTION: getUserLogDates -------------

// ------------- START FUNCTION: updatePlanUserArrays -------------
async function updatePlanUserArrays(userId, status, env) {
    const pendingKey = 'pending_plan_users';
    const readyKey = 'ready_plan_users';
    const [pendingStr, readyStr] = await Promise.all([
        env.USER_METADATA_KV.get(pendingKey),
        env.USER_METADATA_KV.get(readyKey)
    ]);
    let pending = safeParseJson(pendingStr, []);
    let ready = safeParseJson(readyStr, []);
    if (!Array.isArray(pending)) pending = [];
    if (!Array.isArray(ready)) ready = [];
    const remove = arr => {
        const idx = arr.indexOf(userId);
        if (idx !== -1) arr.splice(idx, 1);
    };
    if (status === 'pending') {
        if (!pending.includes(userId)) pending.push(userId);
        remove(ready);
    } else if (status === 'ready') {
        if (!ready.includes(userId)) ready.push(userId);
        remove(pending);
    } else {
        remove(pending);
        remove(ready);
    }
    await Promise.all([
        env.USER_METADATA_KV.put(pendingKey, JSON.stringify(pending)),
        env.USER_METADATA_KV.put(readyKey, JSON.stringify(ready))
    ]);
}
// ------------- END FUNCTION: updatePlanUserArrays -------------

// ------------- START FUNCTION: setPlanStatus -------------
async function setPlanStatus(userId, status, env) {
    await env.USER_METADATA_KV.put(`plan_status_${userId}`, status, { metadata: { status } });
    await updatePlanUserArrays(userId, status, env);
}
// ------------- END FUNCTION: setPlanStatus -------------


// ------------- START FUNCTION: createFallbackPrincipleSummary -------------
function createFallbackPrincipleSummary(principlesText) {
    const changeLines = principlesText
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    return {
        title: 'Актуализация на Вашите Принципи',
        introduction: 'Въз основа на последните Ви данни прегледахме хранителните насоки.',
        changes: changeLines.length > 0 ? changeLines : [principlesText.substring(0, 200)],
        encouragement: 'Следвайте актуализираните насоки за по-добри резултати.'
    };
}
// ------------- END FUNCTION: createFallbackPrincipleSummary -------------

// ------------- START FUNCTION: createPlanUpdateSummary -------------
function createPlanUpdateSummary(newPlan, oldPlan = {}) {
    const changes = [];
    const newCal = safeGet(newPlan, 'caloriesMacros.calories');
    const oldCal = safeGet(oldPlan, 'caloriesMacros.calories');
    if (newCal) {
        if (!oldCal || newCal !== oldCal) {
            changes.push(`Дневен калориен прием: около ${newCal} kcal`);
        }
    }

    const principlesText = safeGet(newPlan, 'principlesWeek2_4', '');
    const principleLines = typeof principlesText === 'string'
        ? principlesText.split('\n')
        : Array.isArray(principlesText) ? principlesText : [];
    principleLines.forEach(l => {
        let combined = '';
        if (l && typeof l === 'object') {
            const title = l.title ? String(l.title).trim() : '';
            const content = l.content ? String(l.content).trim() : '';
            combined = `${title} ${content}`.replace(/\s+/g, ' ').trim();
        } else {
            combined = String(l);
        }
        const t = combined.replace(/^[-*]\s*/, '').trim();
        if (t) changes.push(t);
    });

    // --- New logic: compare week1Menu between plans ---
    const newMenu = safeGet(newPlan, 'week1Menu', {});
    const oldMenu = safeGet(oldPlan, 'week1Menu', {});
    if (newMenu && typeof newMenu === 'object') {
        const dayMap = { monday: 'Понеделник', tuesday: 'Вторник', wednesday: 'Сряда', thursday: 'Четвъртък', friday: 'Петък', saturday: 'Събота', sunday: 'Неделя' };
        const cap = s => (s && typeof s === 'string') ? s.charAt(0).toUpperCase() + s.slice(1) : '';
        const diffs = [];
        for (const [dayKey, meals] of Object.entries(newMenu)) {
            const newMeals = Array.isArray(meals) ? meals : [];
            const oldMeals = Array.isArray(oldMenu?.[dayKey]) ? oldMenu[dayKey] : [];
            const changedMeals = [];
            newMeals.forEach((m, idx) => {
                const oldM = oldMeals[idx] || {};
                const newNames = Array.isArray(m?.items) ? m.items.map(it => it.name).join(', ') : '';
                const oldNames = Array.isArray(oldM?.items) ? oldM.items.map(it => it.name).join(', ') : '';
                if (!oldM.meal_name || m.meal_name !== oldM.meal_name || newNames !== oldNames) {
                    if (m.meal_name) changedMeals.push(m.meal_name);
                }
            });
            if (changedMeals.length > 0) {
                diffs.push(`${dayMap[dayKey] || cap(dayKey)}: ${changedMeals.join(', ')}`);
            }
        }
        if (diffs.length > 0) changes.push(...diffs.slice(0, 5));
    }

    if (changes.length === 0) {
        changes.push('Няма съществени промени – планът е обновен без значителни разлики.');
    }

    const MAX_CHANGES = 5;
    const totalLength = changes.reduce((sum, ch) => sum + ch.length, 0);
    const finalChanges = totalLength <= 120 ? changes : changes.slice(0, MAX_CHANGES);

    return {
        title: 'Обновен персонализиран план',
        introduction: 'Вашият план беше генериран отново. Ето няколко основни акцента:',
        changes: finalChanges,
        encouragement: 'Разгледайте плана и следвайте препоръките!'
    };
}
// ------------- END FUNCTION: createPlanUpdateSummary -------------

// ------------- START FUNCTION: createUserConcernsSummary -------------
function createUserConcernsSummary(logStrings = [], chatHistory = []) {
    const notes = [];
    const extras = [];
    for (let i = 0; i < logStrings.length; i++) {
        const logStr = logStrings[i];
        if (!logStr) continue;
        const log = safeParseJson(logStr, {});
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dStr = date.toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' });
        if (log.note && notes.length < 3) {
            const snippet = String(log.note).trim();
            if (snippet) notes.push(`${dStr}: \"${snippet.substring(0, 30)}${snippet.length > 30 ? '...' : ''}\"`);
        }
        if (Array.isArray(log.extraMeals) && log.extraMeals.length > 0 && extras.length < 3) {
            extras.push(`${dStr}: ${log.extraMeals.length}`);
        }
    }

    const chatSnippets = [];
    if (Array.isArray(chatHistory)) {
        chatHistory
            .filter(m => m && m.role === 'user' && m.parts && m.parts[0] && m.parts[0].text)
            .slice(-RECENT_CHAT_MESSAGES_FOR_PRINCIPLES)
            .forEach(m => {
                const txt = m.parts[0].text.trim();
                if (txt && chatSnippets.length < 3) {
                    chatSnippets.push(`\"${txt.substring(0, 30)}${txt.length > 30 ? '...' : ''}\"`);
                }
            });
    }

    const parts = [];
    if (notes.length) parts.push(`Бележки: ${notes.join('; ')}`);
    if (extras.length) parts.push(`Извънредни хранения: ${extras.join('; ')}`);
    if (chatSnippets.length) parts.push(`Проблеми от чата: ${chatSnippets.join('; ')}`);

    return parts.length > 0
        ? parts.join('\n')
        : 'Няма специални бележки или извънредни хранения в последните дни.';
}
// ------------- END FUNCTION: createUserConcernsSummary -------------

// ------------- START FUNCTION: evaluatePlanChange -------------
async function evaluatePlanChange(userId, requestData, env) {
    try {
        const initialStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
        const initial = safeParseJson(initialStr, {});
        if (!initial || Object.keys(initial).length === 0) {
            return { deviationPercent: null, explanation: 'Липсват първоначални данни.' };
        }

        const logs = [];
        for (let i = 0; i < USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const logStr = await env.USER_METADATA_KV.get(`${userId}_log_${d.toISOString().split('T')[0]}`);
            if (logStr) logs.push(safeParseJson(logStr, {}));
        }

        let currentWeight = null;
        for (const log of logs) {
            if (log && log.weight !== undefined) {
                const w = safeParseFloat(log.weight);
                if (w !== null) { currentWeight = w; break; }
            }
        }
        if (currentWeight === null) {
            const statusStr = await env.USER_METADATA_KV.get(`${userId}_current_status`);
            const status = safeParseJson(statusStr, {});
            currentWeight = safeParseFloat(status.weight, null);
        }

        const initialWeight = safeParseFloat(initial.weight);
        let targetWeight = null;
        if (initial.goal === 'отслабване') {
            const lossKg = safeParseFloat(initial.lossKg);
            if (lossKg !== null) targetWeight = initialWeight - lossKg;
        } else if (initial.goal === 'покачване на мускулна маса') {
            const gainKg = safeParseFloat(initial.gainKg);
            if (gainKg !== null) targetWeight = initialWeight + gainKg;
        } else {
            targetWeight = safeParseFloat(initial.maintenanceWeight, initialWeight);
        }

        if (currentWeight === null || targetWeight === null) {
            return { deviationPercent: null, explanation: 'Недостатъчни данни за изчисляване на отклонението.' };
        }

        const deviationPercent = Math.round(Math.abs((currentWeight - targetWeight) / targetWeight * 100));
        const explanation = `Текущо тегло ${currentWeight.toFixed(1)} кг спрямо цел ${targetWeight.toFixed(1)} кг. Отклонение ${deviationPercent}%`;

        return { deviationPercent, explanation };
    } catch (e) {
        console.error(`EVAL_PLAN_CHANGE_ERROR (${userId}):`, e.message);
        return { deviationPercent: null, explanation: 'Грешка при изчисление на отклонението.' };
    }
}
// ------------- END FUNCTION: evaluatePlanChange -------------

// ------------- START FUNCTION: createUserEvent -------------
async function createUserEvent(eventType, userId, payload, env) {
    if (!eventType || !userId) return { success: false, message: 'Невалидни параметри.' };

    if (eventType === 'planMod') {
        try {
            const pendingFlag = await env.USER_METADATA_KV.get(`pending_plan_mod_${userId}`);
            if (pendingFlag) {
                return { success: false, message: 'Вече има чакаща заявка за промяна на плана.' };
            }
        } catch (err) {
            console.error(`EVENT_PENDING_FLAG_CHECK_ERROR (${userId}):`, err);
        }

        try {
            const existing = await env.USER_METADATA_KV.list({ prefix: `event_planMod_${userId}` });
            for (const { name } of existing.keys) {
                const val = await env.USER_METADATA_KV.get(name);
                const parsed = safeParseJson(val, null);
                if (parsed && parsed.status === 'pending') {
                    return { success: false, message: 'Вече има чакаща заявка за промяна на плана.' };
                }
            }
        } catch (err) {
            console.error(`EVENT_CHECK_ERROR (${userId}):`, err);
        }
    }

    const key = `event_${eventType}_${userId}_${Date.now()}`;
    const data = {
        type: eventType,
        userId,
        status: 'pending',
        createdTimestamp: Date.now(),
        payload
    };
    await env.USER_METADATA_KV.put(key, JSON.stringify(data));
    if (eventType === 'planMod') {
        try {
            await env.USER_METADATA_KV.put(`pending_plan_mod_${userId}`, JSON.stringify(payload || {}));
            await setPlanStatus(userId, 'pending', env);
        } catch (err) {
            console.error(`EVENT_SAVE_PENDING_MOD_ERROR (${userId}):`, err);
        }
    }
    return { success: true };
}
// ------------- END FUNCTION: createUserEvent -------------

// ------------- START FUNCTION: cleanGeminiJson -------------
function cleanGeminiJson(rawJsonString) {
    if (typeof rawJsonString !== 'string') return '{}';
    let cleaned = rawJsonString.trim();

    // Remove markdown code block fences (```json ... ``` or ``` ... ```)
    const fenceStartTriple = cleaned.indexOf('```json');
    if (fenceStartTriple !== -1) {
        cleaned = cleaned.substring(fenceStartTriple + 7); // Length of "```json\n" or "```json "
        const fenceEndTriple = cleaned.lastIndexOf('```');
        if (fenceEndTriple !== -1) {
            cleaned = cleaned.substring(0, fenceEndTriple).trim();
        }
    } else {
        const fenceStartGeneric = cleaned.indexOf('```');
        if (fenceStartGeneric !== -1) {
            cleaned = cleaned.substring(fenceStartGeneric + 3);
            const fenceEndGeneric = cleaned.lastIndexOf('```');
            if (fenceEndGeneric !== -1) {
                cleaned = cleaned.substring(0, fenceEndGeneric).trim();
            }
        }
    }
    
    // Attempt to find the first '{' or '[' and the last '}' or ']'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");

    let start = -1, end = -1;
    let isObject = false, isArray = false;

    if (firstBrace !== -1 && lastBrace > firstBrace) { // Potential object
        isObject = true;
        start = firstBrace;
        end = lastBrace;
    }
    if (firstBracket !== -1 && lastBracket > firstBracket) { // Potential array
        if (!isObject || firstBracket < firstBrace) { // If array starts before object or no object
            isArray = true;
            isObject = false; // Prefer array if it's the outermost structure
            start = firstBracket;
            end = lastBracket;
        } else if (isObject && firstBracket > firstBrace && lastBracket < lastBrace) {
            // This case (array inside an object) is fine, object boundaries are already set
        }
    }

    if (start !== -1 && end !== -1) {
        cleaned = cleaned.substring(start, end + 1);
        // Final check if the extracted substring is valid JSON
        try {
            JSON.parse(cleaned);
            return cleaned; // It's valid
        } catch {
            // console.warn(`cleanGeminiJson: Extracted string is NOT valid JSON after slicing. Error: ${e.message}. Original (cleaned): ${cleaned.substring(0,200)}...`);
            // Fallback to empty object/array depending on what it looked like
            return isObject ? '{}' : (isArray ? '[]' : '{}');
        }
    } else {
        // console.warn(`cleanGeminiJson: Could not find valid JSON structure ({...} or [...]). Raw (start): ${rawJsonString.substring(0,200)}...`);
        return '{}'; // Default to empty object if nothing sensible found
    }
}
// ------------- END FUNCTION: cleanGeminiJson -------------

// ------------- START BLOCK: PasswordHashing -------------
const PBKDF2_ITERATIONS_CONST = 100000;
const PBKDF2_HASH_ALGORITHM_CONST = 'SHA-256';
const SALT_LENGTH_CONST = 16; // bytes
const DERIVED_KEY_LENGTH_CONST = 32; // bytes

async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_CONST));
    const passwordBuffer = new TextEncoder().encode(password);
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedKeyBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS_CONST,
            hash: PBKDF2_HASH_ALGORITHM_CONST
        },
        keyMaterial,
        DERIVED_KEY_LENGTH_CONST * 8
    );
    const hashBuffer = new Uint8Array(derivedKeyBuffer);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedSaltAndHash) {
    try {
        const parts = storedSaltAndHash.split(':');
        if (parts.length !== 2) {
            console.warn("VERIFY_PASSWORD_WARN: Stored hash format is invalid (not 2 parts).");
            return false;
        }
        const [saltHex, storedHashHex] = parts;
        if (!saltHex || !storedHashHex || saltHex.length !== SALT_LENGTH_CONST * 2 || storedHashHex.length !== DERIVED_KEY_LENGTH_CONST * 2) {
            console.warn("VERIFY_PASSWORD_WARN: Salt or hash hex length mismatch with constants.");
            return false;
        }
        // Convert hex salt back to Uint8Array
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const passwordBuffer = new TextEncoder().encode(password);
        const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);
        const derivedKeyBuffer = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS_CONST, hash: PBKDF2_HASH_ALGORITHM_CONST },
            keyMaterial,
            DERIVED_KEY_LENGTH_CONST * 8
        );
        const inputHashBuffer = new Uint8Array(derivedKeyBuffer);
        const inputHashHex = Array.from(inputHashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
        return inputHashHex === storedHashHex;
    } catch (error) {
        console.error(`Error verifying password: ${error.message}\n${error.stack}`);
        return false;
    }
}
// ------------- END BLOCK: PasswordHashing -------------

// ------------- START FUNCTION: callGeminiAPI -------------
async function callGeminiAPI(prompt, apiKey, generationConfig = {}, safetySettings = [], model, options = {}) {
    const { signal } = options;
    if (!model) {
        console.error("GEMINI_API_CALL_ERROR: Model name is missing!");
        throw new Error("Gemini model name is missing.");
    }
    const apiUrl = `${GEMINI_API_URL_BASE}${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
        ...(safetySettings.length > 0 && { safetySettings })
    };

    const delays = [500, 1000, 2000];
    let lastErr;
    for (let attempt = 0; attempt < delays.length; attempt++) {
        try {
            if (signal?.aborted) {
                const abortError = signal.reason instanceof Error
                    ? signal.reason
                    : new Error('Aborted');
                if (!abortError.name) {
                    abortError.name = 'AbortError';
                }
                throw abortError;
            }
            const fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            };
            if (signal !== undefined) {
                fetchOptions.signal = signal;
            }
            const response = await fetch(apiUrl, fetchOptions);
            const data = await parseJsonSafe(response);

            const errDet = data?.error;
            const msg = errDet?.message || `HTTP Error ${response.status}`;
            const stat = errDet?.status || `HTTP_${response.status}`;
            const overloaded = !response.ok &&
                (response.status === 429 || response.status === 503 || /overload/i.test(msg) || stat === 429 || stat === 503);

            if (!response.ok) {
                if (overloaded && attempt < delays.length - 1) {
                    await new Promise(r => setTimeout(r, delays[attempt]));
                    continue;
                }
                console.error(`Gemini API Error (${model} - Status ${stat}): ${msg}`, JSON.stringify(errDet || data, null, 2));
                throw new Error(`Gemini API Error (${model} - ${stat}): ${msg}`);
            }

            const cand = data?.candidates?.[0];
            if (!cand) {
                const blockR = data?.promptFeedback?.blockReason;
                if (blockR) {
                    console.error(`Gemini API prompt blocked for model ${model}. Reason: ${blockR}\n${JSON.stringify(data.promptFeedback, null, 2)}`);
                    throw new Error(`AI assistant blocked prompt (Model: ${model}, Reason: ${blockR}).`);
                } else {
                    console.error(`Gemini API Error for model ${model}: No candidates in response. Full response:\n${JSON.stringify(data, null, 2)}`);
                    throw new Error(`Gemini API Error (Model: ${model}): No candidates found in response.`);
                }
            }

            if (cand.finishReason === 'SAFETY') {
                const safetyInfo = cand.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'N/A';
                console.error(`Gemini API content blocked by safety settings for model ${model}. Ratings: [${safetyInfo}]\n${JSON.stringify(cand, null, 2)}`);
                throw new Error(`AI response blocked by safety settings (Model: ${model}, Ratings: ${safetyInfo}).`);
            }

            const txtContent = cand?.content?.parts?.[0]?.text;
            if (txtContent !== undefined && txtContent !== null) {
                return txtContent;
            } else if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') { // MAX_TOKENS is a valid finish reason that might not have text if the model just filled tokens.
                console.warn(`Gemini API call for model ${model} finished with reason: ${cand.finishReason}, but no text content found.`);
                return ""; // Return empty string if finished for other reasons without text
            } else if (cand.finishReason === 'MAX_TOKENS' && (txtContent === undefined || txtContent === null)) {
                console.warn(`Gemini API call for model ${model} finished due to MAX_TOKENS and no text content was produced or it was empty.`);
                return "";
            }
            console.error(`Gemini API Error for model ${model}: Text content missing from successful candidate. FinishReason: '${cand.finishReason || 'N/A'}'. Full candidate:\n${JSON.stringify(cand, null, 2)}`);
            throw new Error(`Gemini API Error (Model: ${model}): Unexpected response structure or missing text content from candidate.`);
        } catch (error) {
            const overloaded = /overload/i.test(error.message);
            if (overloaded && attempt < delays.length - 1) {
                lastErr = error;
                await new Promise(r => setTimeout(r, delays[attempt]));
                continue;
            }
            if (!error.message.includes(`Model: ${model}`)) {
                error.message = `[Gemini Call Error - Model: ${model}] ${error.message}`;
            }
            console.error(`Error during Gemini API call (${model}): ${error.message}\n${error.stack ? error.stack.substring(0, 500) : "No stack"}`);
            throw error;
        }
    }
    if (lastErr) throw lastErr;
}
// ------------- END FUNCTION: callGeminiAPI -------------

// ------------- START FUNCTION: callGeminiVisionAPI -------------
async function callGeminiVisionAPI(
    imageData,
    mimeType,
    apiKey,
    prompt = 'Опиши съдържанието на това изображение.',
    generationConfig = {},
    model,
    options = {}
) {
    const { signal } = options;
    if (!model) {
        console.error('GEMINI_VISION_CALL_ERROR: Model name is missing!');
        throw new Error('Gemini model name is missing.');
    }
    const apiUrl = `${GEMINI_API_URL_BASE}${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{
            parts: [
                { inlineData: { mimeType, data: imageData } },
                { text: prompt || 'Опиши съдържанието на това изображение.' }
            ]
        }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig })
    };

    const delays = [500, 1000, 2000];
    let lastErr;
    for (let attempt = 0; attempt < delays.length; attempt++) {
        try {
            if (signal?.aborted) {
                const abortError = signal.reason instanceof Error
                    ? signal.reason
                    : new Error('Aborted');
                if (!abortError.name) {
                    abortError.name = 'AbortError';
                }
                throw abortError;
            }
            const fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            };
            if (signal !== undefined) {
                fetchOptions.signal = signal;
            }
            const response = await fetch(apiUrl, fetchOptions);
            const data = await parseJsonSafe(response);

            const errDet = data?.error;
            const msg = errDet?.message || `HTTP Error ${response.status}`;
            const stat = errDet?.status || `HTTP_${response.status}`;
            const overloaded = !response.ok &&
                (response.status === 429 || response.status === 503 || /overload/i.test(msg) || stat === 429 || stat === 503);

            if (!response.ok) {
                if (overloaded && attempt < delays.length - 1) {
                    await new Promise(r => setTimeout(r, delays[attempt]));
                    continue;
                }
                console.error(`Gemini API Error (${model} - Status ${stat}): ${msg}`, JSON.stringify(errDet || data, null, 2));
                throw new Error(`Gemini API Error (${model} - ${stat}): ${msg}`);
            }

            const cand = data?.candidates?.[0];
            const txtContent = cand?.content?.parts?.[0]?.text;
            if (txtContent !== undefined && txtContent !== null) {
                return txtContent;
            }
            console.error(`Gemini vision response missing text for model ${model}.\n${JSON.stringify(data, null, 2)}`);
            throw new Error(`Gemini API Error (Model: ${model}): Missing text response.`);
        } catch (error) {
            const overloaded = /overload/i.test(error.message);
            if (overloaded && attempt < delays.length - 1) {
                lastErr = error;
                await new Promise(r => setTimeout(r, delays[attempt]));
                continue;
            }
            if (!error.message.includes(`Model: ${model}`)) {
                error.message = `[Gemini Vision Call Error - Model: ${model}] ${error.message}`;
            }
            console.error(`Error during Gemini vision API call (${model}): ${error.message}\n${error.stack ? error.stack.substring(0, 500) : 'No stack'}`);
            throw error;
        }
    }
    if (lastErr) throw lastErr;
}
// ------------- END FUNCTION: callGeminiVisionAPI -------------

// ------------- START FUNCTION: callOpenAiAPI -------------
async function callOpenAiAPI(prompt, apiKey, model, options = {}) {
    if (!model) {
        throw new Error('OpenAI model name is missing.');
    }
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.max_tokens !== undefined && { max_tokens: options.max_tokens })
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: options.signal
    });
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.error?.message || `HTTP ${resp.status}`;
        throw new Error(`OpenAI API Error (${model}): ${msg}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    if (text === undefined || text === null) {
        throw new Error(`OpenAI API Error (${model}): No content in response.`);
    }
    return text;
}
// ------------- END FUNCTION: callOpenAiAPI -------------

// ------------- START FUNCTION: callCohereAI -------------
async function callCohereAI(model, prompt, apiKey, options = {}) {
    if (!model) {
        throw new Error('Cohere model name is missing.');
    }
    const url = 'https://api.cohere.ai/v1/chat';
    const body = {
        model,
        message: prompt,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens })
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: options.signal
    });
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.message || data?.error || `HTTP ${resp.status}`;
        throw new Error(`Cohere API Error (${model}): ${msg}`);
    }
    const text = data?.text;
    if (text === undefined || text === null) {
        throw new Error(`Cohere API Error (${model}): No text in response.`);
    }
    return text;
}
// ------------- END FUNCTION: callCohereAI -------------

function getModelProvider(model) {
    if (!model) return 'gemini';
    if (model === 'command-r-plus') return 'cohere';
    if (model.startsWith('@cf/')) return 'cf';
    if (model.startsWith('gpt-')) return 'openai';
    return 'gemini';
}

async function callModel(model, prompt, env, options = {}) {
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 800;
    const provider = getModelProvider(model);
    if (provider === 'cf') {
        return callCfAi(
            model,
            {
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                temperature,
                max_tokens: maxTokens
            },
            env,
            options
        );
    }
    if (provider === 'cohere') {
        const key = env[COMMAND_R_PLUS_SECRET_NAME];
        if (!key) throw new Error('Missing command-r-plus API key.');
        return callCohereAI(model, prompt, key, { ...options, temperature, maxTokens });
    }
    if (provider === 'openai') {
        const key = env[OPENAI_API_KEY_SECRET_NAME];
        if (!key) throw new Error('Missing OpenAI API key.');
        return callOpenAiAPI(prompt, key, model, { ...options, temperature, max_tokens: maxTokens });
    }
    const key = env[GEMINI_API_KEY_SECRET_NAME];
    if (!key) throw new Error('Missing Gemini API key.');
    return callGeminiAPI(prompt, key, { temperature, maxOutputTokens: maxTokens }, [], model, options);
}

callModelRef.current = callModel;

function setCallModelImplementation(fn) {
    callModelRef.current = typeof fn === 'function' ? fn : callModel;
}

// ------------- START FUNCTION: buildCfImagePayload -------------
function buildCfImagePayload(model, imageUrl, promptText) {
    if (model.startsWith('@cf/')) {
        return { prompt: promptText, image: imageUrl };
    }
    return { image: imageUrl };
}
// ------------- END FUNCTION: buildCfImagePayload -------------

// ------------- START FUNCTION: callCfAi -------------
async function callCfAi(model, payload, env, options = {}) {
    const { signal } = options;
    if (signal?.aborted) {
        const abortError = signal.reason instanceof Error ? signal.reason : new Error('Aborted');
        if (!abortError.name) {
            abortError.name = 'AbortError';
        }
        throw abortError;
    }
    const accountId = env[CF_ACCOUNT_ID_VAR_NAME] || env.accountId || env.ACCOUNT_ID;
    const token = env[CF_AI_TOKEN_SECRET_NAME];
    if (!accountId || !token) {
        throw new Error('Missing Cloudflare AI credentials.');
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: options.signal
    };
    let resp;
    try {
        resp = await fetch(url, fetchOptions);
    } catch (error) {
        if (signal?.aborted) {
            const abortError = signal.reason instanceof Error ? signal.reason : error;
            if (!abortError.name) {
                abortError.name = 'AbortError';
            }
            throw abortError;
        }
        throw error;
    }
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.errors?.[0]?.message || `HTTP ${resp.status}`;
        throw new Error(`CF AI error: ${msg}`);
    }
    return data.result?.response || data;
}
// ------------- END FUNCTION: callCfAi -------------

// ------------- START FUNCTION: calculateAnalyticsIndexes -------------
function buildDeterministicAnalyticsSummary(analytics = {}, metrics = [], userGoal) {
    const numericMetrics = metrics
        .filter(metric => metric && typeof metric.currentValueNumeric === 'number' && !Number.isNaN(metric.currentValueNumeric))
        .map(metric => {
            const value = Number(metric.currentValueNumeric);
            let normalized = value;
            if (!Number.isFinite(normalized)) normalized = 0;
            if (metric.key === 'bmi_status') {
                const idealBmi = 22;
                const diff = Math.abs(value - idealBmi);
                normalized = Math.max(0, Math.min(100, 100 - diff * 10));
            } else if (value >= 0 && value <= 5) {
                normalized = (value / 5) * 100;
            } else {
                normalized = Math.max(0, Math.min(100, value));
            }
            return { ...metric, normalizedScore: normalized, rawValue: value };
        });

    if (numericMetrics.length === 0) {
        return '';
    }

    const sorted = [...numericMetrics].sort((a, b) => b.normalizedScore - a.normalizedScore);
    const successes = sorted.filter(metric => metric.normalizedScore >= 70).slice(0, 2);
    const risks = [...sorted].reverse().filter(metric => metric.normalizedScore <= 50).slice(0, 2);

    const goalText = userGoal && userGoal !== 'unknown' ? userGoal : 'основната Ви цел';
    const safeRound = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? Math.round(num) : 0;
    };
    const formatList = (items) => {
        if (items.length === 0) return '';
        if (items.length === 1) return items[0];
        if (items.length === 2) return `${items[0]} и ${items[1]}`;
        const head = items.slice(0, -1).join(', ');
        const tail = items[items.length - 1];
        return `${head} и ${tail}`;
    };
    const formatScoreValue = (metric) => {
        const { rawValue, key } = metric;
        if (!Number.isFinite(rawValue)) return 'N/A';
        if (key === 'bmi_status') {
            return `${rawValue.toFixed(1)}`;
        }
        if (rawValue >= 0 && rawValue <= 5) {
            return `${rawValue.toFixed(1)}/5`;
        }
        return `${Math.round(rawValue)}%`;
    };

    const sentences = [];
    sentences.push(`Целта Ви е ${goalText}. Общият напредък е ${safeRound(analytics.goalProgress)}%, а ангажираността е ${safeRound(analytics.engagementScore)}%.`);

    if (successes.length > 0) {
        const successText = formatList(successes.map(metric => `${metric.label} (${formatScoreValue(metric)})`));
        sentences.push(`Силни страни се открояват при ${successText}.`);
    }

    if (risks.length > 0) {
        const riskText = formatList(risks.map(metric => `${metric.label} (${formatScoreValue(metric)})`));
        sentences.push(`Необходимо е внимание към ${riskText}.`);
    }

    if (sentences.length < 2 && sorted[0]) {
        const best = sorted[0];
        sentences.push(`Най-стабилен показател е ${best.label} (${formatScoreValue(best)}).`);
    }

    if (sentences.length < 2 && sorted.length > 1) {
        const weakest = sorted[sorted.length - 1];
        if (weakest && weakest !== sorted[0]) {
            sentences.push(`Най-ниска стойност се наблюдава при ${weakest.label} (${formatScoreValue(weakest)}).`);
        }
    }

    return sentences.slice(0, 3).join(' ');
}

async function calculateAnalyticsIndexes(userId, initialAnswers, finalPlan, logEntries = [], currentStatus = {}, customPeriodDays = null) {
    // console.log(`ANALYTICS_CALC (${userId}): Starting calculation.`);

    const safePFloat = safeParseFloat;
    const safeGetL = safeGet; // Using the improved safeGet

    logEntries = Array.isArray(logEntries)
        ? logEntries.map(entry => ({
            date: entry.date,
            data: entry.data || entry.log || {},
            totals: entry.totals || null,
            extraMeals: entry.extraMeals || []
        }))
        : [];

    // Use custom period if provided, otherwise use the default constant
    const analyticsPeriodDays = customPeriodDays !== null ? customPeriodDays : USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS;

    const getAvgLog = (logKey, defaultValue, logs, lookbackDays) => {
        let sum = 0;
        let count = 0;
        const logsToConsider = logs.slice(0, lookbackDays); // Use only logs within the lookback period

        for (const entry of logsToConsider) {
            const valueStr = safeGetL(entry, ['data', logKey]);
            if (valueStr !== undefined && valueStr !== null && String(valueStr).trim() !== '') {
                const numValue = safePFloat(valueStr);
                // Assuming mood, energy etc. are 1-5 scales
                if (numValue !== null && !isNaN(numValue) && numValue >= 1 && numValue <= 5) {
                    sum += numValue;
                    count++;
                }
            }
        }
        return count > 0 ? (sum / count) : safePFloat(defaultValue, 3); // Default to 3 (neutral) if no data
    };

    const score1To5ToPercentage = (value, invert = false) => {
        const numValue = Number(value) || 0;
        // Scale 1-5 to 0-100: value * 20
        // 1→20, 2→40, 3→60, 4→80, 5→100
        const score = Math.max(0, Math.min(100, numValue * 20));
        const finalScore = invert ? 100 - score : score;
        return Math.round(finalScore);
    };

    const getBmiCategory = (bmiValue) => {
        if (bmiValue === null || isNaN(bmiValue)) return "N/A";
        if (bmiValue < 18.5) return "Поднормено тегло";
        if (bmiValue < 25) return "Нормално тегло";
        if (bmiValue < 30) return "Наднормено тегло";
        if (bmiValue < 35) return "Затлъстяване I степен";
        if (bmiValue < 40) return "Затлъстяване II степен";
        return "Затлъстяване III степен";
    };

    const calculateBmiScore = (weight, height) => {
        const W = safePFloat(weight);
        const H_cm = safePFloat(height);
        if (!W || W <= 0 || !H_cm || H_cm <= 0) return 0; // Invalid input for BMI

        const H_m = H_cm / 100;
        const bmi = W / (H_m * H_m);

        // Константи за BMI формулата
        const BMI_UNDERWEIGHT_MILD_RANGE = 1.5; // BMI диапазон 17-18.5

        // Подобрена формула с по-плавни прагове
        // Оптимална зона: 18.5 - 25
        if (bmi >= 18.5 && bmi < 25) {
            // Максимален резултат в здравословната зона
            return 100;
        }
        
        // Под оптималното тегло (BMI < 18.5)
        if (bmi < 18.5) {
            // Плавна крива: 17->85, 16->65, 15->40, <14->10
            if (bmi >= 17) return Math.round(85 + (bmi - 17) / BMI_UNDERWEIGHT_MILD_RANGE * 15); // 17-18.5 -> 85-100
            if (bmi >= 16) return Math.round(65 + (bmi - 16) * 20); // 16-17 -> 65-85
            if (bmi >= 15) return Math.round(40 + (bmi - 15) * 25); // 15-16 -> 40-65
            if (bmi >= 14) return Math.round(20 + (bmi - 14) * 20); // 14-15 -> 20-40
            return Math.max(5, Math.round(bmi / 14 * 20)); // <14 -> 5-20
        }

        // Над оптималното тегло (BMI >= 25)
        // Плавна крива за наднормено тегло и затлъстяване
        if (bmi < 27) return Math.round(100 - ((bmi - 25) / 2) * 20); // 25-27 -> 100-80
        if (bmi < 30) return Math.round(80 - ((bmi - 27) / 3) * 20); // 27-30 -> 80-60
        if (bmi < 35) return Math.round(60 - ((bmi - 30) / 5) * 20); // 30-35 -> 60-40
        if (bmi < 40) return Math.round(40 - ((bmi - 35) / 5) * 20); // 35-40 -> 40-20
        if (bmi < 45) return Math.round(20 - ((bmi - 40) / 5) * 15); // 40-45 -> 20-5
        return 5; // BMI >= 45 -> минимален резултат
    };
    
    const capScore = (score) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    const initialWeight = safePFloat(initialAnswers?.weight);
    const currentWeight = safePFloat(currentStatus?.weight, initialWeight); // Fallback to initial if current not set
    const heightCm = safePFloat(initialAnswers?.height);
    const userGoal = initialAnswers?.goal || 'unknown';

    const logsToConsider = logEntries.slice(0, analyticsPeriodDays);

    let goalProgress = 0;
    let overallHealthScore = 50; // Default
    let engagementScore = 0;
    let averageMealAdherence = 0;
    let logCompletionRate = 0;
    let indexCompletionRate = 0;

    let indexFieldsLogged = 0;
    let indexFieldsExpected = 0;
    const indexKeys = ['mood','energy','calmness','sleep','hydration'];

    let totalPlannedMealsInPeriod = 0;
    let totalCompletedMealsInPeriod = 0;
    let daysWithAnyLogEntry = 0;
    const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const todayDate = new Date();

    for (let i = 0; i < analyticsPeriodDays; i++) {
        const loopDateObj = new Date(todayDate);
        loopDateObj.setDate(todayDate.getDate() - i);
        const dateString = loopDateObj.toISOString().split('T')[0];
        const dayKey = daysOrder[loopDateObj.getDay()];
        
        const logEntryForDay = logsToConsider.find(l => l.date === dateString);
        let hasDataLoggedThisDay = false;
        let completedMealsThisDay = 0;
        let plannedMealsThisDay = 0;

        const mealsPlannedForThisDayKey = safeGetL(finalPlan, ['week1Menu', dayKey], []);
        if (Array.isArray(mealsPlannedForThisDayKey)) {
            plannedMealsThisDay = mealsPlannedForThisDayKey.length;
        }

        if (logEntryForDay && logEntryForDay.data) {
            // Check if any meaningful data was logged, not just an empty object or only lastUpdated
            if (Object.keys(logEntryForDay.data).some(k => k !== 'lastUpdated' && logEntryForDay.data[k] !== null && logEntryForDay.data[k] !== undefined && String(logEntryForDay.data[k]).trim() !== '' && !(k === 'completedMealsStatus' && Object.keys(logEntryForDay.data[k]).length === 0))) {
                hasDataLoggedThisDay = true;
                daysWithAnyLogEntry++;
            }

            const completedMealsStatusForDay = safeGetL(logEntryForDay.data, 'completedMealsStatus', {});
            if (plannedMealsThisDay > 0 && typeof completedMealsStatusForDay === 'object') {
                mealsPlannedForThisDayKey.forEach((_, mealIdx) => {
                    if (completedMealsStatusForDay[`${dayKey}_${mealIdx}`] === true) {
                        completedMealsThisDay++;
                    }
                });
            }

            if (hasDataLoggedThisDay) {
                indexFieldsExpected += indexKeys.length;
                indexKeys.forEach((key) => {
                    const val = logEntryForDay.data[key];
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        indexFieldsLogged++;
                    }
                });
            }
        }
        
        if (plannedMealsThisDay > 0) {
            totalPlannedMealsInPeriod += plannedMealsThisDay;
            totalCompletedMealsInPeriod += completedMealsThisDay;
        } else if (hasDataLoggedThisDay) { // If log exists but no meals planned (e.g. free day, or plan not covering all days)
            // Consider it 100% adherence for that day if any log activity
            totalPlannedMealsInPeriod++;
            totalCompletedMealsInPeriod++;
        }
    }

    averageMealAdherence = totalPlannedMealsInPeriod > 0 ? (totalCompletedMealsInPeriod / totalPlannedMealsInPeriod) * 100 : (daysWithAnyLogEntry > 0 ? 0 : 50); // if logs exist but no plan, 0%, else 50% default
    indexCompletionRate = indexFieldsExpected > 0 ? (indexFieldsLogged / indexFieldsExpected) * 100 : 0;
    logCompletionRate = (daysWithAnyLogEntry / analyticsPeriodDays) * 100;
    
    // Изчисляване на streak бонус (последователност на логване)
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    
    // Обхождаме от днес назад във времето
    for (let i = 0; i < analyticsPeriodDays; i++) {
        const loopDateObj = new Date(todayDate);
        loopDateObj.setDate(todayDate.getDate() - i);
        const dateString = loopDateObj.toISOString().split('T')[0];
        const logEntryForDay = logsToConsider.find(l => l.date === dateString);
        
        const hasLog = logEntryForDay && logEntryForDay.data && 
                       Object.keys(logEntryForDay.data).some(k => 
                           k !== 'lastUpdated' && 
                           logEntryForDay.data[k] !== null && 
                           logEntryForDay.data[k] !== undefined && 
                           String(logEntryForDay.data[k]).trim() !== ''
                       );
        
        if (hasLog) {
            tempStreak++;
            maxStreak = Math.max(maxStreak, tempStreak);
        } else {
            // Ако е прекъснат streak-а, запазваме текущия само ако е от днес
            if (tempStreak > 0 && currentStreak === 0) {
                currentStreak = tempStreak;
            }
            tempStreak = 0;
        }
    }
    
    // Ако streak-ът продължава до края на периода, той е текущият
    if (tempStreak > 0 && currentStreak === 0) {
        currentStreak = tempStreak;
    }
    
    // Streak бонус: до +10% за активен streak от 7+ дни
    const streakBonus = currentStreak >= 7 ? 10 : currentStreak >= 3 ? 5 : 0;
    
    // Качествен бонус: ако средният брой попълнени индекси е висок
    const avgIndexFieldsPerLog = daysWithAnyLogEntry > 0 ? indexFieldsLogged / daysWithAnyLogEntry : 0;
    const qualityBonus = avgIndexFieldsPerLog >= 4 ? 5 : avgIndexFieldsPerLog >= 3 ? 2 : 0;
    
    engagementScore = capScore(
        (averageMealAdherence * 0.4) + 
        (indexCompletionRate * 0.4) + 
        (logCompletionRate * 0.2) +
        streakBonus +
        qualityBonus
    );

    const avgMood = getAvgLog('mood', 3, logsToConsider, analyticsPeriodDays);
    const avgEnergy = getAvgLog('energy', 3, logsToConsider, analyticsPeriodDays);
    const avgCalmness = getAvgLog('calmness', 3, logsToConsider, analyticsPeriodDays); // Assuming calmness is 1-5, higher is better
    const avgSleep = getAvgLog('sleep', 3, logsToConsider, analyticsPeriodDays);
    const avgHydration = getAvgLog('hydration', 3, logsToConsider, analyticsPeriodDays); // Assuming hydration is 1-5

    const currentBmiScore = calculateBmiScore(currentWeight, heightCm);

    overallHealthScore = capScore(
        (score1To5ToPercentage(avgMood) * 0.15) +
        (score1To5ToPercentage(avgEnergy) * 0.15) +
        (score1To5ToPercentage(avgCalmness) * 0.10) + // Calmness (higher is better)
        (score1To5ToPercentage(avgSleep) * 0.15) +
        (score1To5ToPercentage(avgHydration) * 0.10) +
        (currentBmiScore * 0.20) +
        (engagementScore * 0.15)
    );
    
    if (userGoal === 'отслабване') {
        const targetLossKg = safePFloat(initialAnswers?.lossKg);
        if (initialWeight && currentWeight && targetLossKg && targetLossKg > 0) {
            const actualLoss = initialWeight - currentWeight;
            // Подобрена формула: нелинеен прогрес за по-реалистична оценка
            // Ранният прогрес се оценява по-високо (по-лесно е в началото)
            const EARLY_PROGRESS_MULTIPLIER = 120; // Първите 50% на загубата дават 60 точки (0.5 * 120 = 60)
            const LATE_PROGRESS_MULTIPLIER = 80;   // Последните 50% на загубата дават 40 точки (0.5 * 80 = 40)
            const rawProgress = (actualLoss / targetLossKg);
            if (rawProgress <= 0) {
                goalProgress = 0;
            } else if (rawProgress < 0.5) {
                // Първите 50% от целта - оценяват се като 60 точки
                goalProgress = rawProgress * EARLY_PROGRESS_MULTIPLIER; // 0-0.5 -> 0-60
            } else {
                // Последните 50% от целта - оценяват се като 40 точки
                goalProgress = 60 + ((rawProgress - 0.5) * LATE_PROGRESS_MULTIPLIER); // 0.5-1.0 -> 60-100
            }
            goalProgress = Math.max(0, Math.min(100, Math.round(goalProgress)));
        } else goalProgress = 0;
    } else if (userGoal === 'покачване на мускулна маса') {
        const targetGainKg = safePFloat(initialAnswers?.gainKg);
        if (initialWeight && currentWeight && targetGainKg && targetGainKg > 0) {
            const actualGain = currentWeight - initialWeight;
            // Подобрена формула: линеен прогрес за качване на маса (по-предвидимо)
            const rawProgress = (actualGain / targetGainKg);
            goalProgress = Math.max(0, Math.min(100, Math.round(rawProgress * 100)));
        } else goalProgress = overallHealthScore; // If target not set, progress reflects overall health
    } else if (userGoal === 'поддържане') {
        const targetMaintenanceWeight = safePFloat(initialAnswers?.maintenanceWeight, initialWeight);
        if (targetMaintenanceWeight && currentWeight) {
            // Подобрена формула с по-толерантни граници
            // Основна допустима отклонение: 3%
            const baseAllowedDeviationPercentage = 0.03;
            const baseAllowedDeviationKg = targetMaintenanceWeight * baseAllowedDeviationPercentage;
            
            // Допълнителна буферна зона: още 2% (общо 5% преди значителна загуба на точки)
            const bufferDeviationPercentage = 0.02;
            const bufferDeviationKg = targetMaintenanceWeight * bufferDeviationPercentage;
            
            const actualDeviationKg = Math.abs(currentWeight - targetMaintenanceWeight);
            
            if (actualDeviationKg <= baseAllowedDeviationKg) {
                // Перфектно поддържане - 100%
                goalProgress = 100;
            } else if (actualDeviationKg <= baseAllowedDeviationKg + bufferDeviationKg) {
                // В буферната зона (3-5%) - плавно намаление до 90%
                const excessDeviation = actualDeviationKg - baseAllowedDeviationKg;
                goalProgress = 100 - ((excessDeviation / bufferDeviationKg) * 10);
            } else {
                // Над буферната зона - по-бързо намаление
                const excessDeviation = actualDeviationKg - baseAllowedDeviationKg - bufferDeviationKg;
                goalProgress = Math.max(0, 90 - ((excessDeviation / baseAllowedDeviationKg) * 60));
            }
            goalProgress = capScore(goalProgress);
        } else goalProgress = 50; // Default if target not clear
    } else { // Other goals or unknown
        goalProgress = overallHealthScore; // Progress reflects overall health
    }

    const currentAnalytics = {
        goalProgress: Math.round(goalProgress),
        engagementScore: Math.round(engagementScore),
        overallHealthScore: Math.round(overallHealthScore)
    };

    const detailedAnalyticsMetrics = [];
    const scoreToText = (scoreValue, metricType = 'general') => {
        if (scoreValue === null || scoreValue === undefined || isNaN(scoreValue)) return "Няма данни";
        const numericScore = Number(scoreValue);
        if (metricType === 'sleep') {
            if (numericScore >= 4.5) return "Отлично"; if (numericScore >= 3.5) return "Добро";
            if (numericScore >= 2.5) return "Задоволително"; if (numericScore >= 1.5) return "Лошо"; return "Много лошо";
        }
        if (metricType === 'calmness') { // Higher score means more calm
            if (numericScore >= 4.5) return "Отлично";
            if (numericScore >= 3.5) return "Добро";
            if (numericScore >= 2.5) return "Средно";
            if (numericScore >= 1.5) return "Ниско";
            return "Критично";
        }
        // General 1-5 scale (mood, energy, hydration)
        if (numericScore >= 4.5) return "Отлично"; if (numericScore >= 3.5) return "Много добро";
        if (numericScore >= 2.5) return "Добро"; if (numericScore >= 1.5) return "Задоволително"; return "Нужда от подобрение";
    };

    const currentSleepNumeric = avgSleep !== "N/A" ? parseFloat(avgSleep) : null;
    detailedAnalyticsMetrics.push({
        key: "sleep_quality", label: "Качество на Съня",
        initialValueText: `${initialAnswers?.sleepHours||'?'} ч.` + (initialAnswers?.sleepInterrupt==='Да' ? ', с прекъсвания':''),
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.sleep_quality_target_text', "7-8 ч., непрекъснат"),
        currentValueNumeric: currentSleepNumeric,
        currentValueText: currentSleepNumeric !== null ? `${scoreToText(currentSleepNumeric, 'sleep')} (${currentSleepNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "sleep_quality_info",
        periodDays: analyticsPeriodDays
    });

    const currentCalmnessNumeric = avgCalmness !== "N/A" ? parseFloat(avgCalmness) : null;
    detailedAnalyticsMetrics.push({
        key: "stress_level", label: "Ниво на Спокойствие",
        initialValueText: initialAnswers?.stressLevel ? `${initialAnswers.stressLevel} ниво на спокойствие` : "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.stress_level_target_text', "Високо ниво на спокойствие"),
        currentValueNumeric: currentCalmnessNumeric,
        currentValueText: currentCalmnessNumeric !== null ? `${scoreToText(currentCalmnessNumeric, 'calmness')} (${currentCalmnessNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "stress_level_info",
        periodDays: analyticsPeriodDays
    });
    
    const currentEnergyNumeric = avgEnergy !== "N/A" ? parseFloat(avgEnergy) : null;
    detailedAnalyticsMetrics.push({
        key: "energy_level", label: "Ниво на Енергия",
        initialValueText: "N/A", // Initial energy not usually asked directly
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.energy_level_target_text', "Високо и стабилно"),
        currentValueNumeric: currentEnergyNumeric,
        currentValueText: currentEnergyNumeric !== null ? `${scoreToText(currentEnergyNumeric, 'general')} (${currentEnergyNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "energy_level_info",
        periodDays: analyticsPeriodDays
    });

    const currentHydrationNumeric = avgHydration !== "N/A" ? parseFloat(avgHydration) : null;
    detailedAnalyticsMetrics.push({
        key: "hydration_status", label: "Хидратация",
        initialValueText: initialAnswers?.waterIntake || "N/A",
        expectedValueText: safeGetL(finalPlan, 'hydrationCookingSupplements.hydration_recommendations.daily_liters', "2-2.5л") + " вода",
        currentValueNumeric: currentHydrationNumeric,
        currentValueText: currentHydrationNumeric !== null ? `${scoreToText(currentHydrationNumeric, 'general')} (${currentHydrationNumeric.toFixed(1)}/5)` : "Няма данни",
        infoTextKey: "hydration_status_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    const initialBmiValue = initialWeight && heightCm ? (initialWeight / ((heightCm / 100) ** 2)) : null;
    const currentBmiValue = currentWeight && heightCm ? (currentWeight / ((heightCm / 100) ** 2)) : null;
    const expectedBmiNumeric = safeGetL(finalPlan, 'detailedTargets.bmi_target_numeric', 22.5);
    detailedAnalyticsMetrics.push({
        key: "bmi_status", label: "BMI (ИТМ)",
        initialValueText: initialBmiValue !== null ? `${initialBmiValue.toFixed(1)} (${getBmiCategory(initialBmiValue)})` : "N/A",
        expectedValueText: `${expectedBmiNumeric.toFixed(1)} (${getBmiCategory(expectedBmiNumeric)})`,
        currentValueNumeric: currentBmiValue !== null ? parseFloat(currentBmiValue.toFixed(1)) : null,
        currentValueText: currentBmiValue !== null ? `${currentBmiValue.toFixed(1)} (${getBmiCategory(currentBmiValue)})` : "Няма данни",
        infoTextKey: "bmi_info",
        periodDays: 0
    });

    detailedAnalyticsMetrics.push({
        key: "meal_adherence", label: "Придържане към Хранения",
        initialValueText: "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.meal_adherence_target_text', "> 85%"),
        currentValueNumeric: parseFloat(averageMealAdherence.toFixed(1)),
        currentValueText: `${Math.round(averageMealAdherence)}%`,
        infoTextKey: "meal_adherence_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    detailedAnalyticsMetrics.push({
        key: "index_completion", label: "Попълване на Индекси",
        initialValueText: "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.index_completion_target_text', "> 80%"),
        currentValueNumeric: parseFloat(indexCompletionRate.toFixed(1)),
        currentValueText: `${Math.round(indexCompletionRate)}%`,
        infoTextKey: "index_completion_info",
        periodDays: USER_ACTIVITY_LOG_LOOKBACK_DAYS_ANALYTICS
    });

    detailedAnalyticsMetrics.push({
        key: "log_consistency", label: "Редовност на Дневника",
        initialValueText: "N/A",
        expectedValueText: safeGetL(finalPlan, 'detailedTargets.log_consistency_target_text', "> 80%"),
        currentValueNumeric: parseFloat(logCompletionRate.toFixed(1)),
        currentValueText: `${Math.round(logCompletionRate)}%`,
        infoTextKey: "log_consistency_info",
        periodDays: analyticsPeriodDays
    });

    const textualAnalysisSummary = buildDeterministicAnalyticsSummary(currentAnalytics, detailedAnalyticsMetrics, userGoal)
        || 'Няма достатъчно данни за текстов анализ.';

    // ----- Streak Calculation -----
    const streak = { currentCount: 0, dailyStatusArray: [] };
    try {
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const entry = logEntries.find(l => l.date === key);
            const logged = !!(entry && entry.data && Object.keys(entry.data).length > 0);
            streak.dailyStatusArray.push({ date: key, logged });
        }
        for (let i = streak.dailyStatusArray.length - 1; i >= 0; i--) {
            if (streak.dailyStatusArray[i].logged) streak.currentCount++; else break;
        }
    } catch(err) { console.error('STREAK_CALC_ERROR', err); }

    const finalAnalyticsObject = {
        current: currentAnalytics,
        detailed: detailedAnalyticsMetrics,
        textualAnalysis: textualAnalysisSummary,
        streak,
        periodDays: analyticsPeriodDays // Add period information to analytics response
    };
    // console.log(`ANALYTICS_CALC (${userLogId}): Calculation finished. Overall score: ${currentAnalytics.overallHealthScore}`);
    return finalAnalyticsObject;
}
// ------------- END FUNCTION: calculateAnalyticsIndexes -------------

// ------------- START FUNCTION: populatePrompt -------------
function populatePrompt(template, replacements) {
    let populated = template;
    for (const key in replacements) {
        if (replacements.hasOwnProperty(key)) {
            // Escape special characters in the key for regex
            const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedKey, 'g');
            const replacementValue = (replacements[key] === null || replacements[key] === undefined) ? 'N/A' : String(replacements[key]);
            populated = populated.replace(regex, replacementValue);
        }
    }
    return populated;
};
// ------------- END FUNCTION: populatePrompt -------------


// ------------- START FUNCTION: createPraiseReplacements -------------
function createPraiseReplacements(initialAnswers, logs, avgMetric, mealAdh) {
    return {
        '%%име%%': initialAnswers.name || 'Клиент',
        '%%възраст%%': initialAnswers.age || 'N/A',
        '%%формулировка_на_целта%%': initialAnswers.goal || 'N/A',
        '%%извлечени_от_въпросника_ключови_моменти_като_mainChallenge_стрес_ниво_мотивационни_проблеми_или_синтезиран_кратък_психо_портрет_ако_има%%': initialAnswers.additionalNotes || initialAnswers.mainChallenge || '',
        '%%брой_попълнени_дни%%': logs.length,
        '%%общо_дни_в_периода%%': PRAISE_INTERVAL_DAYS,
        '%%средна_енергия_за_периода%%': avgMetric('energy'),
        '%%средна_енергия_предходен_период%%': 'N/A',
        '%%средно_настроение_за_периода%%': avgMetric('mood'),
        '%%средно_настроение_предходен_период%%': 'N/A',
        '%%средна_хидратация_за_периода%%': avgMetric('hydration'),
        '%%процент_придържане_към_хран_план_за_периода%%': mealAdh(),
        '%%процент_придържане_предходен_период%%': 'N/A',
        '%%средно_качество_сън_за_периода%%': avgMetric('sleep_quality'),
        '%%цитат1_от_бележка_или_чат%%': logs[0]?.data?.note || '',
        '%%цитат2_от_бележка_или_чат%%': logs[1]?.data?.note || '',
        '%%заглавие_постижение_N-1%%': '',
        '%%заглавие_постижение_N-2%%': ''
    };
}
// ------------- END FUNCTION: createPraiseReplacements -------------


// ------------- START FUNCTION: shouldTriggerAutomatedFeedbackChat -------------
function shouldTriggerAutomatedFeedbackChat(lastUpdateTs, lastChatTs, currentTime = Date.now()) {
    if (!lastUpdateTs) return false;
    const daysSinceUpdate = (currentTime - lastUpdateTs) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < AUTOMATED_FEEDBACK_TRIGGER_DAYS) return false;
    if (lastChatTs && lastChatTs > lastUpdateTs) return false;
    return true;
}
// ------------- END FUNCTION: shouldTriggerAutomatedFeedbackChat -------------

async function handleTestResultEvent(userId, payload, env) {
    // Processing testResult event
    await env.USER_METADATA_KV.put(`${userId}_latest_test_result`, JSON.stringify(payload || {}));
    await processSingleUserPlan(userId, env);
}

async function handleIrisDiagEvent(userId, payload, env) {
    // Processing irisDiag event
    await env.USER_METADATA_KV.put(`${userId}_latest_iris_diag`, JSON.stringify(payload || {}));
    await processSingleUserPlan(userId, env);
}

function detectFoodPreferenceFromText(text) {
    const t = typeof text === 'string' ? text.toLowerCase() : '';
    if (t.includes('веган') || t.includes('vegan')) return 'Веган режим';
    if (t.includes('вегетариан') || t.includes('vegetarian') || t.includes('без месо')) {
        return 'Вегетариански режим';
    }
    if (t.includes('кето') || t.includes('кетоген') || t.includes('keto')) {
        return 'Кетогенен режим';
    }
    if (t.includes('нисковъглехидрат') || t.includes('low carb')) {
        return 'Нисковъглехидратен режим';
    }
    if (t.includes('без глутен') || t.includes('gluten free')) return 'Безглутенов режим';
    if (t.includes('без млеч') || t.includes('dairy free')) return 'Безмлечен режим';
    return null;
}

// ------------- START BLOCK: UserEventHandlers -------------
const EVENT_HANDLERS = {
    planMod: async (userId, env, payload) => {
        const description = payload && payload.description ? String(payload.description) : '';
        const newPref = detectFoodPreferenceFromText(description);
        if (newPref) {
            const iaStr = await env.USER_METADATA_KV.get(`${userId}_initial_answers`);
            const ia = safeParseJson(iaStr, {});
            if (Object.keys(ia).length > 0) {
                ia.foodPreference = newPref;
                await env.USER_METADATA_KV.put(`${userId}_initial_answers`, JSON.stringify(ia));
            }
        }
        await processSingleUserPlan(userId, env);
    },
    testResult: async (userId, env, payload) => {
        await handleTestResultEvent(userId, payload, env);
    },
    irisDiag: async (userId, env, payload) => {
        await handleIrisDiagEvent(userId, payload, env);
    }
};

async function processPendingUserEvents(env, ctx, limit = 5, cursor) {
    const list = await env.USER_METADATA_KV.list({ prefix: 'event_', limit, cursor });
    const events = [];
    for (const key of list.keys) {
        const eventStr = await env.USER_METADATA_KV.get(key.name);
        const eventData = safeParseJson(eventStr, null);
        if (!eventData || !eventData.type || !eventData.userId) {
            await env.USER_METADATA_KV.delete(key.name);
            continue;
        }
        events.push({ key: key.name, data: eventData });
    }
    events.sort((a, b) => (a.data.createdTimestamp || 0) - (b.data.createdTimestamp || 0));
    let processed = 0;
    for (const { key, data } of events) {
        const handler = EVENT_HANDLERS[data.type];
        if (handler) {
            ctx.waitUntil(handler(data.userId, env, data.payload));
        } else {
            // Unknown event type
        }
        await env.USER_METADATA_KV.delete(key);
        processed++;
    }
    if (!list.list_complete && list.cursor) {
        env.lastUserEventCursor = list.cursor;
        ctx.waitUntil(processPendingUserEvents(env, ctx, limit, list.cursor));
    } else {
        env.lastUserEventCursor = null;
    }
    // User event processing complete
    return processed;
}
// ------------- END BLOCK: UserEventHandlers -------------

// ------------- START FUNCTION: handleListUserKvRequest -------------
async function handleListUserKvRequest(request, env) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
        return { success: false, message: 'Missing userId' };
    }
    const cursor = url.searchParams.get('cursor') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;
    try {
        if (!cursor) {
            const indexStr = await env.USER_METADATA_KV.get(`${userId}_kv_index`);
            if (indexStr) {
                const kv = safeParseJson(indexStr, {});
                return { success: true, kv, listComplete: true, nextCursor: null };
            }
        }
        const list = await env.USER_METADATA_KV.list({ prefix: `${userId}_`, limit, cursor });
        const kvEntries = await Promise.all(
            list.keys.map(async ({ name }) => [name, await env.USER_METADATA_KV.get(name)])
        );
        const kv = Object.fromEntries(kvEntries);
        return {
            success: true,
            kv,
            nextCursor: list.cursor || null,
            listComplete: list.list_complete
        };
    } catch (error) {
        console.error(`Error in handleListUserKvRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Failed to list KV data' };
    }
}
// ------------- END FUNCTION: handleListUserKvRequest -------------

// ------------- START FUNCTION: rebuildUserKvIndex -------------
async function rebuildUserKvIndex(userId, env) {
    const list = await env.USER_METADATA_KV.list({ prefix: `${userId}_` });
    const kv = {};
    for (const { name } of list.keys) {
        kv[name] = await env.USER_METADATA_KV.get(name);
    }
    await env.USER_METADATA_KV.put(`${userId}_kv_index`, JSON.stringify(kv));
}
// ------------- END FUNCTION: rebuildUserKvIndex -------------

// ------------- START FUNCTION: handleUpdateKvRequest -------------
async function handleUpdateKvRequest(request, env) {
    try {
        const { key, value, userId: bodyUserId } = await request.json();
        if (!key) {
            return { success: false, message: 'Missing key' };
        }

        const keyMatch = typeof key === 'string' ? key.match(/^([^_]+)_/) : null;
        const rawUserIdFromKey = keyMatch ? keyMatch[1] : null;
        const rawBodyUserId =
            typeof bodyUserId === 'string' && /^[A-Za-z0-9_-]+$/.test(bodyUserId)
                ? bodyUserId
                : null;
        const userId = rawBodyUserId ?? rawUserIdFromKey;
        if (!userId) {
            return {
                success: false,
                message: 'Missing userId or key prefix'
            };
        }
        const expectedPrefix = `${userId}_`;
        if (!key.startsWith(expectedPrefix)) {
            return {
                success: false,
                message: 'Key prefix does not match userId'
            };
        }

        await env.USER_METADATA_KV.put(key, String(value));
        await rebuildUserKvIndex(userId, env);
        return { success: true };
    } catch (error) {
        console.error(`Error in handleUpdateKvRequest: ${error.message}\n${error.stack}`);
        return { success: false, message: 'Failed to update KV data' };
    }
}
// ------------- END FUNCTION: handleUpdateKvRequest -------------

// ------------- START FUNCTION: handleSubmitPlanChangeRequest -------------
/**
 * Handles plan change requests from clients.
 * Instead of automatically modifying the plan, this stores the request as a notification
 * for the administrator to review and manually apply changes.
 * 
 * @param {Request} request - Contains userId and requestText
 * @param {Object} env - Worker environment with KV bindings
 * @returns {Promise<Object>} Success response confirming the request was submitted
 */
async function handleSubmitPlanChangeRequest(request, env) {
    let userId; // Declare at function scope for catch block access
    try {
        const requestData = await request.json();
        userId = requestData.userId;
        const requestText = requestData.requestText;

        if (!userId || !requestText || !String(requestText).trim()) {
            return {
                success: false,
                message: 'Моля, въведете описание на желаната промяна.',
                statusHint: 400
            };
        }

        console.log(`PLAN_CHANGE_REQUEST (${userId}): Submitting request for admin review: "${String(requestText).trim().substring(0, 200)}..."`);

        // Check if user has an active plan
        const finalPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        const finalPlan = safeParseJson(finalPlanStr, null);
        if (!finalPlan) {
            console.log(`PLAN_CHANGE_ERROR (${userId}): No plan found`);
            return {
                success: false,
                message: 'Не е намерен активен план за този потребител.',
                statusHint: 404
            };
        }

        // Get existing plan change requests for this user
        const existingRequestsStr = await env.USER_METADATA_KV.get(`${userId}_plan_change_requests`);
        const existingRequests = safeParseJson(existingRequestsStr, []);

        // Create new request object
        const newRequest = {
            id: crypto.randomUUID(), // Unique identifier for deletion
            requestText: String(requestText).trim(),
            timestamp: new Date().toISOString(),
            status: 'pending', // pending, reviewed, completed, rejected
            read: false // For admin notification system
        };

        // Add the new request to the list
        existingRequests.push(newRequest);

        // Store the updated requests list
        await env.USER_METADATA_KV.put(`${userId}_plan_change_requests`, JSON.stringify(existingRequests));

        console.log(`PLAN_CHANGE_SUCCESS (${userId}): Request stored successfully for admin review`);
        return {
            success: true,
            message: 'Вашата заявка за промяна на плана е изпратена успешно! Администраторът ще я прегледа и ще направи необходимите промени. Промените ще бъдат видими след презареждане на страницата.',
            notificationType: 'PLAN_CHANGE_REQUEST'
        };
    } catch (error) {
        console.error(`PLAN_CHANGE_ERROR (${userId}): ${error.message}\n${error.stack}`);
        return {
            success: false,
            message: 'Грешка при изпращане на заявката за промяна на плана.',
            statusHint: 500
        };
    }
}
// ------------- END FUNCTION: handleSubmitPlanChangeRequest -------------

// ------------- START FUNCTION: handleProposePlanChangeRequest -------------
/**
 * Handles AI assistant proposals for plan changes.
 * This endpoint is called by the AI assistant when it wants to suggest changes to the user's plan.
 * The changes are stored as pending and require explicit user approval.
 * 
 * @param {Request} request - Contains userId, proposedChanges (description and structured changes), and reasoning
 * @param {Object} env - Worker environment with KV bindings
 * @returns {Promise<Object>} Success response with proposal ID
 */
async function handleProposePlanChangeRequest(request, env) {
    try {
        const { userId, proposedChanges, reasoning, source } = await request.json();
        
        if (!userId || !proposedChanges) {
            return { 
                success: false, 
                message: 'Липсва userId или предложени промени.', 
                statusHint: 400 
            };
        }

        // Check if there's already a pending proposal
        const existingProposalStr = await env.USER_METADATA_KV.get(`${userId}_pending_plan_proposal`);
        if (existingProposalStr) {
            const existingProposal = safeParseJson(existingProposalStr, null);
            if (existingProposal && existingProposal.status === 'pending') {
                return { 
                    success: false, 
                    message: 'Вече има чакащо предложение за промяна на плана. Моля, прегледайте и одобрете или отхвърлете текущото предложение преди да създавате ново.', 
                    statusHint: 409 
                };
            }
        }

        // Get current plan for comparison
        const currentPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        const currentPlan = safeParseJson(currentPlanStr, null);
        
        if (!currentPlan) {
            return { 
                success: false, 
                message: 'Не е намерен текущ план за потребителя.', 
                statusHint: 404 
            };
        }

        // Create proposal object
        const proposalId = `proposal_${Date.now()}`;
        const proposal = {
            id: proposalId,
            userId,
            status: 'pending',
            proposedChanges,
            reasoning: reasoning || 'AI асистентът предлага тази промяна за оптимизиране на вашия план.',
            source: source || 'ai_assistant',
            currentPlanSnapshot: currentPlan,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };

        // Store the proposal
        await env.USER_METADATA_KV.put(
            `${userId}_pending_plan_proposal`,
            JSON.stringify(proposal)
        );

        // Log the proposal creation
        console.log(`PLAN_PROPOSAL_CREATED: User ${userId}, Proposal ${proposalId}`);

        return {
            success: true,
            message: 'Предложението за промяна на плана е създадено успешно.',
            proposalId,
            proposal: {
                id: proposalId,
                proposedChanges,
                reasoning: proposal.reasoning,
                createdAt: proposal.createdAt
            }
        };

    } catch (error) {
        console.error(`Error in handleProposePlanChangeRequest: ${error.message}\n${error.stack}`);
        return { 
            success: false, 
            message: 'Грешка при създаване на предложение за промяна на плана.', 
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleProposePlanChangeRequest -------------

// ------------- START FUNCTION: handleApprovePlanChangeRequest -------------
/**
 * Handles user approval of AI-proposed plan changes.
 * After approval, the changes are applied to the user's final_plan.
 * 
 * @param {Request} request - Contains userId and proposalId
 * @param {Object} env - Worker environment with KV bindings
 * @returns {Promise<Object>} Success response with updated plan
 */
async function handleApprovePlanChangeRequest(request, env) {
    try {
        const { userId, proposalId, userComment } = await request.json();
        
        if (!userId) {
            return { 
                success: false, 
                message: 'Липсва userId.', 
                statusHint: 400 
            };
        }

        // Get the pending proposal
        const proposalStr = await env.USER_METADATA_KV.get(`${userId}_pending_plan_proposal`);
        if (!proposalStr) {
            return { 
                success: false, 
                message: 'Не е намерено чакащо предложение за промяна на плана.', 
                statusHint: 404 
            };
        }

        const proposal = safeParseJson(proposalStr, null);
        if (!proposal || proposal.status !== 'pending') {
            return { 
                success: false, 
                message: 'Предложението вече е обработено или е невалидно.', 
                statusHint: 400 
            };
        }

        // Validate proposal ID if provided
        if (proposalId && proposal.id !== proposalId) {
            return { 
                success: false, 
                message: 'Невалиден идентификатор на предложение.', 
                statusHint: 400 
            };
        }

        // Check if proposal has expired
        const expiresAt = new Date(proposal.expiresAt);
        if (expiresAt < new Date()) {
            // Mark as expired and remove
            await env.USER_METADATA_KV.delete(`${userId}_pending_plan_proposal`);
            return { 
                success: false, 
                message: 'Предложението е изтекло. Моля, поискайте ново от асистента.', 
                statusHint: 410 
            };
        }

        // Get current plan
        const currentPlanStr = await env.USER_METADATA_KV.get(`${userId}_final_plan`);
        const currentPlan = safeParseJson(currentPlanStr, {});

        // Apply the proposed changes
        const updatedPlan = await applyPlanChanges(currentPlan, proposal.proposedChanges);

        // Validate the updated plan has all required macros
        const validationResult = await enforceCompletePlanBeforePersist({
            plan: updatedPlan,
            userId,
            env,
            planModelName: await env.RESOURCES_KV.get('model_plan_generation'),
            basePrompt: 'Попълни липсващите макроси в обновения план.',
            addLog: async () => {},
            retryArtifactKey: null
        });

        if (!validationResult.success) {
            return { 
                success: false, 
                message: 'Обновеният план не успя валидацията на макросите.', 
                statusHint: 422 
            };
        }

        const validatedPlan = validationResult.plan;

        // Update metadata
        if (!validatedPlan.generationMetadata) {
            validatedPlan.generationMetadata = {};
        }
        validatedPlan.generationMetadata.lastModified = new Date().toISOString();
        validatedPlan.generationMetadata.modifiedBy = 'ai_assistant_with_user_approval';
        validatedPlan.generationMetadata.approvalComment = userComment || null;

        // Save the updated plan
        await env.USER_METADATA_KV.put(`${userId}_final_plan`, JSON.stringify(validatedPlan));

        // Update macros record
        const macrosRecord = {
            status: 'final',
            data: validatedPlan.caloriesMacros ? { ...validatedPlan.caloriesMacros } : null
        };
        await env.USER_METADATA_KV.put(`${userId}_analysis_macros`, JSON.stringify(macrosRecord));

        // Archive the approved proposal
        proposal.status = 'approved';
        proposal.approvedAt = new Date().toISOString();
        proposal.userComment = userComment || null;
        await env.USER_METADATA_KV.put(
            `${userId}_plan_proposal_history_${proposal.id}`,
            JSON.stringify(proposal)
        );

        // Remove the pending proposal
        await env.USER_METADATA_KV.delete(`${userId}_pending_plan_proposal`);

        // Clear pending mod flag if exists
        await env.USER_METADATA_KV.delete(`pending_plan_mod_${userId}`);

        // Log the approval
        console.log(`PLAN_PROPOSAL_APPROVED: User ${userId}, Proposal ${proposal.id}`);

        return {
            success: true,
            message: 'Промените в плана са приложени успешно!',
            updatedPlan: validatedPlan
        };

    } catch (error) {
        console.error(`Error in handleApprovePlanChangeRequest: ${error.message}\n${error.stack}`);
        return { 
            success: false, 
            message: 'Грешка при одобряване на промените в плана.', 
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleApprovePlanChangeRequest -------------

// ------------- START FUNCTION: handleGetPendingPlanChangesRequest -------------
/**
 * Gets pending plan change proposals for a user.
 * 
 * @param {Request} request - Contains userId as query parameter
 * @param {Object} env - Worker environment with KV bindings
 * @returns {Promise<Object>} Pending proposals if any
 */
async function handleGetPendingPlanChangesRequest(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        
        if (!userId) {
            return { 
                success: false, 
                message: 'Липсва userId.', 
                statusHint: 400 
            };
        }

        const proposalStr = await env.USER_METADATA_KV.get(`${userId}_pending_plan_proposal`);
        
        if (!proposalStr) {
            return {
                success: true,
                hasPending: false,
                proposal: null
            };
        }

        const proposal = safeParseJson(proposalStr, null);
        
        // Check if expired
        if (proposal && proposal.expiresAt) {
            const expiresAt = new Date(proposal.expiresAt);
            if (expiresAt < new Date()) {
                // Clean up expired proposal
                await env.USER_METADATA_KV.delete(`${userId}_pending_plan_proposal`);
                return {
                    success: true,
                    hasPending: false,
                    proposal: null
                };
            }
        }

        return {
            success: true,
            hasPending: !!proposal,
            proposal: proposal ? {
                id: proposal.id,
                proposedChanges: proposal.proposedChanges,
                reasoning: proposal.reasoning,
                createdAt: proposal.createdAt,
                expiresAt: proposal.expiresAt
            } : null
        };

    } catch (error) {
        console.error(`Error in handleGetPendingPlanChangesRequest: ${error.message}\n${error.stack}`);
        return { 
            success: false, 
            message: 'Грешка при зареждане на чакащите промени.', 
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleGetPendingPlanChangesRequest -------------

// ------------- START FUNCTION: handleRejectPlanChangeRequest -------------
/**
 * Handles user rejection of AI-proposed plan changes.
 * 
 * @param {Request} request - Contains userId, proposalId, and optional reason
 * @param {Object} env - Worker environment with KV bindings
 * @returns {Promise<Object>} Success response
 */
async function handleRejectPlanChangeRequest(request, env) {
    try {
        const { userId, proposalId, reason } = await request.json();
        
        if (!userId) {
            return { 
                success: false, 
                message: 'Липсва userId.', 
                statusHint: 400 
            };
        }

        // Get the pending proposal
        const proposalStr = await env.USER_METADATA_KV.get(`${userId}_pending_plan_proposal`);
        if (!proposalStr) {
            return { 
                success: false, 
                message: 'Не е намерено чакащо предложение за промяна на плана.', 
                statusHint: 404 
            };
        }

        const proposal = safeParseJson(proposalStr, null);
        if (!proposal) {
            return { 
                success: false, 
                message: 'Невалидно предложение.', 
                statusHint: 400 
            };
        }

        // Validate proposal ID if provided
        if (proposalId && proposal.id !== proposalId) {
            return { 
                success: false, 
                message: 'Невалиден идентификатор на предложение.', 
                statusHint: 400 
            };
        }

        // Archive the rejected proposal
        proposal.status = 'rejected';
        proposal.rejectedAt = new Date().toISOString();
        proposal.rejectionReason = reason || null;
        await env.USER_METADATA_KV.put(
            `${userId}_plan_proposal_history_${proposal.id}`,
            JSON.stringify(proposal)
        );

        // Remove the pending proposal
        await env.USER_METADATA_KV.delete(`${userId}_pending_plan_proposal`);

        // Clear pending mod flag if exists
        await env.USER_METADATA_KV.delete(`pending_plan_mod_${userId}`);

        // Log the rejection
        console.log(`PLAN_PROPOSAL_REJECTED: User ${userId}, Proposal ${proposal.id}, Reason: ${reason || 'none'}`);

        return {
            success: true,
            message: 'Предложението за промяна на плана е отхвърлено.'
        };

    } catch (error) {
        console.error(`Error in handleRejectPlanChangeRequest: ${error.message}\n${error.stack}`);
        return { 
            success: false, 
            message: 'Грешка при отхвърляне на промените в плана.', 
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleRejectPlanChangeRequest -------------

// ------------- START FUNCTION: handleDeletePlanChangeNotificationRequest -------------
/**
 * Handles deletion of a specific plan change notification.
 * Removes the notification from the user's plan_change_requests list.
 * @param {Request} request - The request object
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Response object
 */
async function handleDeletePlanChangeNotificationRequest(request, env) {
    try {
        // Parse and validate request body
        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            return { 
                success: false, 
                message: 'Невалиден JSON формат.', 
                statusHint: 400 
            };
        }

        if (!body || typeof body !== 'object') {
            return { 
                success: false, 
                message: 'Невалидно тяло на заявката.', 
                statusHint: 400 
            };
        }

        const { userId, notificationId } = body;
        
        if (!userId) {
            return { 
                success: false, 
                message: 'Липсва userId.', 
                statusHint: 400 
            };
        }

        if (!notificationId) {
            return { 
                success: false, 
                message: 'Липсва notificationId.', 
                statusHint: 400 
            };
        }

        // Get existing plan change requests
        const requestsStr = await env.USER_METADATA_KV.get(`${userId}_plan_change_requests`);
        const requests = safeParseJson(requestsStr, []);

        if (!Array.isArray(requests) || requests.length === 0) {
            return { 
                success: false, 
                message: 'Няма заявки за промяна на плана за този потребител.', 
                statusHint: 404 
            };
        }

        // Filter out the notification with the given ID
        const filteredRequests = requests.filter(req => req.id !== notificationId);

        // Check if anything was removed
        if (filteredRequests.length === requests.length) {
            return { 
                success: false, 
                message: 'Нотификацията не е намерена.', 
                statusHint: 404 
            };
        }

        // Update the KV store with filtered requests
        await env.USER_METADATA_KV.put(`${userId}_plan_change_requests`, JSON.stringify(filteredRequests));

        console.log(`PLAN_CHANGE_NOTIFICATION_DELETED: User ${userId}, Notification ${notificationId}`);

        return {
            success: true,
            message: 'Нотификацията е изтрита успешно.'
        };

    } catch (error) {
        console.error(`Error in handleDeletePlanChangeNotificationRequest: ${error.message}\n${error.stack}`);
        return { 
            success: false, 
            message: 'Грешка при изтриване на нотификацията.', 
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleDeletePlanChangeNotificationRequest -------------

// ------------- START FUNCTION: handleNutrientLookupRequest -------------
/**
 * Handles requests for nutrient lookup by food name and quantity.
 * First checks local product database, then falls back to AI model if not found.
 * 
 * @param {Request} request - HTTP request with {food, quantity} in body
 * @param {Object} env - Environment bindings (KV stores, API keys)
 * @returns {Promise<Object>} Macro nutrients or error response
 */
async function handleNutrientLookupRequest(request, env) {
    /**
     * Helper function to check if all macro values are zero
     * @param {Object} macros - Object with calories, protein, carbs, fat, fiber
     * @returns {boolean} True if all values are zero
     */
    const areAllMacrosZero = (macros) => {
        return macros.calories === 0 && macros.protein === 0 && 
               macros.carbs === 0 && macros.fat === 0 && macros.fiber === 0;
    };
    
    try {
        const { food, quantity } = await request.json();
        
        if (!food || !food.trim()) {
            return { 
                success: false,
                error: 'Missing food',
                statusHint: 400 
            };
        }

        const foodName = food.toLowerCase().trim();
        
        // Normalize quantity - ensure we have a meaningful value for AI query
        // This handles various input formats: numbers, strings like "150 гр", "2 парчета", etc.
        let normalizedQuantity = quantity;
        if (typeof quantity === 'string') {
            normalizedQuantity = quantity.trim();
        }
        // If quantity is falsy or NaN, don't include it in the query
        if (!normalizedQuantity || (typeof normalizedQuantity === 'number' && !isFinite(normalizedQuantity))) {
            normalizedQuantity = null;
        }
        
        // Build food query - only include quantity if it's meaningful
        const foodQuery = normalizedQuantity ? `${normalizedQuantity} ${foodName}` : foodName;

        // First, try to find in local product_macros database
        if (env.RESOURCES_KV) {
            try {
                const productMacrosJson = await env.RESOURCES_KV.get('product_macros');
                if (productMacrosJson) {
                    const products = JSON.parse(productMacrosJson);
                    const product = products.find(p => p.name && p.name.toLowerCase() === foodName);
                    
                    if (product) {
                        // Parse quantity if provided
                        let grams = 100;
                        if (normalizedQuantity) {
                            const match = String(normalizedQuantity).match(/(\d+(?:[.,]\d+)?)/);
                            if (match) {
                                grams = parseFloat(match[1].replace(',', '.'));
                            }
                        }
                        const scale = grams / 100;
                        
                        const macros = {
                            calories: Number((product.calories * scale).toFixed(2)) || 0,
                            protein: Number((product.protein * scale).toFixed(2)) || 0,
                            carbs: Number((product.carbs * scale).toFixed(2)) || 0,
                            fat: Number((product.fat * scale).toFixed(2)) || 0,
                            fiber: Number((product.fiber * scale).toFixed(2)) || 0
                        };
                        
                        // Check if all macros are zero - if so, don't use local data, use AI instead
                        // This handles products like water/tea which legitimately have zero calories
                        // but we want AI to provide more context-aware response
                        if (!areAllMacrosZero(macros)) {
                            return {
                                success: true,
                                ...macros
                            };
                        }
                        // If all zeros, continue to AI lookup for better response
                    }
                }
            } catch (err) {
                console.warn('Error checking local product database:', err);
            }
        }

        // If not found locally, use AI model for nutrient lookup
        // Get model and prompt from RESOURCES_KV (configurable via admin panel)
        // Fetch both values concurrently for better performance
        const [nutrientModel, nutrientPromptBase] = env.RESOURCES_KV 
            ? await Promise.all([
                env.RESOURCES_KV.get('model_nutrient_lookup'),
                env.RESOURCES_KV.get('prompt_nutrient_lookup')
              ])
            : [null, null];
        
        if (env.CF_ACCOUNT_ID && env.CF_AI_TOKEN && nutrientModel) {
            try {
                const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${nutrientModel}`;
                
                // Use custom prompt from admin config or fallback to default with validation
                // The prompt can be customized to work better with specific models
                const defaultPromptWithValidation = `You are a nutrition assistant that validates food descriptions and provides nutritional information.

CRITICAL: You must ALWAYS respond with valid JSON only, no other text or markdown.

Your task:
1. Analyze if the input describes a real food/drink item
2. Check if the quantity/measure is clear and reasonable  
3. If valid, calculate nutritional values
4. If invalid, explain the specific problem in Bulgarian

Response format (MUST be valid JSON):
- For VALID food with clear quantity:
  {"success": true, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number}

- For INVALID input (unclear food, non-food item, unclear quantity, etc.):
  {"success": false, "error": "Bulgarian language error message explaining the specific problem"}

${normalizedQuantity ? `Calculate for the EXACT quantity specified: ${normalizedQuantity}. If quantity is descriptive (like "2 парчета"), estimate weight and calculate.` : 'Calculate per 100g if no quantity is specified.'}

Error message examples in Bulgarian:
- "Не мога да разпозная храната. Моля, опишете по-ясно какво сте консумирали."
- "Количеството не е ясно. Моля, посочете конкретна мярка (напр. '100 гр', '2 парчета', '1 чаша')."
- "Това не изглежда като хранителен продукт. Моля, въведете храна или напитка."
- "Описанието е твърде неясно. Моля, бъдете по-конкретни за продукта и количеството."

Rules:
- All nutritional values must be non-negative numbers
- Reject non-food items (furniture, electronics, etc.)
- Reject vague quantities like "малко", "доста" without specific measure
- Accept both precise ("150 гр") and approximate ("2 средни ябълки") quantities
- Return ONLY JSON, no explanations outside the JSON`;
                
                let systemPrompt;
                if (nutrientPromptBase) {
                    // Use configured prompt with simple string replacement for {quantity} placeholder
                    // This is safe as the prompt comes from admin config (trusted source)
                    systemPrompt = normalizedQuantity 
                        ? nutrientPromptBase.replaceAll('{quantity}', normalizedQuantity)
                        : nutrientPromptBase;
                } else {
                    // Fallback to default prompt with validation
                    systemPrompt = defaultPromptWithValidation;
                }
                
                const messages = [
                    { 
                        role: 'system', 
                        content: systemPrompt
                    },
                    { role: 'user', content: foodQuery }
                ];
                
                const resp = await fetch(cfEndpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.CF_AI_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ messages })
                });
                
                const text = await resp.text();
                try {
                    const parsed = JSON.parse(text);
                    const data = parsed.result || parsed;
                    const payload = data.output || data.response || data;
                    
                    // Try to extract JSON if payload is a string (AI may add explanatory text)
                    let obj;
                    if (typeof payload === 'string') {
                        // Try direct parse first
                        try {
                            obj = JSON.parse(payload);
                        } catch (directParseErr) {
                            // Direct parse failed, try to extract JSON from text using bracket matching
                            // Note: This is a simplified approach that works for most AI responses
                            // It doesn't handle escaped braces or braces in strings, but that's acceptable
                            // since AI responses rarely contain such patterns in our use case
                            const startIdx = payload.indexOf('{');
                            if (startIdx === -1) {
                                console.error('No JSON object found in AI response');
                                // Fall through to return zeros
                                obj = null;
                            } else {
                                let depth = 0;
                                let endIdx = -1;
                                
                                for (let i = startIdx; i < payload.length; i++) {
                                    const char = payload[i];
                                    if (char === '{') {
                                        depth++;
                                    } else if (char === '}') {
                                        depth--;
                                        if (depth === 0) {
                                            endIdx = i + 1;
                                            break;
                                        }
                                    }
                                }
                                
                                if (endIdx === -1) {
                                    console.error('Incomplete JSON object in AI response');
                                    obj = null;
                                } else {
                                    const jsonStr = payload.substring(startIdx, endIdx);
                                    try {
                                        obj = JSON.parse(jsonStr);
                                    } catch (extractParseErr) {
                                        // Extraction also failed - log and fall through to zeros
                                        console.error('Failed to parse extracted JSON from AI response');
                                        obj = null;
                                    }
                                }
                            }
                        }
                    } else {
                        obj = payload;
                    }
                    
                    if (!obj) {
                        // AI failed to extract valid nutrition data - return error instead of zeros
                        console.error('AI failed to extract nutrition data from response');
                        return {
                            success: false,
                            error: 'AI extraction failed',
                            message: 'AI не успя да извлече хранителни данни от отговора',
                            statusHint: 500
                        };
                    }
                    
                    // Check if AI returned an error/validation response
                    if (obj.success === false) {
                        // AI identified a problem with the input
                        return {
                            success: false,
                            error: obj.error || 'Неуспешна валидация на входните данни.',
                            message: obj.error || 'AI не може да обработи заявката',
                            statusHint: 422  // Unprocessable Entity
                        };
                    }
                    
                    const macros = {
                        calories: Number(obj.calories) || 0,
                        protein: Number(obj.protein) || 0,
                        carbs: Number(obj.carbs) || 0,
                        fat: Number(obj.fat) || 0,
                        fiber: Number(obj.fiber) || 0
                    };
                    
                    // Check if AI returned all zeros - this indicates AI couldn't process the food
                    // We should return an error instead of misleading zero values
                    if (areAllMacrosZero(macros)) {
                        console.error('AI returned all zeros - unable to recognize food:', foodQuery);
                        return {
                            success: false,
                            error: 'AI returned all zeros',
                            message: 'AI не може да разпознае храната. Моля, въведете макросите ръчно или опитайте с по-подробно описание (напр. "шоколадов мъфин 80г").',
                            statusHint: 422
                        };
                    }
                    
                    // Success response with macros
                    return {
                        success: true,
                        ...macros
                    };
                } catch (parseErr) {
                    console.error('AI response parsing error:', parseErr);
                    return {
                        success: false,
                        error: 'AI parsing error',
                        message: 'AI не успя да обработи отговора',
                        statusHint: 500
                    };
                }
            } catch (err) {
                console.error('AI nutrient lookup error:', err);
                return {
                    success: false,
                    error: 'AI lookup error',
                    message: 'AI не успя да изчисли хранителни данни',
                    statusHint: 500
                };
            }
        }
        
        // Try Gemini API as fallback if Cloudflare AI is not configured
        const geminiKey = env[GEMINI_API_KEY_SECRET_NAME];
        if (geminiKey && nutrientModel) {
            try {
                // Use custom prompt from admin config or fallback to default
                const defaultPromptQuantity = 'Give nutrition data as JSON {calories, protein, carbs, fat, fiber} for the EXACT quantity of food specified. Calories in kcal, protein/carbs/fat/fiber in grams. Calculate for the specific quantity provided (e.g., if given "150 гр", calculate for 150 grams, not per 100g). If given descriptive quantities like "2 парчета" or "1 чаша", estimate the weight in grams and calculate accordingly. Return ONLY the JSON object, no explanations.';
                const defaultPromptPer100g = 'Give nutrition data as JSON {calories, protein, carbs, fat, fiber} for the given food per 100g. Calories in kcal, protein/carbs/fat/fiber in grams. Return ONLY the JSON object, no explanations.';
                
                let userPrompt;
                if (nutrientPromptBase) {
                    // Use configured prompt with quantity
                    const promptWithQuantity = normalizedQuantity 
                        ? nutrientPromptBase.replaceAll('{quantity}', normalizedQuantity)
                        : nutrientPromptBase;
                    userPrompt = `${promptWithQuantity}\n\nFood: ${foodQuery}`;
                } else {
                    // Fallback to default prompts
                    const systemPrompt = normalizedQuantity ? defaultPromptQuantity : defaultPromptPer100g;
                    userPrompt = `${systemPrompt}\n\nFood: ${foodQuery}`;
                }
                
                const responseText = await callGeminiAPI(
                    userPrompt,
                    geminiKey,
                    { 
                        temperature: 0.3,  // Lower temperature for more consistent results
                        maxOutputTokens: 256  // Short response expected
                    },
                    [],
                    nutrientModel
                );
                
                // Extract JSON from Gemini response
                let obj;
                try {
                    obj = JSON.parse(responseText);
                } catch (directParseErr) {
                    // Try to extract JSON from text using bracket matching
                    const startIdx = responseText.indexOf('{');
                    if (startIdx === -1) {
                        console.error('No JSON object found in Gemini response');
                        obj = null;
                    } else {
                        let depth = 0;
                        let endIdx = -1;
                        
                        for (let i = startIdx; i < responseText.length; i++) {
                            const char = responseText[i];
                            if (char === '{') {
                                depth++;
                            } else if (char === '}') {
                                depth--;
                                if (depth === 0) {
                                    endIdx = i + 1;
                                    break;
                                }
                            }
                        }
                        
                        if (endIdx === -1) {
                            console.error('Incomplete JSON object in Gemini response');
                            obj = null;
                        } else {
                            const jsonStr = responseText.substring(startIdx, endIdx);
                            try {
                                obj = JSON.parse(jsonStr);
                            } catch (extractParseErr) {
                                console.error('Failed to parse extracted JSON from Gemini response');
                                obj = null;
                            }
                        }
                    }
                }
                
                if (!obj) {
                    console.error('Gemini failed to extract nutrition data from response');
                    return {
                        success: false,
                        error: 'Gemini extraction failed',
                        message: 'Gemini не успя да извлече хранителни данни от отговора',
                        statusHint: 500
                    };
                }
                
                // Check if AI returned an error/validation response
                if (obj.success === false) {
                    // AI identified a problem with the input
                    return {
                        success: false,
                        error: obj.error || 'Неуспешна валидация на входните данни.',
                        message: obj.error || 'AI не може да обработи заявката',
                        statusHint: 422  // Unprocessable Entity
                    };
                }
                
                const macros = {
                    calories: Number(obj.calories) || 0,
                    protein: Number(obj.protein) || 0,
                    carbs: Number(obj.carbs) || 0,
                    fat: Number(obj.fat) || 0,
                    fiber: Number(obj.fiber) || 0
                };
                
                // Check if Gemini returned all zeros
                if (areAllMacrosZero(macros)) {
                    console.error('Gemini returned all zeros - unable to recognize food:', foodQuery);
                    return {
                        success: false,
                        error: 'Gemini returned all zeros',
                        message: 'AI не може да разпознае храната. Моля, въведете макросите ръчно или опитайте с по-подробно описание (напр. "шоколадов мъфин 80г").',
                        statusHint: 422
                    };
                }
                
                // Success response with macros
                return {
                    success: true,
                    ...macros
                };
            } catch (err) {
                console.error('Gemini nutrient lookup error:', err);
                return {
                    success: false,
                    error: 'Gemini lookup error',
                    message: 'Gemini не успя да изчисли хранителни данни',
                    statusHint: 500
                };
            }
        }

        // If AI is not configured, return error
        return {
            success: false,
            error: 'AI not configured',
            message: 'AI услугата не е конфигурирана. Моля, конфигурирайте модел в KV store (model_nutrient_lookup) или уверете се, че имате GEMINI_API_KEY.',
            statusHint: 503
        };

    } catch (error) {
        console.error(`Error in handleNutrientLookupRequest: ${error.message}`);
        return { 
            success: false,
            error: 'Internal Server Error',
            message: 'Вътрешна грешка на сървъра',
            statusHint: 500 
        };
    }
}
// ------------- END FUNCTION: handleNutrientLookupRequest -------------

// ------------- START FUNCTION: applyPlanChanges -------------
/**
 * Applies proposed changes to the current plan.
 * This function merges the proposed changes into the existing plan structure.
 * 
 * @param {Object} currentPlan - Current user plan
 * @param {Object} proposedChanges - Changes to apply
 * @returns {Promise<Object>} Updated plan
 */
async function applyPlanChanges(currentPlan, proposedChanges) {
    const updatedPlan = typeof structuredClone === 'function'
        ? structuredClone(currentPlan)
        : JSON.parse(JSON.stringify(currentPlan));

    // Apply changes based on the structure of proposedChanges
    if (proposedChanges.caloriesMacros) {
        if (proposedChanges.caloriesMacros.plan) {
            updatedPlan.caloriesMacros = updatedPlan.caloriesMacros || {};
            updatedPlan.caloriesMacros.plan = {
                ...updatedPlan.caloriesMacros.plan,
                ...proposedChanges.caloriesMacros.plan
            };
        }
        if (proposedChanges.caloriesMacros.recommendation) {
            updatedPlan.caloriesMacros = updatedPlan.caloriesMacros || {};
            updatedPlan.caloriesMacros.recommendation = {
                ...updatedPlan.caloriesMacros.recommendation,
                ...proposedChanges.caloriesMacros.recommendation
            };
        }
    }

    // Apply changes to week1Menu if specified
    if (proposedChanges.week1Menu) {
        updatedPlan.week1Menu = updatedPlan.week1Menu || {};
        for (const [day, meals] of Object.entries(proposedChanges.week1Menu)) {
            if (meals) {
                updatedPlan.week1Menu[day] = meals;
            }
        }
    }

    // Apply changes to principlesWeek2_4 if specified
    if (proposedChanges.principlesWeek2_4) {
        updatedPlan.principlesWeek2_4 = {
            ...updatedPlan.principlesWeek2_4,
            ...proposedChanges.principlesWeek2_4
        };
    }

    // Apply changes to allowedForbiddenFoods if specified
    if (proposedChanges.allowedForbiddenFoods) {
        updatedPlan.allowedForbiddenFoods = {
            ...updatedPlan.allowedForbiddenFoods,
            ...proposedChanges.allowedForbiddenFoods
        };
    }

    // Apply changes to hydrationCookingSupplements if specified
    if (proposedChanges.hydrationCookingSupplements) {
        updatedPlan.hydrationCookingSupplements = {
            ...updatedPlan.hydrationCookingSupplements,
            ...proposedChanges.hydrationCookingSupplements
        };
    }

    // Apply changes to psychologicalGuidance if specified
    if (proposedChanges.psychologicalGuidance) {
        updatedPlan.psychologicalGuidance = {
            ...updatedPlan.psychologicalGuidance,
            ...proposedChanges.psychologicalGuidance
        };
    }

    // Apply changes to detailedTargets if specified
    if (proposedChanges.detailedTargets) {
        updatedPlan.detailedTargets = {
            ...updatedPlan.detailedTargets,
            ...proposedChanges.detailedTargets
        };
    }

    // Apply changes to profileSummary if specified
    if (proposedChanges.profileSummary) {
        updatedPlan.profileSummary = proposedChanges.profileSummary;
    }

    return updatedPlan;
}
// ------------- END FUNCTION: applyPlanChanges -------------

// ------------- START FUNCTION: parsePlanModificationRequest -------------
/**
 * Parses AI's textual plan modification request into structured changes.
 * Uses AI to extract structured data from the modification description.
 * 
 * @param {string} modificationText - The text description of changes from AI
 * @param {string} userId - User ID
 * @param {Object} env - Worker environment
 * @returns {Promise<Object>} Structured changes to apply
 */
async function parsePlanModificationRequest(modificationText, userId, env) {
    try {
        // Get current plan and user data for context
        const [currentPlanStr, initialAnswersStr] = await Promise.all([
            env.USER_METADATA_KV.get(`${userId}_final_plan`),
            env.USER_METADATA_KV.get(`${userId}_initial_answers`)
        ]);
        
        const currentPlan = safeParseJson(currentPlanStr, null);
        const initialAnswers = safeParseJson(initialAnswersStr, {});
        
        if (!currentPlan) {
            console.log(`PLAN_MOD_PARSE_ERROR (${userId}): No current plan found`);
            return {
                textDescription: modificationText,
                structuredChanges: {}
            };
        }

        // Extract user-specific parameters for context
        const userContext = {
            goal: initialAnswers.goal || 'N/A',
            allergies: initialAnswers.allergies || 'N/A',
            intolerances: initialAnswers.intolerances || 'N/A',
            medicalConditions: initialAnswers.medicalConditions || 'N/A',
            dietaryPreferences: initialAnswers.dietaryPreferences || 'N/A',
            activityLevel: initialAnswers.activityLevel || 'N/A',
            age: initialAnswers.age || 'N/A',
            weight: initialAnswers.weight || 'N/A',
            height: initialAnswers.height || 'N/A',
            gender: initialAnswers.gender || 'N/A'
        };

        // Create comprehensive plan summary for AI analysis
        const planSummary = {
            profileSummary: currentPlan.profileSummary || 'N/A',
            calories: currentPlan.caloriesMacros?.plan?.calories || 'N/A',
            protein: currentPlan.caloriesMacros?.plan?.protein_grams || 'N/A',
            carbs: currentPlan.caloriesMacros?.plan?.carbs_grams || 'N/A',
            fat: currentPlan.caloriesMacros?.plan?.fat_grams || 'N/A',
            allowedFoods: (currentPlan.allowedForbiddenFoods?.allowed || []).slice(0, PLAN_MOD_PLAN_SUMMARY_FOOD_LIMIT).join(', ') || 'N/A',
            forbiddenFoods: (currentPlan.allowedForbiddenFoods?.forbidden || []).slice(0, PLAN_MOD_PLAN_SUMMARY_FOOD_LIMIT).join(', ') || 'N/A',
            week1MenuDays: Object.keys(currentPlan.week1Menu || {}).length,
            sampleMeals: [
                currentPlan.week1Menu?.monday?.[0]?.name || 'N/A',
                currentPlan.week1Menu?.monday?.[1]?.name || 'N/A',
                currentPlan.week1Menu?.tuesday?.[0]?.name || 'N/A'
            ].filter(m => m !== 'N/A').join(', '),
            week2_4Principles: currentPlan.principlesWeek2_4 ? 'Присъстват' : 'Липсват',
            hydrationGuidance: currentPlan.hydrationCookingSupplements ? 'Присъства' : 'Липсва',
            psychologicalGuidance: currentPlan.psychologicalGuidance ? 'Присъства' : 'Липсва',
            detailedTargets: currentPlan.detailedTargets ? 'Присъстват' : 'Липсват'
        };

        // First, ask AI to decide: partial modification or full regeneration
        const decisionPrompt = `
Ти си AI експерт по хранителни планове. Анализирай дали потребителската заявка изисква частична промяна или пълно регенериране на плана.

ИНДИВИДУАЛНИ ПАРАМЕТРИ НА ПОТРЕБИТЕЛЯ:
Цел: ${userContext.goal}
Алергии: ${userContext.allergies}
Непоносимости: ${userContext.intolerances}
Медицински състояния: ${userContext.medicalConditions}
Хранителни предпочитания: ${userContext.dietaryPreferences}
Ниво на активност: ${userContext.activityLevel}
Възраст: ${userContext.age} години | Тегло: ${userContext.weight} кг | Височина: ${userContext.height} см | Пол: ${userContext.gender}

ТЕКУЩ ПЛАН (ПЪЛНО РЕЗЮМЕ):
Профилно резюме: ${planSummary.profileSummary}
Калории: ${planSummary.calories} | Протеин: ${planSummary.protein}г | Въглехидрати: ${planSummary.carbs}г | Мазнини: ${planSummary.fat}г
Позволени храни: ${planSummary.allowedFoods}
Забранени храни: ${planSummary.forbiddenFoods}
Седмично меню: ${planSummary.week1MenuDays} дни с примерни ястия: ${planSummary.sampleMeals}
Принципи седмици 2-4: ${planSummary.week2_4Principles}
Хидратация и добавки: ${planSummary.hydrationGuidance}
Психологическо ръководство: ${planSummary.psychologicalGuidance}
Детайлни цели: ${planSummary.detailedTargets}

ЗАЯВКА ОТ ПОТРЕБИТЕЛЯ:
"${modificationText}"

ТВОЯТА ЗАДАЧА:
Анализирай заявката и реши:
1. PARTIAL_MODIFICATION - ако заявката може да се реализира чрез промяна на конкретни секции (напр. повече протеин, добави/премахни храни, промени някои ястия)
2. FULL_REGENERATION - само ако заявката изисква ФУНДАМЕНТАЛНА промяна (напр. "промени целия план за напълно различна диета", "направи ми веган план вместо текущия", "преминавам от deficit към bulk - направи нов план")

ВАЖНО: При частични промени ВИНАГИ съобразявай:
- Алергиите и непоносимостите на потребителя
- Медицинските състояния и специални нужди
- Хранителните предпочитания и цели
- Текущото ниво на активност и физиологични параметри

ПРИОРИТЕТ: Винаги избирай PARTIAL_MODIFICATION освен ако промяната не е наистина фундаментална.

Примери за PARTIAL_MODIFICATION:
- "Искам повече протеин" → промени caloriesMacros + week1Menu
- "Премахни млечните продукти" → добави към forbidden + промени week1Menu
- "Повече разнообразие в менюто" → промени week1Menu
- "Добави повече зеленчуци" → промени week1Menu
- "Искам 200 калории повече" → промени caloriesMacros + week1Menu

Примери за FULL_REGENERATION:
- "Искам напълно различен план, текущият не ми харесва" → пълна промяна
- "Преминавам от загуба на тегло към набиране на мускулна маса" → промяна на цели
- "Искам кето диета вместо балансиран план" → промяна на основна стратегия
- "Целите ми се промениха коренно" → нови цели

Отговори САМО с JSON обект в следния формат:
{
  "decision": "PARTIAL_MODIFICATION" или "FULL_REGENERATION",
  "reasoning": "Кратко обяснение на решението (1-2 изречения)",
  "affectedSections": ["caloriesMacros", "week1Menu", ...] - само за PARTIAL_MODIFICATION
}`;

        const modelName = await env.RESOURCES_KV.get('model_plan_generation');
        
        console.log(`PLAN_MOD_DECISION (${userId}): Asking AI to decide modification type for: "${modificationText.substring(0, 100)}..."`);
        
        // Get AI decision
        const decisionResponse = await callModelRef.current(
            modelName,
            decisionPrompt,
            env,
            { temperature: PLAN_MOD_DECISION_TEMPERATURE, maxTokens: PLAN_MOD_DECISION_MAX_TOKENS }
        );

        const cleanedDecisionJson = cleanGeminiJson(decisionResponse);
        const decision = safeParseJson(cleanedDecisionJson, { decision: 'PARTIAL_MODIFICATION', reasoning: 'Fallback to partial modification', affectedSections: [] });
        
        console.log(`PLAN_MOD_DECISION_RESULT (${userId}): ${decision.decision} - ${decision.reasoning}`);

        // If full regeneration is needed, return special marker
        if (decision.decision === 'FULL_REGENERATION') {
            console.log(`PLAN_MOD_FULL_REGEN (${userId}): AI recommends full plan regeneration`);
            return {
                textDescription: modificationText,
                requiresFullRegeneration: true,
                reasoning: decision.reasoning
            };
        }

        // Otherwise, proceed with partial modification
        console.log(`PLAN_MOD_PARTIAL (${userId}): AI will generate partial modifications for sections: ${(decision.affectedSections || []).join(', ')}`);

        // Use AI to generate the modified plan content
        const parsePrompt = `
Ти си AI асистент за хранителни планове. Потребителят иска да промени своя план ЧАСТИЧНО.

ИНДИВИДУАЛНИ ПАРАМЕТРИ НА ПОТРЕБИТЕЛЯ (ЗАДЪЛЖИТЕЛНО ДА СЪОБРАЗИШ):
Цел: ${userContext.goal}
Алергии: ${userContext.allergies}
Непоносимости: ${userContext.intolerances}
Медицински състояния: ${userContext.medicalConditions}
Хранителни предпочитания: ${userContext.dietaryPreferences}
Ниво на активност: ${userContext.activityLevel}
Възраст: ${userContext.age} години | Тегло: ${userContext.weight} кг | Височина: ${userContext.height} см | Пол: ${userContext.gender}

ТЕКУЩ ПЛАН (РЕЗЮМЕ):
Калории: ${currentPlan.caloriesMacros?.plan?.calories || 'N/A'}
Протеин: ${currentPlan.caloriesMacros?.plan?.protein_grams || 'N/A'}г
Въглехидрати: ${currentPlan.caloriesMacros?.plan?.carbs_grams || 'N/A'}г
Мазнини: ${currentPlan.caloriesMacros?.plan?.fat_grams || 'N/A'}г

Позволени храни: ${currentPlan.allowedForbiddenFoods?.allowed?.slice(0, 10).join(', ') || 'N/A'}
Забранени храни: ${currentPlan.allowedForbiddenFoods?.forbidden?.slice(0, 10).join(', ') || 'N/A'}

Примерно ястие от понеделник: ${currentPlan.week1Menu?.monday?.[0]?.name || 'N/A'}

ЗАЯВКА ЗА ПРОМЯНА ОТ ПОТРЕБИТЕЛЯ:
${modificationText}

ТВОЯТА ЗАДАЧА:
Генерирай КОНКРЕТНИ ЧАСТИЧНИ промени в плана според заявката. ВАЖНО: Генерирай реално съдържание, не само празни структури!
ФОКУС: Адаптирай съществуващия план, не го преправяй напълно!

КРИТИЧНО ВАЖНО - ВИНАГИ СЪОБРАЗЯВАЙ:
1. АЛЕРГИИ (${userContext.allergies}) - НЕ включвай алергенни храни в новото меню!
2. НЕПОНОСИМОСТИ (${userContext.intolerances}) - НЕ включвай непоносими храни!
3. МЕДИЦИНСКИ СЪСТОЯНИЯ (${userContext.medicalConditions}) - Адаптирай храните според медицинските нужди!
4. ЦЕЛ (${userContext.goal}) - Съобрази промените с целта на потребителя!
5. НИВО НА АКТИВНОСТ (${userContext.activityLevel}) - Калориите и макросите трябва да са подходящи!

Примери за правилен отговор:

1. Ако потребителят иска "повече протеин":
{
  "caloriesMacros": {
    "plan": {
      "protein_grams": ${Math.round((currentPlan.caloriesMacros?.plan?.protein_grams || PLAN_MOD_DEFAULT_PROTEIN_GRAMS) * PLAN_MOD_PROTEIN_MULTIPLIER)}
    }
  },
  "week1Menu": {
    "monday": [
      {
        "name": "Гръцко кисело мляко с протеинов прах",
        "description": "200г кисело мляко, 30г протеинов прах, 1 ч.л. мед",
        "calories": 250,
        "protein": 35,
        "carbs": 20,
        "fat": 5
      },
      ... още 2-3 ястия за деня
    ],
    "tuesday": [ ... подобни ястия ... ]
  }
}

2. Ако потребителят иска "без мляко" (ВАЖНО: Проверявай дали потребителят има алергия към мляко!):
{
  "allowedForbiddenFoods": {
    "forbidden": ${JSON.stringify([...(currentPlan.allowedForbiddenFoods?.forbidden || []), 'мляко', 'млечни продукти', 'сирене', 'кашкавал', 'извара'])}
  },
  "week1Menu": {
    "monday": [
      {
        "name": "Овесена каша с бадемово мляко",
        "description": "50г овесени ядки, 200мл бадемово мляко, банан",
        "calories": 280,
        "protein": 8,
        "carbs": 45,
        "fat": 7
      },
      ... още ястия БЕЗ млечни продукти
    ]
  }
}

3. Ако потребителят иска "повече разнообразие":
{
  "week1Menu": {
    "monday": [ ... 3-4 РАЗЛИЧНИ ястия ... ],
    "tuesday": [ ... 3-4 ДРУГИ ястия ... ],
    "wednesday": [ ... 3-4 ОЩЕ РАЗЛИЧНИ ястия ... ]
  }
}

КРИТИЧНО ВАЖНО:
- Генерирай ПЪЛНИ обекти с реални данни (име, описание, макроси)
- НЕ връщай празни масиви или обекти без съдържание
- Ако променяш week1Menu, можеш да промениш само някои дни (напр. само monday и tuesday)
- Всяко ястие ТРЯБВА да има: name, description, calories, protein, carbs, fat, fiber_grams
- Калориите и макросите трябва да са реалистични и ВСИЧКИ полета попълнени
- Ястията да са на български език
- Фокусирай се върху КОНКРЕТНАТА промяна, която потребителят иска
- Не е нужно да генерираш ВСИЧКИ дни, ако промяната не го изисква
- ЗАДЪЛЖИТЕЛНО ИЗБЯГВАЙ АЛЕРГЕНИТЕ И НЕПОНОСИМИТЕ ХРАНИ!

Отговори САМО с валиден JSON обект без никакви обяснения:`;
        
        console.log(`PLAN_MOD_PARSE_START (${userId}): Calling AI to parse modification: "${modificationText.substring(0, 100)}..."`);
        
        const parsedResponse = await callModelRef.current(
            modelName,
            parsePrompt,
            env,
            { temperature: PLAN_MOD_AI_TEMPERATURE, maxTokens: PLAN_MOD_AI_MAX_TOKENS }
        );

        console.log(`PLAN_MOD_PARSE_RESPONSE (${userId}): AI response length: ${parsedResponse?.length || 0} chars`);

        // Clean and parse the AI response
        const cleanedJson = cleanGeminiJson(parsedResponse);
        const structuredChanges = safeParseJson(cleanedJson, {});

        // Log what changes were parsed
        const changeTypes = Object.keys(structuredChanges).filter(k => k !== 'textDescription');
        console.log(`PLAN_MOD_PARSE_COMPLETE (${userId}): Parsed changes for: ${changeTypes.join(', ') || 'NONE'}`);
        
        // Validate that meaningful changes were generated
        if (changeTypes.length === 0 || Object.keys(structuredChanges).every(k => !structuredChanges[k])) {
            console.warn(`PLAN_MOD_PARSE_WARN (${userId}): AI returned empty or invalid changes`);
        }

        return {
            textDescription: modificationText,
            ...structuredChanges
        };

    } catch (error) {
        console.error(`PLAN_MOD_PARSE_ERROR (${userId}): ${error.message}\n${error.stack}`);
        // Return the raw text as fallback
        return {
            textDescription: modificationText,
            structuredChanges: {}
        };
    }
}
// ------------- END FUNCTION: parsePlanModificationRequest -------------

// ------------- START FUNCTION: resetAiPresetIndexCache -------------
function resetAiPresetIndexCache() {
    aiPresetIndexCache = null;
    aiPresetIndexCacheTime = 0;
}
// ------------- END FUNCTION: resetAiPresetIndexCache -------------

// ------------- START BLOCK: kv list telemetry -------------
const KV_LIST_TELEMETRY_INTERVAL_MS = 15 * 60 * 1000;

function _withKvListCounting(env) {
    const wrappedEnv = { ...env };
    wrappedEnv.__kvListCounts = {};
    wrappedEnv.__kvListLastSent = 0;
    for (const [name, ns] of Object.entries(env)) {
        if (ns && typeof ns.list === 'function') {
            wrappedEnv.__kvListCounts[name] = 0;
            const originalList = ns.list.bind(ns);
            wrappedEnv[name] = {
                ...ns,
                async list(...args) {
                    wrappedEnv.__kvListCounts[name]++;
                    return originalList(...args);
                }
            };
        }
    }
    return wrappedEnv;
}

async function _maybeSendKvListTelemetry(env) {
    if (!env.MONITORING_ENDPOINT || !env.__kvListCounts) return;
    const now = Date.now();
    if (env.__kvListLastSent && now - env.__kvListLastSent < KV_LIST_TELEMETRY_INTERVAL_MS) return;
    env.__kvListLastSent = now;
    try {
        await fetch(env.MONITORING_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kv_list_counts: env.__kvListCounts })
        });
    } catch (err) {
        console.error('kv list telemetry send failed', err);
    }
    for (const k of Object.keys(env.__kvListCounts)) {
        env.__kvListCounts[k] = 0;
    }
}
// ------------- END BLOCK: kv list telemetry -------------
// ------------- INSERTION POINT: EndOfFile -------------
export { processSingleUserPlan, handleLogExtraMealRequest, handleGetProfileRequest, handleGetPsychTestsRequest, handleUpdateProfileRequest, handleUpdatePlanRequest, handleSavePsychTestsRequest, handleRegeneratePlanRequest, handleCheckPlanPrerequisitesRequest, handleRequestPasswordReset, handlePerformPasswordReset, shouldTriggerAutomatedFeedbackChat, processPendingUserEvents, handleDashboardDataRequest, handleRecordFeedbackChatRequest, handleSubmitFeedbackRequest, handleGetAchievementsRequest, handleGeneratePraiseRequest, handleAnalyzeInitialAnswers, handleGetInitialAnalysisRequest, handleReAnalyzeQuestionnaireRequest, handleAnalysisStatusRequest, createUserEvent, handleUploadTestResult, handleUploadIrisDiag, handleAiHelperRequest, handleAnalyzeImageRequest, handleRunImageModelRequest, handleListClientsRequest, handlePeekAdminNotificationsRequest, handleDeleteClientRequest, handleAddAdminQueryRequest, handleGetAdminQueriesRequest, handleAddClientReplyRequest, handleGetClientRepliesRequest, handleGetFeedbackMessagesRequest, handleGetPlanModificationPrompt, handleGetAiConfig, handleSetAiConfig, handleListAiPresets, handleGetAiPreset, handleSaveAiPreset, handleDeleteAiPreset, handleTestAiModelRequest, handleContactFormRequest, handleGetContactRequestsRequest, handleValidateIndexesRequest, handleSendTestEmailRequest, handleGetMaintenanceMode, handleSetMaintenanceMode, handleRegisterRequest, handleRegisterDemoRequest, handleLoginRequest, handleSubmitQuestionnaire, handleSubmitDemoQuestionnaire, callCfAi, callModel, callModelWithTimeout, setCallModelImplementation, callGeminiAPI, callGeminiVisionAPI, handlePrincipleAdjustment, createFallbackPrincipleSummary, createPlanUpdateSummary, createUserConcernsSummary, evaluatePlanChange, handleChatRequest, populatePrompt, createPraiseReplacements, buildCfImagePayload, sendAnalysisLinkEmail, sendContactEmail, getEmailConfig, getUserLogDates, calculateAnalyticsIndexes, handleListUserKvRequest, rebuildUserKvIndex, handleUpdateKvRequest, handleSubmitPlanChangeRequest, handleProposePlanChangeRequest, handleApprovePlanChangeRequest, handleGetPendingPlanChangesRequest, handleRejectPlanChangeRequest, handleNutrientLookupRequest, applyPlanChanges, parsePlanModificationRequest, handleLogRequest, handlePlanLogRequest, setPlanStatus, resetAiPresetIndexCache, _withKvListCounting, _maybeSendKvListTelemetry, getMaxChatHistoryMessages, summarizeAndTrimChatHistory, getCachedResource, clearResourceCache, buildDeterministicAnalyticsSummary, AI_CALL_TIMEOUT_MS, DEFAULT_PLAN_CALL_TIMEOUT_MS, resolvePlanCallTimeoutMs };
