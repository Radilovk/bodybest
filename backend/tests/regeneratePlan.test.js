import { jest } from '@jest/globals';
import { handleRegeneratePlanRequest } from '../../worker.js';

describe('POST /api/regeneratePlan', () => {
  test('стартира генерирането само с userId', async () => {
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
    const request = { json: async () => ({ userId: 'u1' }) };
    const res = await handleRegeneratePlanRequest(request, env, ctx, mockProcessor);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('plan_status_u1', 'processing', { metadata: { status: 'processing' } });
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalledWith('pending_plan_mod_u1', expect.anything());
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalledWith('regen_reason_u1', expect.anything());
    // Execution is now synchronous to avoid waitUntil timeout issues
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(mockProcessor).toHaveBeenCalledWith('u1', env);
    expect(mockProcessor.mock.calls[0].length).toBe(2);
    expect(res.success).toBe(true);
    expect(res.message).toBe('Генерирането на нов план завърши.');
  });

  test('връща грешка при липсващ userId', async () => {
    const env = { USER_METADATA_KV: { put: jest.fn() } };
    const request = { json: async () => ({}) };
    const res = await handleRegeneratePlanRequest(request, env, null, jest.fn());
    expect(res.success).toBe(false);
    expect(res.statusHint).toBe(400);
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalled();
  });

  test('връща грешка при липсващи prerequisites', async () => {
    const env = {
      USER_METADATA_KV: {
        put: jest.fn(),
        get: jest.fn(async () => null)
      },
      RESOURCES_KV: { get: jest.fn(async () => 'model') },
      GEMINI_API_KEY: 'key'
    };
    const request = { json: async () => ({ userId: 'u1' }) };
    const res = await handleRegeneratePlanRequest(request, env, null, jest.fn());
    expect(res.success).toBe(false);
    expect(res.message).toBe('Липсват първоначални отговори.');
    expect(res.precheck).toBeUndefined();
    expect(res.statusHint).toBe(400);
  });
});
