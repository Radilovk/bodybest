import { jest } from '@jest/globals';
import { handlePlanLogRequest } from '../../worker.js';

const makeRequest = (userId) => ({ url: `https://x/api/planLog?userId=${userId}` });

describe('handlePlanLogRequest', () => {
  test('връща логове и грешка при статус error', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(async (key) => {
          if (key === 'u1_plan_log') return JSON.stringify(['start', 'end']);
          if (key === 'plan_status_u1') return 'error';
          if (key === 'u1_processing_error') return 'fatal';
          return null;
        })
      }
    };
    const res = await handlePlanLogRequest(makeRequest('u1'), env);
    expect(res).toEqual({ success: true, logs: ['start', 'end'], status: 'error', error: 'fatal' });
  });
});
