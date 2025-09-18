import { jest } from '@jest/globals';

const workerModule = await import('../worker.js');

const callModelMock = jest.fn();

const minimalUnifiedPlanTemplate = JSON.stringify({
  profileSummary: 'Профил за %%USER_NAME%%',
  caloriesMacros: { calories: 2100, fiber_percent: 10, fiber_grams: 30 },
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
    fiber_percent: 10,
    fiber_grams: 30
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

function buildTestEnvironment(userId, { failFirstFlush = false } = {}) {
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
    const { env, kvStore, logKey } = buildTestEnvironment(userId);
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
  });

  test('запазва критична грешка, когато flush на лога се провали', async () => {
    const userId = 'flush-failure-user';
    const { env, kvStore, logKey, logErrorKey } = buildTestEnvironment(
      userId,
      { failFirstFlush: true }
    );
    callModelMock.mockResolvedValue(successfulPlanResponse);

    await workerModule.processSingleUserPlan(userId, env);

    const flushErrorStored = kvStore.get(logErrorKey);
    expect(flushErrorStored).toBeTruthy();
    const flushErrorPayload = JSON.parse(flushErrorStored);
    expect(flushErrorPayload.message).toBe('Simulated flush failure');

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
