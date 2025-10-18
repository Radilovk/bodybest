import { jest } from '@jest/globals';

const workerModule = await import('../worker.js');

const callModelMock = jest.fn();

const minimalUnifiedPlanTemplate = JSON.stringify({
  profileSummary: 'Профил за %%USER_NAME%%',
  caloriesMacros: {
    calories: 'number (%%TARGET_CALORIES%%)',
    protein_percent: 'number (%%TARGET_PROTEIN_P%%)',
    carbs_percent: 'number (%%TARGET_CARBS_P%%)',
    fat_percent: 'number (%%TARGET_FAT_P%%)',
    fiber_percent: 'number (%%TARGET_FIBER_P%%)',
    protein_grams: 'number (%%TARGET_PROTEIN_G%%)',
    carbs_grams: 'number (%%TARGET_CARBS_G%%)',
    fat_grams: 'number (%%TARGET_FAT_G%%)',
    fiber_grams: 'number (%%TARGET_FIBER_G%%)'
  },
  week1Menu: { monday: [] },
  principlesWeek2_4: ['- Баланс'],
  detailedTargets: { hydration: '2L вода' }
});

const successfulPlanResponse = JSON.stringify({
  profileSummary: 'Обобщение',
  caloriesMacros: {
    calories: 2100,
    protein_grams: 140,
    carbs_grams: 210,
    fat_grams: 70,
    fiber_grams: 30,
    protein_percent: 27,
    carbs_percent: 40,
    fat_percent: 30,
    fiber_percent: 6
  },
  week1Menu: {
    monday: [
      {
        meal_name: 'Закуска',
        items: [{ name: 'Овесена каша', portion: '1 купа' }]
      }
    ]
  },
  principlesWeek2_4: ['- Поддържайте хидратация'],
  detailedTargets: { hydration: '2L вода' },
  generationMetadata: { errors: [] }
});

const alignedAnalysisMacrosRecord = {
  status: 'final',
  data: {
    calories: 2100,
    protein_grams: 140,
    carbs_grams: 210,
    fat_grams: 70,
    fiber_grams: 30,
    protein_percent: 27,
    carbs_percent: 40,
    fat_percent: 30,
    fiber_percent: 6
  }
};

const expectedTargetMacros = {
  calories: 2430,
  protein_grams: 182,
  protein_percent: 30,
  carbs_grams: 243,
  carbs_percent: 40,
  fat_grams: 81,
  fat_percent: 30,
  fiber_grams: 25,
  fiber_percent: 2
};

const fallbackPlanResponse = JSON.stringify({
  profileSummary: 'Обобщение',
  week1Menu: {
    monday: [
      {
        meal_name: 'Закуска',
        macros: {
          calories: 500,
          protein_grams: 30,
          carbs_grams: 50,
          fat_grams: 15,
          fiber_grams: 8
        }
      },
      {
        meal_name: 'Обяд',
        macros: {
          calories: 600,
          protein_grams: 35,
          carbs_grams: 60,
          fat_grams: 20,
          fiber_grams: 7
        }
      }
    ]
  },
  mealMacrosIndex: {},
  principlesWeek2_4: ['- Баланс'],
  detailedTargets: { hydration: '2L вода' },
  generationMetadata: { errors: [] }
});

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
  q1745877358368: ['бягане'],
  q1745878063775: '3 пъти седмично',
  q1745890775342: '45 минути',
  q1745878295708: 'Умерена',
  stressLevel: 'Средно',
  sleepHours: 7,
  sleepInterrupt: 'Не',
  mainChallenge: 'Постоянство',
  lossKg: 5,
  q1745806494081: 'Брюкселско зеле',
  submissionDate: '2024-01-01T00:00:00.000Z'
};

function buildTestEnvironment(
  userId,
  {
    failFirstFlush = false,
    initialAnswers = baseInitialAnswers,
    previousPlan = {
      caloriesMacros: alignedAnalysisMacrosRecord.data,
      principlesWeek2_4: ['- Стар принцип']
    },
    analysisMacrosRecord = alignedAnalysisMacrosRecord,
    aggregatedLogs = []
  } = {}
) {
  const kvStore = new Map();
  const logKey = `${userId}_plan_log`;
  const logErrorKey = `${logKey}_flush_error`;
  let flushFailureTriggered = false;

  const userMetadataKv = {
    get: jest.fn(async (key) => {
      if (kvStore.has(key)) {
        return kvStore.get(key);
      }
      if (key === `${userId}_initial_answers`) {
        return JSON.stringify(initialAnswers);
      }
      if (key === `${userId}_final_plan`) {
        return previousPlan ? JSON.stringify(previousPlan) : null;
      }
      if (key === `${userId}_analysis_macros`) {
        if (analysisMacrosRecord === undefined) {
          return null;
        }
        return analysisMacrosRecord ? JSON.stringify(analysisMacrosRecord) : null;
      }
      if (key === `${userId}_current_status`) {
        return JSON.stringify({ weight: 80 });
      }
      if (key === `${userId}_logs` || key.startsWith(`${userId}_log_`)) {
        return JSON.stringify(aggregatedLogs);
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
      if (
        failFirstFlush &&
        key === logKey &&
        value !== JSON.stringify([]) &&
        !flushFailureTriggered
      ) {
        flushFailureTriggered = true;
        throw new Error('Simulated flush failure');
      }
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

  return { env, kvStore, userMetadataKv, resourcesKv, logKey, logErrorKey };
}

describe('processSingleUserPlan - буфериран лог', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    callModelMock.mockReset();
    workerModule.setCallModelImplementation(callModelMock);
  });

  afterEach(() => {
    workerModule.setCallModelImplementation();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('генерира план и записва ключовите стъпки в логовете', async () => {
    const userId = 'test-user';
    const { env, kvStore, logKey } = buildTestEnvironment(userId);
    callModelMock.mockResolvedValue(successfulPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const storedLog = kvStore.get(logKey);
    expect(storedLog).toBeTruthy();
    expect(storedLog).toContain('Старт');
    const finalLogEntries = JSON.parse(storedLog);
    expect(Array.isArray(finalLogEntries)).toBe(true);
    expect(finalLogEntries[0]).toContain('Старт');

    const finalMessages = finalLogEntries.map((entry) => entry.replace(/^\[[^\]]+\]\s*/, ''));

    const expectedSteps = [
      'Старт на генериране на плана',
      'Зареждане на изходни данни',
      'Подготовка на модела',
      'Извикване на AI модела',
      'Планът е генериран',
      'Запис на генерирания план',
      'Планът е готов',
      'Процесът приключи'
    ];

    let lastIndex = -1;
    for (const step of expectedSteps) {
      const foundIndex = finalMessages.findIndex((msg, idx) => idx > lastIndex && msg.includes(step));
      expect(foundIndex).toBeGreaterThan(lastIndex);
      lastIndex = foundIndex;
    }

    expect(callModelMock).toHaveBeenCalledWith(
      'gpt-plan',
      expect.any(String),
      env,
      expect.any(Object)
    );
  });

  test('запазва критична грешка при първи неуспешен flush и я почиства след повторен успех', async () => {
    const userId = 'flush-failure-user';
    const { env, kvStore, logKey, logErrorKey, userMetadataKv } = buildTestEnvironment(
      userId,
      { failFirstFlush: true }
    );
    callModelMock.mockResolvedValue(successfulPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const flushErrorPutCall = userMetadataKv.put.mock.calls.find(([key]) => key === logErrorKey);
    expect(flushErrorPutCall).toBeTruthy();
    const flushErrorPayload = JSON.parse(flushErrorPutCall[1]);
    expect(flushErrorPayload.message).toBe('Simulated flush failure');

    expect(userMetadataKv.delete).toHaveBeenCalledWith(logErrorKey);
    expect(kvStore.has(logErrorKey)).toBe(false);

    const finalLogEntries = JSON.parse(kvStore.get(logKey));
    const finalMessages = finalLogEntries.map((entry) => entry.replace(/^\[[^\]]+\]\s*/, ''));

    const expectedSteps = [
      'Старт на генериране на плана',
      'Зареждане на изходни данни',
      'Подготовка на модела',
      'Извикване на AI модела',
      'Планът е генериран',
      'Запис на генерирания план',
      'Планът е готов',
      'Процесът приключи'
    ];

    for (const step of expectedSteps) {
      expect(finalMessages.some((msg) => msg.includes(step))).toBe(true);
    }

    const flushFailureLogLine = finalMessages.find((msg) => msg.includes('Неуспешен запис на лог'));
    expect(flushFailureLogLine).toContain('Simulated flush failure');

    expect(callModelMock).toHaveBeenCalledWith(
      'gpt-plan',
      expect.any(String),
      env,
      expect.any(Object)
    );
  });
});

describe('processSingleUserPlan - макро валидации', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    callModelMock.mockReset();
    workerModule.setCallModelImplementation(callModelMock);
  });

  afterEach(() => {
    workerModule.setCallModelImplementation();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('инжектира таргетите в промпта и заменя несъответстващи макроси', async () => {
    const userId = 'macros-target-align';
    const { env, kvStore } = buildTestEnvironment(userId, {
      analysisMacrosRecord: null,
      previousPlan: null
    });
    callModelMock.mockResolvedValue(successfulPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const prompt = callModelMock.mock.calls[0][1];
    expect(prompt).not.toContain('%%TARGET_');
    expect(prompt).toContain('"calories":"number (2430)"');
    expect(prompt).toContain('"protein_grams":"number (182)"');
    expect(prompt).toContain('"fiber_grams":"number (25)"');

    const finalPlan = JSON.parse(kvStore.get(`${userId}_final_plan`));
    expect(finalPlan.caloriesMacros).toEqual(expectedTargetMacros);
    expect(finalPlan.generationMetadata.targetSource).toBe('estimate');
    expect(finalPlan.generationMetadata.targetUsedDefaultFiber).toBe(true);
    expect(finalPlan.generationMetadata.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('AI върна различни caloriesMacros')
      ])
    );
    expect(finalPlan.generationMetadata.aiReportedMacros).toEqual({
      calories: 2100,
      protein_grams: 140,
      carbs_grams: 210,
      fat_grams: 70,
      fiber_grams: 30,
      protein_percent: 27,
      carbs_percent: 40,
      fat_percent: 30,
      fiber_percent: 6
    });

    const macrosRecord = JSON.parse(kvStore.get(`${userId}_analysis_macros`));
    expect(macrosRecord).toEqual({ status: 'final', data: expectedTargetMacros });
  });

  test('пресмята макросите от менюто и дневниците при липса на таргети', async () => {
    const userId = 'macros-fallback-user';
    const fallbackInitialAnswers = {
      ...baseInitialAnswers,
      weight: null,
      height: null,
      age: null
    };
    const aggregatedLogs = [
      {
        date: '2024-01-01',
        extraMeals: [
          { calories: 250, protein: 12, carbs: 30, fat: 8, fiber: 4 }
        ]
      }
    ];
    const { env, kvStore } = buildTestEnvironment(userId, {
      initialAnswers: fallbackInitialAnswers,
      previousPlan: null,
      analysisMacrosRecord: null,
      aggregatedLogs
    });
    callModelMock.mockResolvedValue(fallbackPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const prompt = callModelMock.mock.calls[0][1];
    expect(prompt).not.toContain('%%TARGET_');
    expect(prompt).toMatch(/"calories":"number \(0\)"/);

    const finalPlan = JSON.parse(kvStore.get(`${userId}_final_plan`));
    expect(finalPlan.caloriesMacros).toEqual({
      calories: 1350,
      protein_grams: 77,
      protein_percent: 23,
      carbs_grams: 140,
      carbs_percent: 41,
      fat_grams: 43,
      fat_percent: 29,
      fiber_grams: 19,
      fiber_percent: 3
    });
    expect(finalPlan.generationMetadata.targetSource).toBeNull();
    expect(finalPlan.generationMetadata.errors).toEqual(
      expect.arrayContaining([
        'Не успяхме да определим целеви макроси; placeholders за промпта са 0.',
        'AI не върна caloriesMacros; попълнихме ги от менюто и дневниците.'
      ])
    );
    expect(finalPlan.generationMetadata.calculatedMacros).toEqual({
      planAverage: {
        calories: 1100,
        protein_grams: 65,
        protein_percent: 24,
        carbs_grams: 110,
        carbs_percent: 40,
        fat_grams: 35,
        fat_percent: 29,
        fiber_grams: 15,
        fiber_percent: 3
      },
      extraMealsAverage: {
        calories: 250,
        protein_grams: 12,
        protein_percent: 19,
        carbs_grams: 30,
        carbs_percent: 48,
        fat_grams: 8,
        fat_percent: 29,
        fiber_grams: 4,
        fiber_percent: 3
      }
    });
    expect(finalPlan.generationMetadata.aiReportedMacros).toBeUndefined();

    const macrosRecord = JSON.parse(kvStore.get(`${userId}_analysis_macros`));
    expect(macrosRecord).toEqual({ status: 'final', data: finalPlan.caloriesMacros });
  });
});
