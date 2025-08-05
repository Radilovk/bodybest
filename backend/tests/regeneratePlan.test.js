import { jest } from '@jest/globals';
import { handleRegeneratePlanRequest } from '../../worker.js';

describe('POST /api/regeneratePlan', () => {
  test('предава priorityGuidance към процесора', async () => {
    const env = { USER_METADATA_KV: { put: jest.fn() } };
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
