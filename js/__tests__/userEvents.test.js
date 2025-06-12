import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

describe('processPendingUserEvents', () => {
  test('handles plan modification events', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u1' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ status: 'pending' })),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await worker.processPendingUserEvents(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
    expect(count).toBe(1);
  });
});
