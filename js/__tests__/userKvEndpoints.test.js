/** @jest-environment node */
import { jest } from '@jest/globals';
import {
  handleListUserKvRequest,
  handleUpdateKvRequest,
  rebuildUserKvIndex
} from '../../worker.js';

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
  const res = await handleListUserKvRequest(req, env);
  expect(list).toHaveBeenCalledWith({
    prefix: 'user1_',
    cursor: 'abc',
    limit: 2
  });
  expect(res).toEqual({
    success: true,
    kv: { user1_a: '1', user1_b: '2' },
    cursor: 'next-c',
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
  const res = await handleListUserKvRequest(req, env);
  expect(list).not.toHaveBeenCalled();
  expect(res).toEqual({ success: true, kv: { user1_a: '1' }, listComplete: true });
});

test('updates KV entry', async () => {
  const put = jest.fn();
  const env = { USER_METADATA_KV: { put } };
  const req = new Request('https://example.com/api/updateKv', {
    method: 'POST',
    body: JSON.stringify({ key: 'user1_c', value: '3' })
  });
  const res = await handleUpdateKvRequest(req, env);
  expect(put).toHaveBeenCalledWith('user1_c', '3');
  expect(res.success).toBe(true);
});

test('rebuilds KV index for user', async () => {
  const list = jest.fn().mockResolvedValue({
    keys: [{ name: 'user2_a' }],
    list_complete: true
  });
  const get = jest.fn().mockResolvedValue('5');
  const put = jest.fn();
  const env = { USER_METADATA_KV: { list, get, put } };
  await rebuildUserKvIndex('user2', env);
  expect(list).toHaveBeenCalledWith({ prefix: 'user2_' });
  expect(put).toHaveBeenCalledWith(
    'user2_kv_index',
    JSON.stringify({ user2_a: '5' })
  );
});
