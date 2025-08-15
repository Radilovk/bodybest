import { jest } from '@jest/globals';
import { processPendingUserEvents } from '../../worker.js';

  describe('processPendingUserEvents', () => {
    test('processes testResult event', async () => {
      const store = {
        events_queue: JSON.stringify([{ key: 'event_testResult_u1_1', type: 'testResult', userId: 'u1', createdTimestamp: 1 }]),
        event_testResult_u1_1: JSON.stringify({ value: 5 })
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); })
        }
      };
      const ctx = { waitUntil: jest.fn() };
      await processPendingUserEvents(env, ctx, 5);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
      expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
      expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_testResult_u1_1');
      expect(JSON.parse(store.events_queue)).toHaveLength(0);
    });
  });
