import { jest } from '@jest/globals';
import { handleDashboardDataRequest } from '../../worker.js';

describe('handleDashboardDataRequest caloriesMacros', () => {
  test('returns error when caloriesMacros is missing', async () => {
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
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(500);
    expect(res.message).toBe('Планът няма макроси; изисква се повторно генериране');
    expect(res.planData).toBeNull();
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalledWith('u1_final_plan', expect.anything());
  });
});
