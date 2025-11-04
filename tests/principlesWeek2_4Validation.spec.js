import { jest } from '@jest/globals';

const workerModule = await import('../worker.js');

describe('principlesWeek2_4 validation', () => {
  const callModelMock = jest.fn();

  beforeEach(() => {
    callModelMock.mockReset();
    workerModule.setCallModelImplementation(callModelMock);
  });

  afterEach(() => {
    workerModule.setCallModelImplementation();
  });

  function buildMockEnvironment(userId) {
    const kvStore = new Map();
    kvStore.set(`${userId}_initial_answers`, JSON.stringify({
      name: 'Тест',
      email: 'test@example.com',
      goal: 'Отслабване',
      weight: 80,
      height: 175,
      gender: 'мъж',
      age: 30,
      medicalConditions: ['нямам']
    }));
    kvStore.set(`${userId}_analysis_macros`, JSON.stringify({
      status: 'final',
      data: {
        calories: 2000,
        protein_grams: 150,
        protein_percent: 30,
        carbs_grams: 200,
        carbs_percent: 40,
        fat_grams: 67,
        fat_percent: 30,
        fiber_grams: 30,
        fiber_percent: 6
      }
    }));

    const userMetadataKv = {
      get: jest.fn((key) => Promise.resolve(kvStore.get(key) || null)),
      put: jest.fn((key, value) => {
        kvStore.set(key, value);
        return Promise.resolve();
      }),
      delete: jest.fn((key) => {
        kvStore.delete(key);
        return Promise.resolve();
      })
    };

    const resourcesKv = {
      get: jest.fn((key) => {
        if (key === 'model_plan_generation') return Promise.resolve('gemini-1.5-pro');
        if (key === 'prompt_unified_plan_generation_v2') return Promise.resolve('План: %%USER_NAME%%');
        return Promise.resolve(null);
      })
    };

    return {
      env: {
        USER_METADATA_KV: userMetadataKv,
        RESOURCES_KV: resourcesKv,
        GEMINI_API_KEY: 'test-key'
      },
      kvStore
    };
  }

  test('обработва празен масив principlesWeek2_4 и добавя дефолтна стойност', async () => {
    const userId = 'test-empty-principles';
    const { env, kvStore } = buildMockEnvironment(userId);

    const planResponseWithEmptyPrinciples = JSON.stringify({
      profileSummary: 'Тестов профил',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 150,
        carbs_grams: 200,
        fat_grams: 67,
        fiber_grams: 30,
        protein_percent: 30,
        carbs_percent: 40,
        fat_percent: 30,
        fiber_percent: 6
      },
      week1Menu: {
        monday: [{
          meal_name: 'Закуска',
          macros: { calories: 500, protein_grams: 30, carbs_grams: 50, fat_grams: 15, fiber_grams: 8 }
        }]
      },
      principlesWeek2_4: [], // Празен масив!
      detailedTargets: { hydration: '2L' }
    });

    callModelMock.mockResolvedValueOnce(planResponseWithEmptyPrinciples);

    await workerModule.processSingleUserPlan(userId, env);

    const finalPlanCall = env.USER_METADATA_KV.put.mock.calls.find(
      ([key]) => key === `${userId}_final_plan`
    );
    
    expect(finalPlanCall).toBeDefined();
    const savedPlan = JSON.parse(finalPlanCall[1]);
    
    // Проверяваме че principlesWeek2_4 е попълнен с дефолтна стойност
    expect(savedPlan.principlesWeek2_4).toBeDefined();
    expect(Array.isArray(savedPlan.principlesWeek2_4)).toBe(true);
    expect(savedPlan.principlesWeek2_4.length).toBeGreaterThan(0);
  });

  test('приема валиден масив от обекти за principlesWeek2_4', async () => {
    const userId = 'test-valid-object-principles';
    const { env } = buildMockEnvironment(userId);

    const planResponseWithValidPrinciples = JSON.stringify({
      profileSummary: 'Тестов профил',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 150,
        carbs_grams: 200,
        fat_grams: 67,
        fiber_grams: 30,
        protein_percent: 30,
        carbs_percent: 40,
        fat_percent: 30,
        fiber_percent: 6
      },
      week1Menu: {
        monday: [{
          meal_name: 'Закуска',
          macros: { calories: 500, protein_grams: 30, carbs_grams: 50, fat_grams: 15, fiber_grams: 8 }
        }]
      },
      principlesWeek2_4: [
        { title: 'Принцип 1', content: 'Хидратация', icon: 'icon-water' },
        { title: 'Принцип 2', content: 'Баланс', icon: 'icon-balance' }
      ],
      detailedTargets: { hydration: '2L' }
    });

    callModelMock.mockResolvedValueOnce(planResponseWithValidPrinciples);

    await workerModule.processSingleUserPlan(userId, env);

    const finalPlanCall = env.USER_METADATA_KV.put.mock.calls.find(
      ([key]) => key === `${userId}_final_plan`
    );
    
    expect(finalPlanCall).toBeDefined();
    const savedPlan = JSON.parse(finalPlanCall[1]);
    
    expect(savedPlan.principlesWeek2_4).toBeDefined();
    expect(savedPlan.principlesWeek2_4.length).toBe(2);
    expect(savedPlan.principlesWeek2_4[0].title).toBe('Принцип 1');
  });

  test('приема валиден масив от strings за principlesWeek2_4', async () => {
    const userId = 'test-valid-string-principles';
    const { env } = buildMockEnvironment(userId);

    const planResponseWithStringPrinciples = JSON.stringify({
      profileSummary: 'Тестов профил',
      caloriesMacros: {
        calories: 2000,
        protein_grams: 150,
        carbs_grams: 200,
        fat_grams: 67,
        fiber_grams: 30,
        protein_percent: 30,
        carbs_percent: 40,
        fat_percent: 30,
        fiber_percent: 6
      },
      week1Menu: {
        monday: [{
          meal_name: 'Закуска',
          macros: { calories: 500, protein_grams: 30, carbs_grams: 50, fat_grams: 15, fiber_grams: 8 }
        }]
      },
      principlesWeek2_4: [
        '- Пийте достатъчно вода',
        '- Хранете се на равни интервали'
      ],
      detailedTargets: { hydration: '2L' }
    });

    callModelMock.mockResolvedValueOnce(planResponseWithStringPrinciples);

    await workerModule.processSingleUserPlan(userId, env);

    const finalPlanCall = env.USER_METADATA_KV.put.mock.calls.find(
      ([key]) => key === `${userId}_final_plan`
    );
    
    expect(finalPlanCall).toBeDefined();
    const savedPlan = JSON.parse(finalPlanCall[1]);
    
    expect(savedPlan.principlesWeek2_4).toBeDefined();
    expect(savedPlan.principlesWeek2_4.length).toBe(2);
    expect(savedPlan.principlesWeek2_4[0]).toBe('- Пийте достатъчно вода');
  });
});
