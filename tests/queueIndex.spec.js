import { jest } from '@jest/globals';

await jest.unstable_mockModule('../worker.js', async () => {
  const original = await import('../worker.js');
  return { ...original, processSingleUserPlan: jest.fn().mockResolvedValue() };
});

const { createUserEvent, processPendingUserEvents, setPlanStatus } = await import('../worker.js');

describe('интегритет на индекси и опашки', () => {
  describe('events', () => {
    test('паралелно добавяне на дублирани събития не създава повторения', async () => {
      const store = {};
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); }),
          list: jest.fn(({ prefix }) => Promise.resolve({
            keys: Object.keys(store).filter(k => k.startsWith(prefix)).map(name => ({ name })),
            list_complete: true
          }))
        }
      };
      const fixedTime = 1700000000000;
      const originalNow = Date.now;
      global.Date.now = jest.fn(() => fixedTime);
      await Promise.all([
        createUserEvent('planMod', 'u1', { v: 1 }, env),
        createUserEvent('planMod', 'u1', { v: 1 }, env)
      ]);
      global.Date.now = originalNow;
      const list = await env.USER_METADATA_KV.list({ prefix: 'event_planMod_u1' });
      expect(list.keys).toHaveLength(1);
    });

    test('едновременен enqueue и dequeue поддържат опашката активна', async () => {
      const store = {
        event_test_u1: JSON.stringify({ type: 'testResult', userId: 'u1', createdTimestamp: 1, payload: {} })
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); }),
          list: jest.fn(({ prefix }) => Promise.resolve({
            keys: Object.keys(store).filter(k => k.startsWith(prefix)).map(name => ({ name })),
            list_complete: true
          }))
        }
      };
      const ctx = { waitUntil: jest.fn() };
      await Promise.all([
        createUserEvent('planMod', 'u1', { v: 2 }, env),
        processPendingUserEvents(env, ctx, 1)
      ]);
      const list = await env.USER_METADATA_KV.list({ prefix: 'event_' });
      expect(list.keys).toHaveLength(1);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    });
  });

  describe('plan user arrays', () => {
    test('дублирани setPlanStatus не добавят повторения', async () => {
      const store = { pending_plan_users: JSON.stringify([]), ready_plan_users: JSON.stringify([]) };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          list: jest.fn(() => Promise.resolve({ keys: [] }))
        }
      };
      await Promise.all([
        setPlanStatus('u1', 'pending', env),
        setPlanStatus('u1', 'pending', env)
      ]);
      expect(JSON.parse(store.pending_plan_users)).toEqual(['u1']);
      expect(JSON.parse(store.ready_plan_users)).toEqual([]);
    });

    test('паралелно изтриване не блокира индексите', async () => {
      const store = { pending_plan_users: JSON.stringify(['u1']), ready_plan_users: JSON.stringify([]) };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          list: jest.fn(() => Promise.resolve({ keys: [] }))
        }
      };
      await Promise.all([
        setPlanStatus('u1', 'processing', env),
        setPlanStatus('u1', 'processing', env)
      ]);
      expect(JSON.parse(store.pending_plan_users)).toEqual([]);
      expect(JSON.parse(store.ready_plan_users)).toEqual([]);
    });
  });
});

