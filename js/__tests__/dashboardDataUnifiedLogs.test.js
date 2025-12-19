import { jest } from '@jest/globals';
import { handleDashboardDataRequest } from '../../worker.js';

const daysOrder = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

describe('handleDashboardDataRequest unified logs', () => {
  test('използва обединения масив при липса на индивидуални ключове', async () => {
    const today = new Date();
    const dayKey = daysOrder[today.getDay()];
    const dateStr = today.toISOString().split('T')[0];
    const aggregated = JSON.stringify([{ date: dateStr, log: { health_tone: 3, activity: 4, completedMealsStatus: {} } }]);

    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({ name: 'U', weight: '70', height: '170', goal: 'lose' }));
          if (key === 'u1_final_plan') return Promise.resolve(JSON.stringify({ caloriesMacros: { p: 1 }, week1Menu: { [dayKey]: ['a','b','c','d','e'] } }));
          if (key === 'plan_status_u1') return Promise.resolve('ready');
          if (key === 'u1_current_status') return Promise.resolve('{}');
          if (key === 'u1_profile') return Promise.resolve('{}');
          if (key === 'u1_logs') return Promise.resolve(aggregated);
          return Promise.resolve(null);
        }),
        put: jest.fn(),
        list: jest.fn().mockResolvedValue({ keys: [] })
      },
      RESOURCES_KV: { get: jest.fn(async () => '{}') }
    };

    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleDashboardDataRequest(request, env);
    expect(res.dailyLogs).toHaveLength(1);
    const expected = Math.round(((0) * 0.4) + (((2 / 5) * 100) * 0.4) + (((1 / 7) * 100) * 0.2));
    expect(res.analytics.current.engagementScore).toBe(expected);
  });

  test('включва записи само с extraMeals', async () => {
    const dateStr = '2024-01-01';
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({ name: 'U', weight: '70', height: '170', goal: 'lose' }));
          if (key === 'u1_final_plan') return Promise.resolve(JSON.stringify({ caloriesMacros: { p: 1 }, week1Menu: {} }));
          if (key === 'plan_status_u1') return Promise.resolve('ready');
          if (key === 'u1_current_status') return Promise.resolve('{}');
          if (key === 'u1_profile') return Promise.resolve('{}');
          if (key === `u1_log_${dateStr}`) return Promise.resolve(JSON.stringify({ extraMeals: [{ foodDescription: 'Смути', quantityEstimate: '250 мл' }] }));
          return Promise.resolve(null);
        }),
        put: jest.fn(),
        list: jest.fn().mockResolvedValue({ keys: [{ name: `u1_log_${dateStr}` }] })
      },
      RESOURCES_KV: { get: jest.fn(() => Promise.resolve('{}')) }
    };
    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleDashboardDataRequest(request, env);
    expect(res.dailyLogs).toHaveLength(1);
    expect(res.dailyLogs[0].extraMeals).toHaveLength(1);
    expect(res.dailyLogs[0].data).toEqual({});
  });
});
