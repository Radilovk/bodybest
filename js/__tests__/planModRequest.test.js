import { jest } from '@jest/globals';
import { processPendingUserEvents } from '../../worker.js';

  describe('processPendingUserEvents - planMod', () => {
    test('processes planMod event', async () => {
      const store = {
        events_queue: JSON.stringify([{ key: 'event_planMod_u1_1', type: 'planMod', userId: 'u1' }]),
        event_planMod_u1_1: JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: {} })
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); })
        }
      };
      const ctx = { waitUntil: jest.fn() };
      const count = await processPendingUserEvents(env, ctx, 5);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
      expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_planMod_u1_1');
      expect(count).toBe(1);
      expect(JSON.parse(store.events_queue)).toHaveLength(0);
    });

    test('processes two planMod events for same user', async () => {
      const store = {
        events_queue: JSON.stringify([
          { key: 'event_planMod_u1_1', type: 'planMod', userId: 'u1' },
          { key: 'event_planMod_u1_2', type: 'planMod', userId: 'u1' }
        ]),
        event_planMod_u1_1: JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: { a: 1 } }),
        event_planMod_u1_2: JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 2, payload: { b: 2 } })
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); })
        }
      };
      const ctx = { waitUntil: jest.fn() };
      const count = await processPendingUserEvents(env, ctx, 5);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
      expect(env.USER_METADATA_KV.delete.mock.calls[0][0]).toBe('event_planMod_u1_1');
      expect(env.USER_METADATA_KV.delete.mock.calls[1][0]).toBe('event_planMod_u1_2');
      expect(count).toBe(2);
      expect(JSON.parse(store.events_queue)).toHaveLength(0);
    });
  });
