import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../worker.js', async () => {
  const original = await import('../../worker.js');
  return { ...original, processSingleUserPlan: jest.fn().mockResolvedValue() };
});

const { processPendingUserEvents } = await import('../../worker.js');

  describe('processPendingUserEvents', () => {
    test('processes testResult event', async () => {
      const store = {
        event_testResult_u1_1: JSON.stringify({ type: 'testResult', userId: 'u1', createdTimestamp: 1, payload: { value: 5 } })
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
      await processPendingUserEvents(env, ctx, 5);
      expect(ctx.waitUntil).toHaveBeenCalled();
      expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
      expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_testResult_u1_1');
    });
  });
