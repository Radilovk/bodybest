import { jest } from '@jest/globals';
import { createUserEvent, processPendingUserEvents, setPlanStatus } from '../worker.js';

describe('интегритет на индекси и опашки', () => {
  describe('events_queue', () => {
    test('паралелно добавяне на дублирани събития не създава повторения', async () => {
      const store = { events_queue: JSON.stringify([]) };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); })
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
      const queue = JSON.parse(store.events_queue);
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ type: 'planMod', userId: 'u1' });
    });

    test('едновременен enqueue и dequeue поддържат опашката активна', async () => {
      const store = {
        events_queue: JSON.stringify([{ key: 'event_test_u1', type: 'testResult', userId: 'u1' }]),
        event_test_u1: JSON.stringify({ type: 'testResult', userId: 'u1', createdTimestamp: 1, payload: {} })
      };
      const env = {
        USER_METADATA_KV: {
          get: jest.fn(key => Promise.resolve(store[key])),
          put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); }),
          delete: jest.fn(key => { delete store[key]; return Promise.resolve(); })
        }
      };
      const ctx = { waitUntil: jest.fn() };
      await Promise.all([
        createUserEvent('planMod', 'u1', { v: 2 }, env),
        processPendingUserEvents(env, ctx, 1)
      ]);
      const queue = JSON.parse(store.events_queue);
      expect(queue).toHaveLength(1);
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

