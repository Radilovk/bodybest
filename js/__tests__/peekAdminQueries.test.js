import { jest } from '@jest/globals';
import { handleGetAdminQueriesRequest } from '../../worker.js';

describe('handleGetAdminQueriesRequest peek behavior', () => {
  test('peek=true returns unread query without marking as read', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn().mockResolvedValue(JSON.stringify([{ message: 'q', read: false }])),
        put: jest.fn()
      }
    };
    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleGetAdminQueriesRequest(request, env, true);
    expect(res.success).toBe(true);
    expect(res.queries[0].read).toBe(false);
    expect(env.USER_METADATA_KV.put).not.toHaveBeenCalled();
  });

  test('peek=false marks query as read', async () => {
    const env = {
      USER_METADATA_KV: {
        get: jest.fn().mockResolvedValue(JSON.stringify([{ message: 'q', read: false }])),
        put: jest.fn()
      }
    };
    const request = { url: 'https://example.com?userId=u1' };
    const res = await handleGetAdminQueriesRequest(request, env, false);
    expect(res.success).toBe(true);
    expect(res.queries[0].read).toBe(true);
    expect(env.USER_METADATA_KV.put).toHaveBeenCalledWith('u1_admin_queries', JSON.stringify([{ message: 'q', read: true }]));
  });
});
