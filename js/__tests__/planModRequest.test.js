import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

describe('processPendingPlanModRequests', () => {
  test('processes pending requests', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'u1_pending_plan_modification_request' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ status: 'pending' })),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await worker.processPendingPlanModRequests(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
    expect(count).toBe(1);
  });
});
