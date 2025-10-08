import { jest } from '@jest/globals';

const workerModule = await import('../worker.js');

function createTestEnv(userId, finalPlan) {
  const kvData = new Map();

  kvData.set(`${userId}_initial_answers`, JSON.stringify({ name: 'Клиент', goal: 'Форма' }));
  kvData.set(`${userId}_final_plan`, JSON.stringify(finalPlan));
  kvData.set(`plan_status_${userId}`, 'ready');
  kvData.set(`${userId}_current_status`, '{}');
  kvData.set(`${userId}_profile`, '{}');
  kvData.set(`${userId}_welcome_seen`, 'true');

  const userMetadataKv = {
    get: jest.fn(async (key) => (kvData.has(key) ? kvData.get(key) : null)),
    put: jest.fn(async (key, value) => {
      kvData.set(key, value);
    }),
    list: jest.fn(async () => ({ keys: [] }))
  };

  const env = {
    USER_METADATA_KV: userMetadataKv,
    RESOURCES_KV: {
      get: jest.fn(async () => '{}')
    }
  };

  return { env, kvData };
}

describe('handleDashboardDataRequest - макроси', () => {
  test('преизчислява липсващи макроси от менюто и ги записва', async () => {
    const userId = 'dashboard-macros-user';
    const finalPlan = {
      caloriesMacros: null,
      week1Menu: {
        monday: [
          {
            macros: {
              protein_grams: 60,
              carbs_grams: 90,
              fat_grams: 20,
              fiber_grams: 10
            }
          },
          {
            macros: {
              protein_grams: 60,
              carbs_grams: 90,
              fat_grams: 35,
              fiber_grams: 8
            }
          }
        ]
      }
    };

    const { env, kvData } = createTestEnv(userId, finalPlan);
    const request = { url: `https://example.com/api/dashboard-data?userId=${userId}&recalcMacros=1` };

    const response = await workerModule.handleDashboardDataRequest(request, env);

    expect(response.success).toBe(true);
    expect(response.planData?.caloriesMacros).toEqual(
      expect.objectContaining({
        calories: 1731,
        protein_grams: 120,
        carbs_grams: 180,
        fat_grams: 55,
        fiber_grams: 18,
        protein_percent: 28,
        carbs_percent: 42,
        fat_percent: 29,
        fiber_percent: 2
      })
    );

    const savedPlanRaw = kvData.get(`${userId}_final_plan`);
    expect(savedPlanRaw).toBeTruthy();
    const savedPlan = JSON.parse(savedPlanRaw);
    expect(savedPlan.caloriesMacros).toEqual(response.planData.caloriesMacros);

    const saveCall = env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === `${userId}_final_plan`);
    expect(saveCall).toBeDefined();
  });

  test('връща грешка, когато менюто не позволява преизчисление', async () => {
    const userId = 'dashboard-macros-missing';
    const finalPlan = {
      caloriesMacros: null,
      week1Menu: {}
    };

    const { env } = createTestEnv(userId, finalPlan);
    const request = { url: `https://example.com/api/dashboard-data?userId=${userId}&recalcMacros=1` };

    const response = await workerModule.handleDashboardDataRequest(request, env);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      'Планът няма макроси и автоматичното преизчисление се провали. Моля, регенерирайте плана.'
    );
    expect(env.USER_METADATA_KV.put.mock.calls.find(([key]) => key === `${userId}_final_plan`)).toBeUndefined();
  });
});

