import { jest } from '@jest/globals';
import { createUserEvent } from '../../worker.js';

describe('createUserEvent planMod status', () => {
  test('sets status to pending when no existing request', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [] }),
        get: jest.fn(),
        put: jest.fn()
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
      'plan_status_u1', 'pending', { metadata: { status: 'pending' } }
    );
  });

  test('does not update status when request already pending', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u1_old' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ status: 'pending' })),
        put: jest.fn()
      }
    };
    const res = await createUserEvent('planMod', 'u1', { change: 'again' }, env);
    expect(res.success).toBe(false);
    const statusCalls = env.USER_METADATA_KV.put.mock.calls.filter(c => c[0] === 'plan_status_u1');
    expect(statusCalls.length).toBe(0);
  });
});

describe('createUserEvent updateProfile', () => {
  test('sets plan status to pending', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [] }),
        get: jest.fn(),
        put: jest.fn()
      }
    };
    const res = await createUserEvent('updateProfile', 'u1', { name: 'a' }, env);
    expect(res.success).toBe(true);
    const statusCall = env.USER_METADATA_KV.put.mock.calls.find(c => c[0] === 'plan_status_u1');
    expect(statusCall).toBeTruthy();
  });

  test('returns false when event already pending', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_updateProfile_u1_old' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ status: 'pending' })),
        put: jest.fn()
      }
    };
    const res = await createUserEvent('updateProfile', 'u1', { n: 1 }, env);
    expect(res.success).toBe(false);
    const statusCalls = env.USER_METADATA_KV.put.mock.calls.filter(c => c[0] === 'plan_status_u1');
    expect(statusCalls.length).toBe(0);
  });
});
