import { jest } from '@jest/globals';
import { handleRegeneratePlanRequest } from '../../worker.js';

describe('handleRegeneratePlanRequest', () => {
  test('записва priorityGuidance и reason и стартира генерирането', async () => {
    const env = {
      USER_METADATA_KV: {
        put: jest.fn(),
        get: jest.fn(async key => (key === 'u1_initial_answers' ? '{"x":1}' : null))
      },
      RESOURCES_KV: { get: jest.fn(async () => 'model') },
      GEMINI_API_KEY: 'key'
    };
    const ctx = { waitUntil: jest.fn() };
    const mockProcessor = jest.fn().mockResolvedValue();
    const request = { json: async () => ({ userId: 'u1', priorityGuidance: 'повече протеин', reason: 'нова цел' }) };
    const res = await handleRegeneratePlanRequest(request, env, ctx, mockProcessor);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('pending_plan_mod_u1', 'повече протеин');
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('regen_reason_u1', 'нова цел');
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('plan_status_u1', 'processing', { metadata: { status: 'processing' } });
    expect(ctx.waitUntil).toHaveBeenCalled();
    expect(mockProcessor).toHaveBeenCalledWith('u1', env, 'повече протеин', 'нова цел');
    expect(res.success).toBe(true);
  });

  test('връща грешка при липсващ reason', async () => {
    const env = { USER_METADATA_KV: { put: jest.fn() } };
    const request = { json: async () => ({ userId: 'u1', reason: '' }) };
    const res = await handleRegeneratePlanRequest(request, env, null, jest.fn());
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalled();
  });
});
