import { jest } from '@jest/globals';
import { processPendingUserEvents } from '../../worker.js';

describe('processPendingUserEvents', () => {
  test('processes testResult event', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_testResult_u1_1' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ type: 'testResult', userId: 'u1', createdTimestamp: 1, payload: { value: 5 } })),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    await processPendingUserEvents(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalled();
    expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_testResult_u1_1');
  });

  test('processes updateProfile event', async () => {
    const env = {
      USER_METADATA_KV: {
        list: jest.fn().mockResolvedValue({ keys: [{ name: 'event_updateProfile_u1_1' }] }),
        get: jest.fn().mockResolvedValue(JSON.stringify({ type: 'updateProfile', userId: 'u1', createdTimestamp: 1, payload: {} })),
        delete: jest.fn(),
        put: jest.fn()
      }
    };
    const ctx = { waitUntil: jest.fn() };
    await processPendingUserEvents(env, ctx, 5);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    expect(env.USER_METADATA_KV.delete).toHaveBeenCalledWith('event_updateProfile_u1_1');
  });
});
