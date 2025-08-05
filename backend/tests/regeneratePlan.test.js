import { jest } from '@jest/globals';
import { handleRegeneratePlanRequest } from '../../worker.js';

describe('POST /api/regeneratePlan', () => {
  test('предава priorityGuidance към процесора', async () => {
    const env = {
      USER_METADATA_KV: {
        put: jest.fn(),
        get: jest.fn(key => (key === 'u1_initial_answers' ? '{"q":"a"}' : null))
      },
      RESOURCES_KV: {
        get: jest.fn(key => {
          if (key === 'model_plan_generation') return 'model';
          if (key === 'prompt_unified_plan_generation_v2') return 'prompt';
          return null;
        })
      },
      GEMINI_API_KEY: 'key'
    };
    const ctx = { waitUntil: jest.fn() };
    const mockProcessor = jest.fn().mockResolvedValue();
    const request = { json: async () => ({ userId: 'u1', priorityGuidance: 'повече протеин' }) };
    const res = await handleRegeneratePlanRequest(request, env, ctx, mockProcessor);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('plan_status_u1', 'processing', { metadata: { status: 'processing' } });
    expect(ctx.waitUntil).toHaveBeenCalled();
    expect(mockProcessor).toHaveBeenCalledWith('u1', env, 'повече протеин');
    expect(res.success).toBe(true);
  });
});
