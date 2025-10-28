import { jest } from '@jest/globals';

const workerModule = await import('../worker.js');

const callModelMock = jest.fn();

const minimalUnifiedPlanTemplate = [
  'План за %%USER_NAME%% (%%USER_ID%%)',
  'Цели: калории %%TARGET_CALORIES%%, протеин %%TARGET_PROTEIN_GRAMS%% г (%%TARGET_PROTEIN_PERCENT%%%); ',
  'въглехидрати %%TARGET_CARBS_GRAMS%% г (%%TARGET_CARBS_PERCENT%%%); ',
  'мазнини %%TARGET_FAT_GRAMS%% г (%%TARGET_FAT_PERCENT%%%); ',
  'фибри %%TARGET_FIBER_GRAMS%% г (%%TARGET_FIBER_PERCENT%%% ).',
  'Психопрофил: %%DOMINANT_PSYCHO_PROFILE%% / %%PSYCHO_PROFILE_CONCEPTS%%.',
  'JSON шаблон: %%USER_ANSWERS_JSON%%'
].join('\n');

const successfulPlanResponse = JSON.stringify({
  profileSummary: 'Обобщение',
  caloriesMacros: {
    calories: 2100,
    protein_grams: 140,
    carbs_grams: 210,
    fat_grams: 70,
    fiber_percent: 10,
    fiber_grams: 30
  },
  week1Menu: {
    monday: [
      {
        meal_name: 'Закуска',
        items: [{ name: 'Овесена каша', portion: '1 купа' }],
        macros: {
          calories: 420,
          protein_grams: 25,
          carbs_grams: 55,
          fat_grams: 12,
          fiber_grams: 8
        }
      }
    ]
  },
  principlesWeek2_4: ['- Поддържайте хидратация'],
  detailedTargets: { hydration: '2L вода' },
  generationMetadata: { errors: [] },
  mealMacrosIndex: {
    monday_0: {
      calories: 420,
      protein_grams: 25,
      carbs_grams: 55,
      fat_grams: 12,
      fiber_grams: 8
    }
  }
});

const missingMacrosPlanResponse = JSON.stringify({
  profileSummary: 'Обобщение',
  caloriesMacros: {
    calories: 2100,
    protein_grams: 140,
    carbs_grams: 210,
    fat_grams: 70,
    fiber_percent: 10,
    fiber_grams: 30
  },
  week1Menu: {
    monday: [
      {
        meal_name: 'Закуска',
        items: [{ name: 'Овесена каша', portion: '1 купа' }],
        macros: {}
      }
    ]
  },
  principlesWeek2_4: ['- Поддържайте хидратация'],
  detailedTargets: { hydration: '2L вода' },
  generationMetadata: { errors: [] },
  mealMacrosIndex: {
    monday_0: {}
  }
});

const repairedMacrosResponse = JSON.stringify({
  week1Menu: {
    monday: [
      {
        macros: {
          calories: 430,
          protein_grams: 28,
          carbs_grams: 52,
          fat_grams: 14,
          fiber_grams: 9
        }
      }
    ]
  },
  mealMacrosIndex: {
    monday_0: {
      calories: 430,
      protein_grams: 28,
      carbs_grams: 52,
      fat_grams: 14,
      fiber_grams: 9
    }
  }
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

function buildTestEnvironment(userId, { failFirstFlush = false, analysisMacrosData = null, psychoProfileData = null } = {}) {
  const kvStore = new Map();
  const logKey = `${userId}_plan_log`;
  const logErrorKey = `${logKey}_flush_error`;
  let flushFailureTriggered = false;

  if (analysisMacrosData) {
    kvStore.set(
      `${userId}_analysis_macros`,
      JSON.stringify({ status: 'final', data: analysisMacrosData })
    );
  }
  if (psychoProfileData) {
    kvStore.set(`${userId}_analysis`, JSON.stringify(psychoProfileData));
  }

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
    const { env, kvStore, logKey } = buildTestEnvironment(userId, {
      analysisMacrosData: mockAnalysisMacros,
      psychoProfileData: mockPsychoProfile
    });
    callModelMock.mockResolvedValue(successfulPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const storedLog = kvStore.get(logKey);
    expect(storedLog).toBeTruthy();
    const finalLogEntries = JSON.parse(storedLog);
    expect(Array.isArray(finalLogEntries)).toBe(true);

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

    const promptArgument = callModelMock.mock.calls[0][1];
    expect(promptArgument).toContain('1900');
    expect(promptArgument).toContain('145');
    expect(promptArgument).toContain('30%');
    expect(promptArgument).toContain('45%');
    expect(promptArgument).toContain('25%');
    expect(promptArgument).toContain('28 г');
    expect(promptArgument).toContain('Емоционален профил');
    expect(promptArgument).toContain('Mindful Eating');
    expect(promptArgument).toContain('"goal":"Подобряване на формата"');
    expect(promptArgument).not.toContain('%%TARGET_CALORIES%%');
    expect(promptArgument).not.toMatch(/%%TARGET_[A-Z_]+%%/);
    expect(promptArgument).not.toContain('%%TARGET_PROTEIN_G%%');
    expect(promptArgument).not.toContain('%%TARGET_PROTEIN_P%%');
    expect(promptArgument).not.toContain('%%DOMINANT_PSYCHO_PROFILE%%');
    expect(promptArgument).not.toContain('%%USER_ANSWERS_JSON%%');
  });

  test('запазва критична грешка при първи неуспешен flush и я почиства след повторен успех', async () => {
    const userId = 'flush-failure-user';
    const { env, kvStore, logKey, logErrorKey, userMetadataKv } = buildTestEnvironment(
      userId,
      { failFirstFlush: true, analysisMacrosData: mockAnalysisMacros, psychoProfileData: mockPsychoProfile }
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

  test('повторно извикване при празни макроси попълва стойностите преди запис', async () => {
    const userId = 'missing-macros-user';
    const { env, kvStore } = buildTestEnvironment(userId);

    callModelMock
      .mockResolvedValueOnce(missingMacrosPlanResponse)
      .mockResolvedValueOnce(repairedMacrosResponse);

    await workerModule.processSingleUserPlan(userId, env);

    expect(callModelMock).toHaveBeenCalledTimes(2);
    const secondPrompt = callModelMock.mock.calls[1][1];
    expect(secondPrompt).toContain('fully populated mealMacrosIndex');

    const storedPlanRaw = kvStore.get(`${userId}_final_plan`);
    expect(storedPlanRaw).toBeTruthy();
    const storedPlan = JSON.parse(storedPlanRaw);

    const mealMacros = storedPlan.week1Menu.monday[0].macros;
    expect(mealMacros).toMatchObject({
      calories: 430,
      protein_grams: 28,
      carbs_grams: 52,
      fat_grams: 14,
      fiber_grams: 9
    });
    expect(storedPlan.mealMacrosIndex.monday_0).toMatchObject({
      calories: 430,
      protein_grams: 28,
      carbs_grams: 52,
      fat_grams: 14,
      fiber_grams: 9
    });
  });
});

describe('processSingleUserPlan - caloriesMacros fallback', () => {
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

  test('попълва caloriesMacros чрез преизчисление от менюто', async () => {
    const userId = 'macros-fallback-user';
    const { env, kvStore, logKey } = buildTestEnvironment(userId);
    callModelMock.mockResolvedValue(
      JSON.stringify({
        profileSummary: 'Обобщение',
        caloriesMacros: null,
        week1Menu: {
          monday: [
            {
              macros: {
                calories: '480 kcal',
                protein_grams: '30 г',
                carbs_grams: '40 г',
                fat_grams: '20 г',
                fiber_grams: '10 г'
              }
            },
            { meal_name: 'Обяд без макроси' }
          ]
        },
        mealMacrosIndex: {
          monday_1: {
            calories: '360 kcal',
            protein_grams: '25',
            carbs_grams: '30',
            fat_grams: '12',
            fiber_grams: '8'
          }
        },
        principlesWeek2_4: ['- Баланс'],
        detailedTargets: { hydration: '2L вода' },
        generationMetadata: { errors: [] }
      })
    );

    await workerModule.processSingleUserPlan(userId, env);

    const finalPlan = JSON.parse(kvStore.get(`${userId}_final_plan`));
    expect(finalPlan.caloriesMacros).toEqual({
      calories: 824,
      protein_grams: 55,
      protein_percent: 27,
      carbs_grams: 70,
      carbs_percent: 34,
      fat_grams: 32,
      fat_percent: 35,
      fiber_grams: 18,
      fiber_percent: 4
    });
    expect(kvStore.get(`plan_status_${userId}`)).toBe('ready');
    expect(finalPlan.generationMetadata.errors).toEqual([]);

    const analysisMacros = JSON.parse(kvStore.get(`${userId}_analysis_macros`));
    expect(analysisMacros).toEqual({ status: 'final', data: finalPlan.caloriesMacros });

    const storedLog = JSON.parse(kvStore.get(logKey));
    expect(storedLog.some((entry) => entry.includes('AI не върна пълни caloriesMacros'))).toBe(true);
  });

  test('маркира грешка, когато макросите липсват и не могат да се преизчислят', async () => {
    const userId = 'macros-missing-user';
    const { env, kvStore, userMetadataKv, logKey } = buildTestEnvironment(userId);
    callModelMock.mockResolvedValue(
      JSON.stringify({
        profileSummary: 'Обобщение',
        week1Menu: {
          monday: [
            { meal_name: 'Без макроси' }
          ]
        },
        principlesWeek2_4: ['- Баланс'],
        detailedTargets: { hydration: '2L вода' },
        generationMetadata: { errors: [] }
      })
    );

    await workerModule.processSingleUserPlan(userId, env);

    const finalPlan = JSON.parse(kvStore.get(`${userId}_final_plan`));
    expect(finalPlan.caloriesMacros).toBeNull();
    expect(finalPlan.generationMetadata.errors).toContain(
      'AI отговорът няма caloriesMacros и неуспешно автоматично преизчисление от менюто.'
    );
    expect(kvStore.get(`plan_status_${userId}`)).toBe('error');
    const processingError = userMetadataKv.put.mock.calls.find(([key]) => key === `${userId}_processing_error`);
    expect(processingError?.[1]).toContain('AI отговорът няма caloriesMacros');

    const analysisMacros = JSON.parse(kvStore.get(`${userId}_analysis_macros`));
    expect(analysisMacros).toEqual({ status: 'final', data: null });

    const storedLog = JSON.parse(kvStore.get(logKey));
    expect(storedLog.some((entry) => entry.includes('неуспешно автоматично преизчисление'))).toBe(true);
  });
});
