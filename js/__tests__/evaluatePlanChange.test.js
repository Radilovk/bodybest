import { jest } from '@jest/globals';
import { evaluatePlanChange } from '../../worker.js';

describe('evaluatePlanChange', () => {
  test('calculates weight loss deviation', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') {
            return Promise.resolve(JSON.stringify({ goal: 'отслабване', weight: 80, lossKg: 10 }));
          }
          if (key === 'u1_current_status') {
            return Promise.resolve(JSON.stringify({ weight: 77 }));
          }
          return Promise.resolve('');
        })
      }
    };
    const res = await evaluatePlanChange('u1', {}, env);
    expect(res.deviationPercent).toBe(70);
    expect(res.comment).toMatch(/Отклонение/);
  });
});
