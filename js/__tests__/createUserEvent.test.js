import { jest } from '@jest/globals';
import { createUserEvent } from '../../worker.js';

describe('createUserEvent planMod status', () => {
  test('sets status to pending when no existing request', async () => {
    const store = {
      events_queue: JSON.stringify([]),
      pending_plan_users: JSON.stringify([]),
      ready_plan_users: JSON.stringify([])
    };
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); })
      }
    };
    const res = await createUserEvent('planMod', 'u1', { change: 'something' }, env);
    expect(res.success).toBe(true);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^event_planMod_u1_/), expect.any(String)
    );
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'pending_plan_mod_u1', JSON.stringify({ change: 'something' })
    );
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'planMod_pending_u1', '1', { expirationTtl: expect.any(Number) }
    );
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'plan_status_u1', 'pending', { metadata: { status: 'pending' } }
    );
    const queue = JSON.parse(store.events_queue);
    expect(queue[0]).toMatchObject({ type: 'planMod', userId: 'u1' });
  });

  test('does not update status when request already pending', async () => {
    const store = {
      events_queue: JSON.stringify([]),
      planMod_pending_u1: '1'
    };
    const env = {
      USER_METADATA_KV: {
        get: jest.fn(key => Promise.resolve(store[key])),
        put: jest.fn((key, val) => { store[key] = val; return Promise.resolve(); })
      }
    };
    const res = await createUserEvent('planMod', 'u1', { change: 'again' }, env);
    expect(res.success).toBe(false);
    const statusCalls = env.USER_METADATA_KV.put.mock.calls.filter(c => c[0] === 'plan_status_u1');
    expect(statusCalls.length).toBe(0);
    const eventCalls = env.USER_METADATA_KV.put.mock.calls.filter(c => /^event_planMod_u1_/.test(c[0]));
    expect(eventCalls.length).toBe(0);
    expect(store.events_queue).toBe(JSON.stringify([]));
  });
});

