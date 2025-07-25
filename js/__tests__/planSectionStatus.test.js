import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

describe('plan section status handler', () => {
  test('returns status for each section', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => {
          if (key.includes('profile') || key.includes('guidance')) return Promise.resolve('{}');
          return Promise.resolve(null);
        })
      }
    };
    const req = { url: 'https://x/api/plan-section-status?userId=u1' };
    const res = await worker.handlePlanSectionStatusRequest(req, env);
    expect(res.success).toBe(true);
    expect(res.sections).toEqual({ profile: 'ready', menu: 'missing', principles: 'missing', guidance: 'ready' });
  });
});
