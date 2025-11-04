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
          calories: 520,
          protein_grams: 32,
          carbs_grams: 55,
          fat_grams: 18,
          fiber_grams: 8
        }
      }
    ]
  },
  principlesWeek2_4: ['- Поддържайте хидратация'],
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

function buildTestEnvironment(
  userId,
  { failFirstFlush = false, analysisMacrosData = null, psychoProfileData = null, previousPlanData = null } = {}
) {
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
        const defaultPlan = {
          caloriesMacros: { calories: 2000 },
          principlesWeek2_4: ['- Стар принцип']
        };
        const planPayload = previousPlanData ? { ...defaultPlan, ...previousPlanData } : defaultPlan;
        return JSON.stringify(planPayload);
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
        // Removed 'prompt_target_macros_fix' - no longer used, replaced by estimateMacros
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
    const { env, kvStore, logKey, userMetadataKv } = buildTestEnvironment(userId, {
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
      expect.objectContaining({
        temperature: 0.1,
        maxTokens: 12000,
        signal: expect.any(Object)
      })
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

  test('използва макро целите от предишния план, когато анализ липсва', async () => {
    const userId = 'plan-fallback-user';
    const previousPlanMacros = {
      calories: 2050,
      protein_grams: 150,
      protein_percent: 29,
      carbs_grams: 230,
      carbs_percent: 45,
      fat_grams: 65,
      fat_percent: 26,
      fiber_grams: 30,
      fiber_percent: 6
    };
    const { env } = buildTestEnvironment(userId, {
      psychoProfileData: mockPsychoProfile,
      previousPlanData: { caloriesMacros: previousPlanMacros }
    });
    callModelMock.mockResolvedValue(successfulPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const promptArgument = callModelMock.mock.calls[0][1];
    expect(promptArgument).toContain('2050');
    expect(promptArgument).toContain('150');
    expect(promptArgument).toContain('29%');
    expect(promptArgument).toContain('45%');
    expect(promptArgument).toContain('26%');
    expect(promptArgument).toContain('30 г');
    expect(promptArgument).toContain('"goal":"Подобряване на формата"');
    expect(promptArgument).not.toMatch(/%%TARGET_[A-Z_]+%%/);
    expect(promptArgument).not.toContain('%%USER_ANSWERS_JSON%%');
  });

  test('resolvePlanCallTimeoutMs връща 60 секунди по подразбиране', () => {
    expect(workerModule.resolvePlanCallTimeoutMs({})).toBe(
      workerModule.DEFAULT_PLAN_CALL_TIMEOUT_MS
    );
  });

  test('resolvePlanCallTimeoutMs използва конфигурацията от env', () => {
    expect(workerModule.resolvePlanCallTimeoutMs({ AI_PLAN_TIMEOUT_MS: '45000' })).toBe(45_000);
  });

  test('логва таймаут със стойността от env.AI_PLAN_TIMEOUT_MS', async () => {
    const userId = 'plan-timeout-config-user';
    const { env, userMetadataKv } = buildTestEnvironment(userId, {
      analysisMacrosData: mockAnalysisMacros,
      psychoProfileData: mockPsychoProfile
    });
    env.AI_PLAN_TIMEOUT_MS = '25';
    callModelMock.mockImplementation(() => new Promise(() => {}));

    const planPromise = workerModule.processSingleUserPlan(userId, env);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await planPromise;

    const processingErrorCall = userMetadataKv.put.mock.calls.find(
      ([key]) => key === `${userId}_processing_error`
    );
    expect(processingErrorCall).toBeDefined();
    expect(processingErrorCall[1]).toContain('25ms');
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
      expect.objectContaining({
        temperature: 0.1,
        maxTokens: 12000,
        signal: expect.any(Object)
      })
    );
  });

  test('прекъсва бавната Cloudflare AI заявка при генериране на план', async () => {
    jest.useFakeTimers();
    const abortReasons = [];
    const userId = 'slow-cf-plan-user';
    const { env, kvStore, logKey, userMetadataKv } = buildTestEnvironment(userId, {
      analysisMacrosData: mockAnalysisMacros,
      psychoProfileData: mockPsychoProfile
    });
    env.CF_ACCOUNT_ID = 'acc';
    env.CF_AI_TOKEN = 'token';
    env.AI_PLAN_TIMEOUT_MS = '150';

    const baseResourcesGet = env.RESOURCES_KV.get.getMockImplementation();
    env.RESOURCES_KV.get.mockImplementation(async (key) => {
      if (key === 'model_plan_generation') {
        return '@cf/meta/llama-3-8b-instruct';
      }
      return baseResourcesGet ? baseResourcesGet(key) : null;
    });

    const fetchMock = jest.fn((url, options = {}) => {
      expect(url).toBe(
        'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/meta/llama-3-8b-instruct'
      );
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          abortReasons.push(options.signal.reason);
          reject(options.signal.reason);
        });
      });
    });

    global.fetch = fetchMock;
    workerModule.setCallModelImplementation();

    try {
      const planPromise = workerModule.processSingleUserPlan(userId, env);
      await jest.advanceTimersByTimeAsync(150);
      await planPromise;
    } finally {
      jest.useRealTimers();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(abortReasons).toHaveLength(1);
    expect(abortReasons[0]).toMatchObject({
      name: 'AbortError',
      message: 'AI call timed out after 150ms'
    });

    const processingErrorCall = userMetadataKv.put.mock.calls.find(
      ([key]) => key === `${userId}_processing_error`
    );
    expect(processingErrorCall).toBeDefined();
    expect(processingErrorCall[1]).toContain('AI заявката за плана прекъсна след 150ms.');

    const storedLog = JSON.parse(kvStore.get(logKey));
    expect(storedLog.some((entry) => entry.includes('Изтече времето за отговор'))).toBe(true);
  });
});

describe('processSingleUserPlan - липсващи caloriesMacros', () => {
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

  test('повторно извиква AI и използва коригиран отговор за макросите', async () => {
    const userId = 'macros-retry-user';
    const { env, kvStore, logKey } = buildTestEnvironment(userId);
    const initialMenu = {
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
    };
    // With the updated code, target macros come from estimateMacros instead of AI prompt.
    // So we expect 2 AI calls instead of 3:
    // 1. First plan generation returns caloriesMacros: null
    // 2. Retry plan generation returns valid caloriesMacros
    callModelMock
      .mockResolvedValueOnce(
        JSON.stringify({
          profileSummary: 'Обобщение',
          caloriesMacros: null,
          week1Menu: initialMenu,
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
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          profileSummary: 'Обобщение',
          caloriesMacros: {
            calories: 1900,
            protein_grams: 135,
            protein_percent: 29,
            carbs_grams: 205,
            carbs_percent: 43,
            fat_grams: 65,
            fat_percent: 28,
            fiber_grams: 30,
            fiber_percent: 6
          },
          week1Menu: initialMenu,
          mealMacrosIndex: {
            monday_1: {
              calories: 360,
              protein_grams: 25,
              carbs_grams: 30,
              fat_grams: 12,
              fiber_grams: 8
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
      calories: 1900,
      protein_grams: 135,
      protein_percent: 29,
      carbs_grams: 205,
      carbs_percent: 43,
      fat_grams: 65,
      fat_percent: 28,
      fiber_grams: 30,
      fiber_percent: 6
    });
    expect(kvStore.get(`plan_status_${userId}`)).toBe('ready');
    expect(finalPlan.generationMetadata.errors).toEqual([]);

    const analysisMacros = JSON.parse(kvStore.get(`${userId}_analysis_macros`));
    expect(analysisMacros).toEqual({ status: 'final', data: finalPlan.caloriesMacros });

    expect(callModelMock).toHaveBeenCalledTimes(2);
    const retryCall = callModelMock.mock.calls[1];
    expect(retryCall[1]).toContain('Missing items');

    const storedLog = JSON.parse(kvStore.get(logKey));
    expect(storedLog.some((entry) => entry.includes('AI отговорът няма валидни caloriesMacros'))).toBe(true);
    expect(storedLog.some((entry) => entry.includes('Повторен опит 1 за попълване на макроси.'))).toBe(true);
    expect(storedLog.some((entry) => entry.includes('Макросите бяха допълнени след 1 повторен(и) опит(и).'))).toBe(true);
  });

  test('маркира грешка и не записва план, когато повторните опити не успеят', async () => {
    const userId = 'macros-missing-user';
    const { env, kvStore, userMetadataKv, logKey } = buildTestEnvironment(userId);
    // With the updated code, target macros come from estimateMacros instead of AI prompt.
    // So we expect 3 AI calls instead of 4:
    // 1. First plan generation returns caloriesMacros: null
    // 2. Retry 1 returns caloriesMacros: null
    // 3. Retry 2 returns caloriesMacros: null (max retries reached)
    callModelMock
      .mockResolvedValueOnce(
        JSON.stringify({
          profileSummary: 'Обобщение',
          caloriesMacros: null,
          week1Menu: {
            monday: [
              { meal_name: 'Без макроси' }
            ]
          },
          principlesWeek2_4: ['- Баланс'],
          detailedTargets: { hydration: '2L вода' },
          generationMetadata: { errors: [] }
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          profileSummary: 'Обобщение',
          caloriesMacros: null,
          week1Menu: {
            monday: [
              { meal_name: 'Без макроси' }
            ]
          },
          principlesWeek2_4: ['- Баланс'],
          detailedTargets: { hydration: '2L вода' },
          generationMetadata: { errors: [] }
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          profileSummary: 'Обобщение',
          caloriesMacros: null,
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

    const finalPlanCall = userMetadataKv.put.mock.calls.find(([key]) => key === `${userId}_final_plan`);
    expect(finalPlanCall).toBeUndefined();
    expect(kvStore.get(`${userId}_final_plan`)).toBeUndefined();

    const analysisMacrosCall = userMetadataKv.put.mock.calls.find(
      ([key]) => key === `${userId}_analysis_macros`
    );
    expect(analysisMacrosCall).toBeUndefined();

    // Plan status is set to 'error' when validation fails and errors are added
    expect(kvStore.get(`plan_status_${userId}`)).toBe('error');

    expect(callModelMock).toHaveBeenCalledTimes(3);

    const storedLog = JSON.parse(kvStore.get(logKey));
    expect(storedLog.some((entry) => entry.includes('AI отговорът няма валидни caloriesMacros'))).toBe(true);
    expect(storedLog.some((entry) => entry.includes('Повторен опит 1 за попълване на макроси.'))).toBe(true);
    expect(storedLog.some((entry) => entry.includes('Повторен опит 2 за попълване на макроси.'))).toBe(true);
    expect(storedLog.some((entry) => entry.includes('Планът няма да бъде записан'))).toBe(true);
  });
});

describe('processSingleUserPlan - таргет макроси timeout', () => {
  // This test suite is no longer relevant because we removed the AI-based target macros fix.
  // Target macros are now calculated using estimateMacros, which doesn't involve AI calls.
  test.skip('прекъсва Cloudflare AI заявката и записва грешка при таймаут на таргет макросите', async () => {
    // Test skipped - functionality removed in favor of estimateMacros
  });
});

describe('callModelWithTimeout helper', () => {
  let originalFetch;

  beforeEach(() => {
    jest.useFakeTimers();
    originalFetch = global.fetch;
    callModelMock.mockReset();
    workerModule.setCallModelImplementation(callModelMock);
  });

  afterEach(() => {
    workerModule.setCallModelImplementation();
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test('прекъсва AI извикването при изтичане на AI_CALL_TIMEOUT_MS', async () => {
    callModelMock.mockReturnValue(new Promise(() => {}));

    const callPromise = workerModule
      .callModelWithTimeout({
        model: 'gpt-plan',
        prompt: 'test',
        env: {},
        options: { temperature: 0.3, maxTokens: 500 }
      })
      .catch((err) => err);

    await jest.advanceTimersByTimeAsync(workerModule.AI_CALL_TIMEOUT_MS);

    const timeoutError = await callPromise;
    expect(timeoutError).toMatchObject({ name: 'AbortError' });
    expect(callModelMock).toHaveBeenCalledTimes(1);
    const optionsArg = callModelMock.mock.calls[0][3];
    expect(optionsArg.signal).toBeDefined();
    expect(optionsArg.signal.aborted).toBe(true);
  });

  test('прекъсва fetch заявка към Cloudflare AI с AbortSignal', async () => {
    workerModule.setCallModelImplementation();
    const abortReasons = [];
    const fetchMock = jest.fn((url, options = {}) => {
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          abortReasons.push(options.signal.reason);
          reject(options.signal.reason);
        });
      });
    });
    global.fetch = fetchMock;

    const env = { CF_ACCOUNT_ID: 'acc', CF_AI_TOKEN: 'token' };
    const callPromise = workerModule
      .callModelWithTimeout({
        model: '@cf/meta/llama-3-8b-instruct',
        prompt: 'test prompt',
        env,
        options: { temperature: 0.2, maxTokens: 512 },
        timeoutMs: 150
      })
      .catch((err) => err);

    await jest.advanceTimersByTimeAsync(150);
    const timeoutError = await callPromise;

    expect(timeoutError).toBeInstanceOf(Error);
    expect(timeoutError.name).toBe('AbortError');
    expect(timeoutError.message).toContain('AI call timed out after 150ms');
    expect(timeoutError.message).not.toContain('IoContext timed out');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/meta/llama-3-8b-instruct',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        },
        signal: expect.any(AbortSignal)
      })
    );

    expect(abortReasons).toHaveLength(1);
    expect(abortReasons[0]).toMatchObject({
      name: 'AbortError',
      message: 'AI call timed out after 150ms'
    });
  });
});

describe('processSingleUserPlan - валидация на макроси по хранения', () => {
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

  test('маркира плана като грешен при хранене без макроси и индекс', async () => {
    const userId = 'meal-macros-validation-user';
    const { env, kvStore, logKey, userMetadataKv } = buildTestEnvironment(userId, {
      analysisMacrosData: mockAnalysisMacros,
      psychoProfileData: mockPsychoProfile
    });
    callModelMock.mockResolvedValue(
      JSON.stringify({
        profileSummary: 'Обобщение',
        caloriesMacros: {
          calories: 2000,
          protein_grams: 130,
          carbs_grams: 210,
          fat_grams: 70,
          fiber_grams: 28
        },
        week1Menu: {
          monday: [
            { meal_name: 'Закуска без макроси', items: [{ name: 'Тест', portion: '1' }] }
          ]
        },
        mealMacrosIndex: {},
        principlesWeek2_4: ['- Баланс'],
        detailedTargets: { hydration: '2L вода' },
        generationMetadata: { errors: [] }
      })
    );

    await workerModule.processSingleUserPlan(userId, env);

    const finalPlanCall = userMetadataKv.put.mock.calls.find(([key]) => key === `${userId}_final_plan`);
    expect(finalPlanCall).toBeUndefined();
    expect(kvStore.get(`${userId}_final_plan`)).toBeUndefined();

    expect(kvStore.get(`plan_status_${userId}`)).toBeUndefined();

    const retryRecord = userMetadataKv.put.mock.calls.find(
      ([key]) => key === `${userId}_last_plan_macro_retry`
    );
    expect(retryRecord?.[1]).toContain('Закуска без макроси');

    const logEntries = JSON.parse(kvStore.get(logKey));
    expect(logEntries.some((entry) => entry.includes('Липсват макроси'))).toBe(true);
    expect(logEntries.some((entry) => entry.includes('Планът няма да бъде записан'))).toBe(true);
  });
});
