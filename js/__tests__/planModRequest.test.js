import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../worker.js', async () => {
  const original = await import('../../worker.js');
  return { ...original, processSingleUserPlan: jest.fn().mockResolvedValue() };
});

const { processPendingUserEvents } = await import('../../worker.js');

  describe('processPendingUserEvents - planMod', () => {
    test('processes planMod event', async () => {
      const store = {
        event_planMod_u1_1: JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: {} }),
        planMod_pending_u1: '1'
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); }),
          list: jest.fn(() => Promise.resolve({
            keys: Object.keys(store).filter(k => k.startsWith('event_')).map(name => ({ name })),
            list_complete: true
          }))
        }
      };
      const ctx = { waitUntil: jest.fn() };
      const count = await processPendingUserEvents(env, ctx, 5);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
      expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_planMod_u1_1');
      expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('planMod_pending_u1');
      expect(count).toBe(1);
      expect(store.planMod_pending_u1).toBeUndefined();
    });

    test('processes two planMod events for same user', async () => {
      const store = {
        event_planMod_u1_1: JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 1, payload: { a: 1 } }),
        event_planMod_u1_2: JSON.stringify({ type: 'planMod', userId: 'u1', createdTimestamp: 2, payload: { b: 2 } }),
        planMod_pending_u1: '1'
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); }),
          list: jest.fn(() => Promise.resolve({
            keys: Object.keys(store).filter(k => k.startsWith('event_')).map(name => ({ name })),
            list_complete: true
          }))
        }
      };
      const ctx = { waitUntil: jest.fn() };
      const count = await processPendingUserEvents(env, ctx, 5);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
      expect(env.USER_METADATA_KV.delete.mock.calls[0][0]).toBe('event_planMod_u1_1');
      expect(env.USER_METADATA_KV.delete.mock.calls[1][0]).toBe('planMod_pending_u1');
      expect(env.USER_METADATA_KV.delete.mock.calls[2][0]).toBe('event_planMod_u1_2');
      expect(env.USER_METADATA_KV.delete.mock.calls[3][0]).toBe('planMod_pending_u1');
      expect(count).toBe(2);
      expect(store.planMod_pending_u1).toBeUndefined();
    });
  });
