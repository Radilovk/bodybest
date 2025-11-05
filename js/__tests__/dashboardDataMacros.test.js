import { jest } from '@jest/globals';

const workerModule = await import('../../worker.js');
const { handleDashboardDataRequest } = workerModule;

describe('handleDashboardDataRequest caloriesMacros', () => {

  test('returns error when caloriesMacros is missing', async () => {
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
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(500);
    expect(res.message).toBe('Планът няма макроси; изисква се повторно генериране');
    expect(res.planData).toBeNull();
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalledWith('u1_final_plan', expect.anything());
  });

  test('recalculates caloriesMacros when recalcMacros=1', async () => {
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

    const request = { url: 'https://example.com?userId=u1&recalcMacros=1' };
    const res = await handleDashboardDataRequest(request, env);

    expect(res.success).toBe(true);
    expect(res.planData?.caloriesMacros).toEqual({
      calories: 753,
      protein_grams: 50,
      protein_percent: 27,
      carbs_grams: 75,
      carbs_percent: 40,
      fat_grams: 25,
      fat_percent: 30,
      fiber_grams: 14,
      fiber_percent: 4
    });
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'u1_final_plan',
      expect.stringContaining('"calories": 753')
    );
  });
});
