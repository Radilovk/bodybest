import { jest } from '@jest/globals';
import { createUserEvent } from '../../worker.js';

describe('createUserEvent - planMod', () => {
  test('sets status to pending when request accepted', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [] }),
        get: jest.fn(),
        put: jest.fn()
      }
    };
    const res = await createUserEvent('planMod', 'u1', {}, env);
    expect(res.success).toBe(true);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^event_planMod_u1_/),
      expect.any(String)
    );
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith(
      'plan_status_u1',
      'pending',
      { metadata: { status: 'pending' } }
    );
  });

  test('does not change status when duplicate exists', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_planMod_u1_1' }] }),
        get: jest.fn().mockResolvedValue('{"status":"pending"}'),
        put: jest.fn()
      }
    };
    const res = await createUserEvent('planMod', 'u1', {}, env);
    expect(res.success).toBe(false);
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalledWith(
      'plan_status_u1',
      'pending',
      expect.anything()
    );
  });
});
