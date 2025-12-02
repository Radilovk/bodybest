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
  test('показва данните с предупреждение при липсващи макроси (за стари регистрации)', async () => {
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

    const { env } = createTestEnv(userId, finalPlan);
    const request = { url: `https://example.com/api/dashboard-data?userId=${userId}` };

    const response = await workerModule.handleDashboardDataRequest(request, env);

    // Сега показваме данните успешно с предупреждение вместо грешка
    expect(response.success).toBe(true);
    expect(response.planData).toBeTruthy();
    expect(response.macrosWarning).toBe('Планът няма пълни данни за макроси. За пълна функционалност е препоръчително да регенерирате плана.');
  });

  test('показва данните с предупреждение когато менюто е празно (за стари регистрации)', async () => {
    const userId = 'dashboard-macros-missing';
    const finalPlan = {
      caloriesMacros: null,
      week1Menu: {}
    };

    const { env } = createTestEnv(userId, finalPlan);
    const request = { url: `https://example.com/api/dashboard-data?userId=${userId}` };

    const response = await workerModule.handleDashboardDataRequest(request, env);

    // Сега показваме данните успешно с предупреждение вместо грешка
    expect(response.success).toBe(true);
    expect(response.planData).toBeTruthy();
    expect(response.macrosWarning).toBe('Планът няма пълни данни за макроси. За пълна функционалност е препоръчително да регенерирате плана.');
  });
});

