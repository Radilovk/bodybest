import { jest } from '@jest/globals';

const workerModule = await import('../worker.js');

const callModelMock = jest.fn();

const baseInitialAnswers = {
  name: 'Иван',
  email: 'ivan@example.com',
  goal: 'Подобряване на формата',
  weight: 82,
  height: 178,
  gender: 'мъж',
  age: 34,
  medicalConditions: ['нямам'],
  physicalActivity: 'Да',
  regularActivityTypes: ['бягане'],
  q1745877358368: ['бягане'],
  weeklyActivityFrequency: '3 пъти седмично',
  q1745878063775: '3 пъти седмично',
  activityDuration: '45 минути',
  q1745890775342: '45 минути',
  dailyActivityLevel: 'Умерена',
  q1745878295708: 'Умерена',
  stressLevel: 'Средно',
  sleepHours: 7,
  sleepInterrupt: 'Не',
  mainChallenge: 'Постоянство',
  lossKg: 5,
  foodPreferenceDisliked: 'Брюкселско зеле',
  q1745806494081: 'Брюкселско зеле',
  submissionDate: '2024-01-01T00:00:00.000Z'
};

const mockAnalysisMacros = {
  calories: 1900,
  protein_grams: 145,
  protein_percent: 30,
  carbs_grams: 215,
  carbs_percent: 45,
  fat_grams: 60,
  fat_percent: 25,
  fiber_grams: 28,
  fiber_percent: 6
};

const mockPsychoProfile = {
  dominantPsychoProfile: 'Емоционален профил',
  psychoProfileConcepts: ['Mindful Eating', 'Self-Awareness']
};

const minimalUnifiedPlanTemplate = [
  'План за %%USER_NAME%% (%%USER_ID%%)',
  'JSON шаблон: %%USER_ANSWERS_JSON%%'
].join('\n');

function buildTestEnvironment(userId) {
  const kvStore = new Map();
  const logKey = `${userId}_plan_log`;

  kvStore.set(`${userId}_analysis_macros`, JSON.stringify({ status: 'final', data: mockAnalysisMacros }));
  kvStore.set(`${userId}_analysis`, JSON.stringify(mockPsychoProfile));

  const userMetadataKv = {
    get: jest.fn(async (key) => {
      if (kvStore.has(key)) {
        return kvStore.get(key);
      }
      if (key === `${userId}_initial_answers`) {
        return JSON.stringify(baseInitialAnswers);
      }
      if (key === `${userId}_final_plan`) {
        return JSON.stringify({
          caloriesMacros: { calories: 2000 },
          principlesWeek2_4: ['- Стар принцип']
        });
      }
      if (key === `${userId}_current_status`) {
        return JSON.stringify({ weight: 80 });
      }
      if (key === `${userId}_logs` || key.startsWith(`${userId}_log_`)) {
        return JSON.stringify([]);
      }
      if (key === `${userId}_chat_history`) {
        return JSON.stringify([]);
      }
      if (key === `pending_plan_users` || key === `ready_plan_users`) {
        return kvStore.get(key) ?? JSON.stringify([]);
      }
      if (key === logKey) {
        return kvStore.get(key) ?? null;
      }
      return null;
    }),
    put: jest.fn(async (key, value) => {
      kvStore.set(key, value);
    }),
    delete: jest.fn(async (key) => {
      kvStore.delete(key);
    }),
    list: jest.fn(async () => ({ keys: [], list_complete: true }))
  };

  const resourcesKv = {
    get: jest.fn(async (key) => {
      switch (key) {
        case 'question_definitions':
          return JSON.stringify([
            { id: 'goal', text: 'Каква е целта Ви?' },
            { id: 'medicalConditions', text: 'Медицински състояния' }
          ]);
        case 'base_diet_model':
        case 'allowed_meal_combinations':
        case 'eating_psychology':
          return '';
        case 'recipe_data':
          return JSON.stringify({});
        case 'model_plan_generation':
          return 'gpt-plan';
        case 'prompt_unified_plan_generation_v2':
          return minimalUnifiedPlanTemplate;
        default:
          return null;
      }
    })
  };

  const env = {
    USER_METADATA_KV: userMetadataKv,
    RESOURCES_KV: resourcesKv,
    OPENAI_API_KEY: 'test-openai-key'
  };

  return { env, kvStore, userMetadataKv, logKey };
}

// Helper to create full valid week1Menu with all 7 days
function createFullWeek1Menu() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const menu = {};
  days.forEach(day => {
    menu[day] = [
      {
        meal_name: 'Закуска',
        items: [{ name: 'Овесена каша', portion: '1 купа' }],
        macros: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        }
      }
    ];
  });
  return menu;
}

// Helper to create partial week1Menu (missing some days)
function createPartialWeek1Menu(includedDays) {
  const menu = {};
  includedDays.forEach(day => {
    menu[day] = [
      {
        meal_name: 'Закуска',
        items: [{ name: 'Овесена каша', portion: '1 купа' }],
        macros: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        }
      }
    ];
  });
  return menu;
}

describe('week1Menu validation - strict 7-day requirement', () => {
  let originalFetch;

  beforeAll(() => {
    workerModule.setCallModelImplementation(callModelMock);
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    callModelMock.mockClear();
  });

  test('отхвърля план с непълно седмично меню (4/7 дни)', async () => {
    const userId = 'partial-menu-user';
    const { env, kvStore, logKey } = buildTestEnvironment(userId);

    // Initial response with only 4 days
    const partialMenuResponse = JSON.stringify({
      profileSummary: 'Обобщение',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 130,
        carbs_grams: 210,
        fat_grams: 70,
        fiber_percent: 10,
        fiber_grams: 28
      },
      week1Menu: createPartialWeek1Menu(['monday', 'tuesday', 'wednesday', 'thursday']),
      mealMacrosIndex: {
        monday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 }
      },
      principlesWeek2_4: ['- Баланс'],
      allowedForbiddenFoods: {
        main_allowed_foods: ['Пилешко филе'],
        main_forbidden_foods: []
      },
      hydrationCookingSupplements: {
        hydration_recommendations: { daily_liters: 2.5 }
      },
      psychologicalGuidance: {
        coping_strategies: ['Стратегия 1']
      },
      detailedTargets: { hydration: '2L вода' },
      additionalGuidelines: ['Съвет 1']
    });

    // Repair response with complete week and mealMacrosIndex
    const completeMenuResponse = JSON.stringify({
      week1Menu: createFullWeek1Menu(),
      mealMacrosIndex: {
        monday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 },
        tuesday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 }
      }
    });

    callModelMock
      .mockResolvedValueOnce(partialMenuResponse) // Initial call
      .mockResolvedValueOnce(completeMenuResponse); // Repair call

    const result = await workerModule.processSingleUserPlan(userId, env);

    // Should trigger repair because week1Menu is incomplete (missing friday, saturday, sunday)
    // This means at least 2 calls (initial + at least 1 repair)
    expect(callModelMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('приема план със всички 7 дни в седмичното меню', async () => {
    const userId = 'full-menu-user';
    const { env, kvStore, logKey } = buildTestEnvironment(userId);

    const fullMenuResponse = JSON.stringify({
      profileSummary: 'Обобщение',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 130,
        carbs_grams: 210,
        fat_grams: 70,
        fiber_percent: 10,
        fiber_grams: 28
      },
      week1Menu: createFullWeek1Menu(),
      mealMacrosIndex: {
        monday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        },
        tuesday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        },
        wednesday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        },
        thursday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        },
        friday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        },
        saturday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        },
        sunday_0: {
          calories: 300,
          protein_grams: 10,
          carbs_grams: 40,
          fat_grams: 8,
          fiber_grams: 5
        }
      },
      principlesWeek2_4: ['- Баланс'],
      allowedForbiddenFoods: {
        main_allowed_foods: ['Пилешко филе'],
        main_forbidden_foods: []
      },
      hydrationCookingSupplements: {
        hydration_recommendations: { daily_liters: 2.5 }
      },
      psychologicalGuidance: {
        coping_strategies: ['Стратегия 1']
      },
      detailedTargets: { hydration: '2L вода' },
      additionalGuidelines: ['Съвет 1']
    });

    callModelMock.mockResolvedValueOnce(fullMenuResponse);

    const result = await workerModule.processSingleUserPlan(userId, env);

    // Should NOT trigger repair - only one call needed
    expect(callModelMock).toHaveBeenCalledTimes(1);
    
    // Log should NOT contain warning about missing days
    const logData = JSON.parse(kvStore.get(logKey) || '[]');
    const logMessages = logData.map(entry => entry.message).join(' ');
    expect(logMessages).not.toMatch(/Липсващи дни в week1Menu/);
  });

  test('отхвърля план с празни масиви за някои дни', async () => {
    const userId = 'empty-days-user';
    const { env, kvStore, logKey } = buildTestEnvironment(userId);

    const menuWithEmptyDays = createFullWeek1Menu();
    menuWithEmptyDays.friday = []; // Empty array for Friday
    menuWithEmptyDays.saturday = []; // Empty array for Saturday

    const partialMenuResponse = JSON.stringify({
      profileSummary: 'Обобщение',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 130,
        carbs_grams: 210,
        fat_grams: 70,
        fiber_percent: 10,
        fiber_grams: 28
      },
      week1Menu: menuWithEmptyDays,
      mealMacrosIndex: {
        monday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 }
      },
      principlesWeek2_4: ['- Баланс'],
      allowedForbiddenFoods: {
        main_allowed_foods: ['Пилешко филе'],
        main_forbidden_foods: []
      },
      hydrationCookingSupplements: {
        hydration_recommendations: { daily_liters: 2.5 }
      },
      psychologicalGuidance: {
        coping_strategies: ['Стратегия 1']
      },
      detailedTargets: { hydration: '2L вода' },
      additionalGuidelines: ['Съвет 1']
    });

    const completeMenuResponse = JSON.stringify({
      week1Menu: createFullWeek1Menu(),
      mealMacrosIndex: {
        friday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 },
        saturday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 }
      }
    });

    callModelMock
      .mockResolvedValueOnce(partialMenuResponse)
      .mockResolvedValueOnce(completeMenuResponse);

    const result = await workerModule.processSingleUserPlan(userId, env);

    // Should trigger repair because friday and saturday are empty
    expect(callModelMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('отхвърля план когато липсва цял ден (не е дефиниран)', async () => {
    const userId = 'missing-day-user';
    const { env } = buildTestEnvironment(userId);

    const incompleteMenu = createFullWeek1Menu();
    delete incompleteMenu.sunday; // Remove Sunday completely

    const partialMenuResponse = JSON.stringify({
      profileSummary: 'Обобщение',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 130,
        carbs_grams: 210,
        fat_grams: 70,
        fiber_percent: 10,
        fiber_grams: 28
      },
      week1Menu: incompleteMenu,
      mealMacrosIndex: {
        monday_0: { calories: 300, protein_grams: 10, carbs_grams: 40, fat_grams: 8, fiber_grams: 5 }
      },
      principlesWeek2_4: ['- Баланс'],
      allowedForbiddenFoods: {
        main_allowed_foods: ['Пилешко филе'],
        main_forbidden_foods: []
      },
      hydrationCookingSupplements: {
        hydration_recommendations: { daily_liters: 2.5 }
      },
      psychologicalGuidance: {
        coping_strategies: ['Стратегия 1']
      },
      detailedTargets: { hydration: '2L вода' },
      additionalGuidelines: ['Съвет 1']
    });

    const completeMenuResponse = JSON.stringify({
      week1Menu: createFullWeek1Menu()
    });

    callModelMock
      .mockResolvedValueOnce(partialMenuResponse)
      .mockResolvedValueOnce(completeMenuResponse);

    const result = await workerModule.processSingleUserPlan(userId, env);

    // Should trigger repair because sunday is missing
    expect(callModelMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
