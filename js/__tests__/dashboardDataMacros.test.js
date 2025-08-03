import { jest } from '@jest/globals';
import { handleDashboardDataRequest } from '../../worker.js';

describe('handleDashboardDataRequest caloriesMacros', () => {
  test('returns caloriesMacros when absent from final plan', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({
            name: 'U', weight: '70', height: '170', age: '30', gender: 'мъж', q1745878295708: 'умерено'
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
    expect(res.planData.caloriesMacros).toBeDefined();
    expect(res.planData.caloriesMacros.calories).toBeGreaterThan(0);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'u1_final_plan',
      expect.stringContaining('"caloriesMacros"')
    );
  });

  test('recalculates macros when recalcMacros=1', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({
            name: 'U', weight: '70', height: '170', age: '30', gender: 'мъж', q1745878295708: 'умерено'
          }));
          if (key === 'u1_final_plan') return Promise.resolve(JSON.stringify({
            caloriesMacros: { calories: 1, protein_percent: 1, carbs_percent: 1, fat_percent: 1, protein_grams: 1, carbs_grams: 1, fat_grams: 1 },
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
    const request = { url: 'https://example.com?userId=u1&recalcMacros=1' };
    const res = await handleDashboardDataRequest(request, env);
    expect(res.planData.caloriesMacros.calories).toBeGreaterThan(1);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'u1_final_plan',
      expect.stringContaining('"caloriesMacros"')
    );
  });
});
