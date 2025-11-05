import { jest } from '@jest/globals';
import {
  handleChatRequest,
  handleLogRequest,
  clearResourceCache,
  setCallModelImplementation
} from '../worker.js';

function createEnv() {
  const store = new Map();
  return {
    __store: store,
    USER_METADATA_KV: {
      get: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
      put: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      delete: jest.fn(async key => {
        store.delete(key);
      })
    },
    RESOURCES_KV: {
      get: jest.fn(async key => {
        if (key === 'prompt_chat') {
          return 'Име: %%USER_NAME%%; Цел: %%USER_GOAL%%; Логове: %%RECENT_LOGS_SUMMARY%%';
        }
        if (key === 'model_chat') {
          return 'gpt-test';
        }
        if (key === 'MAX_CHAT_HISTORY_MESSAGES') {
          return null;
        }
        return null;
      })
    },
    OPENAI_API_KEY: 'test-openai-key',
    MAX_CHAT_HISTORY_MESSAGES: 6
  };
}

function createRequest(payload) {
  return {
    json: jest.fn(async () => JSON.parse(JSON.stringify(payload)))
  };
}

describe('chat context caching', () => {
  const callModelMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-06-10T08:00:00Z'));
    clearResourceCache();
    callModelMock.mockReset().mockResolvedValue('AI отговор');
    setCallModelImplementation(callModelMock);
  });

  afterEach(() => {
    jest.useRealTimers();
    setCallModelImplementation();
  });

  test('второто извикване на чата използва кеширан контекст', async () => {
    const env = createEnv();
    const userId = 'user-1';

    const initialAnswers = {
      name: 'Иван',
      goal: 'Отслабване',
      foodPreference: 'Без ограничения',
      medicalConditions: ['нямам'],
      foodPreferenceDisliked: 'Брюкселско зеле',
      q1745806494081: 'Брюкселско зеле'
    };
    const finalPlan = {
      profileSummary: 'Персонализиран план',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 140,
        carbs_grams: 220,
        fat_grams: 70
      },
      allowedForbiddenFoods: {
        main_allowed_foods: ['Сьомга', 'Киноа', 'Броколи', 'Авокадо'],
        main_forbidden_foods: ['Газирани напитки']
      },
      hydrationCookingSupplements: {
        hydration_recommendations: { daily_liters: '2.5' },
        cooking_methods: { recommended: ['на пара', 'печене'] },
        supplement_suggestions: [{ supplement_name: 'Витамин D' }]
      },
      week1Menu: {
        monday: [{ meal_name: 'Закуска' }, { meal_name: 'Обяд' }]
      },
      principlesWeek2_4: ['- Баланс и фокус върху зеленчуци']
    };
    const logEntry = (mood, energy, sleep, note) => ({
      log: {
        mood,
        energy,
        sleep,
        completedMealsStatus: { breakfast: true },
        note
      }
    });

    env.__store.set(`${userId}_initial_answers`, JSON.stringify(initialAnswers));
    env.__store.set(`${userId}_final_plan`, JSON.stringify(finalPlan));
    env.__store.set(`plan_status_${userId}`, 'ready');
    env.__store.set(`${userId}_chat_history`, JSON.stringify([]));
    env.__store.set(`${userId}_current_status`, JSON.stringify({ weight: 82 }));
    env.__store.set(`${userId}_log_2024-06-10`, JSON.stringify(logEntry('4', '3', '5', 'Добро настроение')));
    env.__store.set(`${userId}_log_2024-06-09`, JSON.stringify(logEntry('5', '4', '4', 'Продуктивен ден')));
    env.__store.set(`${userId}_log_2024-06-08`, JSON.stringify(logEntry('3', '3', '2', 'Уморен')));

    const firstResponse = await handleChatRequest(
      createRequest({ userId, message: 'Здравей', source: 'app' }),
      env
    );
    expect(firstResponse.success).toBe(true);
    const getCallsAfterFirst = env.USER_METADATA_KV.get.mock.calls.length;
    expect(env.__store.has(`${userId}_chat_context`)).toBe(true);

    const secondResponse = await handleChatRequest(
      createRequest({ userId, message: 'Как върви денят?', source: 'app' }),
      env
    );
    expect(secondResponse.success).toBe(true);
    const totalGetCalls = env.USER_METADATA_KV.get.mock.calls.length;
    const secondCallGets = totalGetCalls - getCallsAfterFirst;

    expect(secondCallGets).toBeLessThan(getCallsAfterFirst);
    expect(secondCallGets).toBeLessThanOrEqual(2);
    expect(env.USER_METADATA_KV.get.mock.calls[getCallsAfterFirst][0]).toBe(`${userId}_chat_context`);
    expect(callModelMock).toHaveBeenCalledTimes(2);
  });

  test('обновяването на дневник рефрешва резюмето в chat_context', async () => {
    const env = createEnv();
    const userId = 'user-2';
    const today = '2024-06-10';

    const existingContext = {
      version: 1,
      ttlMs: 12 * 60 * 60 * 1000,
      updatedAt: new Date('2024-06-09T08:00:00Z').toISOString(),
      planStatus: 'ready',
      user: {
        name: 'Мария',
        goal: 'Енергия',
        conditions: 'Няма специфични',
        preferences: 'Без ограничения'
      },
      plan: {
        summary: 'Балансиран режим',
        macrosString: 'Кал: 1800 P:120g C:200g F:60g',
        allowedFoodsSummary: 'Плодове, зеленчуци',
        forbiddenFoodsSummary: 'Газирани напитки',
        hydrationTarget: '2',
        cookingMethodsSummary: 'на пара',
        supplementSuggestionsSummary: 'Витамин C',
        principlesText: 'Фокус върху сезонни продукти',
        menuSummaryByDay: {}
      },
      metrics: {
        currentWeightFormatted: '80.0 кг'
      },
      logs: {
        entries: [
          {
            date: '2024-06-09',
            log: { mood: '5', energy: '4', sleep: '4', completedMealsStatus: { breakfast: true } }
          }
        ],
        summaryText: '09.06: Настр:5/5; Енерг:4/5; Сън:4/5; 1 изп. хран.',
        averages: { mood: '5.0/5', energy: '4.0/5', calmness: 'N/A', sleep: '4.0/5' },
        adherenceText: '1 изп. хран. за последните 1 дни',
        todaysCompletedMealsKeys: 'Няма данни за днес',
        updatedAt: new Date('2024-06-09T08:00:00Z').toISOString()
      }
    };

    env.__store.set(`${userId}_chat_context`, JSON.stringify(existingContext));

    const response = await handleLogRequest(
      createRequest({
        userId,
        weight: '79.5',
        mood: '4',
        energy: '3',
        sleep: '5',
        note: 'Много добро настроение',
        date: today,
        data: {
          mood: '4',
          energy: '3',
          sleep: '5',
          note: 'Много добро настроение',
          completedMealsStatus: { breakfast: true, lunch: true }
        }
      }),
      env
    );

    expect(response.success).toBe(true);
    const updatedContextStr = env.__store.get(`${userId}_chat_context`);
    expect(updatedContextStr).toBeTruthy();
    const updatedContext = JSON.parse(updatedContextStr);
    expect(updatedContext.logs.entries[0].date).toBe(today);
    expect(updatedContext.logs.summaryText).toContain('Настр:4/5');
    expect(updatedContext.metrics.currentWeightFormatted).toBe('79.5 кг');
    expect(updatedContext.logs.todaysCompletedMealsKeys).toBe(JSON.stringify(['breakfast', 'lunch']));
  });

  test('изтриването на дневник почиства кеширания chat_context', async () => {
    const env = createEnv();
    const userId = 'user-3';
    const dateToDelete = '2024-06-09';
    const remainingDate = '2024-06-08';

    const deletedLogRecord = {
      log: {
        mood: '5',
        energy: '4',
        sleep: '4',
        completedMealsStatus: { breakfast: true, lunch: true },
        note: 'Дневник за изтриване'
      }
    };
    const remainingLogRecord = {
      log: {
        mood: '3',
        energy: '3',
        sleep: '3',
        completedMealsStatus: { dinner: true },
        note: 'Остава в историята'
      }
    };

    const existingContext = {
      version: 1,
      updatedAt: new Date('2024-06-09T18:00:00Z').toISOString(),
      planStatus: 'ready',
      metrics: {
        currentWeightFormatted: '80.0 кг'
      },
      logs: {
        entries: [
          { date: dateToDelete, log: deletedLogRecord.log },
          { date: remainingDate, log: remainingLogRecord.log }
        ],
        summaryText: '9 юни: тестов запис',
        averages: { mood: '4.0/5', energy: '3.5/5', calmness: 'N/A', sleep: '3.5/5' },
        adherenceText: '2 изп. хран. за последните 2 дни',
        todaysCompletedMealsKeys: JSON.stringify(['breakfast', 'lunch'])
      }
    };

    env.__store.set(`${userId}_log_${dateToDelete}`, JSON.stringify(deletedLogRecord));
    env.__store.set(`${userId}_log_${remainingDate}`, JSON.stringify(remainingLogRecord));
    env.__store.set(
      `${userId}_logs_index`,
      JSON.stringify({ dates: [remainingDate, dateToDelete], ts: Date.now(), version: 1 })
    );
    env.__store.set(`${userId}_chat_context`, JSON.stringify(existingContext));

    const response = await handleLogRequest(
      createRequest({
        userId,
        date: dateToDelete,
        delete: true
      }),
      env
    );

    expect(response.success).toBe(true);
    expect(response.deletedDate).toBe(dateToDelete);
    expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith(`${userId}_log_${dateToDelete}`);
    expect(env.__store.has(`${userId}_log_${dateToDelete}`)).toBe(false);

    const updatedIndex = JSON.parse(env.__store.get(`${userId}_logs_index`));
    expect(updatedIndex.dates).not.toContain(dateToDelete);

    const updatedContextStr = env.__store.get(`${userId}_chat_context`);
    expect(updatedContextStr).toBeTruthy();
    const updatedContext = JSON.parse(updatedContextStr);

    expect(updatedContext.logs.entries).toHaveLength(1);
    expect(updatedContext.logs.entries[0].date).toBe(remainingDate);
    expect(updatedContext.logs.summaryText).not.toMatch(/9 юни/);
    expect(updatedContext.logs.summaryText).toMatch(/8 юни/);
    expect(updatedContext.logs.todaysCompletedMealsKeys).toBe('Няма данни за днес');
  });
});
