import { jest } from '@jest/globals';
import { handleUpdatePlanRequest } from '../../worker.js';

describe('handleUpdatePlanRequest', () => {
  test('stores plan data with flat macros', async () => {
    const env = { USER_METADATA_KV: { put: jest.fn() } };
    const planData = {
      week: 1,
      caloriesMacros: { calories: 2000, fiber_percent: 10, fiber_grams: 30 }
    };
    const request = { json: async () => ({ userId: 'u1', planData }) };
    const res = await handleUpdatePlanRequest(request, env);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_final_plan', JSON.stringify(planData));
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'u1_analysis_macros',
      JSON.stringify({ status: 'final', data: planData.caloriesMacros })
    );
    expect(res.success).toBe(true);
  });
});
