import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

function iso(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

describe('handleGeneratePraiseRequest analytics gating', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates praise when progress improves', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_last_praise_ts') return Promise.resolve('0');
          if (key === 'u1_achievements') return Promise.resolve('[]');
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({ weight: 80, height: 180, goal: 'отслабване', lossKg: 5, name: 'A' }));
          if (key === 'u1_final_plan') return Promise.resolve(JSON.stringify({ week1Menu: { monday:['a'], tuesday:['a'], wednesday:['a'], thursday:['a'], friday:['a'], saturday:['a'], sunday:['a'] }, detailedTargets:{} }));
          if (key === 'u1_current_status') return Promise.resolve(JSON.stringify({ weight: 79 }));
          if (key === 'u1_last_praise_analytics') return Promise.resolve(JSON.stringify({ goalProgress: 10, overallHealthScore: 50, bmi: 24 }));
          for (let i = 0; i < 7; i++) {
            if (key === `u1_log_${iso(i)}`) {
              return Promise.resolve(JSON.stringify({ mood:3, energy:3, calmness:3, sleep:3, hydration:3, completedMealsStatus:{monday_0:true} }));
            }
          }
          return Promise.resolve(null);
        }),
        put: jest.fn(),
      },
      RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) }
    };

    const req = { json: async () => ({ userId: 'u1' }) };
    const res = await worker.handleGeneratePraiseRequest(req, env);
    expect(res.success).toBe(true);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_last_praise_analytics', expect.any(String));
  });

  test('skips praise when no improvement', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_last_praise_ts') return Promise.resolve('0');
          if (key === 'u1_achievements') return Promise.resolve('[]');
          if (key === 'u1_initial_answers') return Promise.resolve(JSON.stringify({ weight: 80, height: 180, goal: 'отслабване', lossKg: 5, name: 'A' }));
          if (key === 'u1_final_plan') return Promise.resolve(JSON.stringify({ week1Menu: { monday:['a'] }, detailedTargets:{} }));
          if (key === 'u1_current_status') return Promise.resolve(JSON.stringify({ weight: 80 }));
          if (key === 'u1_last_praise_analytics') return Promise.resolve(JSON.stringify({ goalProgress: 20, overallHealthScore: 60, bmi: 24.5 }));
          for (let i = 0; i < 7; i++) {
            if (key === `u1_log_${iso(i)}`) {
              return Promise.resolve(JSON.stringify({ mood:2, energy:2, calmness:2, sleep:2, hydration:2, completedMealsStatus:{monday_0:false} }));
            }
          }
          return Promise.resolve(null);
        }),
        put: jest.fn(),
      },
      RESOURCES_KV: { get: jest.fn().mockResolvedValue(null) }
    };

    const req = { json: async () => ({ userId: 'u1' }) };
    const res = await worker.handleGeneratePraiseRequest(req, env);
    expect(res.success).toBe(false);
    const achCalls = env.USER_METADATA_KV.put.mock.calls.filter(c => c[0] === 'u1_achievements');
    expect(achCalls.length).toBe(0);
  });
});
