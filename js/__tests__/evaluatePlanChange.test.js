import { jest } from '@jest/globals';
import { evaluatePlanChange } from '../../worker.js';

function iso(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

describe('evaluatePlanChange', () => {
  test('computes deviation from weight goal', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key === 'u1_initial_answers') {
            return Promise.resolve(JSON.stringify({ weight: 80, goal: 'отслабване', lossKg: 5 }));
          }
          if (key === `u1_log_${iso(0)}`) {
            return Promise.resolve(JSON.stringify({ weight: 78 }));
          }
          if (key === 'u1_current_status') return Promise.resolve(null);
          return Promise.resolve(null);
        })
      }
    };
    const res = await evaluatePlanChange('u1', {}, env);
    expect(res.deviationPercent).toBe(4);
    expect(res.explanation).toContain('78.0');
    expect(res.explanation).toContain('75.0');
  });
});
