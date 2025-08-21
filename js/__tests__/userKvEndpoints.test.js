/** @jest-environment node */
import { jest } from '@jest/globals';
import * as worker from '../../worker.js';

test('lists user KV entries with pagination', async () => {
  const list = jest.fn().mockResolvedValue({
    keys: [{ name: 'user1_a' }, { name: 'user1_b' }],
    cursor: 'next-c',
    list_complete: false
  });
  const get = jest
    .fn()
    .mockImplementation(async key => (key === 'user1_a' ? '1' : '2'));
  const env = { USER_METADATA_KV: { list, get, put: jest.fn() } };
  const req = new Request(
    'https://example.com/api/listUserKv?userId=user1&cursor=abc&limit=2'
  );
  const res = await worker.handleListUserKvRequest(req, env);
  expect(list).toHaveBeenCalledWith({
    prefix: 'user1_',
    cursor: 'abc',
    limit: 2
  });
  expect(res).toEqual({
    success: true,
    kv: { user1_a: '1', user1_b: '2' },
    nextCursor: 'next-c',
    listComplete: false
  });
});

test('returns cached index when available', async () => {
  const list = jest.fn();
  const get = jest.fn().mockResolvedValueOnce(
    JSON.stringify({ user1_a: '1' })
  );
  const env = { USER_METADATA_KV: { list, get, put: jest.fn() } };
  const req = new Request('https://example.com/api/listUserKv?userId=user1');
  const res = await worker.handleListUserKvRequest(req, env);
  expect(list).not.toHaveBeenCalled();
  expect(res).toEqual({ success: true, kv: { user1_a: '1' }, listComplete: true, nextCursor: null });
});

test('updates KV entry and rebuilds index', async () => {
  const put = jest.fn();
  const list = jest
    .fn()
    .mockResolvedValue({ keys: [{ name: 'user1_c' }], list_complete: true });
  const get = jest.fn().mockResolvedValue('3');
  const env = { USER_METADATA_KV: { put, list, get } };
  const req = new Request('https://example.com/api/updateKv', {
    method: 'POST',
    body: JSON.stringify({ key: 'user1_c', value: '3' })
  });
  const res = await worker.handleUpdateKvRequest(req, env);
  expect(put).toHaveBeenNthCalledWith(1, 'user1_c', '3');
  expect(put).toHaveBeenNthCalledWith(
    2,
    'user1_kv_index',
    JSON.stringify({ user1_c: '3' })
  );
  expect(res.success).toBe(true);
});

test('rejects update when key lacks required prefix', async () => {
  const put = jest.fn();
  const env = { USER_METADATA_KV: { put, list: jest.fn(), get: jest.fn() } };
  const req = new Request('https://example.com/api/updateKv', {
    method: 'POST',
    body: JSON.stringify({ key: 'kv_only', value: 'v', userId: 'user3' })
  });
  const res = await worker.handleUpdateKvRequest(req, env);
  expect(res.success).toBe(false);
  expect(res.message).toMatch(/prefix/i);
  expect(put).not.toHaveBeenCalled();
});

test('rejects update when key prefix mismatches userId', async () => {
  const put = jest.fn();
  const env = { USER_METADATA_KV: { put, list: jest.fn(), get: jest.fn() } };
  const req = new Request('https://example.com/api/updateKv', {
    method: 'POST',
    body: JSON.stringify({ key: 'user4_kv', value: 'v', userId: 'user3' })
  });
  const res = await worker.handleUpdateKvRequest(req, env);
  expect(res.success).toBe(false);
  expect(res.message).toMatch(/prefix/i);
  expect(put).not.toHaveBeenCalled();
});

test('rebuilds KV index for user', async () => {
  const list = jest.fn().mockResolvedValue({
    keys: [{ name: 'user2_a' }],
    list_complete: true
  });
  const get = jest.fn().mockResolvedValue('5');
  const put = jest.fn();
  const env = { USER_METADATA_KV: { list, get, put } };
  await worker.rebuildUserKvIndex('user2', env);
  expect(list).toHaveBeenCalledWith({ prefix: 'user2_' });
  expect(put).toHaveBeenCalledWith(
    'user2_kv_index',
    JSON.stringify({ user2_a: '5' })
  );
});
