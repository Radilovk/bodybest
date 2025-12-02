import { jest } from '@jest/globals';

const workerModule = await import('../../worker.js');
const { handleDashboardDataRequest } = workerModule;

describe('handleDashboardDataRequest caloriesMacros', () => {

  test('returns success with warning when caloriesMacros is missing (legacy users)', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({
            name: 'U', weight: '70', height: '170', age: '30', gender: 'мъж', dailyActivityLevel: 'умерено', q1745878295708: 'умерено'
          }));
          if (key === 'u1_final_plan') return Promise.resolve(JSON.stringify({
            profileSummary: 's', allowedForbiddenFoods: {}, hydrationCookingSupplements: {}, week1Menu: {}, principlesWeek2_4: []
          }));
          if (key === 'plan_status_u1') return Promise.resolve('ready');
          if (key === 'u1_current_status') return Promise.resolve('{}');
          return Promise.resolve(null);
        }),
        put: jest.fn(),
        list: jest.fn().mockResolvedValue({ keys: [] })
      },
      RESOURCES_KV: { get: jest.fn(() => Promise.resolve('{}')) }
    };
    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleDashboardDataRequest(request, env);
    // Сега показваме данните успешно с предупреждение вместо грешка (за стари регистрации)
    expect(res.success).toBe(true);
    expect(res.planData).toBeTruthy();
    expect(res.macrosWarning).toBe('Планът няма пълни данни за макроси. За пълна функционалност е препоръчително да регенерирате плана.');
  });

  test('shows data with warning when macros are incomplete (legacy users)', async () => {
    const planWithoutMacros = {
      profileSummary: 's',
      allowedForbiddenFoods: {},
      hydrationCookingSupplements: {},
      week1Menu: {
        monday: [
          {
            macros: {
              protein_grams: '30',
              carbs_grams: '45',
              fat_grams: '15',
              fiber_grams: '8'
            }
          },
          { meal_name: 'Обяд' }
        ]
      },
      mealMacrosIndex: {
        monday_1: {
          protein_grams: '20',
          carbs_grams: '30',
          fat_grams: '10',
          fiber_grams: '6'
        }
      },
      principlesWeek2_4: [],
      detailedTargets: {}
    };

    const kvStore = new Map();
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => {
          if (kvStore.has(key)) return kvStore.get(key);
          if (key === 'u1_initial_answers') {
            return JSON.stringify({
              name: 'U',
              weight: '70',
              height: '170',
              age: '30',
              gender: 'мъж',
              dailyActivityLevel: 'умерено',
              q1745878295708: 'умерено'
            });
          }
          if (key === 'u1_final_plan') {
            return JSON.stringify(planWithoutMacros);
          }
          if (key === 'plan_status_u1') return 'ready';
          if (key === 'u1_current_status') return '{}';
          return null;
        }),
        put: jest.fn(async (key, value) => {
          kvStore.set(key, value);
        }),
        delete: jest.fn(async (key) => {
          kvStore.delete(key);
        }),
        list: jest.fn().mockResolvedValue({ keys: [] })
      },
      RESOURCES_KV: { get: jest.fn(() => Promise.resolve('{}')) }
    };

    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleDashboardDataRequest(request, env);

    // Сега показваме данните успешно с предупреждение вместо грешка (за стари регистрации)
    expect(res.success).toBe(true);
    expect(res.planData).toBeTruthy();
    expect(res.macrosWarning).toBe('Планът няма пълни данни за макроси. За пълна функционалност е препоръчително да регенерирате плана.');
  });
});
