import { jest } from '@jest/globals';
import { handleUpdatePlanRequest } from '../../worker.js';

describe('handleUpdatePlanRequest', () => {
  test('stores plan data using final plan key', async () => {
    const env = { USER_METADATA_KV: { put: jest.fn() } };
    const planData = { week: 1 };
    const request = { json: async () => ({ userId: 'u1', planData }) };
    const res = await handleUpdatePlanRequest(request, env);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_final_plan', JSON.stringify(planData));
    expect(res.success).toBe(true);
  });
});
