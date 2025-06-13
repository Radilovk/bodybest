import { jest } from '@jest/globals';
import { processPendingUserEvents } from '../../worker.js';

describe('processPendingUserEvents - planMod', () => {
  test('processes planMod event', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u1' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ type: 'planMod', userId: 'u1', payload: {} })),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await processPendingUserEvents(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_planMod_u1');
    expect(count).toBe(1);
  });
});
