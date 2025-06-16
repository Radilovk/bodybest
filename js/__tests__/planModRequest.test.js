import { jest } from '@jest/globals';
import { processPendingUserEvents } from '../../worker.js';

describe('processPendingUserEvents - planMod', () => {
  test('processes planMod event', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u1_1' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: {} })),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await processPendingUserEvents(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_planMod_u1_1');
    expect(count).toBe(1);
  });

  test('processes two planMod events for same user', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [
          { name: 'event_planMod_u1_1' },
          { name: 'event_planMod_u1_2' }
        ] }),
        get: jest.fn(key => {
          if (key === 'event_planMod_u1_1') {
            return Promise.resolve(JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: { a: 1 } }));
          }
          if (key === 'event_planMod_u1_2') {
            return Promise.resolve(JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 2, payload: { b: 2 } }));
          }
          return Promise.resolve('');
        }),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    const count = await processPendingUserEvents(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
    expect(env.USER_METADATA_KV.delete.mock.calls[0][0]).toBe('event_planMod_u1_1');
    expect(env.USER_METADATA_KV.delete.mock.calls[1][0]).toBe('event_planMod_u1_2');
    expect(count).toBe(2);
  });
});
