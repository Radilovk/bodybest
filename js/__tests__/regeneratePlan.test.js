import { jest } from '@jest/globals';
import { handleRegeneratePlanRequest } from '../../worker.js';

describe('handleRegeneratePlanRequest', () => {
  test('starts plan regeneration', async () => {
    const env = { USER_METADATA_KV: { put: jest.fn() } };
    const ctx = { waitUntil: jest.fn() };
    const mockProcessor = jest.fn().mockResolvedValue();
    const request = { json: async () => ({ userId: 'u1' }) };
    const res = await handleRegeneratePlanRequest(request, env, ctx, mockProcessor);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('plan_status_u1', 'processing', { metadata: { status: 'processing' } });
    expect(ctx.waitUntil).toHaveBeenCalled();
    expect(mockProcessor).toHaveBeenCalledWith('u1', env);
    expect(res.success).toBe(true);
  });
});
